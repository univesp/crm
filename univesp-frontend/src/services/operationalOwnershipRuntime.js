import { resolveLastMileAreaLabel } from '@/services/caseRoutingRuntime'
import { QUEUE_DESTINATION_CATALOG } from '@/services/faqCatalogs'

export const OPERATIONAL_OWNER_TYPES = Object.freeze({
  queue: 'queue',
  area: 'area',
  role: 'role',
})

export const OPERATIONAL_OWNER_STATE_CODES = Object.freeze({
  RESOLVED: 'owner_resolved',
  RESOLVED_FALLBACK: 'owner_resolved_fallback',
  MISSING: 'owner_missing',
  INVALID: 'owner_invalid',
})

const OPERATIONAL_OWNER_TYPE_LABELS = Object.freeze({
  [OPERATIONAL_OWNER_TYPES.queue]: 'Fila operacional',
  [OPERATIONAL_OWNER_TYPES.area]: 'Area responsavel',
  [OPERATIONAL_OWNER_TYPES.role]: 'Role responsavel',
})

const OPERATIONAL_OWNER_STATE_LABELS = Object.freeze({
  [OPERATIONAL_OWNER_STATE_CODES.RESOLVED]: 'Owner operacional resolvido',
  [OPERATIONAL_OWNER_STATE_CODES.RESOLVED_FALLBACK]: 'Owner operacional resolvido por fallback',
  [OPERATIONAL_OWNER_STATE_CODES.MISSING]: 'Owner operacional ausente',
  [OPERATIONAL_OWNER_STATE_CODES.INVALID]: 'Owner operacional invalido',
})

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeOwnerType(value = '', fallbackType = OPERATIONAL_OWNER_TYPES.queue) {
  const normalized = normalizeText(value)
  if (Object.values(OPERATIONAL_OWNER_TYPES).includes(normalized)) {
    return normalized
  }
  return fallbackType
}

function sanitizeOwnerValue(value = '') {
  return String(value || '').trim()
}

function resolveQueueLabel(queueKey = '') {
  const normalizedQueue = sanitizeOwnerValue(queueKey)
  if (!normalizedQueue) {
    return ''
  }
  const catalogEntry = QUEUE_DESTINATION_CATALOG[normalizedQueue]
  return catalogEntry?.label || normalizedQueue
}

function buildOwnerKey({
  ownerType = OPERATIONAL_OWNER_TYPES.queue,
  ownerQueue = '',
  ownerArea = '',
  ownerRole = '',
} = {}) {
  if (ownerType === OPERATIONAL_OWNER_TYPES.area) {
    return ownerArea ? `area:${ownerArea}` : ''
  }

  if (ownerType === OPERATIONAL_OWNER_TYPES.role) {
    return ownerRole ? `role:${ownerRole}` : ''
  }

  return ownerQueue ? `queue:${ownerQueue}` : ''
}

function hasMeaningfulOwnerValue(ownerType = '', ownerQueue = '', ownerArea = '', ownerRole = '') {
  if (ownerType === OPERATIONAL_OWNER_TYPES.area) {
    return Boolean(ownerArea)
  }

  if (ownerType === OPERATIONAL_OWNER_TYPES.role) {
    return Boolean(ownerRole)
  }

  return Boolean(ownerQueue) && normalizeText(ownerQueue) !== 'nao_aplicavel'
}

export function hasOperationalOwnerValue(snapshot = {}) {
  return hasMeaningfulOwnerValue(
    normalizeOwnerType(snapshot.ownerType || snapshot.owner_type),
    sanitizeOwnerValue(snapshot.ownerQueue || snapshot.owner_queue || snapshot.queueKey),
    sanitizeOwnerValue(snapshot.ownerArea || snapshot.owner_area || snapshot.areaLabel),
    sanitizeOwnerValue(snapshot.ownerRole || snapshot.owner_role || snapshot.roleKey),
  )
}

export function formatOperationalOwnerLabel(snapshot = {}) {
  const ownerType = normalizeOwnerType(snapshot.ownerType || snapshot.owner_type)
  const ownerQueue = sanitizeOwnerValue(snapshot.ownerQueue || snapshot.owner_queue || snapshot.queueKey)
  const ownerArea = sanitizeOwnerValue(snapshot.ownerArea || snapshot.owner_area || snapshot.areaLabel)
  const ownerRole = sanitizeOwnerValue(snapshot.ownerRole || snapshot.owner_role || snapshot.roleKey)

  if (ownerType === OPERATIONAL_OWNER_TYPES.area) {
    return ownerArea || 'Area nao informada'
  }

  if (ownerType === OPERATIONAL_OWNER_TYPES.role) {
    return ownerRole || 'Role nao informada'
  }

  return resolveQueueLabel(ownerQueue) || 'Fila nao informada'
}

export function formatOperationalOwnerTypeLabel(ownerType = '') {
  const normalizedType = normalizeOwnerType(ownerType || OPERATIONAL_OWNER_TYPES.queue)
  return OPERATIONAL_OWNER_TYPE_LABELS[normalizedType] || OPERATIONAL_OWNER_TYPE_LABELS.queue
}

