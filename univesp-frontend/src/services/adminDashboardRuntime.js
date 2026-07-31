import loggedStudent from '../../mocks/usuario-logado.json'
import { operatorAuditSeeds, operatorCorrelationHistory } from '../../mocks/operations'
import { buildCaseRoutingContext, filterCasesForMockContext } from '@/services/caseRoutingRuntime'
import { buildOperatorCaseDetail, buildOperatorQueueEntries } from '@/services/operatorQueueRuntime'

const FILTER_ALL = 'todos'

const QUEUE_LABELS = {
  sra: 'Secretaria Academica',
  financeiro: 'Financeiro',
  op: 'Operacao do Polo',
  suporte_academico_digital: 'Suporte Academico Digital',
  nao_aplicavel: 'Nao aplicavel',
}

const THEME_QUEUE_MAP = {
  matricula: 'Secretaria Academica',
  colacao: 'Secretaria Academica',
  estagio: 'Secretaria Academica',
  provas: 'Suporte Academico Digital',
  atividades_avaliativas: 'Suporte Academico Digital',
  financeiro: 'Financeiro',
}

function normalizeText(value = '') {
  return String(value).replaceAll('Â·', '-').trim().toLowerCase()
}

function sanitizeLabel(value = '') {
  return String(value).replaceAll('Â·', '-').trim()
}

function titleCase(value = '') {
  const sanitized = sanitizeLabel(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')

  if (!sanitized) {
    return 'Nao informado'
  }

  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1)
}

function formatQueueLabel(queue, theme = '') {
  const normalizedQueue = normalizeText(queue)

  if (QUEUE_LABELS[normalizedQueue]) {
    return QUEUE_LABELS[normalizedQueue]
  }

  const normalizedTheme = normalizeText(theme)

  if (THEME_QUEUE_MAP[normalizedTheme]) {
    return THEME_QUEUE_MAP[normalizedTheme]
  }

  return titleCase(queue)
}

function matchesFilter(filterValue, ...candidateValues) {
  if (!filterValue || normalizeText(filterValue) === FILTER_ALL) {
    return true
  }

  return candidateValues.some((value) => normalizeText(value) === normalizeText(filterValue))
}

function isHighCriticality(criticality) {
  const normalized = normalizeText(criticality)
  return normalized === 'alta' || normalized === 'critica'
}

function isSlaOverdue(sla) {
  const normalized = normalizeText(sla)

  return normalized.includes('vencid') || normalized.includes('atrasad') || normalized.includes('expirad')
}

function isSlaAtRisk(sla) {
  const normalized = normalizeText(sla)

  return (
    isSlaOverdue(sla) ||
    normalized.includes('restante') ||
    normalized.includes('min') ||
    normalized.includes('4h')
  )
}

function isConcludedStatus(status) {
  const normalized = normalizeText(status)
  return normalized.includes('conclu') || normalized.includes('encerrad')
}

function buildFilterOptions(values = []) {
  return [
    { value: FILTER_ALL, label: 'Todos' },
    ...Array.from(new Set(values.filter(Boolean))).map((value) => ({
      value,
      label: value,
    })),
  ]
}

function buildHistoricalRouting({
  polo = '',
  theme = '',
  subtheme = '',
  queueLabel = '',
  queueDestination = '',
  criticality = '',
  entryOrigin = 'Portal do atendimento',
}) {
  return buildCaseRoutingContext({
    studentPolo: polo,
    theme,
    subtheme,
    queueDestination,
    targetAreaLabel: queueLabel,
    criticality,
    entryOrigin,
  })
}

function normalizeHistoricalItem(item) {
  const queue = formatQueueLabel(item.queue, item.theme)
  const routing = buildHistoricalRouting({
    polo: item.polo,
    theme: item.theme,
    subtheme: item.subtheme,
    queueLabel: queue,
  })

  return {
    id: item.id,
    subject: item.subject,
    theme: titleCase(item.theme),
    themeKey: normalizeText(item.theme),
    subsubject: titleCase(item.subtheme),
    subsubjectKey: normalizeText(item.subtheme),
    queue,
    lastMileAreaLabel: routing.targetAreaLabel,
    routing,
    status: sanitizeLabel(item.status || 'Nao informado'),
    criticality: 'Media',
    sla: 'Historico',
    student: item.student,
    polo: item.polo,
    createdAt: item.createdAt,
    createdAtLabel: item.createdAtLabel,
    sourceType: item.type,
    resolvedByFaq: item.type === 'faq_resolved',
    sentToOp: item.type === 'protocol_submitted',
    concluded: isConcludedStatus(item.status),
  }
}

