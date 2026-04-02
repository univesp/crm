import loggedStudent from '../../mocks/usuario-logado.json'
import studentFaq from '../../mocks/faq-aluno.json'
import operatorFaq from '../../mocks/faq-op.json'
import { buildCaseRoutingContext, filterCasesForMockContext } from '@/services/caseRoutingRuntime'
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
const operatorFaqIndex = buildFaqIndex(operatorFaq)

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

function parseSlaMinutes(sla = '') {
  const normalized = normalizeText(sla)

  if (!normalized || normalized.includes('nao informado') || normalized.includes('encerrad')) {
    return Number.MAX_SAFE_INTEGER
  }

  if (normalized.includes('vencid') || normalized.includes('atrasad')) {
    return -1
  }

  if (normalized.includes('hoje')) {
    return 8 * 60
  }

  const daysMatch = normalized.match(/(\d+)\s*d/)
  const hoursMatch = normalized.match(/(\d+)\s*h/)
  const minutesMatch = normalized.match(/(\d+)\s*min/)

  if (daysMatch || hoursMatch || minutesMatch) {
    return (
      Number.parseInt(daysMatch?.[1] || '0', 10) * 24 * 60 +
      Number.parseInt(hoursMatch?.[1] || '0', 10) * 60 +
      Number.parseInt(minutesMatch?.[1] || '0', 10)
    )
  }

  return Number.MAX_SAFE_INTEGER - 1
}

function buildSortTokens({ priority, criticality, status, activityAt, source, sla }) {
  const slaMinutes = parseSlaMinutes(sla)
  return {
    priorityScore: PRIORITY_SCORE[normalizeText(priority)] || 0,
    criticalityScore: CRITICALITY_SCORE[normalizeText(criticality)] || 0,
    statusScore: STATUS_SCORE[normalizeText(status)] || 0,
    sourceScore: source === 'portal_aluno' ? 2 : 1,
    activityAtScore: activityAt ? new Date(activityAt).getTime() : 0,
    slaMinutes,
  }
}

