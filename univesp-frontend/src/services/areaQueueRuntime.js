import { buildOperatorCaseDetail, buildOperatorQueueEntries } from '@/services/operatorQueueRuntime'
import { CASE_PROTOCOL_STATUSES } from '@/services/canonicalFoundationRuntime'
import {
  canViewerAccessAreaSubject,
  deriveAnalystOwnershipState,
  findAreaAssignment,
  findAreaSubjectRule,
} from '@/services/areaGovernanceRuntime'
import {
  resolveAreaBucket,
  resolveAreaStatusLabel,
  shouldShowAreaDeadline,
} from '@/services/canonicalCaseRuntime'
import { buildDistributionDecision } from '@/services/distributionEngine'
import { buildOperationalOwnerDescriptor } from '@/services/operationalOwnershipRuntime'

const DEFAULT_AREA_CATALOG = ['Secretaria Academica', 'Suporte Academico Digital', 'Financeiro']
export const AREA_QUEUE_DEFAULT_PAGE_SIZE = 20
export const AREA_QUEUE_MAX_PAGE_SIZE = 100
const STANDARD_AREA_ESCALATION_MAP = Object.freeze({
  'Suporte Academico Digital': ['Secretaria Academica'],
  'Secretaria Academica': ['Suporte Academico Digital'],
  Financeiro: ['Secretaria Academica'],
})

