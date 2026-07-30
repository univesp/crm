function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase()
}

export const OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS = Object.freeze({
  DRAFT_CREATE: 'draft_create',
  PROTOCOL_CREATE: 'protocol_create',
  PROTOCOL_UPDATE: 'protocol_update',
  PROTOCOL_FOLLOW_UP: 'protocol_follow_up',
  BUNDLE_IMPORT: 'bundle_import',
  BUNDLE_PUBLISH: 'bundle_publish',
})

export const OPERATIONAL_OWNERSHIP_BACKEND_INVARIANTS = Object.freeze([
  'publish_requires_full_ownership_coverage',
  'draft_requires_effective_owner',
  'protocol_requires_effective_owner',
  'owner_reference_must_exist',
  'source_binding_required_when_origin_is_faq',
  'bundle_version_required_when_origin_is_faq',
  'opened_case_owner_snapshot_is_immutable',
  'active_session_keeps_source_bundle_version',
])

export const OPERATIONAL_OWNERSHIP_BACKEND_REQUIRED_CHECKS = Object.freeze({
  [OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.DRAFT_CREATE]: [
    'owner_presence',
    'owner_reference',
    'source_binding',
    'bundle_version',
  ],
  [OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE]: [
    'owner_presence',
    'owner_reference',
    'source_binding',
    'bundle_version',
  ],
  [OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_UPDATE]: [
    'owner_presence',
    'owner_reference',
    'source_binding',
    'bundle_version',
    'owner_snapshot_immutable',
  ],
  [OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_FOLLOW_UP]: [
    'owner_presence',
    'owner_reference',
    'source_binding',
    'bundle_version',
  ],
  [OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.BUNDLE_IMPORT]: [
    'bundle_default_owner',
    'final_node_effective_owner',
    'owner_reference',
  ],
  [OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.BUNDLE_PUBLISH]: [
    'bundle_default_owner',
    'final_node_effective_owner',
    'owner_reference',
    'ownership_coverage',
  ],
})

export const OPERATIONAL_OWNERSHIP_BACKEND_ERROR_CATALOG = Object.freeze({
  OWNER_MISSING: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'Operational owner is missing in payload.',
    userMessage: 'Nao foi possivel continuar porque o fluxo esta sem dono operacional.',
    entity: 'protocol',
    field: 'owner',
    uiAction: 'review_ownership_source',
  }),
  INVALID_OWNER_TYPE: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'ownerType is invalid.',
    userMessage: 'Tipo de ownership invalido. Revise fila, area ou role.',
    entity: 'protocol',
    field: 'ownerType',
    uiAction: 'review_owner_type',
  }),
  OWNER_REFERENCE_INVALID: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'Owner reference does not match owner payload.',
    userMessage: 'Referencia de ownership invalida. Revise os campos de destino operacional.',
    entity: 'protocol',
    field: 'ownerKey',
    uiAction: 'review_owner_reference',
  }),
  OWNER_QUEUE_NOT_FOUND: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'Queue reference was not found.',
    userMessage: 'Fila operacional nao encontrada para este fluxo.',
    entity: 'protocol',
    field: 'ownerQueue',
    uiAction: 'review_queue_catalog',
  }),
  OWNER_AREA_NOT_FOUND: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'Area reference was not found.',
    userMessage: 'Area responsavel nao encontrada para este fluxo.',
    entity: 'protocol',
    field: 'ownerArea',
    uiAction: 'review_area_catalog',
  }),
  OWNER_ROLE_NOT_FOUND: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'Role reference was not found.',
    userMessage: 'Role responsavel nao encontrada para este fluxo.',
    entity: 'protocol',
    field: 'ownerRole',
    uiAction: 'review_role_catalog',
  }),
  SOURCE_BINDING_INVALID: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'Source bundle/node binding is invalid or missing.',
    userMessage: 'Origem do fluxo nao foi vinculada corretamente. Reabra o fluxo antes de enviar.',
    entity: 'protocol',
    field: 'sourceBinding',
    uiAction: 'restart_from_faq',
  }),
  BUNDLE_VERSION_REQUIRED: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'sourceBundleVersionId is required.',
    userMessage: 'Versao da base de conhecimento ausente. Atualize o fluxo e tente novamente.',
    entity: 'protocol',
    field: 'sourceBundleVersionId',
    uiAction: 'refresh_bundle_context',
  }),
  MISSING_SOURCE_NODE: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'sourceNodeId is required.',
    userMessage: 'No de origem nao foi identificado. Reabra a jornada e tente novamente.',
    entity: 'protocol',
    field: 'sourceNodeId',
    uiAction: 'restart_from_faq',
  }),
  PUBLISH_BLOCKED_BY_OWNERSHIP_COVERAGE: Object.freeze({
    httpStatus: 422,
    technicalMessage: 'Publishing denied due to ownership coverage errors.',
    userMessage: 'Publicacao bloqueada: existem respostas finais sem ownership efetivo.',
    entity: 'bundle',
    field: 'ownershipCoverage',
    uiAction: 'fix_ownership_blockers',
  }),
  LEGACY_OWNERSHIP_REQUIRES_MIGRATION: Object.freeze({
    httpStatus: 409,
    technicalMessage: 'Legacy ownership payload requires migration.',
    userMessage: 'Esse caso usa ownership legado e precisa ser migrado antes da operacao.',
    entity: 'protocol',
    field: 'legacyOwnership',
    uiAction: 'run_legacy_migration',
  }),
  LEGACY_SOURCE_BINDING_REQUIRES_MIGRATION: Object.freeze({
    httpStatus: 409,
    technicalMessage: 'Legacy source binding requires migration.',
    userMessage: 'O vinculo de origem legado precisa ser migrado para versao canonica.',
    entity: 'protocol',
    field: 'sourceBinding',
    uiAction: 'run_legacy_migration',
  }),
  LEGACY_FALLBACK_REQUIRES_MIGRATION: Object.freeze({
    httpStatus: 409,
    technicalMessage: 'Fallback-based ownership requires migration.',
    userMessage: 'Ownership resolvido por fallback legado precisa ser corrigido.',
    entity: 'protocol',
    field: 'operationalOwnerSnapshot',
    uiAction: 'run_legacy_migration',
  }),
})