function isSlaAtRisk(sla) {
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

function getCaseActionLogs(actionLogs = [], caseId) {
  return actionLogs
    .filter((log) => log.caseId === caseId)
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
}

function applyActionLogsToQueueEntry(entry, actionLogs = []) {
  const caseLogs = getCaseActionLogs(actionLogs, entry.id)
  const latestLog = caseLogs[caseLogs.length - 1] || null
  const status = latestLog?.statusLabel || entry.status
  const queue = latestLog?.queueLabel || entry.queue
  const pending = latestLog?.pendingLabel || entry.pendingLabel || 'Aguardando triagem operacional'
  const activityAt = latestLog?.occurredAt || entry.createdAt
  const activityAtLabel = latestLog?.occurredAtLabel || entry.createdAtLabel
  const priority = latestLog?.priorityLabel || entry.priority
  const criticality = latestLog?.criticalityLabel || entry.criticality
  const assignedOperator = entry.assignedOperator
  const normalizedStatus = normalizeText(status)
  const currentSla =
    normalizedStatus.includes('respondido') ||
    normalizedStatus.includes('faq') ||
    normalizedStatus.includes('conclu')
      ? 'Encerrado'
      : entry.sla
  const routing = latestLog?.queueLabel
    ? {
        ...entry.routing,
        targetAreaLabel: latestLog.destinationLabel || entry.routing?.targetAreaLabel,
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
    ownerLabel: latestLog?.assigneeLabel || entry.ownerLabel || assignedOperator,
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
      pending,
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

function buildSeedQueueEntry(item, actionLogs = []) {
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
    },
    actionLogs,
  )
}

function buildLocalQueueEntry(protocol, studentProfile = loggedStudent, actionLogs = []) {
  const protocolStudent = protocol.studentData || studentProfile
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

  return applyActionLogsToQueueEntry(
    {
      id: protocol.protocolNumber,
      subject: protocol.subject,
      theme: titleCase(protocol.context?.theme),
      themeKey: normalizeText(protocol.context?.theme),
      subsubject: titleCase(protocol.context?.subtheme || protocol.context?.finalNode?.title),
      subsubjectKey: normalizeText(protocol.context?.subtheme || protocol.context?.finalNode?.title),
      student: protocolStudent.nome || 'Aluno logado',
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
      assignedOperator: resolveAssignedOperatorName({
        assignedOperator: protocol.assignedOperator,
        polo: protocolStudent.polo,
        queue: routing.currentQueueLabel,
        routing,
      }),
      pendingLabel: protocol.pendingLabel || 'Aguardando triagem operacional',
      routing,
    },
    actionLogs,
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
  const playbookNode = findBestFaqLeaf(operatorFaqIndex, entry.themeKey, entry.subsubjectKey)

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
    title: playbookNode.titulo_exibido,
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

function buildLocalCaseDetail(protocol, entry, studentProfile = loggedStudent) {
  const protocolStudent = protocol.studentData || studentProfile

  return {
    studentData: {
      nome: protocolStudent.nome,
      email: protocolStudent.email,
      ra: protocolStudent.ra,
      curso: protocolStudent.curso,
      polo: protocolStudent.polo,
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

function normalizeProtocolHistory(protocol, studentProfile = loggedStudent) {
  const protocolStudent = protocol.studentData || studentProfile

  return buildHistoryItemBase({
    id: protocol.protocolNumber,
    student: protocolStudent.nome,
    polo: protocolStudent.polo,
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

export function buildOperatorQueueEntries({
  protocols = [],
  actionLogs = [],
  studentProfile = loggedStudent,
  seededQueue = seededOperatorQueue,
  viewerContext = null,
} = {}) {
  const localEntries = protocols
    .filter((protocol) => normalizeText(protocol.statusGroup) !== 'completed')
    .map((protocol) => buildLocalQueueEntry(protocol, studentProfile, actionLogs))

  const seedEntries = seededQueue.map((item) => buildSeedQueueEntry(item, actionLogs))

  return filterCasesForMockContext([...localEntries, ...seedEntries], viewerContext).sort(compareQueueEntries)
}

export function filterOperatorQueueEntries(entries = [], filters = {}) {
  return entries.filter((entry) => {
    return (
      matchesQuery(filters.search, entry.searchText, entry.subject, entry.student, entry.studentRa, entry.id) &&
      matchesFilter(filters.status, entry.status) &&
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
    status: buildFilterOptions(entries, 'status'),
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
  const atRiskCases = entries.filter((entry) => isSlaAtRisk(entry.sla)).length
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
    queueBefore: caseEntry.queue,
    queueLabel,
    queueAfter: queueLabel,
    destinationLabel: queueLabel,
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

export function buildOperatorCaseDetail({
  caseId,
  protocols = [],
  records = [],
  actionLogs = [],
  studentProfile = loggedStudent,
  viewerContext = null,
} = {}) {
  const queueEntries = buildOperatorQueueEntries({
    protocols,
    actionLogs,
    studentProfile,
    viewerContext,
  })
  const caseEntry = queueEntries.find((entry) => entry.id === caseId) || null

  if (!caseEntry) {
    return null
  }

  const localProtocol = protocols.find((protocol) => protocol.protocolNumber === caseId) || null
  const baseDetail = localProtocol
    ? buildLocalCaseDetail(localProtocol, caseEntry, studentProfile)
    : buildSeedCaseDetail(caseEntry)
  const playbook = buildPlaybookPayload(caseEntry)
  const caseActionLogs = getCaseActionLogs(actionLogs, caseId)

  return {
    ...caseEntry,
    studentData: baseDetail.studentData,
    faqContext: baseDetail.faqContext,
    faqAnswer: baseDetail.faqAnswer,
    routing: caseEntry.routing || baseDetail.faqContext?.routing || null,
    lastMileAreaLabel:
      caseEntry.lastMileAreaLabel || caseEntry.routing?.targetAreaLabel || 'Nao informado',
    timeline: [
      ...(baseDetail.timeline || []),
      ...caseActionLogs.map((log) => log.timelineItem),
    ],
    attachments: baseDetail.attachments || [],
    interactions: [
      ...(baseDetail.interactions || []),
      ...caseActionLogs.map((log) => log.interactionItem),
    ],
    actionLogs: caseActionLogs,
    operatorIntake: baseDetail.operatorIntake || null,
    playbook,
    correlatedHistory: buildCorrelatedHistory({
      caseEntry,
      records,
      protocols,
      studentProfile,
    }),
  }
}