function normalizeResolvedRecord(record, studentProfile = loggedStudent) {
  const queue = formatQueueLabel(record.queueDestination || record.context?.queueDestination, record.context?.theme)
  const routing = buildHistoricalRouting({
    polo: studentProfile.polo,
    theme: record.context?.theme,
    subtheme: record.context?.subtheme || record.context?.finalNode?.title,
    queueLabel: queue,
    queueDestination: record.queueDestination || record.context?.queueDestination,
    criticality: record.criticality || record.context?.criticality,
    entryOrigin: record.context?.entryOrigin || 'Acesso Unificado',
  })

  return {
    id: record.id,
    subject: record.subject,
    theme: titleCase(record.context?.theme),
    themeKey: normalizeText(record.context?.theme),
    subsubject: titleCase(record.context?.subtheme || record.context?.finalNode?.title),
    subsubjectKey: normalizeText(record.context?.subtheme || record.context?.finalNode?.title),
    queue,
    lastMileAreaLabel: routing.targetAreaLabel,
    routing,
    status: sanitizeLabel(record.statusLabel),
    criticality: titleCase(record.criticality || record.context?.criticality),
    sla: sanitizeLabel(record.sla || record.context?.sla || 'Historico'),
    student: studentProfile.nome,
    polo: studentProfile.polo,
    createdAt: record.createdAt,
    createdAtLabel: record.createdAtLabel,
    sourceType: 'faq_resolved',
    resolvedByFaq: true,
    sentToOp: false,
    concluded: true,
  }
}

function normalizeProtocolHistory(protocol, studentProfile = loggedStudent) {
  const queue = sanitizeLabel(protocol.queueLabel || protocol.context?.routing?.currentQueueLabel || protocol.context?.queueDestination)
  const routing =
    protocol.routing ||
    protocol.context?.routing ||
    buildHistoricalRouting({
      polo: studentProfile.polo,
      theme: protocol.context?.theme,
      subtheme: protocol.context?.subtheme || protocol.context?.finalNode?.title,
      queueLabel: queue,
      queueDestination: protocol.context?.queueDestination,
      criticality: protocol.context?.criticality,
      entryOrigin: protocol.context?.entryOrigin || 'Acesso Unificado',
    })

  return {
    id: protocol.protocolNumber,
    subject: protocol.subject,
    theme: titleCase(protocol.context?.theme),
    themeKey: normalizeText(protocol.context?.theme),
    subsubject: titleCase(protocol.context?.subtheme || protocol.context?.finalNode?.title),
    subsubjectKey: normalizeText(protocol.context?.subtheme || protocol.context?.finalNode?.title),
    queue,
    lastMileAreaLabel: protocol.lastMileAreaLabel || routing.targetAreaLabel,
    routing,
    status: sanitizeLabel(protocol.statusLabel),
    criticality: titleCase(protocol.context?.criticality),
    sla: sanitizeLabel(protocol.slaLabel || protocol.context?.sla || 'Nao informado'),
    student: studentProfile.nome,
    polo: studentProfile.polo,
    createdAt: protocol.createdAt,
    createdAtLabel: protocol.createdAtLabel,
    sourceType: 'protocol_submitted',
    resolvedByFaq: false,
    sentToOp: true,
    concluded: protocol.statusGroup === 'completed' || isConcludedStatus(protocol.statusLabel),
  }
}

function buildHistoricalAttendances({
  records = [],
  protocols = [],
  studentProfile = loggedStudent,
  viewerContext = null,
  includeSeeds = true,
}) {
  const entries = [
    ...(includeSeeds ? operatorCorrelationHistory.map((item) => normalizeHistoricalItem(item)) : []),
    ...records
      .filter((record) => record.outcome === 'resolved_by_faq')
      .map((record) => normalizeResolvedRecord(record, studentProfile)),
    ...protocols.map((protocol) => normalizeProtocolHistory(protocol, studentProfile)),
  ]

  return filterCasesForMockContext(entries, viewerContext)
}

