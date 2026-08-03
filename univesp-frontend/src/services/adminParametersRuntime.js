import { adminParametersDraft } from '../../mocks/adminParameters'
import { CRITICALITY_CATALOG, SLA_CATALOG, getCatalogKeys } from '@/services/faqCatalogs'

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildDefaultCriticalityLevels() {
  return getCatalogKeys(CRITICALITY_CATALOG).map((key) => ({
    key,
    label: CRITICALITY_CATALOG[key].label,
    badgeLabel: CRITICALITY_CATALOG[key].label,
    backgroundColor: '#f2f4f5',
    textColor: '#101214',
    operationalPriority: CRITICALITY_CATALOG[key].rank,
    note: '',
  }))
}

function buildDefaultSlaLevels() {
  return getCatalogKeys(SLA_CATALOG).map((key, index) => ({
    key,
    label: SLA_CATALOG[key].label,
    badgeLabel: key,
    backgroundColor: '#e8f2fb',
    textColor: '#005f99',
    operationalPriority: index + 1,
    hours: SLA_CATALOG[key].hours ?? null,
    businessDays: SLA_CATALOG[key].businessDays ?? null,
    note: '',
  }))
}

function buildLevelPreview(level) {
  return {
    ...level,
    style: {
      backgroundColor: level.backgroundColor,
      color: level.textColor,
    },
  }
}

export function cloneAdminParametersDraft() {
  return cloneJson(adminParametersDraft)
}

export function findParameterLevel(levels = [], key) {
  return levels.find((level) => level.key === key) || null
}

export function buildAdminParameterLevels(draft) {
  const criticalityLevels = (draft?.criticalityLevels?.length
    ? draft.criticalityLevels
    : buildDefaultCriticalityLevels()
  ).map(buildLevelPreview)
  const slaLevels = (draft?.slaLevels?.length ? draft.slaLevels : buildDefaultSlaLevels()).map(
    buildLevelPreview,
  )
  return { criticalityLevels, slaLevels }
}
