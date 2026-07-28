import loggedStudent from '../../mocks/usuario-logado.json'
import studentFaq from '../../mocks/faq-aluno.json'
import { buildCaseRoutingContext, filterCasesForMockContext } from '@/services/caseRoutingRuntime'
import { getFaqPackageForRuntime } from '@/services/faqRuntime'
import { CASE_PROTOCOL_STATUSES } from '@/services/canonicalFoundationRuntime'
import {
  buildCanonicalSla,
  mapLegacyCaseStatusCode,
  parseLegacySlaMinutes,
  resolveOperationalBucket,
  resolveOperationalStatusLabel,
  shouldShowOperationalDeadline,
} from '@/services/canonicalCaseRuntime'
import {
  buildOperationalOwnerDescriptor,
  resolveOperationalOwnerFromProtocol,
} from '@/services/operationalOwnershipRuntime'
import {
  operatorQueue as seededOperatorQueue,
  operatorCaseSeeds,
  operatorCorrelationHistory,
} from '../../mocks/operations'

const PRIORITY_SCORE = {
  maxima: 5,
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
}

const CRITICALITY_SCORE = {
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
}

const STATUS_SCORE = {
  'prioridade maxima': 4,
  'aguardando acao do op': 3,
  'em validacao operacional': 2,
  'aguardando retorno da area': 1,
  'respondido pelo op': 2,
  'aguardando complementacao do aluno': 2,
  'escalado para area interna': 1,
}

const ACTION_METADATA = {
  reply: {
    title: 'Resposta registrada pelo OP',
    canonicalStatusCode: CASE_PROTOCOL_STATUSES.RESOLVED,
    pendingParty: 'none',
    closedBy: 'op',
    statusLabel: 'Respondido pelo OP',
    pendingLabel: 'Aguardando leitura do aluno no portal',
    channel: 'Portal do atendimento',
    defaultText: ({ playbook }) =>
      playbook.responseTemplate ||
      'Orientacao operacional registrada pelo OP no portal do atendimento.',
    buildDescription: ({ note }) =>
      `O OP respondeu ao aluno pelo portal institucional. ${note ? `Resumo: ${note}` : ''}`.trim(),
  },
  request_info: {
    title: 'Complementacao solicitada',
    canonicalStatusCode: CASE_PROTOCOL_STATUSES.WAITING_STUDENT,
    pendingParty: 'student',
    closedBy: '',
    statusLabel: 'Aguardando complementacao do aluno',
    pendingLabel: 'Aluno precisa complementar informacoes ou anexos',
    channel: 'Portal do atendimento',
    defaultText: ({ playbook }) => {
      const requestedDocuments = playbook.documentsRequested.join(', ')

      if (requestedDocuments) {
        return `Favor complementar o protocolo com ${requestedDocuments}.`
      }

      return 'Favor complementar o protocolo com mais detalhes para continuidade da analise.'
    },
    buildDescription: ({ note }) =>
      `O OP solicitou complementacao ao aluno antes de escalar ou encerrar o caso. ${note ? `Resumo: ${note}` : ''}`.trim(),
  },
  escalate: {
    title: 'Escalado para area interna',
    canonicalStatusCode: CASE_PROTOCOL_STATUSES.WAITING_AREA,
    pendingParty: 'area',
    closedBy: '',
    statusLabel: 'Escalado para area interna',
    pendingLabel: 'Aguardando atuacao do last mile',
    channel: 'Encaminhamento interno',
    defaultText: ({ playbook, caseEntry }) => {
      const escalationReason = playbook.escalationReason || playbook.escalationCriteria
      const targetArea = caseEntry.lastMileAreaLabel || caseEntry.queue

      if (escalationReason) {
        return `Escalonamento solicitado para ${targetArea}. Motivo: ${escalationReason}.`
      }

      return `Escalonamento solicitado para ${targetArea} com briefing operacional registrado.`
    },
    buildDescription: ({ note, playbook }) =>
      `O OP escalou o atendimento para area interna. ${note || playbook.escalationReason || playbook.escalationCriteria}`.trim(),
    queueResolver: (caseEntry) => caseEntry.lastMileAreaLabel || `Area interna - ${caseEntry.queue}`,
    assigneeResolver: (caseEntry) => caseEntry.lastMileAreaLabel || 'Area interna',
  },
}

const OPERATOR_BY_POLO = Object.freeze({
  guarulhos: 'Juliana Prado',
  campinas: 'Aline Costa',
  'sao jose dos campos': 'Diego Lopes',
})

function normalizeText(value = '') {
  return String(value).trim().toLowerCase()
}

function sanitizeObjectCollection(collection = []) {
  return Array.isArray(collection) ? collection.filter((item) => item && typeof item === 'object') : []
}

function tokenize(value = '') {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
}

function titleCase(value = '') {
  const normalized = String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return 'Nao informado'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function hasMeaningfulText(value = '') {
  return String(value || '').trim().length > 0
}

function pickFirstText(...values) {
  for (const value of values) {
    if (hasMeaningfulText(value)) {
      return String(value).trim()
    }
  }

  return ''
}

function pickArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) {
      return [...value]
    }
  }

  for (const value of values) {
    if (Array.isArray(value)) {
      return [...value]
    }
  }

  return []
}

function buildTimestampParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (number) => String(number).padStart(2, '0')

  return {
    iso: date.toISOString(),
    label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
    compact: `${date.getTime()}`,
  }
}

function sortByCreatedAtDesc(left, right) {
  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
}

function buildFaqIndex(payload) {
  const nodes = payload.nodes.filter((node) => node.ativo)
  const links = payload.links.filter((link) => link.ativo)
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]))
  const parentByChild = {}

  for (const link of links) {
    parentByChild[link.child_node_id] = link.parent_node_id
  }

  return {
    nodes,
    leafNodes: nodes.filter((node) => node.node_kind === 'leaf'),
    nodeById,
    parentByChild,
  }
}

const studentFaqIndex = buildFaqIndex(studentFaq)

function findBestFaqLeaf(index, theme, subtheme) {
  const themeKey = normalizeText(theme)
  const subthemeKey = normalizeText(subtheme)

  const exact = index.leafNodes.find(
    (node) =>
      normalizeText(node.tema) === themeKey && normalizeText(node.subtema) === subthemeKey,
  )

  if (exact) {
    return exact
  }

  return (
    index.leafNodes
      .filter((node) => normalizeText(node.tema) === themeKey)
      .sort((left, right) => (right.prioridade_dinamica || 0) - (left.prioridade_dinamica || 0))[0] ||
    null
  )
}

function buildFaqPath(index, nodeId) {
  const path = []
  let currentNodeId = nodeId

  while (currentNodeId && index.nodeById[currentNodeId]) {
    const node = index.nodeById[currentNodeId]
    path.unshift(node)
    currentNodeId = index.parentByChild[currentNodeId]
  }

  return path
}

function buildContextFromFaqLeaf(index, node) {
  if (!node) {
    return {
      theme: 'Nao informado',
      subtheme: null,
      breadcrumb: [],
      finalNode: {
        id: null,
        title: 'Nao informado',
        nodeType: 'leaf',
      },
      displayedAnswer: '',
      action: null,
      queueDestination: null,
      criticality: null,
      sla: null,
    }
  }

  const breadcrumb = buildFaqPath(index, node.id)

  return {
    theme: node.tema,
    subtheme: node.subtema || null,
    breadcrumb: breadcrumb.map((step) => step.titulo_exibido),
    finalNode: {
      id: node.id,
      title: node.titulo_exibido,
      nodeType: node.node_kind || 'leaf',
    },
    displayedAnswer: node.resposta || '',
    action: node.acao || null,
    queueDestination: node.fila_destino || null,
    criticality: node.criticidade_padrao || null,
    sla: node.sla_padrao || null,
  }
}

