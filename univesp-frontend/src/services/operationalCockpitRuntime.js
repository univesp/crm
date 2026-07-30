import { buildAdminDashboardView } from '@/services/adminDashboardRuntime'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function isSlaOverdue(sla = '') {
  const normalized = normalizeText(sla)

  return normalized.includes('vencid') || normalized.includes('atrasad') || normalized.includes('expirad')
}

export function isSlaAtRisk(sla = '') {
  const normalized = normalizeText(sla)

  return (
    isSlaOverdue(sla) ||
    normalized.includes('restante') ||
    normalized.includes('min') ||
    normalized.includes('4h')
  )
}

function toAreaMinutesLeft(entry = {}) {
  return Number(entry.sortTokens?.slaMinutes ?? 0)
}

function isAreaOverdue(entry = {}) {
  return toAreaMinutesLeft(entry) < 0
}

function isAreaAtRisk(entry = {}) {
  const minutes = toAreaMinutesLeft(entry)
  return minutes >= 0 && minutes <= 120
}

function buildCaseRouteForProfile(entry = {}, profileKey = 'admin_central') {
  const caseId = entry.id || entry.caseId || ''
  const areaLabel = entry.currentAreaLabel || entry.resolvedAreaLabel || entry.lastMileAreaLabel || ''

  if (profileKey === 'admin_central') {
    return {
      name: 'admin-protocol-detail',
      params: { protocolId: caseId },
    }
  }

  if (['analista_area', 'gestor_area'].includes(profileKey)) {
    return {
      path: `/area/fila/${caseId}`,
      query: areaLabel ? { area: areaLabel } : {},
    }
  }

  return {
    path: `/op/fila/${caseId}`,
  }
}

function buildInterveneRoute(entry = {}, profileKey = 'admin_central') {
  const baseRoute = buildCaseRouteForProfile(entry, profileKey)

  return {
    ...baseRoute,
    query: {
      ...(baseRoute.query || {}),
      intervene: '1',
      intent: 'assume',
    },
  }
}

function mapDashboardCase(entry = {}, profileKey = 'admin_central', bucket = 'overdue') {
  return {
    id: entry.id,
    subject: entry.subject,
    student: entry.student,
    polo: entry.polo,
    theme: entry.theme,
    queue: entry.queue,
    sla: entry.sla,
    status: entry.status,
    criticality: entry.criticality,
    assignedOperator: entry.assignedOperator || 'Não atribuído',
    bucket,
    caseRoute: buildCaseRouteForProfile(entry, profileKey),
    interveneRoute: buildInterveneRoute(entry, profileKey),
  }
}

function mapAreaCase(entry = {}, profileKey = 'analista_area', bucket = 'overdue') {
  return {
    id: entry.id,
    subject: entry.subject || entry.subjectLabel || `Caso ${entry.id}`,
    student: entry.studentName || entry.student || 'Não informado',
    polo: entry.polo || 'Não informado',
    theme: entry.themeLabel || entry.theme || 'Não informado',
    queue: entry.currentAreaLabel || entry.queue || 'Área especializada',
    sla: entry.slaLabel || entry.sla || 'SLA não calculado',
    status: entry.statusLabel || entry.status || 'Não informado',
    criticality: entry.criticalityLabel || entry.criticality || 'Média',
    assignedOperator: entry.assignedAnalystName || entry.assignedOperator || 'Não atribuído',
    bucket,
    caseRoute: buildCaseRouteForProfile(entry, profileKey),
    interveneRoute: buildInterveneRoute(entry, profileKey),
  }
}

function buildCockpitPayload({
  overdueCases = [],
  atRiskCases = [],
  activeCount = 0,
  profileKey = 'admin_central',
  scopeLabel = '',
} = {}) {
  return {
    profileKey,
    scopeLabel,
    kpis: {
      overdue: overdueCases.length,
      atRisk: atRiskCases.length,
      active: activeCount,
    },
    overdueCases,
    atRiskCases,
  }
}

export function buildOperationalCockpitFromDashboard(
  dashboardData = {},
  filters = {},
  profileKey = 'admin_central',
  options = {},
) {
  const view = buildAdminDashboardView(dashboardData, filters)
  const activeCases = view.activeCases || []
  const limit = options.limit || 8

  const overdueEntries = activeCases.filter((entry) => isSlaOverdue(entry.sla))
  const atRiskEntries = activeCases.filter(
    (entry) => !isSlaOverdue(entry.sla) && isSlaAtRisk(entry.sla),
  )

  return buildCockpitPayload({
    overdueCases: overdueEntries.slice(0, limit).map((entry) => mapDashboardCase(entry, profileKey, 'overdue')),
    atRiskCases: atRiskEntries.slice(0, limit).map((entry) => mapDashboardCase(entry, profileKey, 'at_risk')),
    activeCount: activeCases.length,
    profileKey,
    scopeLabel: options.scopeLabel || '',
  })
}

export function buildOperationalCockpitFromAreaOverview(
  overview = {},
  profileKey = 'analista_area',
  options = {},
) {
  const activeCount = Number(overview?.kpis?.backlogTotal || 0)
  const limit = options.limit || 8
  const attentionCases = overview?.attentionCases || []
  const overdueEntries = attentionCases.filter((entry) => isAreaOverdue(entry))
  const atRiskEntries = attentionCases.filter(
    (entry) => !isAreaOverdue(entry) && isAreaAtRisk(entry),
  )

  return buildCockpitPayload({
    overdueCases: overdueEntries.slice(0, limit).map((entry) => mapAreaCase(entry, profileKey, 'overdue')),
    atRiskCases: atRiskEntries.slice(0, limit).map((entry) => mapAreaCase(entry, profileKey, 'at_risk')),
    activeCount,
    profileKey,
    scopeLabel: options.scopeLabel || overview?.areaLabel || '',
  })
}

export function buildOperationalCockpitSubtitle(profileKey = 'admin_central') {
  if (profileKey === 'admin_central') {
    return 'Visão institucional para intervir em SLAs atrasados ou prestes a estourar, sem absorver filas operacionais.'
  }

  if (profileKey === 'op_externo') {
    return 'Pool regional: assuma casos críticos da fila para acelerar a resposta quando o polo estiver sob pressão.'
  }

  if (profileKey === 'gestor_area') {
    return 'Leitura rápida da área para redistribuir, assumir ou destravar casos antes do SLA estourar.'
  }

  return 'Fila da área com foco em vencidos e em risco. Assuma o caso quando precisar acelerar a tratativa.'
}
