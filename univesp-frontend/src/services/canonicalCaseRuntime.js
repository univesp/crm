import {
  CASE_ASSIGNMENT_STATUSES,
  CASE_PROTOCOL_STATUSES,
  buildInitialKnowledgeUsageRecords,
  buildSubsubjectCode,
  buildSubjectCode,
  findKnowledgeDefinitionBySubject,
  normalizeCanonicalText,
} from '@/services/canonicalFoundationRuntime'
import {
  buildOperationalOwnerIntegrity,
  resolveOperationalOwnerFromProtocol,
} from '@/services/operationalOwnershipRuntime'

const CLOSED_CASE_STATUSES = new Set([CASE_PROTOCOL_STATUSES.RESOLVED, CASE_PROTOCOL_STATUSES.CLOSED])

function normalizeDate(value = new Date()) {
  return value instanceof Date ? value : new Date(value)
}

function formatDate(date) {
  const value = normalizeDate(date)
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function addHours(dateValue, hours = 0) {
  const baseDate = normalizeDate(dateValue)
  return new Date(baseDate.getTime() + Number(hours || 0) * 60 * 60 * 1000)
}

function normalizeSourceBindingValue(value = '') {
  return String(value || '').trim()
}

export function parseLegacySlaMinutes(slaLabel = '') {
  const normalized = normalizeCanonicalText(slaLabel)

  if (!normalized || normalized.includes('nao informado')) {
    return Number.MAX_SAFE_INTEGER
  }

  if (normalized.includes('encerrad')) {
    return Number.MAX_SAFE_INTEGER
  }

  if (normalized.includes('vencid') || normalized.includes('atrasad')) {
    return -1
  }

  const dayMatch = normalized.match(/(\d+)\s*d/)
  const hourMatch = normalized.match(/(\d+)\s*h/)
  const minuteMatch = normalized.match(/(\d+)\s*min/)

  if (dayMatch || hourMatch || minuteMatch) {
    return (
      Number.parseInt(dayMatch?.[1] || '0', 10) * 24 * 60 +
      Number.parseInt(hourMatch?.[1] || '0', 10) * 60 +
      Number.parseInt(minuteMatch?.[1] || '0', 10)
    )
  }

  return Number.MAX_SAFE_INTEGER - 1
}

function formatSlaLabelFromMinutes(minutesRemaining) {
  if (!Number.isFinite(minutesRemaining) || minutesRemaining >= Number.MAX_SAFE_INTEGER - 1) {
    return 'Nao informado'
  }

  if (minutesRemaining <= 0) {
    return 'Vencido'
  }

  const hours = Math.floor(minutesRemaining / 60)
  const minutes = minutesRemaining % 60

  if (hours >= 24 && minutes === 0) {
    return `${Math.ceil(hours / 24)}d`
  }

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes} min restantes`
  }

  if (hours > 0) {
    return `${hours}h uteis`
  }

  return `${minutes} min restantes`
}

export function buildCanonicalSla({
  statusCode = '',
  createdAt = '',
  slaPolicyCode = '',
  currentDate = new Date(),
  legacyLabel = '',
  legacyMinutes = null,
  preferLegacyLabel = false,
}) {
  if (CLOSED_CASE_STATUSES.has(statusCode)) {
    return {
      slaPolicyCode,
      slaDeadlineAt: null,
      slaState: 'closed',
      slaMinutesRemaining: Number.MAX_SAFE_INTEGER,
      slaLabel: 'Encerrado',
    }
  }

  const normalizedPolicy = String(slaPolicyCode || '').trim()
  const policyHoursMatch = normalizedPolicy.match(/(\d+)/)
  const policyHours = policyHoursMatch ? Number.parseInt(policyHoursMatch[1], 10) : null

  if (preferLegacyLabel && legacyLabel) {
    const fallbackMinutes = legacyMinutes == null ? parseLegacySlaMinutes(legacyLabel) : legacyMinutes

    return {
      slaPolicyCode,
      slaDeadlineAt: null,
      slaState:
        fallbackMinutes <= 0
          ? 'overdue'
          : fallbackMinutes <= 120
            ? 'at_risk'
            : fallbackMinutes >= Number.MAX_SAFE_INTEGER - 1
              ? 'unknown'
              : 'on_track',
      slaMinutesRemaining: fallbackMinutes,
      slaLabel: legacyLabel,
    }
  }

  if (createdAt && policyHours != null) {
    const deadline = addHours(createdAt, policyHours)
    const now = normalizeDate(currentDate)
    const minutesRemaining = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60))

    return {
      slaPolicyCode,
      slaDeadlineAt: deadline.toISOString(),
      slaState: minutesRemaining <= 0 ? 'overdue' : minutesRemaining <= 120 ? 'at_risk' : 'on_track',
      slaMinutesRemaining: minutesRemaining,
      slaLabel: formatSlaLabelFromMinutes(minutesRemaining),
    }
  }

  const fallbackMinutes = legacyMinutes == null ? parseLegacySlaMinutes(legacyLabel) : legacyMinutes

  return {
    slaPolicyCode,
    slaDeadlineAt: null,
    slaState:
      fallbackMinutes <= 0
        ? 'overdue'
        : fallbackMinutes <= 120
          ? 'at_risk'
          : fallbackMinutes >= Number.MAX_SAFE_INTEGER - 1
            ? 'unknown'
            : 'on_track',
    slaMinutesRemaining: fallbackMinutes,
    slaLabel: legacyLabel || formatSlaLabelFromMinutes(fallbackMinutes),
  }
}

export function mapLegacyCaseStatusCode({
  statusCode = '',
  statusLabel = '',
  pendingLabel = '',
  latestOperatorActionType = '',
  latestAreaActionType = '',
}) {
  const normalizedStatus = normalizeCanonicalText(statusLabel)
  const normalizedPending = normalizeCanonicalText(pendingLabel)
  const normalizedOperatorAction = normalizeCanonicalText(latestOperatorActionType)
  const normalizedAreaAction = normalizeCanonicalText(latestAreaActionType)

  if (Object.values(CASE_PROTOCOL_STATUSES).includes(statusCode)) {
    return statusCode
  }

  if (normalizedAreaAction === 'reassign' || normalizedStatus.includes('reencaminhado')) {
    return CASE_PROTOCOL_STATUSES.REROUTED
  }

  if (normalizedAreaAction === 'conclude' || normalizedStatus.includes('concluido pela area')) {
    return CASE_PROTOCOL_STATUSES.CLOSED
  }

  if (normalizedStatus.includes('faq')) {
    return CASE_PROTOCOL_STATUSES.CLOSED
  }

  if (normalizedAreaAction === 'technical_reply' || normalizedStatus.includes('respondido pela area')) {
    return CASE_PROTOCOL_STATUSES.IN_PROGRESS_OP
  }

  if (normalizedAreaAction === 'request_complement' || normalizedStatus.includes('complementacao solicitada pela area')) {
    return CASE_PROTOCOL_STATUSES.IN_PROGRESS_OP
  }

  if (normalizedOperatorAction === 'reply' || normalizedStatus.includes('respondido pelo op') || normalizedStatus.includes('leitura do aluno')) {
    return CASE_PROTOCOL_STATUSES.RESOLVED
  }

  if (
    normalizedOperatorAction === 'request_info' ||
    normalizedStatus.includes('complementacao do aluno') ||
    normalizedPending.includes('aluno precisa') ||
    normalizedPending.includes('complement')
  ) {
    return CASE_PROTOCOL_STATUSES.WAITING_STUDENT
  }

  if (
    normalizedOperatorAction === 'escalate' ||
    normalizedStatus.includes('escalado') ||
    normalizedStatus.includes('retorno da area') ||
    normalizedPending.includes('area') ||
    normalizedPending.includes('secretaria')
  ) {
    return CASE_PROTOCOL_STATUSES.WAITING_AREA
  }

  if (normalizedStatus.includes('triagem')) {
    return CASE_PROTOCOL_STATUSES.TRIAGE
  }

  return CASE_PROTOCOL_STATUSES.IN_PROGRESS_OP
}

export function resolvePendingParty({
  statusCode = '',
  latestOperatorActionType = '',
  latestAreaActionType = '',
}) {
  const normalizedOperatorAction = normalizeCanonicalText(latestOperatorActionType)
  const normalizedAreaAction = normalizeCanonicalText(latestAreaActionType)

  if (normalizedAreaAction === 'technical_reply' || normalizedAreaAction === 'request_complement') {
    return 'op'
  }

  if (statusCode === CASE_PROTOCOL_STATUSES.WAITING_STUDENT || normalizedOperatorAction === 'request_info') {
    return 'student'
  }

  if (
    statusCode === CASE_PROTOCOL_STATUSES.WAITING_AREA ||
    statusCode === CASE_PROTOCOL_STATUSES.IN_PROGRESS_AREA ||
    statusCode === CASE_PROTOCOL_STATUSES.REROUTED
  ) {
    return 'area'
  }

  if (statusCode === CASE_PROTOCOL_STATUSES.RESOLVED || statusCode === CASE_PROTOCOL_STATUSES.CLOSED) {
    return 'none'
  }

  return 'op'
}

export function resolveOperationalBucket(caseProtocol = {}) {
  if (caseProtocol.pendingParty === 'student') {
    return 'waiting_student'
  }

  if (caseProtocol.pendingParty === 'area' || caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.REROUTED) {
    return 'waiting_area'
  }

  if (CLOSED_CASE_STATUSES.has(caseProtocol.statusCode)) {
    return 'completed'
  }

  return 'needs_action'
}

export function resolveAreaBucket(caseProtocol = {}) {
  if (caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.REROUTED) {
    return 'rerouted'
  }

  if (caseProtocol.pendingParty === 'op' && caseProtocol.latestAreaActionType === 'request_complement') {
    return 'waiting_complement'
  }

  if (caseProtocol.latestAreaActionType === 'technical_reply') {
    return 'completed'
  }

  if (caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.RESOLVED || caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.CLOSED) {
    return 'completed'
  }

  return 'needs_review'
}

export function resolveOperationalStatusLabel(caseProtocol = {}) {
  if (caseProtocol.latestAreaActionType === 'technical_reply') {
    return 'Resposta da area'
  }

  if (caseProtocol.latestAreaActionType === 'request_complement') {
    return 'Area pediu complemento'
  }

  if (caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.REROUTED) {
    return 'Reencaminhado'
  }

  if (caseProtocol.closedBy === 'faq') {
    return 'Respondido FAQ'
  }

  if (caseProtocol.closedBy === 'area') {
    return 'Concluido pela area'
  }

  if (caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.RESOLVED) {
    return 'Respondido OP'
  }

  if (caseProtocol.slaState === 'overdue') {
    return 'Atrasado'
  }

  if (caseProtocol.pendingParty === 'student') {
    return 'Aguardando aluno'
  }

  if (caseProtocol.pendingParty === 'area') {
    return 'Aguardando area'
  }

  if (caseProtocol.criticalityCode === 'critica' || caseProtocol.slaState === 'at_risk') {
    return 'Urgente'
  }

  if (caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.TRIAGE) {
    return 'Em triagem'
  }

  return 'Pendente'
}

export function resolveAreaStatusLabel(caseProtocol = {}) {
  if (caseProtocol.statusCode === CASE_PROTOCOL_STATUSES.REROUTED) {
    return 'Reencaminhado'
  }

  if (caseProtocol.latestAreaActionType === 'request_complement') {
    return 'Aguardando complemento'
  }

  if (caseProtocol.closedBy === 'area') {
    return 'Concluido pela area'
  }

  if (caseProtocol.latestAreaActionType === 'technical_reply') {
    return 'Respondido pela area'
  }

  return 'Precisa de analise'
}

export function shouldShowOperationalDeadline(caseProtocol = {}) {
  return caseProtocol.pendingParty !== 'student' && caseProtocol.statusCode !== CASE_PROTOCOL_STATUSES.REROUTED
}

export function shouldShowAreaDeadline(caseProtocol = {}) {
  return resolveAreaBucket(caseProtocol) === 'needs_review'
}

export function buildCanonicalProtocolFromSeed(seedItem = {}, currentDate = new Date(), knowledgeFoundation = undefined) {
  const themeKey = seedItem.theme || ''
  const subsubjectKey = seedItem.subtheme || ''
  const knowledgeDefinition = findKnowledgeDefinitionBySubject(themeKey, subsubjectKey, knowledgeFoundation)
  const statusCode = mapLegacyCaseStatusCode({
    statusCode: seedItem.statusCode,
    statusLabel: seedItem.status,
    pendingLabel: seedItem.pendingLabel,
  })
  const pendingParty = seedItem.pendingParty || resolvePendingParty({ statusCode })
  const criticalityCode = normalizeCanonicalText(seedItem.criticality || 'media')
  const sla =
    seedItem.slaState || seedItem.slaDeadlineAt || Number.isFinite(seedItem.slaMinutesRemaining)
      ? {
          slaPolicyCode: knowledgeDefinition.studentNode?.defaultSlaPolicyCode || '',
          slaDeadlineAt: seedItem.slaDeadlineAt || null,
          slaState: seedItem.slaState || 'unknown',
          slaMinutesRemaining:
            typeof seedItem.slaMinutesRemaining === 'number'
              ? seedItem.slaMinutesRemaining
              : parseLegacySlaMinutes(seedItem.sla),
          slaLabel: seedItem.slaLabel || seedItem.sla || '',
        }
      : buildCanonicalSla({
          statusCode,
          createdAt: seedItem.createdAt,
          slaPolicyCode: knowledgeDefinition.studentNode?.defaultSlaPolicyCode || '',
          currentDate,
          legacyLabel: seedItem.sla,
          preferLegacyLabel: true,
        })

  const ownershipSnapshot = resolveOperationalOwnerFromProtocol(
    {
      ownerType: seedItem.ownerType || 'area',
      ownerKey: seedItem.ownerKey || '',
      ownerQueue: seedItem.ownerQueue || '',
      ownerArea: seedItem.ownerArea || seedItem.queue || '',
      ownerRole: seedItem.ownerRole || '',
      ownerRoutingHint: seedItem.ownerRoutingHint || '',
      ownerSource: seedItem.ownerSource || 'seed_legacy',
      queueLabel: seedItem.queue || '',
      currentAreaLabel: seedItem.queue || '',
      lastMileAreaLabel: seedItem.queue || '',
    },
    {
      fallbackQueue: seedItem.queue || '',
      fallbackArea: seedItem.queue || '',
      source: seedItem.ownerSource || 'seed_legacy',
    },
  )
  const ownershipIntegrity = buildOperationalOwnerIntegrity(ownershipSnapshot)
  const sourceBundleId = normalizeSourceBindingValue(
    seedItem.sourceBundleId ||
      knowledgeDefinition.studentNode?.bundleId ||
      knowledgeDefinition.operatorNode?.bundleId ||
      (themeKey ? `legacy-bundle:${themeKey}` : ''),
  )
  const sourceBundleVersionId = normalizeSourceBindingValue(
    seedItem.sourceBundleVersionId ||
      knowledgeDefinition.studentNode?.bundleVersionId ||
      knowledgeDefinition.operatorNode?.bundleVersionId ||
      (sourceBundleId ? 'legacy' : ''),
  )
  const sourceNodeId = normalizeSourceBindingValue(
    seedItem.sourceNodeId ||
      seedItem.currentNodeId ||
      knowledgeDefinition.studentNode?.id ||
      knowledgeDefinition.operatorNode?.id ||
      (seedItem.id ? `legacy-node:${seedItem.id}` : ''),
  )
  const hasSourceBinding = Boolean(sourceBundleId && sourceNodeId)

  return {
    id: seedItem.id,
    protocolNumber: seedItem.id,
    sourceType: 'seed_queue',
    subjectCode: buildSubjectCode(themeKey),
    subsubjectCode: buildSubsubjectCode(themeKey, subsubjectKey),
    themeKey,
    subsubjectKey,
    currentNodeId: knowledgeDefinition.studentNode?.id || knowledgeDefinition.operatorNode?.id || null,
    statusCode,
    pendingParty,
    criticalityCode,
    slaPolicyCode: knowledgeDefinition.studentNode?.defaultSlaPolicyCode || '',
    slaDeadlineAt: sla.slaDeadlineAt,
    slaState: sla.slaState,
    slaMinutesRemaining: sla.slaMinutesRemaining,
    slaLabel: sla.slaLabel,
    queueLabel: seedItem.queue,
    currentAreaLabel: seedItem.queue,
    lastMileAreaLabel: seedItem.queue,
    ownerType: ownershipSnapshot.ownerType || '',
    ownerKey: ownershipSnapshot.ownerKey || '',
    ownerQueue: ownershipSnapshot.ownerQueue || '',
    ownerArea: ownershipSnapshot.ownerArea || '',
    ownerRole: ownershipSnapshot.ownerRole || '',
    ownerSource: ownershipSnapshot.source || '',
    ownerRoutingHint: ownershipSnapshot.routingHint || '',
    hasOperationalOwner: Boolean(ownershipSnapshot.hasOwner),
    ownershipStateCode: ownershipSnapshot.stateCode || '',
    ownershipIntegrityMessage: ownershipIntegrity.message || '',
    operationalOwnerSnapshot: { ...ownershipSnapshot },
    sourceBundleId,
    sourceBundleVersionId,
    sourceNodeId,
    hasSourceBinding,
    sourceBindingStateCode: hasSourceBinding ? 'source_binding_resolved' : 'source_binding_missing',
    routingMode: 'standard',
    exceptionReason: '',
    openedChannel: seedItem.source || 'portal_aluno',
    createdAt: seedItem.createdAt || '',
    createdAtLabel: seedItem.createdAtLabel || (seedItem.createdAt ? formatDate(seedItem.createdAt) : ''),
    latestOperatorActionType: '',
    latestAreaActionType: '',
    closedBy:
      seedItem.closedBy ||
      (normalizeCanonicalText(seedItem.status).includes('faq')
        ? 'faq'
        : normalizeCanonicalText(seedItem.status).includes('concluido pela area')
          ? 'area'
          : normalizeCanonicalText(seedItem.status).includes('respondido')
            ? 'op'
            : ''),
  }
}

export function buildCanonicalProtocolFromLocalProtocol(protocol = {}, currentDate = new Date(), knowledgeFoundation = undefined) {
  const themeKey = protocol.context?.theme || ''
  const subsubjectKey = protocol.context?.subtheme || protocol.context?.finalNode?.title || ''
  const knowledgeDefinition = findKnowledgeDefinitionBySubject(themeKey, subsubjectKey, knowledgeFoundation)
  const statusCode = mapLegacyCaseStatusCode({
    statusCode: protocol.statusCode,
    statusLabel: protocol.statusLabel,
    pendingLabel: protocol.pendingLabel,
  })
  const pendingParty = protocol.pendingParty || resolvePendingParty({ statusCode })
  const criticalityCode = normalizeCanonicalText(protocol.context?.criticality || 'media')
  const sla =
    protocol.slaState || protocol.slaDeadlineAt || Number.isFinite(protocol.slaMinutesRemaining)
      ? {
          slaPolicyCode: protocol.slaPolicyCode || protocol.context?.sla || knowledgeDefinition.studentNode?.defaultSlaPolicyCode || '',
          slaDeadlineAt: protocol.slaDeadlineAt || null,
          slaState: protocol.slaState || 'unknown',
          slaMinutesRemaining:
            typeof protocol.slaMinutesRemaining === 'number'
              ? protocol.slaMinutesRemaining
              : parseLegacySlaMinutes(protocol.slaLabel || protocol.context?.sla || ''),
          slaLabel: protocol.slaLabel || protocol.context?.sla || '',
        }
      : buildCanonicalSla({
          statusCode,
          createdAt: protocol.createdAt,
          slaPolicyCode: protocol.context?.sla || knowledgeDefinition.studentNode?.defaultSlaPolicyCode || '',
          currentDate,
          legacyLabel: protocol.slaLabel || protocol.context?.sla || '',
        })

  const ownershipSnapshot = resolveOperationalOwnerFromProtocol(
    {
      ...protocol,
      ownerType: protocol.ownerType || '',
      ownerKey: protocol.ownerKey || '',
      ownerQueue: protocol.ownerQueue || '',
      ownerArea: protocol.ownerArea || '',
      ownerRole: protocol.ownerRole || '',
      ownerRoutingHint: protocol.ownerRoutingHint || protocol.routingHint || '',
      ownerSource: protocol.ownerSource || protocol.context?.ownership?.source || '',
      queueLabel: protocol.queueLabel || protocol.context?.routing?.currentQueueLabel || '',
      currentAreaLabel: protocol.currentAreaLabel || '',
      lastMileAreaLabel:
        protocol.lastMileAreaLabel || protocol.context?.routing?.targetAreaLabel || '',
      context: protocol.context || {},
    },
    {
      fallbackQueue:
        protocol.queueLabel || protocol.context?.routing?.currentQueueLabel || protocol.context?.queueDestination || '',
      fallbackArea:
        protocol.lastMileAreaLabel || protocol.context?.routing?.targetAreaLabel || protocol.currentAreaLabel || '',
      source: protocol.ownerSource || 'local_protocol',
    },
  )
  const ownershipIntegrity = buildOperationalOwnerIntegrity(ownershipSnapshot)
  const sourceBundleId = normalizeSourceBindingValue(
    protocol.sourceBundleId || protocol.context?.finalNode?.bundleId || '',
  )
  const sourceBundleVersionId = normalizeSourceBindingValue(
    protocol.sourceBundleVersionId || protocol.context?.finalNode?.bundleVersionId || '',
  )
  const sourceNodeId = normalizeSourceBindingValue(
    protocol.sourceNodeId || protocol.currentNodeId || protocol.context?.finalNode?.id || '',
  )
  const hasSourceBinding = Boolean(sourceBundleId && sourceNodeId)

  return {
    id: protocol.protocolNumber,
    protocolNumber: protocol.protocolNumber,
    sourceType: protocol.source || 'portal_aluno',
    subjectCode: buildSubjectCode(themeKey),
    subsubjectCode: buildSubsubjectCode(themeKey, subsubjectKey),
    themeKey,
    subsubjectKey,
    currentNodeId: protocol.context?.finalNode?.id || knowledgeDefinition.studentNode?.id || knowledgeDefinition.operatorNode?.id || null,
    statusCode,
    pendingParty,
    criticalityCode,
    slaPolicyCode: protocol.context?.sla || knowledgeDefinition.studentNode?.defaultSlaPolicyCode || '',
    slaDeadlineAt: sla.slaDeadlineAt,
    slaState: sla.slaState,
    slaMinutesRemaining: sla.slaMinutesRemaining,
    slaLabel: sla.slaLabel,
    queueLabel: protocol.queueLabel || protocol.context?.routing?.currentQueueLabel || '',
    currentAreaLabel: protocol.lastMileAreaLabel || protocol.context?.routing?.targetAreaLabel || '',
    lastMileAreaLabel: protocol.lastMileAreaLabel || protocol.context?.routing?.targetAreaLabel || '',
    ownerType: ownershipSnapshot.ownerType || '',
    ownerKey: ownershipSnapshot.ownerKey || '',
    ownerQueue: ownershipSnapshot.ownerQueue || '',
    ownerArea: ownershipSnapshot.ownerArea || '',
    ownerRole: ownershipSnapshot.ownerRole || '',
    ownerSource: ownershipSnapshot.source || '',
    ownerRoutingHint: ownershipSnapshot.routingHint || '',
    hasOperationalOwner: Boolean(ownershipSnapshot.hasOwner),
    ownershipStateCode: ownershipSnapshot.stateCode || '',
    ownershipIntegrityMessage: ownershipIntegrity.message || '',
    operationalOwnerSnapshot: { ...ownershipSnapshot },
    sourceBundleId,
    sourceBundleVersionId,
    sourceNodeId,
    hasSourceBinding,
    sourceBindingStateCode: hasSourceBinding ? 'source_binding_resolved' : 'source_binding_missing',
    routingMode: protocol.routingMode || 'standard',
    exceptionReason: protocol.context?.routing?.exceptionReason || '',
    openedChannel: protocol.operatorIntake?.channel || protocol.source || 'portal_aluno',
    createdAt: protocol.createdAt || '',
    createdAtLabel: protocol.createdAtLabel || (protocol.createdAt ? formatDate(protocol.createdAt) : ''),
    latestOperatorActionType: '',
    latestAreaActionType: '',
    closedBy:
      protocol.closedBy ||
      (normalizeCanonicalText(protocol.statusLabel).includes('faq')
        ? 'faq'
        : normalizeCanonicalText(protocol.statusLabel).includes('conclu')
          ? 'area'
          : normalizeCanonicalText(protocol.statusLabel).includes('respondido')
            ? 'op'
            : ''),
  }
}

export function buildCanonicalAssignmentRecord({
  caseId = '',
  areaLabel = '',
  analystName = '',
  assignedBy = '',
  assignedAt = new Date().toISOString(),
  reason = '',
  assignmentMode = 'manager_manual',
  assignmentStatusCode = '',
  previousAssignment = null,
  scoreSummary = null,
}) {
  const statusCode =
    assignmentStatusCode ||
    (analystName
      ? previousAssignment?.analystName && normalizeCanonicalText(previousAssignment.analystName) !== normalizeCanonicalText(analystName)
        ? CASE_ASSIGNMENT_STATUSES.REASSIGNED
        : CASE_ASSIGNMENT_STATUSES.ASSIGNED
      : CASE_ASSIGNMENT_STATUSES.PENDING_ASSIGNMENT)

  return {
    id: `assignment:${caseId}:${new Date(assignedAt).getTime()}:${normalizeCanonicalText(analystName || 'unassigned') || 'unassigned'}`,
    caseId,
    areaLabel,
    analystName,
    assignedBy,
    assignedAt,
    assignedAtLabel: formatDate(assignedAt),
    reason,
    assignmentMode,
    statusCode,
    scoreSummary,
  }
}

export function buildCanonicalRoutingDecision({
  caseId = '',
  sourceNodeId = '',
  defaultAreaLabel = '',
  resolvedAreaLabel = '',
  routingMode = 'standard',
  justification = '',
  decidedBy = '',
  decidedAt = new Date().toISOString(),
}) {
  return {
    id: `routing:${caseId}:${new Date(decidedAt).getTime()}`,
    caseId,
    sourceNodeId,
    defaultAreaLabel,
    resolvedAreaLabel,
    routingMode,
    justification,
    decidedBy,
    decidedAt,
    decidedAtLabel: formatDate(decidedAt),
  }
}

export function buildCanonicalCaseEvent({
  caseId = '',
  eventType = '',
  actor = '',
  actorRole = '',
  fromStatus = '',
  toStatus = '',
  description = '',
  payload = {},
  createdAt = new Date().toISOString(),
}) {
  return {
    id: `case-event:${caseId}:${new Date(createdAt).getTime()}:${eventType}`,
    caseId,
    eventType,
    actor,
    actorRole,
    fromStatus,
    toStatus,
    description,
    payload,
    createdAt,
    createdAtLabel: formatDate(createdAt),
  }
}

export function buildInitialKnowledgeUsageForProtocol({
  protocolId = '',
  themeKey = '',
  subsubjectKey = '',
  actorName = '',
  actorRole = '',
  usedAt = new Date().toISOString(),
  knowledgeFoundation = undefined,
}) {
  return buildInitialKnowledgeUsageRecords({
    caseId: protocolId,
    themeKey,
    subsubjectKey,
    actorName,
    actorRole,
    usedAt,
    knowledgeFoundation,
  })
}