const AREA_ACTION_METADATA = {
  technical_reply: {
    title: 'Resposta tecnica registrada',
    canonicalStatusCode: CASE_PROTOCOL_STATUSES.IN_PROGRESS_OP,
    pendingParty: 'op',
    closedBy: '',
    statusLabel: 'Respondido pela area',
    pendingLabel: 'OP precisa devolver resposta tecnica ao aluno',
    channel: 'Devolutiva tecnica interna',
    defaultText: ({ caseDetail }) =>
      caseDetail.playbook.responseTemplate ||
      'Resposta tecnica registrada pela area para continuidade da devolutiva ao aluno.',
    buildDescription: ({ note }) =>
      `A area registrou devolutiva tecnica para o caso. ${note ? `Resumo: ${note}` : ''}`.trim(),
    queueResolver: (caseDetail) => caseDetail.routing?.currentQueueLabel || caseDetail.queue,
    assigneeResolver: (caseDetail) => caseDetail.assignedOperator || 'Operacao do polo',
    destinationResolver: (caseDetail) => caseDetail.routing?.currentQueueLabel || caseDetail.queue,
  },
  request_complement: {
    title: 'Complementacao solicitada pela area',
    canonicalStatusCode: CASE_PROTOCOL_STATUSES.IN_PROGRESS_OP,
    pendingParty: 'op',
    closedBy: '',
    statusLabel: 'Complementacao solicitada pela area',
    pendingLabel: 'OP precisa complementar subsidios para nova analise',
    channel: 'Devolucao interna para o polo',
    defaultText: () =>
      'A area precisa de mais subsidios, evidencias ou validacoes antes da resposta tecnica final.',
    buildDescription: ({ note }) =>
      `A area devolveu o caso para complementacao operacional. ${note ? `Resumo: ${note}` : ''}`.trim(),
    queueResolver: (caseDetail) => caseDetail.routing?.currentQueueLabel || caseDetail.queue,
    assigneeResolver: (caseDetail) => caseDetail.assignedOperator || 'Operacao do polo',
    destinationResolver: (caseDetail) => caseDetail.routing?.currentQueueLabel || caseDetail.queue,
  },
  reassign: {
    title: 'Caso reencaminhado para outra area',
    canonicalStatusCode: CASE_PROTOCOL_STATUSES.REROUTED,
    pendingParty: 'area',
    closedBy: '',
    statusLabel: 'Reencaminhado para outra area',
    pendingLabel: ({ destination }) => `Aguardando analise de ${destination || 'outra area interna'}`,
    channel: 'Reencaminhamento interno',
    defaultText: ({ destination }) =>
      `Caso reencaminhado para ${destination || 'outra area interna'} com contexto tecnico registrado.`,
    buildDescription: ({ note, destination }) =>
      `A area reencaminhou o caso para ${destination || 'outra area interna'}. ${note ? `Resumo: ${note}` : ''}`.trim(),
    queueResolver: (_, destination) => destination || 'Outra area interna',
    assigneeResolver: (_, destination) => destination || 'Outra area interna',
    destinationResolver: (_, destination) => destination || 'Outra area interna',
  },
  conclude: {
    title: 'Analise concluida pela area',
    canonicalStatusCode: CASE_PROTOCOL_STATUSES.CLOSED,
    pendingParty: 'none',
    closedBy: 'area',
    statusLabel: 'Concluido pela area',
    pendingLabel: 'Analise encerrada pela area interna',
    channel: 'Conclusao interna',
    defaultText: () => 'A area concluiu a analise tecnica e encerrou a tratativa interna.',
    buildDescription: ({ note }) =>
      `A area concluiu a analise do caso. ${note ? `Resumo: ${note}` : ''}`.trim(),
    queueResolver: (caseDetail) => caseDetail.queue,
    assigneeResolver: () => 'Area interna',
    destinationResolver: (caseDetail) => caseDetail.lastMileAreaLabel || caseDetail.queue,
  },
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function withPeriod(value = '') {
  const text = String(value || '').trim()

  if (!text) {
    return ''
  }

  return /[.!?]$/.test(text) ? text : `${text}.`
}

function sanitizeObjectCollection(collection = []) {
  return Array.isArray(collection) ? collection.filter((item) => item && typeof item === 'object') : []
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

function getCaseAreaActionLogs(areaActionLogs = [], caseId = '') {
  return areaActionLogs
    .filter((log) => log.caseId === caseId)
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
}

function getLatestOperatorEscalation(operatorActionLogs = [], caseId = '') {
  return operatorActionLogs
    .filter((log) => log.caseId === caseId && log.actionType === 'escalate')
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0] || null
}

function isAreaRelevant(entry, areaActionLogs = []) {
  if (entry.statusCode) {
    return (
      getCaseAreaActionLogs(areaActionLogs, entry.id).length > 0 ||
      entry.pendingParty === 'area' ||
      entry.statusCode === 'rerouted' ||
      entry.latestAreaActionType === 'technical_reply' ||
      entry.latestAreaActionType === 'request_complement' ||
      entry.closedBy === 'area'
    )
  }

  const status = normalizeText(entry.status)
  const pending = normalizeText(entry.pendingLabel)

  if (getCaseAreaActionLogs(areaActionLogs, entry.id).length) {
    return true
  }

  return (
    status.includes('escalado') ||
    status.includes('retorno da area') ||
    pending.includes('area') ||
    pending.includes('secretaria')
  )
}

function resolveCurrentArea(entry, latestAreaLog = null) {
  if (latestAreaLog?.actionType === 'reassign') {
    return latestAreaLog?.destinationLabel || latestAreaLog?.queueAfter || entry.lastMileAreaLabel || entry.queue
  }

  if (latestAreaLog?.actionType === 'technical_reply' || latestAreaLog?.actionType === 'request_complement' || latestAreaLog?.actionType === 'conclude') {
    return latestAreaLog?.queueBefore || entry.lastMileAreaLabel || entry.queue
  }

  return latestAreaLog?.queueAfter || latestAreaLog?.destinationLabel || entry.lastMileAreaLabel || entry.queue
}

function matchesAreaScope(entry, viewerContext, latestAreaLog = null) {
  if (!viewerContext) {
    return true
  }

  const allowedAreas = new Set(viewerContext.visibleAreas || [])
  const currentArea = normalizeText(viewerContext.currentArea)
  const areaLabel = resolveCurrentArea(entry, latestAreaLog)
  const matchesAllowed =
    allowedAreas.has(entry.lastMileAreaLabel) ||
    allowedAreas.has(entry.queue) ||
    allowedAreas.has(areaLabel)

  if (!matchesAllowed) {
    return false
  }

  if (!currentArea || currentArea === normalizeText('Nao se aplica')) {
    return true
  }

  return normalizeText(areaLabel) === currentArea || normalizeText(entry.lastMileAreaLabel) === currentArea
}

function resolveAreaStatus(entry) {
  if (entry.statusCode) {
    return resolveAreaStatusLabel(entry)
  }

  const status = normalizeText(entry.status)

  if (status.includes('concluido pela area')) {
    return 'Concluido pela area'
  }

  if (status.includes('respondido pela area')) {
    return 'Respondido pela area'
  }

  if (status.includes('reencaminhado')) {
    return 'Reencaminhado'
  }

  if (status.includes('complementacao solicitada pela area')) {
    return 'Aguardando complemento'
  }

  return 'Precisa de analise'
}

export function resolveAreaQueueBucket(entry = {}) {
  if (entry.statusCode) {
    return resolveAreaBucket(entry)
  }

  const status = normalizeText(entry.status)

  if (status.includes('concluido pela area') || status.includes('respondido pela area')) {
    return 'completed'
  }

  if (status.includes('reencaminhado')) {
    return 'rerouted'
  }

  if (status.includes('complementacao solicitada pela area')) {
    return 'waiting_complement'
  }

  return 'needs_review'
}

export function shouldShowAreaResponseDeadline(entry = {}) {
  if (entry.statusCode) {
    return shouldShowAreaDeadline(entry)
  }

  return resolveAreaQueueBucket(entry) === 'needs_review'
}

function buildAreaNextStepLabel(entry) {
  const status = normalizeText(entry.status)

  if (status.includes('respondido pela area')) {
    return 'Resposta final pronta para aluno e OP.'
  }

  if (status.includes('complementacao solicitada pela area')) {
    return 'Aguardar complemento do aluno e do polo.'
  }

  if (status.includes('reencaminhado')) {
    return 'Excecao aberta em outra area.'
  }

  if (status.includes('concluido pela area')) {
    return 'Tratativa interna encerrada.'
  }

  return 'Validar base e devolver resposta ou complemento.'
}

function buildAreaQueueEntry(
  entry,
  operatorActionLogs = [],
  areaActionLogs = [],
  assignments = [],
  subjectRules = [],
  userAvailability = [],
  operationalAreas = [],
  canonicalCaseProtocols = [],
  viewerContext = null,
) {
  const latestAreaLog = getCaseAreaActionLogs(areaActionLogs, entry.id).at(-1) || null
  const latestEscalation = getLatestOperatorEscalation(operatorActionLogs, entry.id)
  const status = latestAreaLog?.statusAfter || entry.status
  const queue = latestAreaLog?.queueAfter || entry.queue
  const pendingLabel = latestAreaLog?.pendingLabel || entry.pendingLabel
  const sla =
    latestAreaLog && resolveAreaQueueBucket({ status }) !== 'needs_review' ? 'Encerrado' : entry.sla
  const contextFromOp =
    latestEscalation?.note ||
    entry.operatorIntake?.verifiedSummary ||
    entry.pendingLabel ||
    'Escalonamento sem subsidio detalhado registrado.'
  const currentAreaLabel = resolveCurrentArea(entry, latestAreaLog)
  const assignment = findAreaAssignment({ ...entry, currentAreaLabel }, assignments)
  const areaBucket = resolveAreaQueueBucket({ ...entry, status })
  const subjectRule = findAreaSubjectRule({
    areaLabel: currentAreaLabel,
    themeKey: entry.themeKey,
    subsubjectKey: entry.subsubjectKey,
    rules: subjectRules,
  })
  const caseProtocol = canonicalCaseProtocols.find((item) => item.id === entry.id) || entry
  const operationalOwner = buildOperationalOwnerDescriptor(
    caseProtocol.operationalOwnerSnapshot || {
      ownerType: caseProtocol.ownerType || entry.ownerType || '',
      ownerKey: caseProtocol.ownerKey || entry.ownerKey || '',
      ownerQueue: caseProtocol.ownerQueue || entry.ownerQueue || '',
      ownerArea: caseProtocol.ownerArea || entry.ownerArea || '',
      ownerRole: caseProtocol.ownerRole || entry.ownerRole || '',
      routingHint: caseProtocol.ownerRoutingHint || entry.ownerRoutingHint || '',
      source: caseProtocol.ownerSource || entry.ownerSource || '',
      stateCode: caseProtocol.ownershipStateCode || entry.ownershipStateCode || '',
      hasOwner:
        typeof caseProtocol.hasOperationalOwner === 'boolean'
          ? caseProtocol.hasOperationalOwner
          : entry.hasOperationalOwner,
    },
  )
  const distributionSuggestion = !assignment?.analystName
    ? buildDistributionDecision({
        caseProtocol: {
          ...caseProtocol,
          currentAreaLabel,
          lastMileAreaLabel: currentAreaLabel,
          themeKey: entry.themeKey,
          subsubjectKey: entry.subsubjectKey,
        },
        operationalAreas,
        areaSubjectEligibility: subjectRules,
        userAvailability,
        caseAssignments: assignments,
        caseProtocols: canonicalCaseProtocols,
      })
    : null

  return {
    ...entry,
    status,
    queue,
    lastMileAreaLabel:
      latestAreaLog?.actionType === 'reassign'
        ? latestAreaLog?.destinationLabel || entry.lastMileAreaLabel
        : entry.lastMileAreaLabel,
    currentAreaLabel,
    contextFromOp,
    handoffAtLabel: latestEscalation?.occurredAtLabel || entry.activityAtLabel || entry.createdAtLabel,
    handoffByLabel: latestEscalation?.actor || entry.assignedOperator || 'Operacao do polo',
    pendingLabel,
    sla,
    areaStatusLabel: resolveAreaStatus({ ...entry, status }),
    nextStepLabel: buildAreaNextStepLabel({ ...entry, status }),
    subjectScopeLabel:
      subjectRule?.subjectLabel ||
      `${entry.theme || entry.themeKey || 'Tema'} / ${entry.subsubject || entry.subsubjectKey || 'Subassunto'}`,
    currentAssigneeLabel: assignment?.analystName || 'Sem responsavel',
    currentAssigneeMeta:
      !operationalOwner.hasOwner
        ? 'Erro estrutural: protocolo sem owner operacional efetivo'
        : assignment?.analystName
        ? `Responsavel atual: ${assignment.analystName}`
        : distributionSuggestion?.analystName
          ? `Sem dono fixo. Sugestao automatica: ${distributionSuggestion.analystName}`
          : 'Caso sem responsavel definido na area',
    currentAssignment: assignment || null,
    distributionSuggestion,
    recommendedAssigneeLabel: distributionSuggestion?.analystName || '',
    ownershipState: deriveAnalystOwnershipState(
      { ...entry, status, currentAreaLabel, areaBucket },
      viewerContext,
      assignment,
      getCaseAreaActionLogs(areaActionLogs, entry.id),
    ),
    operationalOwnerType: operationalOwner.ownerType,
    operationalOwnerTypeLabel: operationalOwner.ownerTypeLabel,
    operationalOwnerLabel: operationalOwner.ownerLabel,
    operationalOwnerSource: operationalOwner.source,
    operationalOwnerStateCode: operationalOwner.stateCode,
    operationalOwnerStateLabel: operationalOwner.stateLabel,
    operationalOwnerSnapshot: { ...operationalOwner },
    hasOperationalOwner: Boolean(operationalOwner.hasOwner),
    hasOperationalOwnerError: !operationalOwner.hasOwner,
    subjectScopeRule: subjectRule,
    areaBucket,
    isUnassigned: !(assignment?.analystName || '').trim(),
    isOwnerMissing: !operationalOwner.hasOwner,
    isOverdue: Number(entry.sortTokens?.slaMinutes || 0) < 0,
    isAtRisk:
      Number(entry.sortTokens?.slaMinutes || 0) >= 0 &&
      Number(entry.sortTokens?.slaMinutes || 0) <= 120,
    isExceptionRoute: areaBucket === 'rerouted',
    isWaitingComplement: areaBucket === 'waiting_complement',
    searchText: [
      entry.id,
      entry.student,
      entry.studentRa,
      entry.polo,
      entry.subject,
      contextFromOp,
      queue,
      status,
      operationalOwner.ownerLabel,
      operationalOwner.stateLabel,
      assignment?.analystName || 'Sem responsavel',
    ].join(' '),
  }
}

function compareAreaEntries(left, right) {
  return (
    left.sortTokens.slaMinutes - right.sortTokens.slaMinutes ||
    new Date(right.activityAt || 0).getTime() - new Date(left.activityAt || 0).getTime() ||
    String(left.student).localeCompare(String(right.student), 'pt-BR', { sensitivity: 'base' })
  )
}

function compareText(left = '', right = '') {
  return String(left).localeCompare(String(right), 'pt-BR', { sensitivity: 'base' })
}

function compareEntriesByField(left = {}, right = {}, field = 'sla') {
  switch (field) {
    case 'student':
      return compareText(left.student, right.student)
    case 'ra':
      return compareText(left.studentRa, right.studentRa)
    case 'polo':
      return compareText(left.polo, right.polo)
    case 'subject':
      return compareText(left.subject, right.subject)
    case 'next_step':
      return compareText(left.nextStepLabel, right.nextStepLabel)
    case 'status':
      return compareText(left.areaStatusLabel, right.areaStatusLabel)
    case 'owner':
      return compareText(left.currentAssigneeLabel, right.currentAssigneeLabel)
    case 'protocol':
      return compareText(left.id, right.id)
    case 'sla':
      return (left.sortTokens?.slaMinutes || 0) - (right.sortTokens?.slaMinutes || 0)
    default:
      return 0
  }
}

export function buildAreaQueueQuery(filters = {}, options = {}) {
  const page = Math.max(1, Number(filters.page || options.page || 1) || 1)
  const rawPageSize = Number(filters.pageSize || options.pageSize || AREA_QUEUE_DEFAULT_PAGE_SIZE) || AREA_QUEUE_DEFAULT_PAGE_SIZE
  const pageSize = Math.min(Math.max(1, rawPageSize), AREA_QUEUE_MAX_PAGE_SIZE)
  const direction = String(filters.sortDirection || options.sortDirection || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'

  return {
    search: String(filters.search || '').trim(),
    area: String(filters.area || 'todos'),
    subject: String(filters.subject || 'todos'),
    status: String(filters.status || 'todos'),
    owner: String(filters.owner || 'todos'),
    scopeState: String(filters.scopeState || 'todos'),
    bucket: String(filters.bucket || 'all'),
    sortField: String(filters.sortField || 'sla'),
    sortDirection: direction,
    page,
    pageSize,
  }
}

function sortAreaQueueEntries(entries = [], query = {}) {
  const direction = query.sortDirection === 'desc' ? -1 : 1
  const field = query.sortField || 'sla'

  return [...entries].sort((left, right) => {
    const primary = compareEntriesByField(left, right, field)

    if (primary !== 0) {
      return primary * direction
    }

    return compareEntriesByField(left, right, 'sla')
  })
}

export function runAreaQueueQuery(entries = [], filters = {}, options = {}) {
  const query = buildAreaQueueQuery(filters, options)
  const baseEntries = filterAreaQueueEntries(entries, {
    ...query,
    bucket: 'all',
  })
  const bucketEntries =
    query.bucket === 'all'
      ? baseEntries
      : baseEntries.filter((entry) => resolveAreaQueueBucket(entry) === query.bucket)
  const orderedEntries = sortAreaQueueEntries(bucketEntries, query)
  const startIndex = (query.page - 1) * query.pageSize
  const endIndex = startIndex + query.pageSize
  const items = orderedEntries.slice(startIndex, endIndex)
  const total = orderedEntries.length

  return {
    query,
    total,
    items,
    hasPreviousPage: query.page > 1,
    hasNextPage: endIndex < total,
  }
}

function matchesQuery(query = '', ...values) {
  const normalized = normalizeText(query)

  if (!normalized) {
    return true
  }

  return values.some((value) => normalizeText(value).includes(normalized))
}

function matchesFilter(activeValue = 'todos', candidate = '') {
  if (!activeValue || activeValue === 'todos') {
    return true
  }

  return normalizeText(activeValue) === normalizeText(candidate)
}

function buildFilterOptions(entries = [], field) {
  return [
    { value: 'todos', label: 'Todos' },
    ...Array.from(new Set(entries.map((entry) => entry[field]).filter(Boolean))).map((value) => ({
      value,
      label: value,
    })),
  ]
}

export function buildAreaQueueEntries({
  protocols = [],
  records = [],
  operatorActionLogs = [],
  areaActionLogs = [],
  subjectRules = [],
  assignments = [],
  userAvailability = [],
  operationalAreas = [],
  canonicalCaseProtocols = [],
  viewerContext = null,
} = {}) {
  const baseEntries = buildOperatorQueueEntries({
    protocols,
    actionLogs: operatorActionLogs,
    areaActionLogs,
    canonicalCaseProtocols,
    viewerContext: null,
  }).map((entry) => ({
    ...entry,
    operatorIntake:
      buildOperatorCaseDetail({
        caseId: entry.id,
        protocols,
        records,
        actionLogs: operatorActionLogs,
        areaActionLogs,
        canonicalCaseProtocols,
        viewerContext: null,
      })?.operatorIntake || null,
  }))

  return baseEntries
    .filter((entry) => isAreaRelevant(entry, areaActionLogs))
    .map((entry) =>
      buildAreaQueueEntry(
        entry,
        operatorActionLogs,
        areaActionLogs,
        assignments,
        subjectRules,
        userAvailability,
        operationalAreas,
        canonicalCaseProtocols,
        viewerContext,
      ),
    )
    .filter((entry) => matchesAreaScope(entry, viewerContext, getCaseAreaActionLogs(areaActionLogs, entry.id).at(-1) || null))
    .filter((entry) => canViewerAccessAreaSubject(entry, viewerContext, subjectRules))
    .sort(compareAreaEntries)
}

export function filterAreaQueueEntries(entries = [], filters = {}) {
  return entries.filter((entry) => {
    return (
      matchesQuery(filters.search, entry.searchText, entry.subject, entry.student, entry.studentRa, entry.id) &&
      matchesFilter(filters.area, entry.currentAreaLabel) &&
      matchesFilter(filters.subject, entry.subjectScopeLabel) &&
      matchesFilter(filters.status, entry.areaStatusLabel) &&
      matchesFilter(filters.owner, entry.currentAssigneeLabel) &&
      (!filters.scopeState || filters.scopeState === 'todos' || normalizeText(filters.scopeState) === normalizeText(entry.ownershipState))
    )
  })
}

export function buildAreaQueueFilterOptions(entries = []) {
  return {
    area: buildFilterOptions(entries, 'currentAreaLabel'),
    subject: buildFilterOptions(entries, 'subjectScopeLabel'),
    status: buildFilterOptions(entries, 'areaStatusLabel'),
    owner: buildFilterOptions(entries, 'currentAssigneeLabel'),
  }
}

function buildSummaryBullets(detail, latestEscalation) {
  const subjectLabel = String(detail.subject || 'atendimento').trim()
  const verifiedSummary = detail.operatorIntake?.verifiedSummary || latestEscalation?.note || ''
  const pendingLabel = String(detail.pendingLabel || 'retomar a analise deste caso').trim()

  return [
    `Assunto principal: ${withPeriod(subjectLabel)}`,
    verifiedSummary ? `Ja foi validado antes da area: ${withPeriod(verifiedSummary)}` : '',
    `O que falta agora: ${withPeriod(pendingLabel)}`,
  ].filter(Boolean)
}

function buildHandoffItems(detail, latestEscalation) {
  const playbook = detail.playbook || {}

  return [
    {
      label: 'Motivo do envio para a area',
      value:
        latestEscalation?.escalationReason ||
        playbook.escalationReason ||
        playbook.escalationCriteria ||
        'Escalonamento tecnico sem motivo estruturado na base atual.',
    },
    {
      label: 'O que ja foi validado',
      value:
        latestEscalation?.note ||
        detail.operatorIntake?.verifiedSummary ||
        'Sem subsidios detalhados no registro atual.',
    },
    {
      label: 'O que a area precisa decidir',
      value: detail.pendingLabel || 'Retomar a analise deste caso.',
    },
  ]
}

function buildAnalysisSections(detail) {
  const playbook = detail.playbook || {}
  const checklistItems = (playbook.checklist || []).slice(0, 3).map((item) => withPeriod(item))
  const systemItems = (playbook.systemsToCheck || []).slice(0, 2).map((item) => `Consultar ${item}.`)
  const documentItems = (playbook.documentsRequested || []).slice(0, 3).map(
    (item) => `Sem ${item}, o caminho normal e pedir complemento.`,
  )

  return [
    (checklistItems.length || systemItems.length)
      ? {
          title: 'Confirme antes de responder',
          items: [...checklistItems, ...systemItems].slice(0, 4),
        }
      : null,
    documentItems.length
      ? {
          title: 'Se faltar base, peca complemento',
          items: documentItems,
        }
      : null,
    {
      title: 'Saida normal',
      items: ['Se houver base suficiente, envie a resposta final para aluno e OP.'],
    },
    {
      title: 'Concluir analise interna',
      items: ['Conclua somente quando nao houver nova tratativa pendente para polo ou outra area.'],
    },
    {
      title: 'Excecao operacional',
      items: ['Encaminhe para outra area apenas quando sua area realmente nao puder resolver.'],
    },
  ].filter(Boolean)
}

function buildHistorySummary(detail) {
  const timeline = Array.isArray(detail.timeline) ? detail.timeline : []
  const attachments = Array.isArray(detail.attachments) ? detail.attachments : []
  const latestTimeline = [...timeline].filter(Boolean).slice(-2).reverse()
  const latestAttachment = attachments.at(-1)
  const items = latestTimeline.map((item) => {
    const itemLabel = item.atLabel || item.createdAtLabel || item.occurredAtLabel || 'Sem data'
    const itemTitle = item.title || item.description || 'Atualizacao registrada'
    return `${itemLabel}: ${withPeriod(itemTitle)}`
  })

  if (latestAttachment) {
    items.push(`Ultimo documento registrado: ${withPeriod(latestAttachment.name)}`)
  }

  return items.slice(0, 3)
}

function buildAvailableAreas(currentArea = '', visibleAreas = [], isManager = false) {
  if (isManager) {
    const base = Array.from(new Set([...DEFAULT_AREA_CATALOG, ...visibleAreas])).filter(Boolean)
    return base.filter((area) => normalizeText(area) !== normalizeText(currentArea))
  }

  const standardAreas = STANDARD_AREA_ESCALATION_MAP[currentArea] || []
  return standardAreas.filter((area) => normalizeText(area) !== normalizeText(currentArea))
}

function normalizeAreaDetail(detail = {}, areaEntry = {}) {
  const studentData = detail.studentData && typeof detail.studentData === 'object' ? detail.studentData : {}
  const playbook = detail.playbook && typeof detail.playbook === 'object' ? detail.playbook : {}

  return {
    ...detail,
    ...areaEntry,
    studentData: {
      nome: studentData.nome || areaEntry.student || 'Aluno nao informado',
      email: studentData.email || '',
      ra: studentData.ra || areaEntry.studentRa || '',
      curso: studentData.curso || '',
      polo: studentData.polo || areaEntry.polo || 'Nao informado',
    },
    timeline: sanitizeObjectCollection(detail.timeline),
    attachments: sanitizeObjectCollection(detail.attachments),
    interactions: sanitizeObjectCollection(detail.interactions),
    routingDecisions: sanitizeObjectCollection(detail.routingDecisions),
    caseKnowledgeUsages: sanitizeObjectCollection(detail.caseKnowledgeUsages),
    caseEvents: sanitizeObjectCollection(detail.caseEvents),
    playbook: {
      title: playbook.title || 'Orientacao da area indisponivel',
      checklist: Array.isArray(playbook.checklist) ? playbook.checklist : [],
      systemsToCheck: Array.isArray(playbook.systemsToCheck) ? playbook.systemsToCheck : [],
      documentsRequested: Array.isArray(playbook.documentsRequested) ? playbook.documentsRequested : [],
      responseTemplate: playbook.responseTemplate || '',
      escalationCriteria: playbook.escalationCriteria || '',
      escalationReason: playbook.escalationReason || '',
      matchedNodeId: playbook.matchedNodeId || null,
    },
  }
}

export function buildAreaCaseDetail({
  caseId,
  protocols = [],
  records = [],
  operatorActionLogs = [],
  areaActionLogs = [],
  subjectRules = [],
  assignments = [],
  userAvailability = [],
  operationalAreas = [],
  canonicalCaseProtocols = [],
  caseKnowledgeUsages = [],
  caseRoutingDecisions = [],
  caseEvents = [],
  viewerContext = null,
} = {}) {
  const detail = buildOperatorCaseDetail({
    caseId,
    protocols,
    records,
    actionLogs: operatorActionLogs,
    areaActionLogs,
    canonicalCaseProtocols,
    caseKnowledgeUsages,
    caseRoutingDecisions,
    caseEvents,
    viewerContext: null,
  })

  if (!detail) {
    return null
  }

  const strictEntries = buildAreaQueueEntries({
    protocols,
    records,
    operatorActionLogs,
    areaActionLogs,
    subjectRules,
    assignments,
    userAvailability,
    operationalAreas,
    canonicalCaseProtocols,
    viewerContext,
  })

  const relaxedViewerContext =
    viewerContext && viewerContext.currentArea
      ? {
          ...viewerContext,
          currentArea: '',
        }
      : viewerContext

  const relaxedEntries =
    relaxedViewerContext && relaxedViewerContext !== viewerContext
      ? buildAreaQueueEntries({
          protocols,
          records,
          operatorActionLogs,
          areaActionLogs,
          subjectRules,
          assignments,
          userAvailability,
          operationalAreas,
          canonicalCaseProtocols,
          viewerContext: relaxedViewerContext,
        })
      : []

  const areaEntry =
    strictEntries.find((entry) => entry.id === caseId) ||
    relaxedEntries.find((entry) => entry.id === caseId) ||
    null

  if (!areaEntry) {
    return null
  }

  const latestEscalation = getLatestOperatorEscalation(operatorActionLogs, caseId)
  const areaLogs = getCaseAreaActionLogs(areaActionLogs, caseId)
  const normalizedDetail = normalizeAreaDetail(detail, areaEntry)
  const requiredDocuments = Array.isArray(normalizedDetail.playbook?.documentsRequested)
    ? normalizedDetail.playbook.documentsRequested
    : []
  const systemsToCheck = Array.isArray(normalizedDetail.playbook?.systemsToCheck)
    ? normalizedDetail.playbook.systemsToCheck
    : []
  const attachments = Array.isArray(normalizedDetail.attachments) ? normalizedDetail.attachments : []
  const missingRequirements = []
  const hasOperationalOwner = Boolean(areaEntry.hasOperationalOwner)

  if (requiredDocuments.length && !attachments.length) {
    missingRequirements.push('documentos_evidencias')
  }

  if (systemsToCheck.length) {
    missingRequirements.push('checagens_sistema')
  }

  if (!hasOperationalOwner) {
    missingRequirements.push('owner_operacional')
  }

  const latestMeaningfulTimelineEvent = Array.isArray(normalizedDetail.timeline)
    ? normalizedDetail.timeline
      .slice()
      .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())[0] || null
    : null
  const recommendedAction = missingRequirements.includes('owner_operacional')
    ? 'reassign'
    : missingRequirements.includes('documentos_evidencias')
      ? 'request_complement'
      : 'technical_reply'
  const decisionStatus = missingRequirements.length ? 'missing_requirements' : 'ready_to_reply'

  return {
    ...normalizedDetail,
    summaryBullets: buildSummaryBullets(normalizedDetail, latestEscalation),
    handoffItems: buildHandoffItems(normalizedDetail, latestEscalation),
    analysisSections: buildAnalysisSections(normalizedDetail),
    historySummary: buildHistorySummary(normalizedDetail),
    availableAreas: buildAvailableAreas(
      areaEntry.currentAreaLabel,
      (operationalAreas || []).map((item) => item.areaLabel).filter(Boolean),
      viewerContext?.profileKey === 'gestor_area',
    ),
    standardAreas: buildAvailableAreas(areaEntry.currentAreaLabel, viewerContext?.visibleAreas || [], false),
    areaActionLogs: areaLogs,
    latestEscalation,
    scopeValid: true,
    decisionStatus,
    missingRequirements,
    recommendedAction,
    responseAllowed: hasOperationalOwner,
    exceptionAllowed: true,
    assignmentStatus:
      areaEntry.currentAssignment?.statusCode ||
      areaEntry.operationalOwnerStateCode ||
      areaEntry.ownershipState ||
      '',
    hasOperationalOwner,
    operationalOwnerStateCode: areaEntry.operationalOwnerStateCode || '',
    operationalOwnerStateLabel: areaEntry.operationalOwnerStateLabel || '',
    lastMeaningfulEvent: latestMeaningfulTimelineEvent
      ? {
          title: latestMeaningfulTimelineEvent.title || 'Ultimo evento registrado',
          at: latestMeaningfulTimelineEvent.at || null,
          atLabel: latestMeaningfulTimelineEvent.atLabel || '',
        }
      : null,
    contextLoadState: {
      opContextLoading: false,
      opContextError: '',
      guidanceLoading: false,
      guidanceError: '',
      historyLoading: false,
      historyError: '',
    },
  }
}

export function buildAreaActionLog({
  caseDetail,
  actionType,
  note = '',
  actorName = '',
  nextArea = '',
  isManagerException = false,
  currentDate = new Date(),
}) {
  const metadata = AREA_ACTION_METADATA[actionType]

  if (!metadata) {
    throw new Error(`Acao da area desconhecida: ${actionType}`)
  }

  const timestamp = buildTimestampParts(currentDate)
  const destination = metadata.destinationResolver(caseDetail, nextArea)
  const queueLabel = metadata.queueResolver(caseDetail, nextArea)
  const normalizedNote = note.trim() || metadata.defaultText({ caseDetail, destination })
  const pendingLabel =
    typeof metadata.pendingLabel === 'function'
      ? metadata.pendingLabel({ destination, caseDetail })
      : metadata.pendingLabel

  return {
    id: `area-action-${caseDetail.id}-${timestamp.compact}`,
    caseId: caseDetail.id,
    actor: actorName || 'Area interna',
    assigneeLabel: metadata.assigneeResolver(caseDetail, nextArea),
    actionType,
    actionLabel: metadata.title,
    occurredAt: timestamp.iso,
    occurredAtLabel: timestamp.label,
    statusBefore: caseDetail.status,
    statusAfter: metadata.statusLabel,
    statusLabel: metadata.statusLabel,
    canonicalStatusCode: metadata.canonicalStatusCode || '',
    pendingParty: metadata.pendingParty || '',
    closedBy: metadata.closedBy || '',
    queueBefore: caseDetail.queue,
    queueAfter: queueLabel,
    queueLabel,
    destinationLabel: destination,
    resolvedAreaLabel: destination,
    routingMode: actionType === 'reassign' && isManagerException ? 'manager_exception' : 'standard',
    pendingLabel,
    note: normalizedNote,
    timelineItem: {
      id: `area-timeline-${caseDetail.id}-${timestamp.compact}`,
      title:
        actionType === 'reassign' && isManagerException
          ? 'Caso reencaminhado por excecao gerencial'
          : metadata.title,
      description: metadata.buildDescription({ note: normalizedNote, destination }),
      at: timestamp.iso,
      atLabel: timestamp.label,
      tone: 'primary',
    },
    interactionItem: {
      id: `area-interaction-${caseDetail.id}-${timestamp.compact}`,
      actor: actorName || 'Area interna',
      channel: metadata.channel,
      text: normalizedNote,
      at: timestamp.iso,
      atLabel: timestamp.label,
    },
  }
}
