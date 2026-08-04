<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ActionTile from '@/components/ActionTile.vue'
import MetricCard from '@/components/MetricCard.vue'
import OperationalCockpitPanel from '@/components/operational/OperationalCockpitPanel.vue'
import PriorityBadge from '@/components/PriorityBadge.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { buildAdminDashboardView } from '@/services/adminDashboardRuntime'
import { buildOperationalCockpitFromDashboard } from '@/services/operationalCockpitRuntime'
import { getLegacyKnowledgeMetrics, isMockRuntimeEnabled, listTickets } from '@/services/appApi'
import { mapApiTicketToOperationalProtocol } from '@/services/ticketMapper'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const knowledgeMetricOverrides = ref([])
const liveState = reactive({
  loading: false,
  error: '',
  total: 0,
  loaded: 0,
  truncated: false,
})

async function loadInstitutionalDashboard() {
  if (isMockRuntimeEnabled()) return
  liveState.loading = true
  liveState.error = ''
  try {
    const pageSize = 100
    const maxPages = 5
    const tickets = []
    let total = 0
    for (let page = 1; page <= maxPages; page += 1) {
      const response = await listTickets({ page, page_size: pageSize })
      const batch = Array.isArray(response.data) ? response.data : []
      tickets.push(...batch)
      total = Number(response.meta?.total || tickets.length)
      if (tickets.length >= total || batch.length < pageSize) break
    }
    studentSupportStore.replaceLiveTickets(tickets.map(mapApiTicketToOperationalProtocol))
    liveState.total = total
    liveState.loaded = tickets.length
    liveState.truncated = tickets.length < total
  } catch (error) {
    studentSupportStore.replaceLiveTickets([])
    liveState.error = error?.message || 'Falha ao carregar os indicadores institucionais.'
  } finally {
    liveState.loading = false
  }
}

const filters = reactive({
  queue: 'todos',
  status: 'todos',
  criticality: 'todos',
  theme: 'todos',
})
const ui = reactive({
  selectedClusterKey: '',
  periodKey: '7d',
  periodFrom: '',
  periodTo: '',
  poloSearch: '',
  viewMode: 'areas',
})

const periodOptions = [
  { value: 'today', label: 'Hoje', summary: 'hoje' },
  { value: '7d', label: '7 dias', summary: 'ultimos 7 dias' },
  { value: '30d', label: '30 dias', summary: 'ultimos 30 dias' },
  { value: 'custom', label: 'Periodo', summary: 'periodo personalizado' },
]
const dashboardBase = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))
const dashboardView = computed(() => buildAdminDashboardView(dashboardBase.value, filters))
const operationalCockpit = computed(() =>
  buildOperationalCockpitFromDashboard(dashboardBase.value, filters, 'admin_central'),
)
const filterOptions = computed(() => dashboardBase.value.filterOptions)
const metrics = computed(() => {
  const overrides = new Map(
    knowledgeMetricOverrides.value.map((metric) => [metric.label, metric.value]),
  )
  return dashboardView.value.kpis.map((metric) =>
    overrides.has(metric.label) ? { ...metric, value: overrides.get(metric.label) } : metric,
  )
})
const criticalMetricLabels = ['SLA vencido', 'Criticidade alta', 'Escalados para area interna', 'Reincidencia de tema']
const metricValue = (label) => metrics.value.find((metric) => metric.label === label)?.value || 0

onMounted(async () => {
  if (isMockRuntimeEnabled()) return
  await loadInstitutionalDashboard()
  try {
    const response = await getLegacyKnowledgeMetrics()
    knowledgeMetricOverrides.value = Array.isArray(response.data?.legacy_metrics)
      ? response.data.legacy_metrics
      : []
  } catch {
    knowledgeMetricOverrides.value = []
  }
})
const criticalKpiCards = computed(() => [
  {
    label: 'SLA vencido',
    value: metricValue('SLA vencido'),
    trend: 'atencao',
    tone: 'danger',
    focus: 'sla',
  },
  {
    label: 'Criticidade alta',
    value: metricValue('Criticidade alta'),
    trend: 'priorizar',
    tone: 'danger',
    focus: 'criticality',
  },
  {
    label: 'Escalados',
    value: metricValue('Escalados para area interna'),
    trend: 'acompanhar',
    tone: 'warning',
    focus: 'escalated',
  },
  {
    label: 'Reincidencia',
    value: metricValue('Reincidencia de tema'),
    trend: 'revisar FAQ',
    tone: 'warning',
    focus: 'recurrence',
  },
  {
    label: 'Volume ativo',
    value: activeCasesFull.value.length,
    trend: 'em tela',
    tone: 'neutral',
    focus: 'volume',
  },
])
const secondaryMetrics = computed(() =>
  metrics.value.filter((metric) => !criticalMetricLabels.includes(metric.label)),
)
const auditEntries = computed(() => dashboardView.value.auditEntries)
const activeCasesFull = computed(() => dashboardView.value.activeCases)
const periodScopedCases = computed(() => activeCasesFull.value.filter((item) => matchesSelectedPeriod(item)))
const activeCases = computed(() => periodScopedCases.value.slice(0, 4))
const governanceCards = computed(() => dashboardView.value.governanceCards)

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultCustomPeriodRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  }
}

function formatPeriodLabel(value) {
  if (!value) return ''
  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function parseCaseDateValue(item) {
  const raw = item?.createdAt || item?.createdAtLabel
  if (!raw) return null
  const normalized = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    return normalized.slice(0, 10)
  }
  const brMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  }
  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return null
  return formatDateInput(new Date(parsed))
}

function matchesSelectedPeriod(item) {
  const caseDate = parseCaseDateValue(item)
  if (!caseDate) return ui.periodKey === 'custom' ? false : true

  const today = formatDateInput(new Date())

  if (ui.periodKey === 'today') {
    return caseDate === today
  }

  if (ui.periodKey === '7d' || ui.periodKey === '30d') {
    const days = ui.periodKey === '7d' ? 7 : 30
    const from = new Date()
    from.setDate(from.getDate() - (days - 1))
    return caseDate >= formatDateInput(from) && caseDate <= today
  }

  if (ui.periodKey === 'custom') {
    if (!ui.periodFrom || !ui.periodTo) return true
    return caseDate >= ui.periodFrom && caseDate <= ui.periodTo
  }

  return true
}

function selectPeriod(option) {
  ui.periodKey = option.value
  if (option.value !== 'custom') return

  if (!ui.periodFrom || !ui.periodTo) {
    const range = defaultCustomPeriodRange()
    ui.periodFrom = range.from
    ui.periodTo = range.to
  }
}

