function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

export const AREA_CASE_SUMMARY_MINIMAL_PAYLOAD = Object.freeze({
  scopeValid: 'boolean',
  decisionStatus: 'scope_invalid|read_only|missing_requirements|ready_to_reply|ready_to_request_complement|in_review',
  missingRequirements: 'string[]',
  recommendedAction: 'technical_reply|request_complement|conclude|reassign',
  responseAllowed: 'boolean',
  exceptionAllowed: 'boolean',
  assignmentStatus: 'string',
  hasOperationalOwner: 'boolean',
  operationalOwnerStateCode: 'string',
  operationalOwnerStateLabel: 'string',
  lastMeaningfulEvent: 'null | { title: string, at: string|null, atLabel: string }',
})

export const AREA_CASE_SUMMARY_SERVER_CANONICAL_FIELDS = Object.freeze([
  'scopeValid',
  'decisionStatus',
  'missingRequirements',
  'recommendedAction',
  'responseAllowed',
  'exceptionAllowed',
  'assignmentStatus',
  'hasOperationalOwner',
  'operationalOwnerStateCode',
  'operationalOwnerStateLabel',
  'lastMeaningfulEvent',
])

export const AREA_CASE_SUMMARY_FRONT_DERIVED_FIELDS = Object.freeze([
  'decisionStatus (fallback mock)',
  'missingRequirements (fallback mock)',
  'recommendedAction (fallback mock)',
])

export const AREA_CASE_DETAIL_BACKEND_ERROR_STATES = Object.freeze([
  'case_not_found',
  'scope_invalid',
  'assignment_conflict',
  'action_not_allowed',
  'sync_conflict',
  'history_unavailable',
  'guidance_unavailable',
])

function resolveMissingRequirements({
  detail = null,
  preDecisionChecks = [],
  concludeReadiness = null,
} = {}) {
  const missing = []

  for (const check of preDecisionChecks) {
    const requirementCode = String(check.requirementCode || '').trim()
    const isPending = typeof check.isPending === 'boolean'
      ? check.isPending
      : normalizeText(check.statusLabel || '').includes('pendente')

    if (requirementCode && isPending) {
      missing.push(requirementCode)
    }
  }

  if (concludeReadiness?.required && !concludeReadiness.canConclude) {
    missing.push('resposta_final_obrigatoria')
  }

  if (!detail?.contextFromOp) {
    missing.push('contexto_op_incompleto')
  }

  return Array.from(new Set(missing))
}

function resolveDecisionStatus({
  scopeValid = false,
  canAct = false,
  missingRequirements = [],
  recommendedAction = '',
} = {}) {
  if (!scopeValid) {
    return 'scope_invalid'
  }

  if (!canAct) {
    return 'read_only'
  }

  if (missingRequirements.length) {
    return 'missing_requirements'
  }

  if (recommendedAction === 'technical_reply') {
    return 'ready_to_reply'
  }

  if (recommendedAction === 'request_complement') {
    return 'ready_to_request_complement'
  }

  return 'in_review'
}

function resolveLastMeaningfulEvent(detail = null) {
  if (!detail) {
    return null
  }

  const timeline = Array.isArray(detail.timeline) ? detail.timeline : []
  const caseEvents = Array.isArray(detail.caseEvents) ? detail.caseEvents : []

  const latestTimeline = timeline
    .slice()
    .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())[0]

  if (latestTimeline) {
    return {
      title: latestTimeline.title || 'Ultimo evento registrado',
      at: latestTimeline.at || null,
      atLabel: latestTimeline.atLabel || '',
    }
  }

  const latestEvent = caseEvents
    .slice()
    .sort((left, right) => new Date(right.occurredAt || 0).getTime() - new Date(left.occurredAt || 0).getTime())[0]

  if (!latestEvent) {
    return null
  }

  return {
    title: latestEvent.eventLabel || latestEvent.eventType || 'Ultimo evento registrado',
    at: latestEvent.occurredAt || null,
    atLabel: latestEvent.occurredAtLabel || '',
  }
}

export function buildAreaCaseSummaryBackendReadiness({
  hasServerSummary = false,
} = {}) {
  return {
    hasServerSummary,
    minimalPayload: AREA_CASE_SUMMARY_MINIMAL_PAYLOAD,
    serverCanonicalFields: [...AREA_CASE_SUMMARY_SERVER_CANONICAL_FIELDS],
    frontDerivedFallbackFields: [...AREA_CASE_SUMMARY_FRONT_DERIVED_FIELDS],
    backendErrorStates: [...AREA_CASE_DETAIL_BACKEND_ERROR_STATES],
  }
}

export function buildAreaCaseSummaryPayload({
  detail = null,
  detailAccessState = null,
  decisionSuggestion = null,
  preDecisionChecks = [],
  concludeReadiness = null,
  actionAvailability = null,
  actionAuthorization = {},
} = {}) {
  const scopeValid = Boolean(detail) && !detailAccessState
  const recommendedAction = decisionSuggestion?.actionId || 'technical_reply'
  const missingRequirements = resolveMissingRequirements({
    detail,
    preDecisionChecks,
    concludeReadiness,
  })
  const decisionStatus = resolveDecisionStatus({
    scopeValid,
    canAct: Boolean(actionAvailability?.canAct),
    missingRequirements,
    recommendedAction,
  })
  const responseAllowed = Boolean(actionAuthorization?.technical_reply?.allowed)
  const exceptionAllowed = Boolean(actionAuthorization?.reassign?.allowed)
  const assignmentStatus =
    detail?.currentAssignment?.statusCode ||
    detail?.operationalOwnerStateCode ||
    detail?.ownershipState ||
    ''

  return {
    scopeValid,
    decisionStatus,
    missingRequirements,
    recommendedAction,
    responseAllowed,
    exceptionAllowed,
    assignmentStatus,
    hasOperationalOwner: Boolean(detail?.hasOperationalOwner),
    operationalOwnerStateCode: detail?.operationalOwnerStateCode || '',
    operationalOwnerStateLabel: detail?.operationalOwnerStateLabel || '',
    lastMeaningfulEvent: resolveLastMeaningfulEvent(detail),
  }
}