function formatCriticalityLabel(criticality) {
  const normalized = normalizeText(criticality)

  if (!normalized) {
    return 'Media'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildPriorityLabel(criticality, fallback = '') {
  const normalizedFallback = normalizeText(fallback)

  if (normalizedFallback) {
    return titleCase(fallback)
  }

  const normalizedCriticality = normalizeText(criticality)

  if (normalizedCriticality === 'critica') {
    return 'Maxima'
  }

  if (normalizedCriticality === 'alta') {
    return 'Alta'
  }

  if (normalizedCriticality === 'baixa') {
    return 'Baixa'
  }

  return 'Media'
}

function buildSortTokens({ priority, criticality, status, activityAt, source, sla }) {
  const slaMinutes = typeof sla === 'number' ? sla : parseLegacySlaMinutes(sla)
  return {
    priorityScore: PRIORITY_SCORE[normalizeText(priority)] || 0,
    criticalityScore: CRITICALITY_SCORE[normalizeText(criticality)] || 0,
    statusScore: STATUS_SCORE[normalizeText(status)] || 0,
    sourceScore: source === 'portal_aluno' ? 2 : 1,
    activityAtScore: activityAt ? new Date(activityAt).getTime() : 0,
    slaMinutes,
  }
}

function hasStructuredStudentData(value = null) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      [value.nome, value.email, value.ra, value.curso, value.polo].some(hasMeaningfulText),
  )
}

function isSlaAtRisk(sla, slaState = '') {
  const normalizedState = normalizeText(slaState)

  if (normalizedState === 'at_risk' || normalizedState === 'overdue') {
    return true
  }

  const normalized = normalizeText(sla)

  return normalized.includes('min') || normalized.includes('restante') || normalized.includes('4h')
}

function matchesFilter(filterValue, currentValue) {
  if (!filterValue || filterValue === 'todos') {
    return true
  }

  return normalizeText(filterValue) === normalizeText(currentValue)
}

function matchesQuery(query = '', ...values) {
  const terms = tokenize(query)

  if (!terms.length) {
    return true
  }

  const haystack = tokenize(values.filter(Boolean).join(' '))

  return terms.every((term) => haystack.some((part) => part.includes(term)))
}

function buildFilterOptions(entries, field) {
  return [
    { value: 'todos', label: 'Todos' },
    ...Array.from(new Set(entries.map((entry) => entry[field]).filter(Boolean))).map((value) => ({
      value,
      label: value,
    })),
  ]
}

function resolveSourceLabel(source = '') {
  const normalized = normalizeText(source)

  if (normalized === 'portal_aluno') {
    return 'Portal do aluno'
  }

  if (normalized === 'operador_polo') {
    return 'Atendimento pelo OP'
  }

  return 'Base operacional'
}

export function resolveQueueBucket(entry = {}) {
  if (entry.statusCode) {
    return resolveOperationalBucket(entry)
  }

  const status = normalizeText(entry.status)
  const pending = normalizeText(entry.pendingLabel)

  if (
    status.includes('faq') ||
    status.includes('respondido pelo op') ||
    status.includes('concluido pela area') ||
    status.includes('conclu')
  ) {
    return 'completed'
  }

  if (status.includes('respondido pela area') || status.includes('complementacao solicitada pela area')) {
    return 'needs_action'
  }

  if (status.includes('reencaminhado')) {
    return 'waiting_area'
  }

  if (
    status.includes('complement') ||
    pending.includes('complement') ||
    pending.includes('anexo') ||
    pending.includes('aluno precisa')
  ) {
    return 'waiting_student'
  }

  if (
    status.includes('retorno da area') ||
    status.includes('escalado') ||
    pending.includes('secretaria') ||
    pending.includes('area')
  ) {
    return 'waiting_area'
  }

  return 'needs_action'
}

export function resolveOperationalStatus(entry = {}) {
  if (entry.statusCode) {
    return resolveOperationalStatusLabel(entry)
  }

  const status = normalizeText(entry.status)
  const bucket = resolveQueueBucket(entry)
  const sla = normalizeText(entry.sla)

  if (status.includes('respondido pela area')) {
    return 'Resposta da area'
  }

  if (status.includes('complementacao solicitada pela area')) {
    return 'Area pediu complemento'
  }

  if (status.includes('reencaminhado')) {
    return 'Reencaminhado'
  }

  if (status.includes('concluido pela area')) {
    return 'Concluido pela area'
  }

  if (status.includes('faq')) {
    return 'Respondido FAQ'
  }

  if (status.includes('respondido') || status.includes('leitura do aluno')) {
    return 'Respondido OP'
  }

  if (sla.includes('vencid')) {
    return 'Atrasado'
  }

  if (bucket === 'waiting_student') {
    return 'Aguardando aluno'
  }

  if (bucket === 'waiting_area') {
    return 'Aguardando area'
  }

  if (status.includes('prioridade maxima') || entry.slaState === 'Em risco') {
    return 'Urgente'
  }

  if (status.includes('validacao')) {
    return 'Em andamento'
  }

  return 'Pendente'
}

export function shouldShowResponseDeadline(entry = {}) {
  if (entry.statusCode) {
    return shouldShowOperationalDeadline(entry)
  }

  return resolveQueueBucket(entry) !== 'waiting_student' && !normalizeText(entry.status).includes('reencaminhado')
}

function resolveAssignedOperatorName({
  assignedOperator = '',
  polo = '',
  queue = '',
  routing = null,
} = {}) {
  if (assignedOperator) {
    return assignedOperator
  }

  const currentQueue = normalizeText(queue || routing?.currentQueueLabel)
  if (currentQueue === normalizeText('Triagem Central')) {
    return 'Triagem Central'
  }

  return OPERATOR_BY_POLO[normalizeText(polo)] || 'Operacao do polo'
}

function buildPriorityReasonLabel({
  status = '',
  pendingLabel = '',
  sla = '',
  criticality = '',
} = {}) {
  const normalizedStatus = normalizeText(status)
  const normalizedPending = normalizeText(pendingLabel)
  const normalizedCriticality = normalizeText(criticality)

  if (isSlaAtRisk(sla)) {
    return 'SLA em risco'
  }

  if (normalizedStatus.includes('acao do op')) {
    return 'Aguardando acao do OP'
  }

  if (normalizedStatus.includes('complementacao') || normalizedPending.includes('complement')) {
    return 'Complementacao pendente'
  }

  if (normalizedStatus.includes('escalado') || normalizedPending.includes('area')) {
    return 'Handoff para area interna'
  }

  if (normalizedCriticality === 'critica' || normalizedCriticality === 'alta') {
    return 'Criticidade alta'
  }

  return 'Fila ativa'
}

function buildSlaStateLabel(sla = '') {
  const normalized = normalizeText(sla)

  if (!normalized || normalized.includes('encerrad')) {
    return 'Encerrado'
  }

  return isSlaAtRisk(sla) ? 'Em risco' : 'No prazo'
}

function buildPendingFacetLabel({ status = '', pendingLabel = '' } = {}) {
  const normalizedStatus = normalizeText(status)
  const normalizedPending = normalizeText(pendingLabel)

  if (normalizedStatus.includes('respondido pela area')) {
    return 'Aguardando acao do OP'
  }

  if (normalizedStatus.includes('complementacao solicitada pela area')) {
    return 'Complementacao pendente'
  }

  if (normalizedStatus.includes('faq') || normalizedStatus.includes('conclu') || normalizedStatus.includes('respondido')) {
    return 'Concluidos'
  }

  if (normalizedStatus.includes('acao do op')) {
    return 'Aguardando acao do OP'
  }

  if (normalizedStatus.includes('complementacao') || normalizedPending.includes('complement')) {
    return 'Complementacao pendente'
  }

  if (normalizedStatus.includes('respondido')) {
    return 'Resposta registrada'
  }

  if (normalizedStatus.includes('escalado') || normalizedPending.includes('area')) {
    return 'Aguardando area interna'
  }

  return 'Em leitura operacional'
}

