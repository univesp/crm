import { QUEUE_DESTINATION_CATALOG } from '@/services/faqCatalogs'
import { mockAccessProfiles } from '../../mocks/mockAccessProfiles'
import { operationalAreaSeeds } from '../../mocks/canonicalFoundation'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function uniqueNormalized(values = []) {
  const unique = []
  const seen = new Set()

  for (const value of values) {
    const raw = String(value || '').trim()
    const normalized = normalizeText(raw)
    if (!raw || !normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    unique.push(raw)
  }

  return unique
}

function collectOperationalAreaValues(areas = []) {
  const values = []

  for (const area of areas || []) {
    if (!area || typeof area !== 'object') {
      continue
    }

    values.push(area.areaLabel)
    values.push(area.areaCode)
    values.push(area.areaId)
    values.push(area.id)
  }

  return values
}

function collectRoleValues(profiles = []) {
  const values = []

  for (const profile of profiles || []) {
    if (!profile || typeof profile !== 'object') {
      continue
    }

    values.push(profile.key)
    values.push(profile.label)
    values.push(profile.roleLabel)
  }

  return values
}

export function buildOperationalOwnershipReferenceCatalog({
  queues = null,
  operationalAreas = null,
  roles = null,
  profiles = null,
} = {}) {
  const queueCandidates = Array.isArray(queues) ? queues : Object.keys(QUEUE_DESTINATION_CATALOG)
  const areaCandidates = Array.isArray(operationalAreas)
    ? collectOperationalAreaValues(operationalAreas)
    : collectOperationalAreaValues(operationalAreaSeeds)
  const profileCandidates = Array.isArray(profiles) ? profiles : mockAccessProfiles
  const roleCandidates = Array.isArray(roles) ? roles : collectRoleValues(profileCandidates)

  return {
    queues: uniqueNormalized(queueCandidates),
    areas: uniqueNormalized(areaCandidates),
    roles: uniqueNormalized(roleCandidates),
  }
}

export function normalizeOperationalOwnershipReferenceCatalog(referenceCatalog = {}) {
  const queueSet = new Set((referenceCatalog.queues || []).map((item) => normalizeText(item)).filter(Boolean))
  const areaSet = new Set((referenceCatalog.areas || []).map((item) => normalizeText(item)).filter(Boolean))
  const roleSet = new Set((referenceCatalog.roles || []).map((item) => normalizeText(item)).filter(Boolean))

  return {
    queueSet,
    areaSet,
    roleSet,
  }
}

export function hasOperationalOwnershipReference(referenceSet = new Set(), value = '') {
  if (!referenceSet || typeof referenceSet.has !== 'function' || referenceSet.size === 0) {
    return true
  }

  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return referenceSet.has(normalized)
}