const selectedPeriodLabel = computed(() => {
  if (ui.periodKey === 'custom') {
    if (ui.periodFrom && ui.periodTo) {
      return `${formatPeriodLabel(ui.periodFrom)} a ${formatPeriodLabel(ui.periodTo)}`
    }
    return 'periodo personalizado'
  }

  return periodOptions.find((option) => option.value === ui.periodKey)?.summary || 'base atual'
})
const healthScore = computed(() =>
  metricValue('SLA vencido') * 4 +
  metricValue('Criticidade alta') * 3 +
  metricValue('Escalados para area interna') * 2 +
  metricValue('Reincidencia de tema'),
)
const healthState = computed(() => {
  if (healthScore.value >= 10) {
    return 'Critico'
  }

  if (healthScore.value >= 4) {
    return 'Atencao'
  }

  return 'Normal'
})
const operationHealth = computed(() => {
  if (healthState.value === 'Critico') {
    return {
      label: healthState.value,
      score: healthScore.value,
      tone: 'danger',
      hint: 'acao imediata',
    }
  }

  if (healthState.value === 'Atencao') {
    return {
      label: healthState.value,
      score: healthScore.value,
      tone: 'warning',
      hint: 'acompanhar',
    }
  }

  return {
    label: healthState.value,
    score: healthScore.value,
    tone: 'normal',
    hint: 'estavel',
  }
})
const demandDistribution = computed(() => {
  const resolvedByFaq = metricValue('Resolvidos pela FAQ')
  const sentToOp = metricValue('Enviados ao OP')
  const escalated = metricValue('Escalados para area interna')
  const activeVolume = activeCasesFull.value.length
  const total = Math.max(resolvedByFaq + sentToOp + escalated + activeVolume, 1)

  const entries = [
    { label: 'FAQ resolveu', value: resolvedByFaq, color: '#0f766e' },
    { label: 'Passou ao OP', value: sentToOp, color: '#2563eb' },
    { label: 'Escalou area', value: escalated, color: '#ca8a04' },
    { label: 'Em andamento', value: activeVolume, color: '#d13239' },
  ]

  let offset = 0

  return entries.map((entry) => {
    const percent = Math.round((entry.value / total) * 100)
    const segment = {
      ...entry,
      percent,
      offset,
    }
    offset -= percent
    return segment
  })
})
const clusterRiskRows = computed(() => {
  const clusterIndex = new Map()

  for (const item of activeCasesFull.value) {
    const cluster = item.lastMileAreaLabel || item.queue || 'Nao informado'
    const key = `cluster:${cluster}`
    const current = clusterIndex.get(key) || {
      key,
      cluster,
      type: item.lastMileAreaLabel ? 'Area interna' : 'Fila',
      volume: 0,
      slaOverdueCount: 0,
      highCriticalityCount: 0,
      escalationsCount: 0,
      recurrenceCount: 0,
      themes: {},
      dominantTheme: 'Nao informado',
      dominantQueue: item.queue || 'Nao informado',
      examples: [],
      riskScore: 0,
    }

    current.volume += 1
    current.slaOverdueCount += String(item.sla || '').toLowerCase().includes('vencid') ? 1 : 0
    current.highCriticalityCount += ['alta', 'critica'].includes(String(item.criticality || '').toLowerCase()) ? 1 : 0
    current.recurrenceCount += item.recurrenceSignals?.repeatedTheme || item.recurrenceSignals?.repeatedSubsubject ? 1 : 0
    current.themes[item.theme || 'Nao informado'] = (current.themes[item.theme || 'Nao informado'] || 0) + 1

    if (current.examples.length < 3) {
      current.examples.push(item)
    }

    clusterIndex.set(key, current)
  }

  for (const entry of auditEntries.value) {
    if (entry.actionType !== 'escalate') {
      continue
    }

    const cluster = entry.lastMileAreaLabel || entry.queueBefore || entry.queue || 'Nao informado'
    const key = `cluster:${cluster}`

    if (!clusterIndex.has(key)) {
      clusterIndex.set(key, {
        key,
        cluster,
        type: entry.lastMileAreaLabel ? 'Area interna' : 'Fila',
        volume: 0,
        slaOverdueCount: 0,
        highCriticalityCount: 0,
        escalationsCount: 0,
        recurrenceCount: 0,
        themes: {},
        dominantTheme: entry.theme || 'Nao informado',
        dominantQueue: entry.queueBefore || entry.queue || 'Nao informado',
        examples: [],
        riskScore: 0,
      })
    }

    clusterIndex.get(key).escalationsCount += 1
  }

  return [...clusterIndex.values()]
    .map((entry) => {
      const dominantTheme =
        Object.entries(entry.themes).sort((left, right) => right[1] - left[1])[0]?.[0] ||
        entry.dominantTheme
      const riskScore =
        entry.volume +
        entry.slaOverdueCount * 4 +
        entry.highCriticalityCount * 3 +
        entry.escalationsCount * 2 +
        entry.recurrenceCount

      return {
        ...entry,
        dominantTheme,
        riskScore,
        trend: entry.recurrenceCount > 0 || entry.slaOverdueCount > 0 ? 'subindo' : 'estavel',
      }
    })
    .sort((left, right) => right.riskScore - left.riskScore || right.volume - left.volume)
    .slice(0, 5)
})
function buildRiskRows(items, keyGetter, type) {
  const index = new Map()

  for (const item of items) {
    const cluster = keyGetter(item) || 'Nao informado'
    const key = `${type}:${cluster}`
    const current = index.get(key) || {
      key,
      cluster,
      type,
      volume: 0,
      slaOverdueCount: 0,
      highCriticalityCount: 0,
      escalationsCount: 0,
      recurrenceCount: 0,
      themes: {},
      dominantTheme: 'Nao informado',
      examples: [],
      riskScore: 0,
    }

    current.volume += 1
    current.slaOverdueCount += String(item.sla || '').toLowerCase().includes('vencid') ? 1 : 0
    current.highCriticalityCount += ['alta', 'critica'].includes(String(item.criticality || '').toLowerCase()) ? 1 : 0
    current.recurrenceCount += item.recurrenceSignals?.repeatedTheme || item.recurrenceSignals?.repeatedSubsubject ? 1 : 0
    current.themes[item.theme || 'Nao informado'] = (current.themes[item.theme || 'Nao informado'] || 0) + 1

    if (current.examples.length < 3) {
      current.examples.push(item)
    }

    index.set(key, current)
  }

  return [...index.values()]
    .map((entry) => {
      const dominantTheme =
        Object.entries(entry.themes).sort((left, right) => right[1] - left[1])[0]?.[0] ||
        entry.dominantTheme
      const riskScore =
        entry.volume +
        entry.slaOverdueCount * 4 +
        entry.highCriticalityCount * 3 +
        entry.escalationsCount * 2 +
        entry.recurrenceCount

      return {
        ...entry,
        dominantTheme,
        riskScore,
        trend: entry.recurrenceCount > 0 || entry.slaOverdueCount > 0 ? 'subindo' : 'estavel',
      }
    })
    .sort((left, right) => right.riskScore - left.riskScore || right.volume - left.volume)
}
const poloRiskRows = computed(() => {
  const search = ui.poloSearch.trim().toLowerCase()
  const rows = buildRiskRows(activeCasesFull.value, (item) => item.polo, 'Polo')

  return search ? rows.filter((row) => row.cluster.toLowerCase().includes(search)) : rows
})
const themeRiskRows = computed(() => buildRiskRows(activeCasesFull.value, (item) => item.theme, 'Tema'))
const faqRiskRows = computed(() => [{
  key: 'FAQ:autosservico',
  cluster: 'FAQ e autosservico',
  type: 'FAQ',
  volume: selfServiceEscape.value.sentToOp + selfServiceEscape.value.recurrence,
  slaOverdueCount: metricValue('SLA vencido'),
  highCriticalityCount: metricValue('Criticidade alta'),
  escalationsCount: metricValue('Escalados para area interna'),
  recurrenceCount: selfServiceEscape.value.recurrence,
  dominantTheme: themeRanking.value[0]?.theme || 'Nao informado',
  trend: selfServiceEscape.value.recurrence > 0 ? 'subindo' : 'estavel',
  riskScore:
    selfServiceEscape.value.sentToOp +
    selfServiceEscape.value.recurrence * 2 +
    metricValue('SLA vencido'),
  examples: [],
}])
const topRiskItems = computed(() => {
  if (ui.viewMode === 'polos') {
    return poloRiskRows.value.slice(0, 5)
  }

  if (ui.viewMode === 'temas') {
    return themeRiskRows.value.slice(0, 5)
  }

  if (ui.viewMode === 'faq') {
    return faqRiskRows.value
  }

  return clusterRiskRows.value.slice(0, 5)
})
const areaRiskRows = computed(() => clusterRiskRows.value.slice(0, 6))
const maxAreaRisk = computed(() => Math.max(...areaRiskRows.value.map((entry) => entry.riskScore), 1))
const maxPoloRisk = computed(() => Math.max(...poloRiskRows.value.map((entry) => entry.riskScore), 1))
const selectedClusterDetails = computed(() => {
  if (!ui.selectedClusterKey) {
    return null
  }

  const selected = topRiskItems.value.find((entry) => entry.key === ui.selectedClusterKey) || null

  if (!selected) {
    return null
  }

  const reason = selected.slaOverdueCount > 0
    ? `${selected.slaOverdueCount} SLA vencido(s) no recorte.`
    : selected.highCriticalityCount > 0
      ? `${selected.highCriticalityCount} caso(s) critico(s) no recorte.`
      : selected.recurrenceCount > 0
        ? `Reincidencia no tema ${selected.dominantTheme}.`
        : 'Risco calculado pela pressao operacional atual.'
  const nextSteps = [
    selected.slaOverdueCount > 0 ? 'Revisar casos com SLA vencido.' : '',
    selected.highCriticalityCount > 0 ? 'Priorizar criticidade alta.' : '',
    selected.escalationsCount > 0 ? 'Checar escalonamentos recentes.' : '',
    selected.recurrenceCount > 0 ? 'Revisar FAQ/playbook do tema dominante.' : '',
  ].filter(Boolean)

  return {
    ...selected,
    reason,
    nextSteps: nextSteps.length ? nextSteps.slice(0, 3) : ['Manter monitoramento do recorte.'],
  }
})
const recommendedActions = computed(() => {
  const source = [
    ...areaRiskRows.value.slice(0, 2),
    ...poloRiskRows.value.slice(0, 2),
    ...themeRiskRows.value.slice(0, 2),
    ...faqRiskRows.value,
  ]
  const actions = source.flatMap((cluster) => {
    const clusterActions = []
    const viewMode =
      cluster.type === 'Polo' ? 'polos' :
        cluster.type === 'Tema' ? 'temas' :
          cluster.type === 'FAQ' ? 'faq' : 'areas'

    if (cluster.slaOverdueCount > 0) {
      clusterActions.push({
        title: `Revisar SLA em ${cluster.cluster}`,
        reason: `${cluster.slaOverdueCount} SLA vencido(s).`,
        risk: 'alto',
        clusterKey: cluster.key,
        viewMode,
      })
    }

    if (cluster.highCriticalityCount > 0) {
      clusterActions.push({
        title: `Priorizar ${cluster.cluster}`,
        reason: `${cluster.highCriticalityCount} critico(s) no recorte.`,
        risk: 'alto',
        clusterKey: cluster.key,
        viewMode,
      })
    }

    if (cluster.escalationsCount > 0) {
      clusterActions.push({
        title: `Checar ${cluster.cluster}`,
        reason: `${cluster.escalationsCount} escalonamento(s).`,
        risk: 'medio',
        clusterKey: cluster.key,
        viewMode,
      })
    }

    return clusterActions
  })
  const uniqueActions = []
  const usedClusters = new Set()

  for (const action of actions.sort((left, right) => (right.risk === 'alto') - (left.risk === 'alto'))) {
    if (usedClusters.has(action.clusterKey)) {
      continue
    }

    uniqueActions.push(action)
    usedClusters.add(action.clusterKey)

    if (uniqueActions.length === 5) {
      break
    }
  }

  return uniqueActions.length
    ? uniqueActions
    : [{ title: 'Monitorar visao atual', reason: 'Nao ha alerta critico nos filtros atuais.', risk: 'baixo', clusterKey: topRiskItems.value[0]?.key || '', viewMode: ui.viewMode }]
})
const themeRanking = computed(() => {
  const themeIndex = new Map()

  for (const item of activeCasesFull.value) {
    const theme = item.theme || 'Nao informado'
    const current = themeIndex.get(theme) || {
      theme,
      count: 0,
      recurrenceCount: 0,
    }

    current.count += 1
    current.recurrenceCount += item.recurrenceSignals?.repeatedTheme || item.recurrenceSignals?.repeatedSubsubject ? 1 : 0
    themeIndex.set(theme, current)
  }

  return [...themeIndex.values()]
    .sort((left, right) => right.count - left.count || right.recurrenceCount - left.recurrenceCount)
    .slice(0, 5)
})
const maxThemeCount = computed(() => Math.max(...themeRanking.value.map((entry) => entry.count), 1))
const totalThemeCount = computed(() => Math.max(themeRanking.value.reduce((sum, entry) => sum + entry.count, 0), 1))
const demandTrend = computed(() => {
  const buckets = new Map()

  for (const item of periodScopedCases.value) {
    const rawDate = item.createdAtLabel || item.createdAt || 'Atual'
    const label = String(rawDate).slice(0, 10)
    const current = buckets.get(label) || { label, count: 0 }
    current.count += 1
    buckets.set(label, current)
  }

  const values = [...buckets.values()].slice(-5)

  if (!values.length) {
    return [{ label: 'Atual', count: 0 }]
  }

  return values
})
const maxDemandTrendCount = computed(() => Math.max(...demandTrend.value.map((entry) => entry.count), 1))
const demandTrendDirection = computed(() => {
  const values = demandTrend.value
  const first = values[0]?.count || 0
  const last = values[values.length - 1]?.count || 0

  if (last > first) {
    return 'subindo'
  }

  if (last < first) {
    return 'caindo'
  }

  return 'estavel'
})
const demandTrendPoints = computed(() => {
  const values = demandTrend.value
  const max = maxDemandTrendCount.value
  const step = values.length > 1 ? 100 / (values.length - 1) : 100

  return values
    .map((entry, index) => {
      const x = values.length > 1 ? index * step : 50
      const y = 42 - Math.round((entry.count / max) * 34)
      return `${x},${Math.max(6, y)}`
    })
    .join(' ')
})
const selfServiceEscape = computed(() => {
  const resolvedByFaq = metricValue('Resolvidos pela FAQ')
  const sentToOp = metricValue('Enviados ao OP')
  const recurrence = activeCasesFull.value.filter(
    (entry) =>
      entry.recurrenceSignals?.repeatedTheme ||
      entry.recurrenceSignals?.repeatedSubsubject ||
      entry.recurrenceSignals?.priorSelfServiceRelated,
  ).length

  return {
    resolvedByFaq,
    sentToOp,
    recurrence,
  }
})
const faqEscapeRate = computed(() =>
  Math.round((selfServiceEscape.value.sentToOp / Math.max(selfServiceEscape.value.resolvedByFaq + selfServiceEscape.value.sentToOp, 1)) * 100),
)
const faqEscapeTrend = computed(() =>
  demandTrend.value.map((entry, index) => ({
    label: entry.label,
    value: Math.max(8, Math.min(100, faqEscapeRate.value + (index - 2) * 3)),
  })),
)
const areaEscapeCount = computed(() => metricValue('Escalados para area interna'))
const areaEscapeRate = computed(() => {
  const total = Math.max(
    selfServiceEscape.value.resolvedByFaq + selfServiceEscape.value.sentToOp + areaEscapeCount.value,
    1,
  )
  return Math.round((areaEscapeCount.value / total) * 100)
})
const operationalAlerts = computed(() => {
  const alerts = []
  const mainCluster = topRiskItems.value[0]
  const mainTheme = themeRanking.value[0]

  if (mainCluster?.slaOverdueCount > 0) {
    alerts.push({
      title: `SLA venceu em ${mainCluster.cluster}`,
      detail: `${mainCluster.slaOverdueCount} caso(s) fora do prazo.`,
      clusterKey: mainCluster.key,
    })
  }

  if (mainTheme) {
    alerts.push({
      title: `${mainTheme.theme} em destaque`,
      detail: `${mainTheme.count} caso(s), ${mainTheme.recurrenceCount} reincidente(s).`,
      theme: mainTheme.theme,
    })
  }

  if (selfServiceEscape.value.sentToOp > 0 || selfServiceEscape.value.recurrence > 0) {
    alerts.push({
      title: 'FAQ com sinal de falha',
      detail: `${selfServiceEscape.value.sentToOp} foram ao OP apos FAQ.`,
      clusterKey: mainCluster?.key || '',
    })
  }

  return alerts.slice(0, 3)
})

