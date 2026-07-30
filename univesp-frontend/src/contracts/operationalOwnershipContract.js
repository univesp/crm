import {
  hasOperationalOwnershipReference,
  normalizeOperationalOwnershipReferenceCatalog,
} from '@/services/operationalOwnershipReferences'

export const OPERATIONAL_OWNERSHIP_SERVER_PARITY_NOTE =
  'Ambiente mock: ownership operacional ainda e validado no frontend. Em backend real, owner, fila e vinculo de origem devem ser canonicos e obrigatorios no servidor.'

export const OPERATIONAL_OWNERSHIP_SEMANTIC_MODEL = Object.freeze({
  operationalOwner: 'Dono tematico/operacional do assunto (fila, area ou role).',
  queueDestination: 'Fila operacional de destino para continuidade do caso.',
  areaResponsibility: 'Area organizacional responsavel pelo tratamento.',
  roleResponsibility: 'Papel elegivel para tratar o caso na area.',
  humanAssignee: 'Pessoa atribuida para executar o caso naquele momento.',
  managerException: 'Quebra justificada do fluxo padrao com rastreabilidade.',
})

export const PROTOCOL_OWNERSHIP_PAYLOAD_SHAPE = Object.freeze({
  ownerType: 'queue|area|role',
  ownerKey: 'string',
  ownerQueue: 'string',
  ownerArea: 'string',
  ownerRole: 'string',
  ownerSource: 'string',
  ownerRoutingHint: 'string',
  hasOperationalOwner: 'boolean',
  ownershipStateCode: 'owner_resolved|owner_resolved_fallback|owner_missing|owner_invalid',
  operationalOwnerSnapshot: 'object',
})

export const PROTOCOL_SOURCE_BINDING_FIELDS = Object.freeze(['sourceBundleId', 'sourceNodeId'])
export const PROTOCOL_SOURCE_VERSION_FIELD = 'sourceBundleVersionId'

export const OPERATIONAL_OWNERSHIP_BACKEND_ERROR_STATES = Object.freeze([
  'owner_missing',
  'owner_invalid',
  'owner_conflict',
  'owner_destination_unavailable',
  'queue_not_found',
  'area_not_found',
  'role_not_found',
  'bundle_version_not_found',
  'node_not_found',
])

export const OPERATIONAL_OWNERSHIP_ALLOWED_OWNER_TYPES = Object.freeze(['queue', 'area', 'role'])

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function validateOperationalOwnershipEnvelope(
  protocol = {},
  {
    requireSourceBinding = false,
    requireBundleVersion = false,
    enforceReferences = false,
    references = null,
  } = {},
) {
  const missingFields = []
  const ownerType = normalizeText(protocol.ownerType || protocol.operationalOwnerSnapshot?.ownerType || '')
  const ownerKey = String(protocol.ownerKey || protocol.operationalOwnerSnapshot?.ownerKey || '').trim()
  const ownerQueue = String(protocol.ownerQueue || protocol.operationalOwnerSnapshot?.ownerQueue || '').trim()
  const ownerArea = String(protocol.ownerArea || protocol.operationalOwnerSnapshot?.ownerArea || '').trim()
  const ownerRole = String(protocol.ownerRole || protocol.operationalOwnerSnapshot?.ownerRole || '').trim()
  const hasOperationalOwner =
    typeof protocol.hasOperationalOwner === 'boolean'
      ? protocol.hasOperationalOwner
      : Boolean(protocol.operationalOwnerSnapshot?.hasOwner)
  const ownershipStateCode = String(
    protocol.ownershipStateCode || protocol.operationalOwnerSnapshot?.stateCode || '',
  ).trim()
  const referenceCatalog = normalizeOperationalOwnershipReferenceCatalog(references || {})

  if (!ownerType) {
    missingFields.push('ownerType')
  } else if (!OPERATIONAL_OWNERSHIP_ALLOWED_OWNER_TYPES.includes(ownerType)) {
    missingFields.push('ownerType_invalid')
  }

  if (!ownerKey) {
    missingFields.push('ownerKey')
  } else if (ownerType && !ownerKey.startsWith(`${ownerType}:`)) {
    missingFields.push('ownerKey_mismatch')
  }

  if (!ownershipStateCode) {
    missingFields.push('ownershipStateCode')
  }

  if (ownerType === 'queue' && (!ownerQueue || normalizeText(ownerQueue) === 'nao_aplicavel')) {
    missingFields.push('ownerQueue')
  }

  if (ownerType === 'area' && !ownerArea) {
    missingFields.push('ownerArea')
  }

  if (ownerType === 'role' && !ownerRole) {
    missingFields.push('ownerRole')
  }

  if (enforceReferences) {
    if (
      ownerType === 'queue' &&
      ownerQueue &&
      !hasOperationalOwnershipReference(referenceCatalog.queueSet, ownerQueue)
    ) {
      missingFields.push('ownerQueue_reference_invalid')
    }

    if (
      ownerType === 'area' &&
      ownerArea &&
      !hasOperationalOwnershipReference(referenceCatalog.areaSet, ownerArea)
    ) {
      missingFields.push('ownerArea_reference_invalid')
    }

    if (
      ownerType === 'role' &&
      ownerRole &&
      !hasOperationalOwnershipReference(referenceCatalog.roleSet, ownerRole)
    ) {
      missingFields.push('ownerRole_reference_invalid')
    }
  }

  if (requireSourceBinding) {
    for (const field of PROTOCOL_SOURCE_BINDING_FIELDS) {
      if (!String(protocol[field] || '').trim()) {
        missingFields.push(field)
      }
    }
  }

  if (requireBundleVersion && !String(protocol[PROTOCOL_SOURCE_VERSION_FIELD] || '').trim()) {
    missingFields.push(PROTOCOL_SOURCE_VERSION_FIELD)
  }

  const uniqueMissingFields = Array.from(new Set(missingFields))
  const invalidReferences = uniqueMissingFields.filter((field) => field.endsWith('_reference_invalid'))
  const missingMandatoryFields = uniqueMissingFields.filter((field) => !field.endsWith('_reference_invalid'))

  return {
    ok: hasOperationalOwner && uniqueMissingFields.length === 0,
    hasOperationalOwner,
    missingFields: uniqueMissingFields,
    missingMandatoryFields,
    invalidReferences,
    message:
      hasOperationalOwner && uniqueMissingFields.length === 0
        ? ''
        : invalidReferences.length
          ? `Ownership operacional invalido: referencias nao encontradas (${invalidReferences.join(', ')}).`
          : uniqueMissingFields.length
            ? `Ownership operacional incompleto: faltam ${uniqueMissingFields.join(', ')}.`
            : 'Ownership operacional ausente.',
  }
}

export function buildOperationalOwnershipBackendReadiness({
  hasServerValidation = false,
} = {}) {
  return {
    hasServerValidation,
    parityNote: OPERATIONAL_OWNERSHIP_SERVER_PARITY_NOTE,
    semanticModel: { ...OPERATIONAL_OWNERSHIP_SEMANTIC_MODEL },
    protocolPayloadShape: { ...PROTOCOL_OWNERSHIP_PAYLOAD_SHAPE },
    sourceBindingFields: [...PROTOCOL_SOURCE_BINDING_FIELDS],
    sourceVersionField: PROTOCOL_SOURCE_VERSION_FIELD,
    backendErrorStates: [...OPERATIONAL_OWNERSHIP_BACKEND_ERROR_STATES],
  }
}