function buildEscalationStateLabel({ status = '', queue = '', routing = null } = {}) {
  const normalizedStatus = normalizeText(status)
  const normalizedQueue = normalizeText(queue)
  const normalizedCurrentQueue = normalizeText(routing?.currentQueueLabel)

  if (
    normalizedStatus.includes('respondido pela area') ||
    normalizedStatus.includes('complementacao solicitada pela area')
  ) {
    return 'No OP'
  }

  if (normalizedStatus.includes('escalado') || (normalizedCurrentQueue && normalizedQueue !== normalizedCurrentQueue)) {
    return 'Escalado'
  }

  if (normalizedStatus.includes('retorno da area') || normalizedStatus.includes('area interna')) {
    return 'Aguardando area'
  }

  return 'No OP'
}

function buildNextStepLabel({ status = '', pendingLabel = '', sla = '', criticality = '' } = {}) {
  const normalizedStatus = normalizeText(status)
  const normalizedPending = normalizeText(pendingLabel)
  const normalizedCriticality = normalizeText(criticality)

  if (normalizedStatus.includes('complementacao') || normalizedPending.includes('complement')) {
    return 'Conferir se o aluno ja trouxe o que falta antes de seguir.'
  }

  if (normalizedStatus.includes('retorno da area') || normalizedPending.includes('area')) {
    return 'Validar o retorno da area e devolver a orientacao ao aluno.'
  }

  if (normalizedStatus.includes('escalado')) {
    return 'Acompanhar o handoff e aguardar a devolutiva da area interna.'
  }

  if (isSlaAtRisk(sla) || normalizedCriticality === 'critica') {
    return 'Priorizar a leitura e registrar a decisao agora.'
  }

  return 'Validar a tratativa e registrar a proxima decisao.'
}

function buildPendingFacetFromCanonical(caseProtocol = {}) {
  if (caseProtocol.closedBy || ['resolved', 'closed'].includes(caseProtocol.statusCode)) {
    return 'Concluidos'
  }

  if (caseProtocol.latestAreaActionType === 'request_complement' || caseProtocol.pendingParty === 'student') {
    return 'Complementacao pendente'
  }

  if (caseProtocol.pendingParty === 'area' || caseProtocol.statusCode === 'rerouted') {
    return 'Aguardando area interna'
  }

  return 'Aguardando acao do OP'
}

function buildEscalationStateFromCanonical(caseProtocol = {}) {
  if (caseProtocol.pendingParty === 'area' || caseProtocol.statusCode === 'rerouted') {
    return 'Escalado'
  }

  return 'No OP'
}

function buildNextStepFromCanonical(caseProtocol = {}) {
  if (caseProtocol.latestAreaActionType === 'request_complement') {
    return 'Reunir os subsidios pedidos pela area antes de devolver o caso.'
  }

  if (caseProtocol.latestAreaActionType === 'technical_reply') {
    return 'Traduzir a resposta tecnica da area para o aluno e registrar a devolutiva.'
  }

  if (caseProtocol.pendingParty === 'student') {
    return 'Aguardar a complementacao do aluno antes de retomar a analise.'
  }

  if (caseProtocol.pendingParty === 'area' || caseProtocol.statusCode === 'rerouted') {
    return 'Acompanhar o handoff interno e aguardar a devolutiva da area.'
  }

  if (caseProtocol.slaState === 'overdue' || caseProtocol.slaState === 'at_risk' || caseProtocol.criticalityCode === 'critica') {
    return 'Priorizar a leitura e registrar a decisao agora.'
  }

  return 'Validar a tratativa e registrar a proxima decisao.'
}

function buildPriorityReasonFromCanonical(caseProtocol = {}) {
  if (caseProtocol.slaState === 'overdue' || caseProtocol.slaState === 'at_risk') {
    return 'SLA em risco'
  }

  if (caseProtocol.pendingParty === 'area' || caseProtocol.statusCode === 'rerouted') {
    return 'Handoff para area interna'
  }

  if (caseProtocol.pendingParty === 'student') {
    return 'Complementacao pendente'
  }

  if (caseProtocol.criticalityCode === 'critica' || caseProtocol.criticalityCode === 'alta') {
    return 'Criticidade alta'
  }

  return 'Fila ativa'
}

function getCaseActionLogs(actionLogs = [], caseId) {
  return actionLogs
    .filter((log) => log.caseId === caseId)
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
}

function getCaseAreaActionLogs(areaActionLogs = [], caseId) {
  return areaActionLogs
    .filter((log) => log.caseId === caseId)
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
}

function applyActionLogsToQueueEntry(entry, actionLogs = [], areaActionLogs = []) {
  const caseLogs = getCaseActionLogs(actionLogs, entry.id)
  const latestLog = caseLogs[caseLogs.length - 1] || null
  const caseAreaLogs = getCaseAreaActionLogs(areaActionLogs, entry.id)
  const latestAreaLog = caseAreaLogs[caseAreaLogs.length - 1] || null
  const status = latestAreaLog?.statusAfter || latestLog?.statusLabel || entry.status
  const queue = latestAreaLog?.queueAfter || latestLog?.queueLabel || entry.queue
  const pending =
    latestAreaLog?.pendingLabel || latestLog?.pendingLabel || entry.pendingLabel || 'Aguardando triagem operacional'
  const activityAt = latestAreaLog?.occurredAt || latestLog?.occurredAt || entry.createdAt
  const activityAtLabel = latestAreaLog?.occurredAtLabel || latestLog?.occurredAtLabel || entry.createdAtLabel
  const priority = latestLog?.priorityLabel || entry.priority
  const criticality = latestLog?.criticalityLabel || entry.criticality
  const assignedOperator = entry.assignedOperator
  const normalizedStatus = normalizeText(status)
  const currentSla =
    (normalizedStatus.includes('respondido') && !normalizedStatus.includes('respondido pela area')) ||
    normalizedStatus.includes('faq') ||
    normalizedStatus.includes('conclu')
      ? 'Encerrado'
      : entry.sla
  const routing = latestLog?.queueLabel || latestAreaLog?.queueAfter
    ? {
        ...entry.routing,
        targetAreaLabel:
          latestAreaLog?.destinationLabel || latestLog?.destinationLabel || entry.routing?.targetAreaLabel,
      }
    : entry.routing
  const originLabel = entry.originLabel || resolveSourceLabel(entry.source)

  return {
    ...entry,
    status,
    queue,
    routing,
    pendingLabel: pending,
    activityAt,
    activityAtLabel,
    assignedOperator,
    ownerLabel:
      latestAreaLog?.assigneeLabel || latestLog?.assigneeLabel || entry.ownerLabel || assignedOperator,
    originLabel,
    sla: currentSla,
    slaState: buildSlaStateLabel(currentSla),
    pendingFacetLabel: buildPendingFacetLabel({
      status,
      pendingLabel: pending,
    }),
    escalationState: buildEscalationStateLabel({
      status,
      queue,
      routing,
    }),
    nextStepLabel: buildNextStepLabel({
      status,
      pendingLabel: pending,
      sla: currentSla,
      criticality,
    }),
    priorityReasonLabel: buildPriorityReasonLabel({
      status,
      pendingLabel: pending,
      sla: currentSla,
      criticality,
    }),
    searchText: [
      entry.id,
      entry.subject,
      entry.student,
      entry.studentRa,
      entry.polo,
      assignedOperator,
      latestLog?.assigneeLabel,
      latestAreaLog?.assigneeLabel,
      pending,
      entry.operationalOwnerLabel,
      entry.operationalOwnerStateLabel,
      entry.ownerQueue,
      entry.ownerArea,
      entry.ownerRole,
    ].join(' '),
    sortTokens: buildSortTokens({
      priority,
      criticality,
      status,
      activityAt,
      source: entry.source,
      sla: currentSla,
    }),
  }
}

