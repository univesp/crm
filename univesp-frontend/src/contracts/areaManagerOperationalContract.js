export const AREA_MANAGER_OPERATIONAL_SERVER_PARITY_NOTE =
  'Ambiente mock: a leitura gerencial e as intervencoes ainda rodam no front. Em backend real, KPI, escopo e acao gerencial devem ser canonicos e auditaveis no servidor.'

export const AREA_MANAGER_OVERVIEW_MINIMAL_PAYLOAD = Object.freeze({
  backlogTotal: 'number',
  overdue: 'number',
  atRisk: 'number',
  unassigned: 'number',
  ownerMissing: 'number',
  distributionImbalance: 'number',
  casesBySubject: 'Array<{ subjectLabel: string, openCases: number }>',
  exceptionCount: 'number',
  pendingKnowledgeChanges: 'number',
  stalledCases: 'number',
})

export const AREA_MANAGER_INTERVENTION_STATES = Object.freeze([
  'assign_case',
  'reassign_case',
  'assume_case',
  'manager_exception',
  'mark_operational_blocker',
])

export const AREA_MANAGER_GOVERNANCE_IMPACT_FIELDS = Object.freeze([
  'affectedSubjects',
  'affectedAnalysts',
  'affectedQueues',
  'estimatedUnassignedRisk',
  'estimatedSlaRisk',
])

export const AREA_MANAGER_BACKEND_ERROR_STATES = Object.freeze([
  'overview_unavailable',
  'queue_sync_conflict',
  'rule_impact_unavailable',
  'intervention_not_allowed',
  'audit_write_failed',
])

export function buildAreaManagerBackendReadiness({ hasServerOverview = false } = {}) {
  return {
    hasServerOverview,
    minimalOverviewPayload: { ...AREA_MANAGER_OVERVIEW_MINIMAL_PAYLOAD },
    interventionStates: [...AREA_MANAGER_INTERVENTION_STATES],
    governanceImpactFields: [...AREA_MANAGER_GOVERNANCE_IMPACT_FIELDS],
    backendErrorStates: [...AREA_MANAGER_BACKEND_ERROR_STATES],
  }
}