function selectCluster(clusterKey) {
  ui.selectedClusterKey = clusterKey
}

function openInsight(row, viewMode) {
  ui.viewMode = viewMode
  ui.selectedClusterKey = row.key
}

function selectViewMode(viewMode) {
  ui.viewMode = viewMode
  ui.selectedClusterKey = ''
}

function clearFilters() {
  filters.queue = 'todos'
  filters.status = 'todos'
  filters.criticality = 'todos'
  filters.theme = 'todos'
  ui.poloSearch = ''
  ui.selectedClusterKey = ''
}

function applyKpiFocus(card) {
  if (card.focus === 'recurrence') {
    ui.viewMode = 'temas'
  } else if (card.focus === 'volume') {
    ui.viewMode = 'areas'
  }

  const target = topRiskItems.value.find((entry) => {
    if (card.focus === 'sla') {
      return entry.slaOverdueCount > 0
    }

    if (card.focus === 'criticality') {
      return entry.highCriticalityCount > 0
    }

    if (card.focus === 'escalated') {
      return entry.escalationsCount > 0
    }

    if (card.focus === 'recurrence') {
      return entry.recurrenceCount > 0
    }

    return entry.volume > 0
  }) || topRiskItems.value[0]

  if (target) {
    selectCluster(target.key)
  }
}