function mergeCanonicalCaseProtocol(entry, canonicalCaseProtocol = null, caseKnowledgeUsages = []) {
  if (!canonicalCaseProtocol) {
    return entry
  }

  const sla = buildCanonicalSla({
    statusCode: canonicalCaseProtocol.statusCode,
    createdAt: canonicalCaseProtocol.createdAt || entry.createdAt,
    slaPolicyCode: canonicalCaseProtocol.slaPolicyCode || '',
    legacyLabel: canonicalCaseProtocol.slaLabel || entry.sla,
    legacyMinutes: canonicalCaseProtocol.slaMinutesRemaining,
  })
  const knowledgeUsages = caseKnowledgeUsages
    .filter((record) => record.caseId === entry.id)
    .sort((left, right) => new Date(left.usedAt || 0).getTime() - new Date(right.usedAt || 0).getTime())
  const ownershipDescriptor = buildOperationalOwnerDescriptor(
    canonicalCaseProtocol.operationalOwnerSnapshot || {
      ownerType: canonicalCaseProtocol.ownerType || '',
      ownerKey: canonicalCaseProtocol.ownerKey || '',
      ownerQueue: canonicalCaseProtocol.ownerQueue || '',
      ownerArea: canonicalCaseProtocol.ownerArea || '',
      ownerRole: canonicalCaseProtocol.ownerRole || '',
      routingHint: canonicalCaseProtocol.ownerRoutingHint || '',
      source: canonicalCaseProtocol.ownerSource || '',
      stateCode: canonicalCaseProtocol.ownershipStateCode || '',
      hasOwner: canonicalCaseProtocol.hasOperationalOwner,
    },
  )

  return {
    ...entry,
    subjectCode: canonicalCaseProtocol.subjectCode || entry.themeKey,
    subsubjectCode: canonicalCaseProtocol.subsubjectCode || entry.subsubjectKey,
    currentNodeId: canonicalCaseProtocol.currentNodeId || null,
    statusCode: canonicalCaseProtocol.statusCode,
    pendingParty: canonicalCaseProtocol.pendingParty,
    criticalityCode: canonicalCaseProtocol.criticalityCode || normalizeText(entry.criticality),
    currentAreaLabel: canonicalCaseProtocol.currentAreaLabel || entry.queue,
    lastMileAreaLabel: canonicalCaseProtocol.lastMileAreaLabel || entry.lastMileAreaLabel,
    routingMode: canonicalCaseProtocol.routingMode || 'standard',
    exceptionReason: canonicalCaseProtocol.exceptionReason || '',
    latestOperatorActionType: canonicalCaseProtocol.latestOperatorActionType || '',
    latestAreaActionType: canonicalCaseProtocol.latestAreaActionType || '',
    closedBy: canonicalCaseProtocol.closedBy || '',
    ownerType: ownershipDescriptor.ownerType || '',
    ownerKey: ownershipDescriptor.ownerKey || '',
    ownerQueue: ownershipDescriptor.ownerQueue || '',
    ownerArea: ownershipDescriptor.ownerArea || '',
    ownerRole: ownershipDescriptor.ownerRole || '',
    ownerSource: ownershipDescriptor.source || '',
    ownerRoutingHint: ownershipDescriptor.routingHint || '',
    hasOperationalOwner: Boolean(ownershipDescriptor.hasOwner),
    ownershipStateCode: ownershipDescriptor.stateCode || '',
    operationalOwnerSnapshot: { ...ownershipDescriptor },
    operationalOwnerLabel: ownershipDescriptor.ownerLabel,
    operationalOwnerTypeLabel: ownershipDescriptor.ownerTypeLabel,
    operationalOwnerStateLabel: ownershipDescriptor.stateLabel,
    hasOperationalOwnerError: !ownershipDescriptor.hasOwner,
    slaPolicyCode: canonicalCaseProtocol.slaPolicyCode || '',
    slaDeadlineAt: sla.slaDeadlineAt,
    slaState: sla.slaState,
    sla: sla.slaLabel,
    knowledgeUsages,
    latestKnowledgeUsage: knowledgeUsages.at(-1) || null,
    pendingFacetLabel: buildPendingFacetFromCanonical(canonicalCaseProtocol),
    escalationState: buildEscalationStateFromCanonical(canonicalCaseProtocol),
    nextStepLabel: buildNextStepFromCanonical(canonicalCaseProtocol),
    priorityReasonLabel: buildPriorityReasonFromCanonical(canonicalCaseProtocol),
    sortTokens: buildSortTokens({
      priority: entry.priority,
      criticality: entry.criticality,
      status: resolveOperationalStatusLabel({
        ...canonicalCaseProtocol,
        closedBy: canonicalCaseProtocol.closedBy || '',
      }),
      activityAt: entry.activityAt,
      source: entry.source,
      sla: sla.slaMinutesRemaining,
    }),
  }
}

function buildSeedQueueEntry(item, actionLogs = [], areaActionLogs = []) {
  const seedCase = findSeedCaseById(item.id)
  const priority = buildPriorityLabel(item.criticality, item.priority)
  const criticality = formatCriticalityLabel(item.criticality)
  const routing = buildCaseRoutingContext({
    studentPolo: item.polo,
    theme: item.theme,
    subtheme: item.subtheme,
    targetAreaLabel: item.queue,
    criticality: item.criticality,
    entryOrigin: 'Portal do atendimento',
  })
  const operationalOwner = resolveOperationalOwnerFromProtocol(
    {
      ownerType: item.ownerType || 'area',
      ownerKey: item.ownerKey || '',
      ownerQueue: item.ownerQueue || '',
      ownerArea: item.ownerArea || item.queue || '',
      ownerRole: item.ownerRole || '',
      ownerRoutingHint: item.ownerRoutingHint || '',
      ownerSource: item.ownerSource || 'seed_queue_entry',
      queueLabel: item.queue || '',
      currentAreaLabel: item.queue || '',
      lastMileAreaLabel: item.queue || '',
    },
    {
      fallbackQueue: item.queue || '',
      fallbackArea: item.queue || '',
      source: item.ownerSource || 'seed_queue_entry',
    },
  )
  const ownershipDescriptor = buildOperationalOwnerDescriptor(operationalOwner)

  return applyActionLogsToQueueEntry(
    {
      id: item.id,
      subject: item.subject,
      theme: titleCase(item.theme),
      themeKey: normalizeText(item.theme),
      subsubject: titleCase(item.subtheme),
      subsubjectKey: normalizeText(item.subtheme),
      student: item.student,
      studentRa: item.ra || seedCase?.studentData?.ra || '',
      polo: item.polo || 'Nao informado',
      status: item.status,
      priority,
      criticality,
      sla: item.sla,
      queue: routing.currentQueueLabel,
      lastMileAreaLabel: routing.targetAreaLabel,
      createdAt: item.createdAt || null,
      createdAtLabel: item.createdAtLabel || 'Nao informado',
      source: item.source || 'mock_operacional',
      originLabel: item.originLabel || resolveSourceLabel(item.source),
      assignedOperator: resolveAssignedOperatorName({
        assignedOperator: item.assignedOperator,
        polo: item.polo,
        queue: routing.currentQueueLabel,
        routing,
      }),
      pendingLabel: item.pendingLabel || 'Leitura inicial pelo OP',
      routing,
      ownerType: ownershipDescriptor.ownerType,
      ownerKey: ownershipDescriptor.ownerKey,
      ownerQueue: ownershipDescriptor.ownerQueue,
      ownerArea: ownershipDescriptor.ownerArea,
      ownerRole: ownershipDescriptor.ownerRole,
      ownerSource: ownershipDescriptor.source,
      ownerRoutingHint: ownershipDescriptor.routingHint,
      ownershipStateCode: ownershipDescriptor.stateCode,
      hasOperationalOwner: Boolean(ownershipDescriptor.hasOwner),
      operationalOwnerSnapshot: { ...ownershipDescriptor },
      operationalOwnerLabel: ownershipDescriptor.ownerLabel,
      operationalOwnerTypeLabel: ownershipDescriptor.ownerTypeLabel,
      operationalOwnerStateLabel: ownershipDescriptor.stateLabel,
      hasOperationalOwnerError: !ownershipDescriptor.hasOwner,
    },
    actionLogs,
    areaActionLogs,
  )
}

