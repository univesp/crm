import { buildOperationalOwnerIntegrity } from '@/services/operationalOwnershipRuntime'
import { validateOperationalOwnershipEnvelope } from '@/contracts/operationalOwnershipContract'
import {
  OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS,
  buildOperationalOwnershipBackendValidationResult,
  mapOwnershipIntegrityCodeToBackendErrorCode,
  mapOwnershipIssueToBackendErrorCode,
} from '@/contracts/operationalOwnershipBackendContract'

export const OPERATIONAL_OWNERSHIP_LEGACY_MODES = Object.freeze({
  TRANSITION: 'transition',
  STRICT: 'strict',
})

export const DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY = Object.freeze({
  mode: OPERATIONAL_OWNERSHIP_LEGACY_MODES.TRANSITION,
  allowLegacyRead: true,
  allowLegacyFollowUpWrite: true,
  allowLegacyWrite: false,
  allowFallbackOwnerWrite: false,
  allowLegacySourceBindingWrite: false,
})

const WRITE_ENDPOINTS = new Set([
  OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.DRAFT_CREATE,
  OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE,
  OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_UPDATE,
  OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.BUNDLE_IMPORT,
  OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.BUNDLE_PUBLISH,
])

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function isLegacyReference(value = '', prefix = 'legacy-') {
  return normalizeText(value).startsWith(prefix)
}

export function normalizeOperationalOwnershipLegacyPolicy(policy = {}) {
  const mode = normalizeText(policy.mode)
  const strict = mode === OPERATIONAL_OWNERSHIP_LEGACY_MODES.STRICT

  return {
    mode: strict ? OPERATIONAL_OWNERSHIP_LEGACY_MODES.STRICT : OPERATIONAL_OWNERSHIP_LEGACY_MODES.TRANSITION,
    allowLegacyRead: strict ? false : policy.allowLegacyRead !== false,
    allowLegacyFollowUpWrite: strict ? false : policy.allowLegacyFollowUpWrite !== false,
    allowLegacyWrite: strict ? false : Boolean(policy.allowLegacyWrite),
    allowFallbackOwnerWrite: strict ? false : Boolean(policy.allowFallbackOwnerWrite),
    allowLegacySourceBindingWrite: strict ? false : Boolean(policy.allowLegacySourceBindingWrite),
  }
}

export function classifyOperationalOwnershipLegacyState(payload = {}) {
  const ownerSource = String(payload.ownerSource || payload.operationalOwnerSnapshot?.source || '').trim()
  const ownershipStateCode = String(
    payload.ownershipStateCode || payload.operationalOwnerSnapshot?.stateCode || '',
  ).trim()
  const sourceBundleId = String(payload.sourceBundleId || '').trim()
  const sourceBundleVersionId = String(payload.sourceBundleVersionId || '').trim()
  const sourceNodeId = String(payload.sourceNodeId || '').trim()

  const hasLegacySourceBinding =
    isLegacyReference(sourceBundleId, 'legacy-bundle:') ||
    isLegacyReference(sourceNodeId, 'legacy-node:') ||
    normalizeText(sourceBundleVersionId) === 'legacy'
  const hasLegacyOwnerSource = ownerSource.includes('legacy')
  const hasFallbackOwner = normalizeText(ownershipStateCode) === 'owner_resolved_fallback'
  const isLegacyPayload = hasLegacySourceBinding || hasLegacyOwnerSource || hasFallbackOwner

  return {
    isLegacyPayload,
    hasLegacySourceBinding,
    hasLegacyOwnerSource,
    hasFallbackOwner,
    ownerSource,
    sourceBundleId,
    sourceBundleVersionId,
    sourceNodeId,
  }
}

function resolveLegacyViolationCodes({
  endpoint,
  legacyState,
  legacyPolicy,
}) {
  if (!legacyState.isLegacyPayload) {
    return []
  }

  const isWriteEndpoint = WRITE_ENDPOINTS.has(endpoint)
  const violations = []

  if (!isWriteEndpoint && !legacyPolicy.allowLegacyRead) {
    violations.push('LEGACY_OWNERSHIP_REQUIRES_MIGRATION')
  }

  if (
    endpoint === OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_FOLLOW_UP &&
    !legacyPolicy.allowLegacyFollowUpWrite
  ) {
    violations.push('LEGACY_OWNERSHIP_REQUIRES_MIGRATION')
  }

  if (
    isWriteEndpoint &&
    endpoint !== OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_FOLLOW_UP &&
    !legacyPolicy.allowLegacyWrite
  ) {
    violations.push('LEGACY_OWNERSHIP_REQUIRES_MIGRATION')
  }

  if (isWriteEndpoint && legacyState.hasFallbackOwner && !legacyPolicy.allowFallbackOwnerWrite) {
    violations.push('LEGACY_FALLBACK_REQUIRES_MIGRATION')
  }

  if (isWriteEndpoint && legacyState.hasLegacySourceBinding && !legacyPolicy.allowLegacySourceBindingWrite) {
    violations.push('LEGACY_SOURCE_BINDING_REQUIRES_MIGRATION')
  }

  return violations
}