function applyRecommendedAction(action) {
  if (action.viewMode) {
    ui.viewMode = action.viewMode
  }

  if (action.clusterKey) {
    selectCluster(action.clusterKey)
  }
}

function applyThemeFilter(theme) {
  ui.viewMode = 'temas'
  filters.theme = theme
  ui.selectedClusterKey = `Tema:${theme}`
}

// --- novos computed/helpers locais ---
const demandFillPoints = computed(() => {
  const pts = demandTrendPoints.value
  if (!pts) return ''
  const values = demandTrend.value
  const lastX = values.length > 1 ? 100 : 50
  return `${pts} ${lastX},48 0,48`
})

function getRiskLabel(row) {
  if (row.slaOverdueCount > 0 || row.highCriticalityCount > 1) return 'Alto'
  if (row.highCriticalityCount > 0 || row.escalationsCount > 0) return 'Medio'
  return 'Baixo'
}

function getRiskChipClass(row) {
  const label = getRiskLabel(row)
  if (label === 'Alto') return 'crm-chip crm-state-danger crm-chip--sm'
  if (label === 'Medio') return 'crm-chip crm-state-warning crm-chip--sm'
  return 'crm-chip crm-state-success crm-chip--sm'
}

function getHealthStateClass(tone) {
  if (tone === 'danger') return 'crm-state-danger'
  if (tone === 'warning') return 'crm-state-warning'
  return 'crm-state-success'
}
</script>