function buildLocalQueueEntry(protocol, actionLogs = [], areaActionLogs = []) {
  const protocolStudent = hasStructuredStudentData(protocol.studentData) ? protocol.studentData : {}
  const priority = buildPriorityLabel(protocol.context?.criticality, protocol.priorityLabel)
  const criticality = formatCriticalityLabel(protocol.context?.criticality)
  const status = protocol.statusLabel || 'Aguardando acao do OP'
  const routing =
    protocol.routing ||
    protocol.context?.routing ||
    buildCaseRoutingContext({
      studentPolo: protocolStudent.polo,
      theme: protocol.context?.theme,
      subtheme: protocol.context?.subtheme,
      queueDestination: protocol.context?.queueDestination,
      criticality: protocol.context?.criticality,
        entryOrigin: protocol.context?.entryOrigin || 'Acesso Unificado',
    })
  const operationalOwner = resolveOperationalOwnerFromProtocol(
    {
      ...protocol,
      context: protocol.context || {},
      queueLabel: protocol.queueLabel || routing.currentQueueLabel || '',
      currentAreaLabel: protocol.currentAreaLabel || protocol.lastMileAreaLabel || routing.targetAreaLabel || '',
      lastMileAreaLabel: protocol.lastMileAreaLabel || routing.targetAreaLabel || '',
      ownerSource: protocol.ownerSource || protocol.context?.ownership?.source || 'local_protocol',
    },
    {
      fallbackQueue: protocol.queueLabel || routing.currentQueueLabel || protocol.context?.queueDestination || '',
      fallbackArea: protocol.currentAreaLabel || protocol.lastMileAreaLabel || routing.targetAreaLabel || '',
      source: protocol.ownerSource || protocol.context?.ownership?.source || 'local_protocol',
    },
  )
  const ownershipDescriptor = buildOperationalOwnerDescriptor(operationalOwner)

  return applyActionLogsToQueueEntry(
    {
      id: protocol.protocolNumber,
      runtimeSource: protocol.runtimeSource || '',
      currentNodeId:
        protocol.knowledge?.node_id ||
        protocol.context?.finalNode?.id ||
        null,
      knowledge: protocol.knowledge || null,
      subject: protocol.subject,
      theme: titleCase(protocol.context?.theme),
      themeKey: normalizeText(protocol.context?.theme),
      subsubject: titleCase(protocol.context?.subtheme || protocol.context?.finalNode?.title),
      subsubjectKey: normalizeText(protocol.context?.subtheme || protocol.context?.finalNode?.title),
      student: protocolStudent.nome || 'Aluno nao informado',
      studentRa: protocolStudent.ra || '',
      polo: protocolStudent.polo || 'Nao informado',
      status,
      priority,
      criticality,
      sla: protocol.slaLabel || protocol.context?.sla || 'Nao informado',
      queue: routing.currentQueueLabel,
      lastMileAreaLabel: routing.targetAreaLabel,
      createdAt: protocol.createdAt,
      createdAtLabel: protocol.createdAtLabel || 'Nao informado',
      source: protocol.source || 'portal_aluno',
      originLabel: protocol.sourceLabel || resolveSourceLabel(protocol.source),
      assignedOperator:
        protocol.runtimeSource === 'app_api'
          ? protocol.assignedOperator || ''
          : resolveAssignedOperatorName({
              assignedOperator: protocol.assignedOperator,
              polo: protocolStudent.polo,
              queue: routing.currentQueueLabel,
              routing,
            }),
      assignedOperatorEmail: protocol.assignedOperatorEmail || '',
      pendingLabel: protocol.pendingLabel || 'Aguardando triagem operacional',
      routing,
      ownerType: ownershipDescriptor.ownerType,
      ownerKey: ownershipDescriptor.ownerKey,
      ownerQueue: ownershipDescriptor.ownerQueue,
      ownerArea: ownershipDescriptor.ownerArea,
      ownerRole: ownershipDescriptor.ownerRole,
      ownerSource: ownershipDescriptor.source,
      ownerRoutingHint: ownershipDescriptor.routingHint,
      ownershipStateCode: ownershipDescriptor.stateCode,
      hasOperationalOwner: Boolean(ownershipDescriptor.hasOwner),
      operationalOwnerSnapshot: { ...ownershipDescriptor },
      operationalOwnerLabel: ownershipDescriptor.ownerLabel,
      operationalOwnerTypeLabel: ownershipDescriptor.ownerTypeLabel,
      operationalOwnerStateLabel: ownershipDescriptor.stateLabel,
      hasOperationalOwnerError: !ownershipDescriptor.hasOwner,
    },
    actionLogs,
    areaActionLogs,
  )
}

function compareQueueEntries(left, right) {
  return (
    left.sortTokens.slaMinutes - right.sortTokens.slaMinutes ||
    right.sortTokens.priorityScore - left.sortTokens.priorityScore ||
    right.sortTokens.criticalityScore - left.sortTokens.criticalityScore ||
    right.sortTokens.statusScore - left.sortTokens.statusScore ||
    right.sortTokens.sourceScore - left.sortTokens.sourceScore ||
    right.sortTokens.activityAtScore - left.sortTokens.activityAtScore
  )
}

function buildPlaybookPayload(entry) {
  const operatorFaqIndex = buildFaqIndex(getFaqPackageForRuntime('op'))
  const directNode = entry.currentNodeId
    ? operatorFaqIndex.nodeById[entry.currentNodeId] || null
    : null
  const playbookNode =
    directNode || findBestFaqLeaf(operatorFaqIndex, entry.themeKey, entry.subsubjectKey)

  if (!playbookNode) {
    return {
      title: 'Orientacao operacional indisponivel',
      checklist: [],
      systemsToCheck: [],
      documentsRequested: [],
      responseTemplate: 'Sem playbook especifico publicado para este tema nesta base mockada.',
      escalationCriteria: 'Aplicar analise operacional antes de escalar.',
      escalationReason: 'playbook_nao_publicado',
      matchedNodeId: null,
    }
  }

  return {
    title: playbookNode.playbook_v3?.objective || playbookNode.titulo_exibido,
    checklist: playbookNode.checklist_op || [],
    systemsToCheck: playbookNode.sistemas_a_consultar || [],
    documentsRequested: playbookNode.documentos_a_solicitar || [],
    responseTemplate: playbookNode.resposta_padrao_sugerida || '',
    escalationCriteria: playbookNode.criterio_de_escalonamento || '',
    escalationReason: playbookNode.motivo_escalonamento_sugerido || '',
    matchedNodeId: playbookNode.id,
  }
}

export function buildOperatorPlaybookGuide({ theme = '', subsubject = '' } = {}) {
  return buildPlaybookPayload({
    themeKey: normalizeText(theme),
    subsubjectKey: normalizeText(subsubject),
  })
}

function findSeedCaseById(caseId) {
  return operatorCaseSeeds.find((item) => item.id === caseId) || null
}

function buildSeedCaseDetail(entry) {
  const seedCase = findSeedCaseById(entry.id)
  const faqLeaf = findBestFaqLeaf(studentFaqIndex, entry.themeKey, entry.subsubjectKey)
  const context = {
    ...buildContextFromFaqLeaf(studentFaqIndex, faqLeaf),
    routing: entry.routing,
  }

  return {
    studentData: seedCase?.studentData || {
      nome: entry.student,
      polo: entry.polo,
      ra: entry.studentRa || '',
    },
    faqContext: context,
    faqAnswer: context.displayedAnswer,
    timeline: seedCase?.timeline || [],
    attachments: seedCase?.attachments || [],
    interactions: seedCase?.interactions || [],
  }
}

function buildLocalCaseDetail(protocol, entry) {
  const protocolStudent = hasStructuredStudentData(protocol.studentData) ? protocol.studentData : {}

  return {
    studentData: {
      nome: protocolStudent.nome || '',
      email: protocolStudent.email || '',
      ra: protocolStudent.ra || '',
      curso: protocolStudent.curso || '',
      polo: protocolStudent.polo || '',
    },
    faqContext: {
      ...protocol.context,
      routing: protocol.context?.routing || entry.routing,
    },
    faqAnswer: protocol.context?.displayedAnswer || '',
    timeline: protocol.timeline || [],
    attachments: protocol.attachments || [],
    interactions: protocol.interactions || [],
    operatorIntake: protocol.operatorIntake || null,
  }
}