export function formatOperationalOwnerStateLabel(stateCode = '') {
  const normalizedState = sanitizeOwnerValue(stateCode)
  return OPERATIONAL_OWNER_STATE_LABELS[normalizedState] || OPERATIONAL_OWNER_STATE_LABELS[OPERATIONAL_OWNER_STATE_CODES.MISSING]
}

export function isOperationalOwnerResolved(snapshot = {}) {
  const normalizedSnapshot = normalizeOperationalOwnerSnapshot(snapshot || {})
  return (
    normalizedSnapshot.hasOwner &&
    normalizedSnapshot.stateCode !== OPERATIONAL_OWNER_STATE_CODES.MISSING &&
    normalizedSnapshot.stateCode !== OPERATIONAL_OWNER_STATE_CODES.INVALID
  )
}

export function buildOperationalOwnerDescriptor(snapshot = {}) {
  const normalizedSnapshot = normalizeOperationalOwnerSnapshot(snapshot || {})
  return {
    ...normalizedSnapshot,
    ownerTypeLabel: formatOperationalOwnerTypeLabel(normalizedSnapshot.ownerType),
    ownerLabel: formatOperationalOwnerLabel(normalizedSnapshot),
    stateLabel: formatOperationalOwnerStateLabel(normalizedSnapshot.stateCode),
  }
}

export function buildOperationalOwnerIntegrity(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      ok: false,
      code: OPERATIONAL_OWNER_STATE_CODES.MISSING,
      message: 'Ownership operacional ausente no payload.',
    }
  }

  if (snapshot.stateCode === OPERATIONAL_OWNER_STATE_CODES.INVALID) {
    return {
      ok: false,
      code: OPERATIONAL_OWNER_STATE_CODES.INVALID,
      message: 'Ownership operacional invalido para este protocolo.',
    }
  }

  if (!snapshot.hasOwner) {
    return {
      ok: false,
      code: OPERATIONAL_OWNER_STATE_CODES.MISSING,
      message: 'Ownership operacional nao resolvido para este protocolo.',
    }
  }

  return {
    ok: true,
    code: snapshot.stateCode || OPERATIONAL_OWNER_STATE_CODES.RESOLVED,
    message: '',
  }
}

export function normalizeOperationalOwnerSnapshot(rawSnapshot = {}, options = {}) {
  const fallbackOwnerType = normalizeOwnerType(
    options.fallbackOwnerType || rawSnapshot.fallbackOwnerType || OPERATIONAL_OWNER_TYPES.queue,
  )
  const ownerType = normalizeOwnerType(
    rawSnapshot.ownerType || rawSnapshot.owner_type || fallbackOwnerType,
    fallbackOwnerType,
  )
  const ownerQueue = sanitizeOwnerValue(
    rawSnapshot.ownerQueue ||
      rawSnapshot.owner_queue ||
      rawSnapshot.queueKey ||
      rawSnapshot.queue_key ||
      '',
  )
  const ownerArea = sanitizeOwnerValue(
    rawSnapshot.ownerArea ||
      rawSnapshot.owner_area ||
      rawSnapshot.areaLabel ||
      rawSnapshot.area_label ||
      '',
  )
  const ownerRole = sanitizeOwnerValue(
    rawSnapshot.ownerRole ||
      rawSnapshot.owner_role ||
      rawSnapshot.roleKey ||
      rawSnapshot.role_key ||
      '',
  )
  const routingHint = sanitizeOwnerValue(
    rawSnapshot.routingHint || rawSnapshot.routing_hint || rawSnapshot.routingPolicy || rawSnapshot.routing_policy,
  )
  const fallbackQueue = sanitizeOwnerValue(options.fallbackQueue || rawSnapshot.fallbackQueue || '')
  const fallbackArea = sanitizeOwnerValue(
    options.fallbackArea || rawSnapshot.fallbackArea || (fallbackQueue ? resolveLastMileAreaLabel(fallbackQueue) : ''),
  )
  const fallbackRole = sanitizeOwnerValue(options.fallbackRole || rawSnapshot.fallbackRole || '')
  const hasExplicitValue = hasMeaningfulOwnerValue(ownerType, ownerQueue, ownerArea, ownerRole)

  let resolvedQueue = ownerQueue
  let resolvedArea = ownerArea
  let resolvedRole = ownerRole
  let fallbackUsed = false
  let source =
    sanitizeOwnerValue(rawSnapshot.source || rawSnapshot.ownerSource || rawSnapshot.owner_source) ||
    sanitizeOwnerValue(options.source || '')

  if (!hasExplicitValue) {
    if (ownerType === OPERATIONAL_OWNER_TYPES.area && fallbackArea) {
      resolvedArea = fallbackArea
      fallbackUsed = true
    } else if (ownerType === OPERATIONAL_OWNER_TYPES.role && fallbackRole) {
      resolvedRole = fallbackRole
      fallbackUsed = true
    } else if (fallbackQueue) {
      resolvedQueue = fallbackQueue
      fallbackUsed = true
    } else if (fallbackArea) {
      resolvedArea = fallbackArea
      fallbackUsed = true
    } else if (fallbackRole) {
      resolvedRole = fallbackRole
      fallbackUsed = true
    }
  }

  const hasOwner = hasMeaningfulOwnerValue(ownerType, resolvedQueue, resolvedArea, resolvedRole)
  if (!source) {
    source = hasOwner ? (fallbackUsed ? 'legacy_fallback' : 'explicit') : 'missing'
  }

  const providedOwnerKey = sanitizeOwnerValue(rawSnapshot.ownerKey || rawSnapshot.owner_key)
  const expectedOwnerKeyPrefix = `${ownerType}:`
  const normalizedProvidedOwnerKey =
    providedOwnerKey && providedOwnerKey.startsWith(expectedOwnerKeyPrefix)
      ? providedOwnerKey
      : ''
  const ownerKey =
    normalizedProvidedOwnerKey ||
    buildOwnerKey({
      ownerType,
      ownerQueue: resolvedQueue,
      ownerArea: resolvedArea,
      ownerRole: resolvedRole,
    })

  let stateCode = OPERATIONAL_OWNER_STATE_CODES.MISSING
  if (hasOwner) {
    stateCode = fallbackUsed
      ? OPERATIONAL_OWNER_STATE_CODES.RESOLVED_FALLBACK
      : OPERATIONAL_OWNER_STATE_CODES.RESOLVED
  }

  if (
    (ownerType === OPERATIONAL_OWNER_TYPES.area && resolvedQueue) ||
    (ownerType === OPERATIONAL_OWNER_TYPES.role && resolvedQueue)
  ) {
    stateCode = hasOwner ? stateCode : OPERATIONAL_OWNER_STATE_CODES.INVALID
  }

  return {
    ownerType,
    ownerKey,
    ownerQueue: resolvedQueue,
    ownerQueueLabel: resolveQueueLabel(resolvedQueue),
    ownerArea: resolvedArea,
    ownerRole: resolvedRole,
    routingHint,
    source,
    hasOwner,
    fallbackUsed,
    stateCode,
  }
}