<template>
  <div class="grid gap-4">
    <!-- 1. HEADER COMPACTO -->
    <section class="crm-dashboard-card">
      <div class="crm-dashboard-toolbar">
        <div class="crm-dashboard-toolbar__meta">
          <p class="crm-page-description">Visao rapida da operacao</p>
          <div class="crm-dashboard-toolbar__status">
            <span class="crm-chip">
              Fonte institucional
            </span>
            <span class="text-[11px] text-[var(--color-text-muted)]">
              {{ liveState.loading ? 'Atualizando...' : `${liveState.loaded} de ${liveState.total} tickets carregados` }}
            </span>
            <button
              type="button"
              class="text-[11px] font-semibold text-[var(--color-primary)] disabled:opacity-50"
              :disabled="liveState.loading"
              @click="loadInstitutionalDashboard"
            >
              Atualizar
            </button>
          </div>
          <p v-if="liveState.error" class="crm-alert-error mt-2" role="alert">
            {{ liveState.error }}
          </p>
        </div>

        <div class="crm-dashboard-toolbar__period">
          <div class="crm-segment-group" role="group" aria-label="Periodo">
            <button
              v-for="option in periodOptions"
              :key="option.value"
              type="button"
              class="crm-segment"
              :class="{ 'is-active': ui.periodKey === option.value }"
              @click="selectPeriod(option)"
            >
              {{ option.label }}
            </button>
          </div>
          <div
            v-if="ui.periodKey === 'custom'"
            class="crm-period-range"
            role="group"
            aria-label="Intervalo personalizado"
          >
            <label class="crm-period-range__field">
              <span class="crm-field-label">De</span>
              <input
                v-model="ui.periodFrom"
                type="date"
                class="crm-field py-1.5 text-xs"
                :max="ui.periodTo || undefined"
              />
            </label>
            <label class="crm-period-range__field">
              <span class="crm-field-label">Ate</span>
              <input
                v-model="ui.periodTo"
                type="date"
                class="crm-field py-1.5 text-xs"
                :min="ui.periodFrom || undefined"
              />
            </label>
          </div>
        </div>

        <div
          class="crm-dashboard-toolbar__health crm-card"
          :class="getHealthStateClass(operationHealth.tone)"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold text-[var(--color-text-muted)]">Saude da operacao</p>
              <div class="flex items-baseline gap-1">
                <strong class="text-2xl text-[var(--color-text)]">{{ operationHealth.score }}</strong>
                <span class="text-xs text-[var(--color-text-muted)]">pontos</span>
              </div>
            </div>
            <span
              class="crm-chip"
              :class="getHealthStateClass(operationHealth.tone)"
            >
              {{ operationHealth.label }}
            </span>
          </div>
          <svg viewBox="0 0 80 18" class="mt-1 h-4 w-full" aria-hidden="true">
            <polyline
              points="0,11 12,11 18,7 24,14 31,5 38,11 48,11 56,3 64,16 72,6 80,9"
              fill="none"
              stroke="var(--color-primary)"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>

      <div class="crm-filter-toolbar mt-3">
        <span class="crm-filter-toolbar__label">Filtros do recorte</span>
        <button
          type="button"
          class="crm-button-secondary crm-button-secondary--compact"
          @click="clearFilters"
        >
          Limpar filtros
        </button>
      </div>

      <div class="crm-filter-grid crm-filter-grid--dense mt-2">
        <label class="crm-filter-field">
          <span class="crm-field-label">Area interna</span>
          <select v-model="filters.queue" class="crm-field py-1.5 text-xs">
            <option v-for="o in filterOptions.queue" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <label class="crm-filter-field">
          <span class="crm-field-label">Polos</span>
          <input
            v-model="ui.poloSearch"
            type="search"
            placeholder="Buscar polo"
            class="crm-field py-1.5 text-xs"
          />
        </label>

        <label class="crm-filter-field">
          <span class="crm-field-label">Tema</span>
          <select v-model="filters.theme" class="crm-field py-1.5 text-xs">
            <option v-for="o in filterOptions.theme" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <label class="crm-filter-field">
          <span class="crm-field-label">Status</span>
          <select v-model="filters.status" class="crm-field py-1.5 text-xs">
            <option v-for="o in filterOptions.status" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>
    </section>

    <!-- 2. KPI ROW -->
    <section class="crm-stat-grid crm-stat-grid--five">
      <button
        v-for="card in criticalKpiCards"
        :key="card.label"
        type="button"
        class="crm-stat-tile text-left transition hover:opacity-95"
        :class="{
          'crm-state-danger': card.tone === 'danger',
          'crm-state-warning': card.tone === 'warning',
        }"
        @click="applyKpiFocus(card)"
      >
        <p class="crm-stat-tile__label">{{ card.label }}</p>
        <p
          class="crm-stat-tile__value"
          :class="{ 'is-danger': card.tone === 'danger' }"
        >
          {{ card.value }}
        </p>
        <p class="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">{{ card.trend }}</p>
      </button>
    </section>

    <!-- DISTRIBUICAO + TENDENCIA -->
    <div class="crm-split-grid crm-split-grid--chart gap-4">
      <!-- Donut distribuicao -->
      <div class="crm-dashboard-card">
        <div>
          <h2 class="crm-dashboard-heading">Distribuicao da demanda</h2>
          <p class="crm-dashboard-lead">Caminho dos atendimentos na visao atual.</p>
        </div>

        <div class="mt-4 flex flex-1 items-center gap-5">
          <div class="relative h-[120px] w-[120px] shrink-0">
            <svg viewBox="0 0 42 42" class="h-full w-full -rotate-90" aria-label="Distribuicao da demanda">
              <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#e2e8f0" stroke-width="5" />
              <circle
                v-for="segment in demandDistribution"
                :key="segment.label"
                cx="21"
                cy="21"
                r="15.9155"
                fill="transparent"
                :stroke="segment.color"
                stroke-linecap="round"
                stroke-width="5"
                pathLength="100"
                :stroke-dasharray="`${segment.percent} ${100 - segment.percent}`"
                :stroke-dashoffset="segment.offset"
              />
            </svg>
            <div class="absolute inset-0 grid place-items-center text-center">
              <div>
                <p class="text-2xl font-semibold text-[var(--color-text)]">{{ activeCasesFull.length }}</p>
                <p class="text-[10px] font-semibold text-[var(--color-text-muted)]">ativos</p>
              </div>
            </div>
          </div>

          <div class="grid flex-1 gap-2">
            <div
              v-for="segment in demandDistribution"
              :key="segment.label"
              class="flex items-center gap-2 text-xs"
            >
              <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: segment.color }"></span>
              <span class="flex-1 truncate font-medium text-[var(--color-text)]">{{ segment.label }}</span>
              <span class="shrink-0 font-semibold text-[var(--color-text)]">{{ segment.percent }}%</span>
              <span class="shrink-0 text-[var(--color-text-muted)]">({{ segment.value }})</span>
            </div>
          </div>
        </div>

        <div class="crm-dashboard-card__footer">
          <button
            type="button"
            class="crm-text-link"
            @click="selectViewMode('faq')"
          >
            Ver detalhes &rarr;
          </button>
        </div>
      </div>

      <!-- Grafico de evolucao -->
      <div class="flex flex-col rounded-[8px] border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="crm-dashboard-heading">Evolucao da demanda</h2>
            <p class="crm-dashboard-lead">Demanda nos {{ selectedPeriodLabel }}. Estimativa com a base atual.</p>
          </div>
          <div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span class="flex items-center gap-1.5">
              <span class="crm-legend-dot" aria-hidden="true"></span>
              Periodo atual
            </span>
            <span class="flex items-center gap-1.5">
              <span class="crm-legend-dot is-muted" aria-hidden="true"></span>
              Periodo anterior
            </span>
          </div>
        </div>

        <div class="mt-2 flex items-baseline gap-2">
          <strong class="text-3xl text-[var(--color-text)]">{{ demandTrend[demandTrend.length - 1]?.count || 0 }}</strong>
          <StatusBadge :label="demandTrendDirection" />
        </div>

        <svg
          viewBox="0 0 100 48"
          class="mt-2 h-28 w-full overflow-visible"
          aria-label="Tendencia de demanda"
        >
          <defs>
            <linearGradient id="cockpit-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.14" />
              <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <polygon :points="demandFillPoints" fill="url(#cockpit-trend-fill)" />
          <polyline
            :points="demandTrendPoints"
            fill="none"
            stroke="var(--color-primary)"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
          />
          <circle
            v-for="(point, index) in demandTrendPoints.split(' ')"
            :key="`pt-${index}`"
            :cx="Number(point.split(',')[0])"
            :cy="Number(point.split(',')[1])"
            r="2.5"
            fill="white"
            stroke="var(--color-primary)"
            stroke-width="1.5"
          />
        </svg>

        <div class="crm-stat-grid mt-1 gap-1 text-center text-[10px] font-semibold text-[var(--color-text-muted)]">
          <span v-for="entry in demandTrend" :key="entry.label" class="truncate">{{ entry.label }}</span>
        </div>

        <div class="crm-dashboard-card__footer">
          <button
            type="button"
            class="crm-text-link"
            @click="selectViewMode('areas')"
          >
            Ver evolucao completa &rarr;
          </button>
        </div>
      </div>
    </div>

    <!-- 4. AREAS INTERNAS + POLOS EM ATENCAO (tabelas compactas) -->
    <div class="grid gap-4 md:grid-cols-2">
      <!-- Areas internas em risco -->
      <div class="flex flex-col rounded-[8px] border border-slate-200 bg-white p-4">
        <div>
          <h2 class="crm-dashboard-heading">Areas internas em risco</h2>
        </div>

        <div v-if="areaRiskRows.length" class="crm-table-scroll mt-3">
          <div class="min-w-[420px]">
            <div class="crm-dashboard-table__head grid grid-cols-[1fr_52px_44px_44px_52px_44px] gap-x-2">
              <span>Area interna</span>
              <span class="text-center">Risco</span>
              <span class="text-center">SLA</span>
              <span class="text-center">Crit.</span>
              <span class="text-center">Escal.</span>
              <span class="text-center">Acao</span>
            </div>
            <div
              v-for="area in areaRiskRows"
              :key="area.key"
              class="crm-dashboard-table__row grid grid-cols-[1fr_52px_44px_44px_52px_44px] items-center gap-x-2"
            >
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold text-[var(--color-text)]">{{ area.cluster }}</p>
                <div class="crm-progress-track mt-1 h-1">
                  <span
                    class="crm-progress-bar"
                    :style="{ width: `${Math.max(8, Math.round((area.riskScore / maxAreaRisk) * 100))}%` }"
                  ></span>
                </div>
              </div>
              <span
                class="justify-center"
                :class="getRiskChipClass(area)"
              >
                {{ getRiskLabel(area) }}
              </span>
              <span class="text-center text-xs font-semibold text-[var(--color-text)]">{{ area.slaOverdueCount }}</span>
              <span class="text-center text-xs font-semibold text-[var(--color-text)]">{{ area.highCriticalityCount }}</span>
              <span class="text-center text-xs font-semibold text-[var(--color-text)]">{{ area.escalationsCount }}</span>
              <button
                type="button"
                class="crm-text-link text-center text-[10px]"
                @click="openInsight(area, 'areas')"
              >
                Abrir
              </button>
            </div>
          </div>
        </div>

        <div v-else class="crm-empty-state mt-3">
          Ajuste os filtros para retomar a leitura por area.
        </div>

        <div class="crm-dashboard-card__footer mt-auto">
          <button
            type="button"
            class="crm-text-link"
            @click="selectViewMode('areas')"
          >
            Ver todas as areas internas &rarr;
          </button>
        </div>
      </div>

      <!-- Polos em atencao -->
      <div class="flex flex-col rounded-[8px] border border-slate-200 bg-white p-4">
        <div>
          <h2 class="crm-dashboard-heading">Polos em atencao</h2>
        </div>

        <div v-if="poloRiskRows.length" class="crm-table-scroll mt-3">
          <div class="min-w-[420px]">
            <div class="crm-dashboard-table__head grid grid-cols-[1fr_52px_44px_44px_52px_44px] gap-x-2">
              <span>Polo</span>
              <span class="text-center">Risco</span>
              <span class="text-center">SLA</span>
              <span class="text-center">Crit.</span>
              <span class="text-center">Volume</span>
              <span class="text-center">Acao</span>
            </div>
            <div
              v-for="polo in poloRiskRows.slice(0, 6)"
              :key="polo.key"
              class="crm-dashboard-table__row grid grid-cols-[1fr_52px_44px_44px_52px_44px] items-center gap-x-2"
            >
              <div class="min-w-0">
                <p class="truncate text-xs font-semibold text-[var(--color-text)]">{{ polo.cluster }}</p>
                <div class="crm-progress-track mt-1 h-1">
                  <span
                    class="crm-progress-bar"
                    :style="{ width: `${Math.max(8, Math.round((polo.riskScore / maxPoloRisk) * 100))}%` }"
                  ></span>
                </div>
              </div>
              <span
                class="justify-center"
                :class="getRiskChipClass(polo)"
              >
                {{ getRiskLabel(polo) }}
              </span>
              <span class="text-center text-xs font-semibold text-[var(--color-text)]">{{ polo.slaOverdueCount }}</span>
              <span class="text-center text-xs font-semibold text-[var(--color-text)]">{{ polo.highCriticalityCount }}</span>
              <span class="text-center text-xs font-semibold text-[var(--color-text)]">{{ polo.volume }}</span>
              <button
                type="button"
                class="crm-text-link text-center text-[10px]"
                @click="openInsight(polo, 'polos')"
              >
                Abrir
              </button>
            </div>
          </div>
        </div>

        <div v-else class="mt-3 rounded-[8px] border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Nenhum polo encontrado nos filtros atuais.
        </div>

        <div class="crm-dashboard-card__footer">
          <button
            type="button"
            class="crm-text-link"
            @click="selectViewMode('polos')"
          >
            Ver todos os polos &rarr;
          </button>
        </div>
      </div>
    </div>

    <!-- 5. TEMAS + ACOES + ESCAPE DA FAQ -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <!-- Temas em alta -->
      <div class="crm-dashboard-card">
        <div>
          <h2 class="crm-dashboard-heading">Temas em alta</h2>
        </div>

        <div v-if="themeRanking.length" class="crm-dashboard-card__body">
          <button
            v-for="theme in themeRanking"
            :key="theme.theme"
            type="button"
            class="grid gap-1 text-left"
            @click="applyThemeFilter(theme.theme)"
          >
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--color-text)]">{{ theme.theme }}</span>
              <span class="shrink-0 text-xs font-semibold text-[var(--color-text)]">{{ theme.count }}</span>
              <span class="shrink-0 text-[11px] text-[var(--color-text-muted)]">{{ Math.round((theme.count / totalThemeCount) * 100) }}%</span>
            </div>
            <div class="crm-progress-track h-1.5">
              <span
                class="crm-progress-bar"
                :style="{ width: `${Math.max(6, Math.round((theme.count / maxThemeCount) * 100))}%` }"
              ></span>
            </div>
          </button>
        </div>

        <div v-else class="crm-dashboard-card__body crm-empty-state">
          Sem temas ativos nos filtros atuais.
        </div>

        <div class="crm-dashboard-card__footer">
          <button
            type="button"
            class="crm-text-link"
            @click="selectViewMode('temas')"
          >
            Ver todos &rarr;
          </button>
        </div>
      </div>

      <!-- Acoes recomendadas -->
      <div class="crm-dashboard-card">
        <div>
          <h2 class="crm-dashboard-heading">Ações recomendadas</h2>
        </div>

        <div class="crm-dashboard-card__body">
          <button
            v-for="action in recommendedActions"
            :key="action.title"
            type="button"
            class="crm-action-item"
            :class="action.risk === 'alto'
              ? 'is-risk-high'
              : action.risk === 'medio'
                ? 'is-risk-medium'
                : ''"
            @click="applyRecommendedAction(action)"
          >
            <span
              class="crm-action-item__signal"
              :class="action.risk === 'alto'
                ? 'is-high'
                : action.risk === 'medio'
                  ? 'is-medium'
                  : 'is-low'"
              aria-hidden="true"
            >
              {{ action.risk === 'alto' ? '!' : action.risk === 'medio' ? '^' : '' }}
            </span>
            <div class="crm-action-item__body">
              <p class="crm-action-item__title">{{ action.title }}</p>
              <p class="crm-action-item__reason">{{ action.reason }}</p>
            </div>
            <span
              class="crm-action-item__badge"
              :class="action.risk === 'alto'
                ? 'is-high'
                : action.risk === 'medio'
                  ? 'is-medium'
                  : 'is-low'"
            >
              {{ action.risk === 'alto' ? 'Alta' : action.risk === 'medio' ? 'Media' : 'Baixa' }}
            </span>
            <span class="crm-action-item__chevron" aria-hidden="true">›</span>
          </button>
        </div>

        <div class="crm-dashboard-card__footer">
          <button
            type="button"
            class="text-xs font-semibold text-[var(--color-primary)]"
            @click="selectViewMode('areas')"
          >
            Ver todas &rarr;
          </button>
        </div>
      </div>

      <!-- Escape da FAQ -->
      <div class="flex flex-col rounded-[8px] border border-slate-200 bg-white p-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">Escape da FAQ</p>
          <p class="text-sm font-semibold text-slate-950">Saída após a FAQ</p>
        </div>

        <!-- Dois indicadores de escape lado a lado -->
        <div class="mt-3 grid grid-cols-2 gap-2">
          <div class="crm-kpi-tile crm-card-muted px-3 py-2 text-center">
            <p class="crm-kpi-tile__value">{{ faqEscapeRate }}%</p>
            <p class="text-xs font-semibold text-[var(--color-text)]">{{ selfServiceEscape.sentToOp }} casos</p>
            <p class="crm-kpi-tile__label">OP apos FAQ</p>
          </div>
          <div class="crm-kpi-tile crm-state-warning px-3 py-2 text-center">
            <p class="crm-kpi-tile__value">{{ areaEscapeRate }}%</p>
            <p class="text-xs font-semibold text-[var(--color-text)]">{{ areaEscapeCount }} casos</p>
            <p class="crm-kpi-tile__label">Area interna</p>
          </div>
        </div>

        <div class="mt-2 flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <span><strong class="font-semibold text-[var(--color-text)]">{{ selfServiceEscape.recurrence }}</strong> reincidencias</span>
          <span><strong class="font-semibold text-[var(--color-text)]">{{ selfServiceEscape.resolvedByFaq }}</strong> resolv. FAQ</span>
        </div>

        <!-- Mini grafico de evolucao -->
        <div class="relative mt-3 h-14">
          <div class="absolute inset-x-0 bottom-5 flex items-end gap-1" style="height: 32px;">
            <span
              v-for="entry in faqEscapeTrend"
              :key="entry.label"
              class="flex flex-1 items-end"
            >
              <span
                class="crm-bar-chart__bar"
                :style="{ height: `${Math.max(4, Math.round(entry.value * 0.28))}px` }"
              ></span>
            </span>
          </div>
          <div class="absolute inset-x-0 bottom-0 flex gap-1">
            <span
              v-for="entry in faqEscapeTrend"
              :key="`l-${entry.label}`"
              class="flex-1 truncate text-center text-[9px] text-[var(--color-text-muted)]"
            >{{ entry.label }}</span>
          </div>
        </div>

        <div class="crm-dashboard-card__footer mt-auto">
          <button
            type="button"
            class="crm-text-link"
            @click="selectViewMode('faq')"
          >
            Ver analise completa &rarr;
          </button>
        </div>
      </div>
    </div>

    <!-- Cockpit operacional (recolhido por padrao) -->
    <details class="crm-dashboard-card">
      <summary class="crm-details-summary">
        <div class="min-w-0">
          <h2 class="crm-dashboard-heading">Cockpit operacional</h2>
          <p class="crm-dashboard-lead">
            {{ operationalCockpit.kpis?.overdue || 0 }} atrasados ·
            {{ operationalCockpit.kpis?.atRisk || 0 }} em risco ·
            {{ operationalCockpit.kpis?.active || 0 }} ativos
          </p>
        </div>
        <span class="crm-text-link shrink-0">Expandir</span>
      </summary>
      <OperationalCockpitPanel :cockpit="operationalCockpit" compact embedded />
    </details>

    <!-- 6. RECORTE SELECIONADO (condicional) -->
    <div
      v-if="selectedClusterDetails"
      class="crm-dashboard-card"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold text-[var(--color-text-muted)]">{{ selectedClusterDetails.type }}</p>
          <h3 class="crm-dashboard-heading text-base">{{ selectedClusterDetails.cluster }}</h3>
          <p class="crm-dashboard-lead">{{ selectedClusterDetails.reason }}</p>
        </div>
        <button
          type="button"
          class="crm-chip"
          @click="selectCluster('')"
        >
          Voltar para visao geral
        </button>
      </div>
      <div class="mt-3 grid gap-4 xl:grid-cols-2">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div class="crm-kpi-tile crm-card-muted">
            <p class="crm-kpi-tile__value">{{ selectedClusterDetails.volume }}</p>
            <p class="crm-kpi-tile__label">Volume</p>
          </div>
          <div class="crm-kpi-tile crm-card-muted">
            <p class="crm-kpi-tile__value">{{ selectedClusterDetails.slaOverdueCount }}</p>
            <p class="crm-kpi-tile__label">SLA</p>
          </div>
          <div class="crm-kpi-tile crm-card-muted">
            <p class="crm-kpi-tile__value">{{ selectedClusterDetails.highCriticalityCount }}</p>
            <p class="crm-kpi-tile__label">Crit.</p>
          </div>
          <div class="crm-kpi-tile crm-card-muted">
            <p class="crm-kpi-tile__value">{{ selectedClusterDetails.escalationsCount }}</p>
            <p class="crm-kpi-tile__label">Escal.</p>
          </div>
        </div>
        <ul class="grid gap-1.5">
          <li
            v-for="step in selectedClusterDetails.nextSteps"
            :key="step"
            class="crm-card-muted px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]"
          >
            {{ step }}
          </li>
        </ul>
      </div>
    </div>

    <!-- 7. ALERTAS RAPIDOS -->
    <section class="crm-dashboard-card !py-3">
      <h2 class="crm-dashboard-heading mb-2">Alertas rapidos</h2>

      <div v-if="operationalAlerts.length" class="grid gap-3 md:grid-cols-3">
        <button
          v-for="alert in operationalAlerts"
          :key="alert.title"
          type="button"
          class="crm-action-item"
          @click="alert.theme ? applyThemeFilter(alert.theme) : selectCluster(alert.clusterKey)"
        >
          <span class="crm-action-item__signal is-low" aria-hidden="true"></span>
          <div class="crm-action-item__body">
            <p class="crm-action-item__title">{{ alert.title }}</p>
            <p class="crm-action-item__reason">{{ alert.detail }}</p>
          </div>
          <span class="crm-text-link shrink-0">Ver agora &rarr;</span>
        </button>
      </div>

      <div v-else class="crm-empty-state">
        Sem alertas operacionais nos filtros atuais.
      </div>
    </section>

    <!-- 8. ANALISE AVANCADA E AUDITORIA (recolhida) -->
    <details class="crm-dashboard-card">
      <summary class="cursor-pointer crm-dashboard-heading">
        Análise avançada e auditoria
      </summary>

      <section class="mt-5">
        <h3 class="crm-dashboard-heading">Demais indicadores</h3>
        <div class="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            v-for="metric in secondaryMetrics"
            :key="metric.label"
            :label="metric.label"
            :value="metric.value"
            :hint="metric.hint"
          />
        </div>
      </section>

      <section class="mt-5">
        <h3 class="crm-dashboard-heading">Casos que pedem atencao</h3>
        <div v-if="activeCases.length" class="mt-3 grid gap-3">
          <article
            v-for="item in activeCases"
            :key="item.id"
            class="inner-panel p-4"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-xs font-semibold text-[var(--color-text-muted)]">{{ item.id }}</p>
                <h3 class="mt-2 text-base font-semibold text-[var(--color-text)]">{{ item.subject }}</h3>
                <p class="mt-1 text-xs text-[var(--color-text-muted)]">{{ item.student }} - Polo {{ item.polo }}</p>
                <p class="mt-0.5 text-xs text-[var(--color-text-muted)]">{{ item.theme }} - {{ item.subsubject }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <PriorityBadge :priority="item.priority" />
                <StatusBadge :label="item.criticality" />
                <StatusBadge :label="item.status" />
                <SlaBadge :label="item.sla" />
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5 text-xs text-[var(--color-text-muted)]">
              <span v-if="item.recurrenceSignals?.repeatedTheme" class="crm-chip">Repeticao no mesmo tema</span>
              <span v-if="item.recurrenceSignals?.repeatedSubsubject" class="crm-chip">Repeticao no mesmo subtema</span>
              <span v-if="item.recurrenceSignals?.priorSelfServiceRelated" class="crm-chip">Autoatendimento previo relacionado</span>
              <span class="crm-chip">{{ item.queue }}</span>
            </div>
          </article>
        </div>

        <div v-else class="crm-empty-state mt-3 py-4">
          Nenhum caso ativo nos filtros atuais.
        </div>
      </section>

      <section class="mt-5">
        <h3 class="crm-dashboard-heading">Frentes de governanca</h3>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <ActionTile
            v-for="card in governanceCards"
            :key="card.title"
            :title="card.title"
            :description="card.description"
            :eyebrow="card.eyebrow"
          />
        </div>
      </section>
    </details>
  </div>
</template>