function buildDefaultFaqContext(routing = null) {
  return {
    theme: 'Nao informado',
    subtheme: null,
    breadcrumb: [],
    breadcrumbPath: [],
    finalNode: {
      id: null,
      title: 'Nao informado',
      nodeType: 'leaf',
    },
    displayedAnswer: '',
    action: null,
    queueDestination: null,
    criticality: null,
    sla: null,
    routing,
  }
}

function buildHistoryItemBase(item) {
  return {
    ...item,
    theme: titleCase(item.theme),
    themeKey: normalizeText(item.theme),
    subsubject: titleCase(item.subtheme),
    subsubjectKey: normalizeText(item.subtheme),
  }
}

function normalizeRecordHistory(record, studentProfile = loggedStudent) {
  return buildHistoryItemBase({
    id: record.id,
    student: studentProfile.nome,
    polo: studentProfile.polo,
    subject: record.subject,
    theme: record.context?.theme,
    subtheme: record.context?.subtheme || record.context?.finalNode?.title,
    type: record.outcome === 'resolved_by_faq' ? 'faq_resolved' : 'faq_record',
    status: record.statusLabel,
    createdAt: record.createdAt,
    createdAtLabel: record.createdAtLabel,
  })
}

function normalizeProtocolHistory(protocol) {
  const protocolStudent = hasStructuredStudentData(protocol.studentData) ? protocol.studentData : {}

  return buildHistoryItemBase({
    id: protocol.protocolNumber,
    student: protocolStudent.nome || 'Aluno nao informado',
    polo: protocolStudent.polo || 'Nao informado',
    subject: protocol.subject,
    theme: protocol.context?.theme,
    subtheme: protocol.context?.subtheme || protocol.context?.finalNode?.title,
    type: 'protocol_submitted',
    status: protocol.statusLabel,
    createdAt: protocol.createdAt,
    createdAtLabel: protocol.createdAtLabel,
  })
}

function normalizeSeedHistory(item) {
  return buildHistoryItemBase(item)
}

function buildRecurrenceLabel(summary) {
  if (summary.sameSubsubjectCount > 0) {
    return 'Reincidencia no mesmo subtema identificada.'
  }

  if (summary.sameThemeCount > 0) {
    return 'Reincidencia no mesmo tema identificada.'
  }

  if (summary.previousFaqResolvedCount > 0) {
    return 'Ja houve autoatendimento relacionado neste historico.'
  }

  return 'Nao ha reincidencia relevante nesta janela mockada.'
}

function buildCorrelatedHistory({
  caseEntry,
  records = [],
  protocols = [],
  studentProfile = loggedStudent,
}) {
  const recentThreshold = Date.now() - 1000 * 60 * 60 * 24 * 90
  const allHistory = [
    ...operatorCorrelationHistory.map((item) => normalizeSeedHistory(item)),
    ...records.map((record) => normalizeRecordHistory(record, studentProfile)),
    ...protocols.map((protocol) => normalizeProtocolHistory(protocol, studentProfile)),
  ]

  const relatedItems = allHistory
    .filter(
      (item) =>
        normalizeText(item.student) === normalizeText(caseEntry.student) && item.id !== caseEntry.id,
    )
    .sort(sortByCreatedAtDesc)
    .map((item) => ({
      ...item,
      sameTheme: item.themeKey === caseEntry.themeKey,
      sameSubsubject: item.subsubjectKey === caseEntry.subsubjectKey,
      previousSelfService: item.type === 'faq_resolved',
      recent: new Date(item.createdAt).getTime() >= recentThreshold,
    }))

  const summary = {
    total: relatedItems.length,
    previousFaqResolvedCount: relatedItems.filter((item) => item.type === 'faq_resolved').length,
    previousProtocolsCount: relatedItems.filter((item) => item.type === 'protocol_submitted').length,
    sameThemeCount: relatedItems.filter((item) => item.sameTheme).length,
    sameSubsubjectCount: relatedItems.filter((item) => item.sameSubsubject).length,
    recentWindowCount: relatedItems.filter((item) => item.recent).length,
  }

  const signals = {
    repeatedTheme: summary.sameThemeCount > 0,
    repeatedSubsubject: summary.sameSubsubjectCount > 0,
    priorSelfServiceRelated: relatedItems.some(
      (item) => item.previousSelfService && item.sameTheme,
    ),
  }

  return {
    items: relatedItems,
    summary: {
      ...summary,
      recurrenceLabel: buildRecurrenceLabel(summary),
    },
    signals,
  }
}

function buildEmptyCorrelatedHistory() {
  return {
    items: [],
    summary: {
      total: 0,
      previousFaqResolvedCount: 0,
      previousProtocolsCount: 0,
      sameThemeCount: 0,
      sameSubsubjectCount: 0,
      recentWindowCount: 0,
      recurrenceLabel: 'Nao ha reincidencia relevante nesta janela mockada.',
    },
    signals: {
      repeatedTheme: false,
      repeatedSubsubject: false,
      priorSelfServiceRelated: false,
    },
  }
}

function mergeQueueEntryWithSeedFallback(seedEntry = null, localEntry = null) {
  if (!seedEntry) {
    return localEntry
  }

  if (!localEntry) {
    return seedEntry
  }

  const merged = {
    ...seedEntry,
    ...localEntry,
    subject: pickFirstText(localEntry.subject, seedEntry.subject, 'Atendimento sem assunto'),
    theme: pickFirstText(
      localEntry.theme && localEntry.theme !== 'Nao informado' ? localEntry.theme : '',
      seedEntry.theme,
      'Nao informado',
    ),
    themeKey: pickFirstText(localEntry.themeKey, seedEntry.themeKey),
    subsubject: pickFirstText(
      localEntry.subsubject && localEntry.subsubject !== 'Nao informado' ? localEntry.subsubject : '',
      seedEntry.subsubject,
      'Nao informado',
    ),
    subsubjectKey: pickFirstText(localEntry.subsubjectKey, seedEntry.subsubjectKey),
    student: pickFirstText(localEntry.student, seedEntry.student, 'Aluno nao informado'),
    studentRa: pickFirstText(localEntry.studentRa, seedEntry.studentRa),
    polo: pickFirstText(localEntry.polo, seedEntry.polo, 'Nao informado'),
    status: pickFirstText(localEntry.status, seedEntry.status, 'Aguardando acao do OP'),
    priority: pickFirstText(localEntry.priority, seedEntry.priority, 'Media'),
    criticality: pickFirstText(localEntry.criticality, seedEntry.criticality, 'Media'),
    sla: pickFirstText(localEntry.sla, seedEntry.sla, 'Nao informado'),
    queue: pickFirstText(localEntry.queue, seedEntry.queue, 'Fila nao informada'),
    lastMileAreaLabel: pickFirstText(localEntry.lastMileAreaLabel, seedEntry.lastMileAreaLabel),
    createdAt: pickFirstText(localEntry.createdAt, seedEntry.createdAt),
    createdAtLabel: pickFirstText(localEntry.createdAtLabel, seedEntry.createdAtLabel, 'Nao informado'),
    source: pickFirstText(localEntry.source, seedEntry.source, 'mock_operacional'),
    originLabel: pickFirstText(localEntry.originLabel, seedEntry.originLabel, 'Nao informado'),
    assignedOperator: pickFirstText(localEntry.assignedOperator, seedEntry.assignedOperator),
    assignedOperatorEmail: pickFirstText(localEntry.assignedOperatorEmail, seedEntry.assignedOperatorEmail),
    pendingLabel: pickFirstText(localEntry.pendingLabel, seedEntry.pendingLabel, 'Aguardando triagem operacional'),
    routing: localEntry.routing || seedEntry.routing || null,
  }

  return {
    ...merged,
    searchText: [
      merged.id,
      merged.subject,
      merged.student,
      merged.studentRa,
      merged.polo,
      merged.assignedOperator,
      merged.pendingLabel,
      merged.operationalOwnerLabel,
      merged.operationalOwnerStateLabel,
      merged.ownerQueue,
      merged.ownerArea,
      merged.ownerRole,
    ].filter(Boolean).join(' '),
    sortTokens: buildSortTokens({
      priority: merged.priority,
      criticality: merged.criticality,
      status: merged.status,
      activityAt: merged.activityAt || merged.createdAt,
      source: merged.source,
      sla: merged.sla,
    }),
  }
}