export function resolveOperationalOwnerFromProtocol(protocol = {}, options = {}) {
  const ownershipPayload =
    (protocol.context && protocol.context.ownership) ||
    protocol.operationalOwnerSnapshot ||
    {}

  const ownerType =
    protocol.ownerType ||
    ownershipPayload.ownerType ||
    ownershipPayload.owner_type ||
    options.fallbackOwnerType ||
    OPERATIONAL_OWNER_TYPES.queue

  const fallbackQueue = sanitizeOwnerValue(
    options.fallbackQueue ||
      protocol.ownerQueue ||
      ownershipPayload.queueKey ||
      ownershipPayload.ownerQueue ||
      protocol.queueLabel ||
      protocol.context?.queueDestination ||
      '',
  )
  const fallbackArea = sanitizeOwnerValue(
    options.fallbackArea ||
      protocol.ownerArea ||
      ownershipPayload.areaLabel ||
      ownershipPayload.ownerArea ||
      protocol.lastMileAreaLabel ||
      protocol.currentAreaLabel ||
      protocol.context?.routing?.targetAreaLabel ||
      (fallbackQueue ? resolveLastMileAreaLabel(fallbackQueue) : ''),
  )
  const fallbackRole = sanitizeOwnerValue(
    options.fallbackRole || protocol.ownerRole || ownershipPayload.roleKey || ownershipPayload.ownerRole,
  )

  return normalizeOperationalOwnerSnapshot(
    {
      ownerType,
      ownerKey: protocol.ownerKey || ownershipPayload.ownerKey || ownershipPayload.owner_key,
      ownerQueue:
        protocol.ownerQueue ||
        ownershipPayload.queueKey ||
        ownershipPayload.ownerQueue ||
        ownershipPayload.owner_queue,
      ownerArea:
        protocol.ownerArea ||
        ownershipPayload.areaLabel ||
        ownershipPayload.ownerArea ||
        ownershipPayload.owner_area,
      ownerRole:
        protocol.ownerRole ||
        ownershipPayload.roleKey ||
        ownershipPayload.ownerRole ||
        ownershipPayload.owner_role,
      routingHint:
        protocol.ownerRoutingHint ||
        protocol.routingHint ||
        ownershipPayload.routingHint ||
        ownershipPayload.routingPolicy ||
        '',
      source:
        protocol.ownerSource ||
        ownershipPayload.source ||
        options.source ||
        'protocol_payload',
    },
    {
      fallbackOwnerType: ownerType,
      fallbackQueue,
      fallbackArea,
      fallbackRole,
      source: protocol.ownerSource || ownershipPayload.source || options.source || '',
    },
  )
}