export function validateOperationalOwnershipForServer(
  payload = {},
  {
    endpoint = OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE,
    references = null,
    requireSourceBinding = true,
    requireBundleVersion = true,
    enforceReferences = true,
    legacyPolicy = DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
  } = {},
) {
  const normalizedLegacyPolicy = normalizeOperationalOwnershipLegacyPolicy(legacyPolicy)
  const legacyState = classifyOperationalOwnershipLegacyState(payload)
  const envelope = validateOperationalOwnershipEnvelope(payload, {
    requireSourceBinding,
    requireBundleVersion,
    enforceReferences,
    references,
  })
  const integrity = buildOperationalOwnerIntegrity(
    payload.operationalOwnerSnapshot || {
      ownerType: payload.ownerType || '',
      ownerKey: payload.ownerKey || '',
      ownerQueue: payload.ownerQueue || '',
      ownerArea: payload.ownerArea || '',
      ownerRole: payload.ownerRole || '',
      source: payload.ownerSource || '',
      routingHint: payload.ownerRoutingHint || '',
      hasOwner:
        typeof payload.hasOperationalOwner === 'boolean'
          ? payload.hasOperationalOwner
          : Boolean(payload.ownerKey || payload.ownerQueue || payload.ownerArea || payload.ownerRole),
      stateCode: payload.ownershipStateCode || '',
    },
  )

  const errorCodes = []
  for (const issue of envelope.missingFields || []) {
    const mappedCode = mapOwnershipIssueToBackendErrorCode(issue)
    if (mappedCode) {
      errorCodes.push(mappedCode)
    }
  }

  const integrityMappedCode = mapOwnershipIntegrityCodeToBackendErrorCode(integrity.code)
  if (!integrity.ok && integrityMappedCode) {
    errorCodes.push(integrityMappedCode)
  }

  const legacyViolationCodes = resolveLegacyViolationCodes({
    endpoint,
    legacyState,
    legacyPolicy: normalizedLegacyPolicy,
  })
  errorCodes.push(...legacyViolationCodes)

  const validationResult = buildOperationalOwnershipBackendValidationResult({
    errorCodes,
    issues: envelope.missingFields || [],
    entity:
      endpoint === OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.BUNDLE_IMPORT ||
      endpoint === OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.BUNDLE_PUBLISH
        ? 'bundle'
        : 'protocol',
  })

  return {
    ...validationResult,
    endpoint,
    envelope,
    integrity,
    legacyState,
    legacyPolicy: normalizedLegacyPolicy,
  }
}

const OWNERSHIP_BLOCKER_CODES = new Set([
  'bundle_without_default_owner',
  'bundle_invalid_owner_reference',
  'final_without_effective_owner',
  'final_with_invalid_owner_reference',
  'invalid_owner_override',
  'invalid_owner_reference',
])

export function validateBundleOwnershipCoverageForServer(
  validation = {},
  { endpoint = OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.BUNDLE_PUBLISH } = {},
) {
  const blockingCodes = (validation?.errors || [])
    .map((issue) => issue?.code)
    .filter((code) => OWNERSHIP_BLOCKER_CODES.has(code))

  if (!blockingCodes.length) {
    return {
      ok: true,
      endpoint,
      blockingIssueCodes: [],
      errors: [],
      primaryError: null,
    }
  }

  const result = buildOperationalOwnershipBackendValidationResult({
    errorCodes: ['PUBLISH_BLOCKED_BY_OWNERSHIP_COVERAGE'],
    issues: blockingCodes,
    entity: 'bundle',
  })

  return {
    ...result,
    endpoint,
    blockingIssueCodes: blockingCodes,
  }
}

export function auditLegacyOwnershipRecords(
  protocols = [],
  {
    references = null,
    legacyPolicy = DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
  } = {},
) {
  const report = {
    totalRecords: 0,
    canonicalRecords: 0,
    legacyRecords: 0,
    legacySafeToNormalize: 0,
    legacyRequiresManualMigration: 0,
    records: [],
  }

  for (const protocol of protocols || []) {
    report.totalRecords += 1
    const validation = validateOperationalOwnershipForServer(protocol, {
      endpoint: OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_FOLLOW_UP,
      references,
      requireSourceBinding: true,
      requireBundleVersion: true,
      enforceReferences: true,
      legacyPolicy,
    })
    const legacyState = validation.legacyState
    const isLegacy = Boolean(legacyState?.isLegacyPayload)
    const recordState = {
      id: protocol?.protocolNumber || protocol?.id || '',
      isLegacy,
      status: '',
      issues: validation.errorCodes || [],
    }

    if (!isLegacy) {
      report.canonicalRecords += 1
      recordState.status = 'canonical'
    } else {
      report.legacyRecords += 1
      if (validation.ok) {
        report.legacySafeToNormalize += 1
        recordState.status = 'legacy_safe_to_normalize'
      } else {
        report.legacyRequiresManualMigration += 1
        recordState.status = 'legacy_requires_manual_migration'
      }
    }

    report.records.push(recordState)
  }

  return report
}