function buildNormalizedOperatorDetail({
  caseEntry,
  localProtocol = null,
  studentProfile = loggedStudent,
  records = [],
  protocols = [],
  playbook = {},
}) {
  const seedDetail = buildSeedCaseDetail(caseEntry)
  const localDetail = localProtocol ? buildLocalCaseDetail(localProtocol, caseEntry) : null
  const seedFaqContext = seedDetail?.faqContext || buildDefaultFaqContext(caseEntry.routing || null)
  const localFaqContext = localDetail?.faqContext || {}
  const correlatedHistory =
    buildCorrelatedHistory({
      caseEntry,
      records,
      protocols,
      studentProfile,
    }) || buildEmptyCorrelatedHistory()

  return {
    studentData: {
      nome: pickFirstText(
        localDetail?.studentData?.nome,
        seedDetail?.studentData?.nome,
        caseEntry.student,
        studentProfile.nome,
        'Aluno nao informado',
      ),
      email: pickFirstText(localDetail?.studentData?.email, seedDetail?.studentData?.email, studentProfile.email),
      ra: pickFirstText(localDetail?.studentData?.ra, seedDetail?.studentData?.ra, caseEntry.studentRa),
      curso: pickFirstText(localDetail?.studentData?.curso, seedDetail?.studentData?.curso, studentProfile.curso),
      polo: pickFirstText(
        localDetail?.studentData?.polo,
        seedDetail?.studentData?.polo,
        caseEntry.polo,
        studentProfile.polo,
        'Nao informado',
      ),
    },
    faqContext: {
      ...seedFaqContext,
      ...localFaqContext,
      theme: pickFirstText(localFaqContext.theme, seedFaqContext.theme, caseEntry.theme, 'Nao informado'),
      subtheme: pickFirstText(localFaqContext.subtheme, seedFaqContext.subtheme, caseEntry.subsubject) || null,
      breadcrumb: pickArray(localFaqContext.breadcrumb, seedFaqContext.breadcrumb),
      breadcrumbPath: pickArray(localFaqContext.breadcrumbPath, seedFaqContext.breadcrumbPath),
      finalNode: {
        ...(seedFaqContext.finalNode || buildDefaultFaqContext().finalNode),
        ...(localFaqContext.finalNode || {}),
      },
      displayedAnswer: pickFirstText(localFaqContext.displayedAnswer, seedFaqContext.displayedAnswer),
      routing: localFaqContext.routing || seedFaqContext.routing || caseEntry.routing || null,
    },
    faqAnswer: pickFirstText(localDetail?.faqAnswer, seedDetail?.faqAnswer, seedFaqContext.displayedAnswer),
    timeline: pickArray(localDetail?.timeline, seedDetail?.timeline),
    attachments: pickArray(localDetail?.attachments, seedDetail?.attachments),
    interactions: pickArray(localDetail?.interactions, seedDetail?.interactions),
    operatorIntake: localDetail?.operatorIntake || null,
    playbook: {
      title: pickFirstText(playbook.title, 'Orientacao operacional indisponivel'),
      checklist: pickArray(playbook.checklist),
      systemsToCheck: pickArray(playbook.systemsToCheck),
      documentsRequested: pickArray(playbook.documentsRequested),
      responseTemplate: pickFirstText(playbook.responseTemplate),
      escalationCriteria: pickFirstText(playbook.escalationCriteria),
      escalationReason: pickFirstText(playbook.escalationReason, 'playbook_nao_publicado'),
      matchedNodeId: playbook.matchedNodeId || null,
    },
    correlatedHistory,
  }
}

export function buildOperatorQueueEntries({
  protocols = [],
  actionLogs = [],
  areaActionLogs = [],
  seededQueue = seededOperatorQueue,
  canonicalCaseProtocols = [],
  caseKnowledgeUsages = [],
  viewerContext = null,
} = {}) {
  const canonicalMap = new Map((canonicalCaseProtocols || []).map((item) => [item.id, item]))
  const localEntries = protocols
    .filter((protocol) => {
      const statusCode =
        protocol.statusCode ||
        mapLegacyCaseStatusCode({
          statusLabel: protocol.statusLabel,
          pendingLabel: protocol.pendingLabel,
        })

      return !['resolved', 'closed'].includes(statusCode)
    })
    .map((protocol) => buildLocalQueueEntry(protocol, actionLogs, areaActionLogs))

  const seedEntries = seededQueue.map((item) => buildSeedQueueEntry(item, actionLogs, areaActionLogs))
  const localEntryMap = new Map(localEntries.map((entry) => [entry.id, entry]))
  const seedEntryMap = new Map(seedEntries.map((entry) => [entry.id, entry]))
  const mergedEntries = new Map()

  for (const [id, seedEntry] of seedEntryMap.entries()) {
    mergedEntries.set(id, mergeQueueEntryWithSeedFallback(seedEntry, localEntryMap.get(id) || null))
  }

  for (const [id, localEntry] of localEntryMap.entries()) {
    if (!mergedEntries.has(id)) {
      mergedEntries.set(id, localEntry)
    }
  }

  return filterCasesForMockContext([...mergedEntries.values()], viewerContext)
    .map((entry) => mergeCanonicalCaseProtocol(entry, canonicalMap.get(entry.id), caseKnowledgeUsages))
    .sort(compareQueueEntries)
}

export function filterOperatorQueueEntries(entries = [], filters = {}) {
  return entries.filter((entry) => {
    return (
      matchesQuery(filters.search, entry.searchText, entry.subject, entry.student, entry.studentRa, entry.id) &&
      matchesFilter(filters.status, resolveOperationalStatus(entry)) &&
      matchesFilter(filters.polo, entry.polo) &&
      matchesFilter(filters.sla, entry.slaState) &&
      matchesFilter(filters.origin, entry.originLabel) &&
      matchesFilter(filters.pending, entry.pendingFacetLabel) &&
      matchesFilter(filters.escalation, entry.escalationState) &&
      matchesFilter(filters.operator, entry.assignedOperator)
    )
  })
}

export function buildOperatorQueueFilterOptions(entries = []) {
  return {
    status: [
      { value: 'todos', label: 'Todos' },
      ...Array.from(new Set(entries.map((entry) => resolveOperationalStatus(entry)).filter(Boolean))).map(
        (value) => ({
          value,
          label: value,
        }),
      ),
    ],
    polo: buildFilterOptions(entries, 'polo'),
    sla: buildFilterOptions(entries, 'slaState'),
    origin: buildFilterOptions(entries, 'originLabel'),
    pending: buildFilterOptions(entries, 'pendingFacetLabel'),
    escalation: buildFilterOptions(entries, 'escalationState'),
    operator: buildFilterOptions(entries, 'assignedOperator'),
  }
}

export function buildOperatorQueueMetrics(entries = []) {
  const criticalCases = entries.filter((entry) => {
    const criticality = normalizeText(entry.criticality)
    return criticality === 'critica' || criticality === 'alta'
  }).length
  const atRiskCases = entries.filter((entry) => isSlaAtRisk(entry.sla, entry.slaState)).length
  const portalCases = entries.filter((entry) => entry.source === 'portal_aluno').length
  const actionRequiredCases = entries.filter((entry) => normalizeText(entry.status).includes('acao do op')).length

  return [
    {
      label: 'Casos ativos',
      value: entries.length,
      hint: 'Itens no escopo atual da leitura operacional.',
    },
    {
      label: 'Aguardando OP',
      value: actionRequiredCases,
      hint: 'Casos que dependem de acao direta da operacao agora.',
    },
    {
      label: 'SLA em atencao',
      value: atRiskCases,
      hint: 'Casos com janela curta ou tempo restante visivel.',
    },
    {
      label: 'Alta criticidade',
      value: criticalCases,
      hint: 'Itens com criticidade alta ou critica no escopo atual.',
    },
    {
      label: 'Vindos do portal',
      value: portalCases,
      hint: 'Protocolos gerados pelo portal do atendimento.',
    },
  ]
}