function buildActiveCases({
  protocols = [],
  records = [],
  actionLogs = [],
  areaActionLogs = [],
  studentProfile = loggedStudent,
  viewerContext = null,
  seededQueue = undefined,
}) {
  const queueEntries = buildOperatorQueueEntries({
    protocols,
    seededQueue,
    actionLogs,
    areaActionLogs,
    studentProfile,
    viewerContext,
  })

  return queueEntries.map((entry) => {
    const detail = buildOperatorCaseDetail({
      caseId: entry.id,
      protocols,
      records,
      actionLogs,
      areaActionLogs,
      studentProfile,
      viewerContext,
    })

    return {
      ...entry,
      queue: sanitizeLabel(entry.queue),
      lastMileAreaLabel: sanitizeLabel(entry.lastMileAreaLabel),
      sourceType: 'active_queue',
      faqContext: detail?.faqContext || null,
      faqAnswer: detail?.faqAnswer || '',
      correlatedSummary: detail?.correlatedHistory?.summary || null,
      recurrenceSignals: detail?.correlatedHistory?.signals || {
        repeatedTheme: false,
        repeatedSubsubject: false,
        priorSelfServiceRelated: false,
      },
      studentData: detail?.studentData || null,
    }
  })
}

function buildAuditEntries({
  activeCases = [],
  historicalAttendances = [],
  actionLogs = [],
  viewerContext = null,
  includeSeeds = true,
}) {
  const caseIndex = Object.fromEntries(activeCases.map((entry) => [entry.id, entry]))
  const historyIndex = Object.fromEntries(historicalAttendances.map((entry) => [entry.id, entry]))

  const entries = [...(includeSeeds ? operatorAuditSeeds : []), ...actionLogs]
    .map((log) => {
      const caseEntry = caseIndex[log.caseId] || historyIndex[log.caseId] || null

      return {
        id: log.id,
        caseId: log.caseId,
        actor: log.actor || 'Operador de Polo',
        actionType: log.actionType,
        actionLabel: log.actionLabel || 'Acao operacional',
        occurredAt: log.occurredAt,
        occurredAtLabel: log.occurredAtLabel || 'Nao informado',
        statusBefore: sanitizeLabel(log.statusBefore || caseEntry?.status || 'Nao informado'),
        statusAfter: sanitizeLabel(log.statusAfter || log.statusLabel || caseEntry?.status || 'Nao informado'),
        queueBefore: sanitizeLabel(log.queueBefore || caseEntry?.queue || 'Nao informado'),
        queueAfter: sanitizeLabel(log.queueAfter || log.queueLabel || caseEntry?.queue || 'Nao informado'),
        escalationReason: log.escalationReason || null,
        note: log.note || '',
        subject: caseEntry?.subject || `Caso ${log.caseId}`,
        theme: caseEntry?.theme || 'Nao informado',
        criticality: caseEntry?.criticality || 'Media',
        status: caseEntry?.status || sanitizeLabel(log.statusAfter || 'Nao informado'),
        queue: caseEntry?.queue || sanitizeLabel(log.queueAfter || log.queueLabel || 'Nao informado'),
        lastMileAreaLabel:
          caseEntry?.lastMileAreaLabel ||
          caseEntry?.routing?.targetAreaLabel ||
          sanitizeLabel(log.queueAfter || log.queueLabel || 'Nao informado'),
        student: caseEntry?.student || 'Nao informado',
        polo: caseEntry?.polo || 'Nao informado',
        routing: caseEntry?.routing || null,
      }
    })
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())

  return filterCasesForMockContext(entries, viewerContext)
}

function filterAttendanceEntries(entries = [], filters = {}) {
  return entries.filter((entry) => {
    return (
      matchesFilter(filters.queue, entry.queue) &&
      matchesFilter(filters.status, entry.status) &&
      matchesFilter(filters.criticality, entry.criticality) &&
      matchesFilter(filters.theme, entry.theme)
    )
  })
}

function filterAuditEntries(entries = [], filters = {}) {
  return entries.filter((entry) => {
    return (
      matchesFilter(filters.queue, entry.queue, entry.queueBefore, entry.queueAfter) &&
      matchesFilter(filters.status, entry.status, entry.statusAfter) &&
      matchesFilter(filters.criticality, entry.criticality) &&
      matchesFilter(filters.theme, entry.theme)
    )
  })
}

function countUniqueBy(entries = [], key) {
  return new Set(entries.map((entry) => entry[key]).filter(Boolean)).size
}