export function getOperationalOwnershipBackendErrorDefinition(code = '') {
  const normalizedCode = normalizeCode(code)
  return (
    OPERATIONAL_OWNERSHIP_BACKEND_ERROR_CATALOG[normalizedCode] ||
    OPERATIONAL_OWNERSHIP_BACKEND_ERROR_CATALOG.OWNER_REFERENCE_INVALID
  )
}

export function buildOperationalOwnershipBackendError({
  code = '',
  technicalMessage = '',
  userMessage = '',
  field = '',
  entity = '',
  details = null,
} = {}) {
  const normalizedCode = normalizeCode(code)
  const definition = getOperationalOwnershipBackendErrorDefinition(normalizedCode)

  return {
    code: normalizedCode || 'OWNER_REFERENCE_INVALID',
    httpStatus: definition.httpStatus,
    technicalMessage: technicalMessage || definition.technicalMessage,
    userMessage: userMessage || definition.userMessage,
    field: field || definition.field,
    entity: entity || definition.entity,
    uiAction: definition.uiAction,
    details: details || null,
  }
}

export function mapOwnershipIssueToBackendErrorCode(issueCode = '') {
  const normalized = String(issueCode || '').trim()
  switch (normalized) {
    case 'ownerType':
    case 'ownerKey':
    case 'ownerQueue':
    case 'ownerArea':
    case 'ownerRole':
    case 'ownershipStateCode':
      return 'OWNER_MISSING'
    case 'ownerType_invalid':
      return 'INVALID_OWNER_TYPE'
    case 'ownerKey_mismatch':
      return 'OWNER_REFERENCE_INVALID'
    case 'ownerQueue_reference_invalid':
      return 'OWNER_QUEUE_NOT_FOUND'
    case 'ownerArea_reference_invalid':
      return 'OWNER_AREA_NOT_FOUND'
    case 'ownerRole_reference_invalid':
      return 'OWNER_ROLE_NOT_FOUND'
    case 'sourceBundleId':
    case 'sourceNodeId':
      return 'SOURCE_BINDING_INVALID'
    case 'sourceBundleVersionId':
      return 'BUNDLE_VERSION_REQUIRED'
    case 'missing_source_node':
      return 'MISSING_SOURCE_NODE'
    case 'bundle_without_default_owner':
    case 'final_without_effective_owner':
    case 'final_with_invalid_owner_reference':
    case 'invalid_owner_override':
    case 'bundle_invalid_owner_reference':
      return 'PUBLISH_BLOCKED_BY_OWNERSHIP_COVERAGE'
    default:
      return ''
  }
}

export function mapOwnershipIntegrityCodeToBackendErrorCode(integrityCode = '') {
  const normalized = String(integrityCode || '').trim().toLowerCase()
  if (normalized === 'owner_missing') {
    return 'OWNER_MISSING'
  }
  if (normalized === 'owner_invalid') {
    return 'OWNER_REFERENCE_INVALID'
  }
  return ''
}

export function buildOperationalOwnershipBackendValidationResult({
  errorCodes = [],
  issues = [],
  entity = 'protocol',
} = {}) {
  const uniqueCodes = Array.from(
    new Set(
      errorCodes
        .map((item) => normalizeCode(item))
        .filter(Boolean),
    ),
  )
  const errors = uniqueCodes.map((code) =>
    buildOperationalOwnershipBackendError({
      code,
      entity,
      details: {
        issues,
      },
    }),
  )
  return {
    ok: errors.length === 0,
    errorCodes: uniqueCodes,
    primaryError: errors[0] || null,
    errors,
  }
}

export function buildOperationalOwnershipBackendReadinessSummary() {
  return {
    endpoints: { ...OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS },
    requiredChecksByEndpoint: { ...OPERATIONAL_OWNERSHIP_BACKEND_REQUIRED_CHECKS },
    invariants: [...OPERATIONAL_OWNERSHIP_BACKEND_INVARIANTS],
    errorCatalog: { ...OPERATIONAL_OWNERSHIP_BACKEND_ERROR_CATALOG },
  }
}