export function buildOperatorActionLog({
  caseEntry,
  actionType,
  note = '',
  playbook,
  actorName = '',
  currentDate = new Date(),
}) {
  const timestamp = buildTimestampParts(currentDate)
  const metadata = ACTION_METADATA[actionType]

  if (!metadata) {
    throw new Error(`Acao operacional desconhecida: ${actionType}`)
  }

  const normalizedNote = note.trim() || metadata.defaultText({ playbook, caseEntry })
  const queueLabel = metadata.queueResolver ? metadata.queueResolver(caseEntry, playbook) : caseEntry.queue

  return {
    id: `op-action-${caseEntry.id}-${timestamp.compact}`,
    caseId: caseEntry.id,
    actor: actorName || 'Operador de Polo',
    assigneeLabel: metadata.assigneeResolver
      ? metadata.assigneeResolver(caseEntry, playbook)
      : caseEntry.assignedOperator || actorName || 'Operacao do polo',
    actionType,
    actionLabel: metadata.title,
    occurredAt: timestamp.iso,
    occurredAtLabel: timestamp.label,
    statusBefore: caseEntry.status,
    statusLabel: metadata.statusLabel,
    statusAfter: metadata.statusLabel,
    canonicalStatusCode: metadata.canonicalStatusCode || '',
    pendingParty: metadata.pendingParty || '',
    closedBy: metadata.closedBy || '',
    queueBefore: caseEntry.queue,
    queueLabel,
    queueAfter: queueLabel,
    destinationLabel: queueLabel,
    resolvedAreaLabel: queueLabel,
    routingMode: 'standard',
    pendingLabel: metadata.pendingLabel,
    escalationReason: actionType === 'escalate' ? playbook.escalationReason || null : null,
    note: normalizedNote,
    timelineItem: {
      id: `op-timeline-${caseEntry.id}-${timestamp.compact}`,
      title: metadata.title,
      description: metadata.buildDescription({ note: normalizedNote, playbook, caseEntry }),
      at: timestamp.iso,
      atLabel: timestamp.label,
      tone: 'primary',
    },
    interactionItem: {
      id: `op-interaction-${caseEntry.id}-${timestamp.compact}`,
      actor: 'Operador de Polo',
      channel: metadata.channel,
      text: normalizedNote,
      at: timestamp.iso,
      atLabel: timestamp.label,
    },
  }
}

export function buildOperatorAssumeActionLog({
  caseEntry,
  actorName = '',
  reason = '',
  currentDate = new Date(),
}) {
  const timestamp = buildTimestampParts(currentDate)
  const normalizedReason =
    reason.trim() ||
    `Caso assumido por ${actorName || 'Operacao do polo'} para acelerar a tratativa via cockpit.`
  const previousOperator = caseEntry.assignedOperator || 'Nao atribuido'

  return {
    id: `op-action-${caseEntry.id}-${timestamp.compact}-assume`,
    caseId: caseEntry.id,
    actor: actorName || 'Operador de Polo',
    assigneeLabel: actorName || 'Operacao do polo',
    actionType: 'assume_case',
    actionLabel: 'Caso assumido para acelerar',
    occurredAt: timestamp.iso,
    occurredAtLabel: timestamp.label,
    statusBefore: caseEntry.status,
    statusLabel: caseEntry.status,
    statusAfter: caseEntry.status,
    canonicalStatusCode: caseEntry.statusCode || '',
    pendingParty: caseEntry.pendingParty || '',
    closedBy: caseEntry.closedBy || '',
    queueBefore: caseEntry.queue,
    queueLabel: caseEntry.queue,
    queueAfter: caseEntry.queue,
    destinationLabel: caseEntry.queue,
    resolvedAreaLabel: caseEntry.lastMileAreaLabel || caseEntry.queue,
    routingMode: 'intervention',
    pendingLabel: caseEntry.pendingLabel,
    escalationReason: null,
    note: `${normalizedReason} Responsavel anterior: ${previousOperator}.`,
    timelineItem: {
      id: `op-timeline-${caseEntry.id}-${timestamp.compact}-assume`,
      title: 'Caso assumido para acelerar',
      description: `${normalizedReason} Responsavel anterior: ${previousOperator}.`,
      at: timestamp.iso,
      atLabel: timestamp.label,
      tone: 'warning',
    },
    interactionItem: {
      id: `op-interaction-${caseEntry.id}-${timestamp.compact}-assume`,
      actor: actorName || 'Operador de Polo',
      channel: 'Intervencao operacional',
      text: normalizedReason,
      at: timestamp.iso,
      atLabel: timestamp.label,
    },
  }
}

export function buildOperatorCaseDetail({
  caseId,
  protocols = [],
  records = [],
  actionLogs = [],
  areaActionLogs = [],
  studentProfile = loggedStudent,
  canonicalCaseProtocols = [],
  caseKnowledgeUsages = [],
  caseRoutingDecisions = [],
  caseEvents = [],
  seededQueue = seededOperatorQueue,
  viewerContext = null,
} = {}) {
  const queueEntries = buildOperatorQueueEntries({
    protocols,
    seededQueue,
    actionLogs,
    areaActionLogs,
    studentProfile,
    canonicalCaseProtocols,
    caseKnowledgeUsages,
    viewerContext,
  })
  const caseEntry = queueEntries.find((entry) => entry.id === caseId) || null

  if (!caseEntry) {
    return null
  }

  const localProtocol = protocols.find((protocol) => protocol.protocolNumber === caseId) || null
  const baseDetail = buildNormalizedOperatorDetail({
    caseEntry,
    localProtocol,
    studentProfile,
    records,
    protocols,
    playbook: buildPlaybookPayload(caseEntry),
  })
  const caseActionLogs = getCaseActionLogs(actionLogs, caseId)
  const caseAreaActionLogs = getCaseAreaActionLogs(areaActionLogs, caseId)

  return {
    ...caseEntry,
    studentData: baseDetail.studentData,
    faqContext: baseDetail.faqContext,
    faqAnswer: baseDetail.faqAnswer,
    routing: caseEntry.routing || baseDetail.faqContext?.routing || null,
    lastMileAreaLabel:
      caseEntry.lastMileAreaLabel || caseEntry.routing?.targetAreaLabel || 'Nao informado',
    timeline: sanitizeObjectCollection([
      ...(baseDetail.timeline || []),
      ...caseActionLogs.map((log) => log.timelineItem),
      ...caseAreaActionLogs.map((log) => log.timelineItem),
    ]),
    attachments: sanitizeObjectCollection(baseDetail.attachments),
    interactions: sanitizeObjectCollection([
      ...(baseDetail.interactions || []),
      ...caseActionLogs.map((log) => log.interactionItem),
      ...caseAreaActionLogs.map((log) => log.interactionItem),
    ]),
    actionLogs: sanitizeObjectCollection(caseActionLogs),
    areaActionLogs: sanitizeObjectCollection(caseAreaActionLogs),
    caseKnowledgeUsages: sanitizeObjectCollection(caseKnowledgeUsages.filter((record) => record.caseId === caseId)),
    routingDecisions: sanitizeObjectCollection(caseRoutingDecisions.filter((record) => record.caseId === caseId)),
    caseEvents: sanitizeObjectCollection(caseEvents.filter((record) => record.caseId === caseId)),
    operatorIntake: baseDetail.operatorIntake || null,
    playbook: baseDetail.playbook,
    correlatedHistory: baseDetail.correlatedHistory,
  }
}