function buildKpis({ activeCases = [], historicalAttendances = [], auditEntries = [] }) {
  const totalAttendanceIds = new Set([
    ...activeCases.map((entry) => entry.id),
    ...historicalAttendances.map((entry) => entry.id),
  ])
  const sentToOpIds = new Set([
    ...activeCases.map((entry) => entry.id),
    ...historicalAttendances.filter((entry) => entry.sentToOp).map((entry) => entry.id),
  ])
  const concludedIds = new Set([
    ...activeCases.filter((entry) => isConcludedStatus(entry.status)).map((entry) => entry.id),
    ...historicalAttendances.filter((entry) => entry.concluded).map((entry) => entry.id),
  ])

  return [
    {
      label: 'Total de atendimentos',
      value: totalAttendanceIds.size,
      hint: 'Consolida fila ativa, historico de protocolos e registros resolvidos pela FAQ.',
    },
    {
      label: 'Resolvidos pela FAQ',
      value: countUniqueBy(historicalAttendances.filter((entry) => entry.resolvedByFaq), 'id'),
      hint: 'Autoatendimentos registrados na fonte de dados ativa.',
    },
    {
      label: 'Enviados ao OP',
      value: sentToOpIds.size,
      hint: 'Casos que chegaram a protocolo e passaram pela camada operacional.',
    },
    {
      label: 'Respondidos pelo OP',
      value: countUniqueBy(auditEntries.filter((entry) => entry.actionType === 'reply'), 'caseId'),
      hint: 'Casos com resposta operacional registrada no portal do atendimento.',
    },
    {
      label: 'Em complementacao',
      value: countUniqueBy(auditEntries.filter((entry) => entry.actionType === 'request_info'), 'caseId'),
      hint: 'Casos que voltaram ao aluno para envio de novas informacoes ou anexos.',
    },
    {
      label: 'Escalados para area interna',
      value: countUniqueBy(auditEntries.filter((entry) => entry.actionType === 'escalate'), 'caseId'),
      hint: 'Casos que subiram do OP para o last mile institucional.',
    },
    {
      label: 'Concluidos',
      value: concludedIds.size,
      hint: 'Atendimentos encerrados no historico consolidado da fonte ativa.',
    },
    {
      label: 'Criticidade alta',
      value: activeCases.filter((entry) => isHighCriticality(entry.criticality)).length,
      hint: 'Itens ativos com criticidade alta ou critica na fila operacional.',
    },
    {
      label: 'SLA vencido',
      value: activeCases.filter((entry) => isSlaOverdue(entry.sla)).length,
      hint: 'Casos ativos que ja ultrapassaram a janela prevista de atendimento.',
    },
    {
      label: 'Reincidencia de tema',
      value: activeCases.filter((entry) => entry.recurrenceSignals?.repeatedTheme).length,
      hint: 'Casos ativos com historico correlato no mesmo tema.',
    },
    {
      label: 'Reincidencia de subtema',
      value: activeCases.filter((entry) => entry.recurrenceSignals?.repeatedSubsubject).length,
      hint: 'Casos ativos com repeticao especifica no mesmo subtema.',
    },
  ]
}

function buildQueueSummary({ activeCases = [], auditEntries = [] }) {
  const queueIndex = new Map()

  for (const entry of activeCases) {
    const queue = entry.queue || 'Nao informado'

    if (!queueIndex.has(queue)) {
      queueIndex.set(queue, {
        queue,
        volume: 0,
        highCriticalityCount: 0,
        slaOverdueCount: 0,
        slaAtRiskCount: 0,
        escalationsCount: 0,
        themes: {},
      })
    }

    const current = queueIndex.get(queue)
    current.volume += 1
    current.highCriticalityCount += isHighCriticality(entry.criticality) ? 1 : 0
    current.slaOverdueCount += isSlaOverdue(entry.sla) ? 1 : 0
    current.slaAtRiskCount += isSlaAtRisk(entry.sla) ? 1 : 0
    current.themes[entry.theme] = (current.themes[entry.theme] || 0) + 1
  }

  for (const auditEntry of auditEntries) {
    if (auditEntry.actionType !== 'escalate') {
      continue
    }

    const queue = auditEntry.queueBefore || auditEntry.queue || 'Nao informado'

    if (!queueIndex.has(queue)) {
      queueIndex.set(queue, {
        queue,
        volume: 0,
        highCriticalityCount: 0,
        slaOverdueCount: 0,
        slaAtRiskCount: 0,
        escalationsCount: 0,
        themes: {},
      })
    }

    queueIndex.get(queue).escalationsCount += 1
  }

  return [...queueIndex.values()]
    .map((entry) => {
      const dominantThemeEntry =
        Object.entries(entry.themes).sort((left, right) => right[1] - left[1])[0] || null

      return {
        queue: entry.queue,
        volume: entry.volume,
        highCriticalityCount: entry.highCriticalityCount,
        slaOverdueCount: entry.slaOverdueCount,
        escalationsCount: entry.escalationsCount,
        dominantTheme: dominantThemeEntry?.[0] || 'Nao informado',
        criticalityLabel:
          entry.highCriticalityCount > 0
            ? `${entry.highCriticalityCount} alta/critica`
            : 'Sem criticidade alta',
        slaLabel:
          entry.slaOverdueCount > 0
            ? `${entry.slaOverdueCount} SLA vencido`
            : entry.slaAtRiskCount > 0
              ? `${entry.slaAtRiskCount} SLA em atencao`
              : 'SLA sob controle',
      }
    })
    .sort((left, right) => {
      return (
        right.highCriticalityCount - left.highCriticalityCount ||
        right.escalationsCount - left.escalationsCount ||
        right.volume - left.volume
      )
    })
}

