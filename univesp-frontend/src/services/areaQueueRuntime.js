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

const DEFAULT_AREA_CATALOG = ['Secretaria Academica', 'Suporte Academico Digital', 'Financeiro']
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
    currentAssigneeLabel: assignment?.analystName || 'Sem responsavel',
    currentAssigneeMeta:
      assignment?.analystName
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
    subjectScopeRule: subjectRule,
    areaBucket,
    searchText: [entry.id, entry.student, entry.studentRa, entry.polo, entry.subject, contextFromOp, queue, status].join(' '),
  }
}

function compareAreaEntries(left, right) {
  return (
    left.sortTokens.slaMinutes - right.sortTokens.slaMinutes ||
    new Date(right.activityAt || 0).getTime() - new Date(left.activityAt || 0).getTime() ||
    String(left.student).localeCompare(String(right.student), 'pt-BR', { sensitivity: 'base' })
  )
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
      matchesFilter(filters.status, entry.areaStatusLabel) &&
      matchesFilter(filters.owner, entry.currentAssigneeLabel) &&
      (!filters.scopeState || filters.scopeState === 'todos' || normalizeText(filters.scopeState) === normalizeText(entry.ownershipState))
    )
  })
}

export function buildAreaQueueFilterOptions(entries = []) {
  return {
    area: buildFilterOptions(entries, 'currentAreaLabel'),
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