function buildGovernanceCards({ activeCases = [], auditEntries = [] }) {
  const repeatedCases = activeCases.filter(
    (entry) => entry.recurrenceSignals?.repeatedTheme || entry.recurrenceSignals?.repeatedSubsubject,
  ).length
  const escalatedCases = countUniqueBy(
    auditEntries.filter((entry) => entry.actionType === 'escalate'),
    'caseId',
  )
  const slaHotspots = activeCases.filter((entry) => isSlaAtRisk(entry.sla)).length

  return [
    {
      title: 'Auditoria operacional viva',
      description: `${auditEntries.length} movimentos operacionais disponiveis na fonte ativa.`,
      eyebrow: 'Auditoria',
    },
    {
      title: 'Recorrencia por tema',
      description: `${repeatedCases} casos ativos ja chegam com sinais de repeticao de tema ou subtema.`,
      eyebrow: 'Governanca',
    },
    {
      title: 'Pressao de SLA',
      description: `${slaHotspots} casos ativos exigem leitura de gestao por janela curta ou SLA ja vencido.`,
      eyebrow: 'Risco',
    },
    {
      title: 'Escalonamento interno',
      description: `${escalatedCases} casos ja demandaram subida para area interna antes do encerramento.`,
      eyebrow: 'Fluxo',
    },
  ]
}

export function buildAdminDashboardData({
  protocols = [],
  records = [],
  actionLogs = [],
  areaActionLogs = [],
  studentProfile = loggedStudent,
  viewerContext = null,
  seededQueue = undefined,
  includeSeeds = true,
} = {}) {
  const activeCases = buildActiveCases({
    protocols,
    records,
    actionLogs,
    areaActionLogs,
    studentProfile,
    viewerContext,
    seededQueue,
  })
  const historicalAttendances = buildHistoricalAttendances({
    records,
    protocols,
    studentProfile,
    viewerContext,
    includeSeeds,
  })
  const auditEntries = buildAuditEntries({
    activeCases,
    historicalAttendances,
    actionLogs,
    viewerContext,
    includeSeeds,
  })
  const filterSource = [...activeCases, ...historicalAttendances]

  return {
    activeCases,
    historicalAttendances,
    auditEntries,
    filterOptions: {
      queue: buildFilterOptions(filterSource.map((entry) => entry.queue)),
      status: buildFilterOptions(filterSource.map((entry) => entry.status)),
      criticality: buildFilterOptions(filterSource.map((entry) => entry.criticality)),
      theme: buildFilterOptions(filterSource.map((entry) => entry.theme)),
    },
  }
}

export function buildAdminDashboardView(dashboardData, filters = {}) {
  const activeCases = filterAttendanceEntries(dashboardData?.activeCases || [], filters)
  const historicalAttendances = filterAttendanceEntries(
    dashboardData?.historicalAttendances || [],
    filters,
  )
  const auditEntries = filterAuditEntries(dashboardData?.auditEntries || [], filters)

  return {
    activeCases,
    historicalAttendances,
    auditEntries,
    kpis: buildKpis({
      activeCases,
      historicalAttendances,
      auditEntries,
    }),
    queueSummary: buildQueueSummary({
      activeCases,
      auditEntries,
    }),
    governanceCards: buildGovernanceCards({
      activeCases,
      auditEntries,
    }),
  }
}
