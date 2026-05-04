<script setup>
import { computed, reactive } from 'vue'
import ActionTile from '@/components/ActionTile.vue'
import MetricCard from '@/components/MetricCard.vue'
import PriorityBadge from '@/components/PriorityBadge.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { buildAdminDashboardView } from '@/services/adminDashboardRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const filters = reactive({
  queue: 'todos',
  status: 'todos',
  criticality: 'todos',
  theme: 'todos',
})
const ui = reactive({
  selectedClusterKey: '',
  periodKey: '7d',
  poloSearch: '',
  viewMode: 'areas',
})

const periodOptions = [
  { value: 'today', label: 'Hoje', summary: 'hoje' },
  { value: '7d', label: '7 dias', summary: 'ultimos 7 dias' },
  { value: '30d', label: '30 dias', summary: 'ultimos 30 dias' },
  { value: 'base', label: 'Periodo', summary: 'base atual' },
]
const viewModes = [
  { value: 'areas', label: 'Areas internas' },
  { value: 'polos', label: 'Polos' },
  { value: 'temas', label: 'Temas' },
  { value: 'faq', label: 'FAQ' },
]

const dashboardBase = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))
const dashboardView = computed(() => buildAdminDashboardView(dashboardBase.value, filters))
const filterOptions = computed(() => dashboardBase.value.filterOptions)
const metrics = computed(() => dashboardView.value.kpis)
const criticalMetricLabels = ['SLA vencido', 'Criticidade alta', 'Escalados para area interna', 'Reincidencia de tema']
const metricValue = (label) => metrics.value.find((metric) => metric.label === label)?.value || 0
const criticalMetrics = computed(() =>
  criticalMetricLabels
    .map((label) => metrics.value.find((metric) => metric.label === label))
    .filter(Boolean),
)
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
const queueSummary = computed(() => dashboardView.value.queueSummary)
const auditEntries = computed(() => dashboardView.value.auditEntries)
const activeCasesFull = computed(() => dashboardView.value.activeCases)
const activeCases = computed(() => activeCasesFull.value.slice(0, 4))
const governanceCards = computed(() => dashboardView.value.governanceCards)
const selectedPeriodLabel = computed(() => periodOptions.find((option) => option.value === ui.periodKey)?.summary || 'base atual')
const currentViewLabel = computed(() => viewModes.find((mode) => mode.value === ui.viewMode)?.label || 'Areas internas')
const activeFilterCount = computed(() =>
  [filters.status, filters.criticality, filters.theme].filter((value) => value !== 'todos').length +
  (ui.poloSearch.trim() ? 1 : 0),
)
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
const topRiskTitle = computed(() => {
  if (ui.viewMode === 'polos') {
    return 'Polos em risco'
  }

  if (ui.viewMode === 'temas') {
    return 'Temas em alta'
  }

  if (ui.viewMode === 'faq') {
    return 'FAQ com sinal de falha'
  }

  return 'Areas internas em risco'
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
const maxClusterVolume = computed(() => Math.max(...topRiskItems.value.map((entry) => entry.volume), 1))
const maxClusterRisk = computed(() => Math.max(...topRiskItems.value.map((entry) => entry.riskScore), 1))
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

  for (const item of activeCasesFull.value) {
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
const healthScoreDisplay = computed(() => Math.min(100, Math.max(0, operationHealth.value.score || 0)))

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
</script>

<template>
  <div class="grid gap-4">

    <!-- 1. HEADER COMPACTO -->
    <section class="rounded-[16px] border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-slate-950">Dashboard admin</h1>
          <p class="text-xs text-slate-500">Visao rapida da operacao</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="flex gap-1">
            <button
              v-for="option in periodOptions"
              :key="option.value"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              :class="ui.periodKey === option.value
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              @click="ui.periodKey = option.value"
            >
              {{ option.label }}
            </button>
          </div>

          <div
            class="min-w-[190px] rounded-[14px] border px-3 py-2"
            :class="operationHealth.tone === 'danger'
              ? 'border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.74)]'
              : operationHealth.tone === 'warning'
                ? 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.62)]'
                : 'border-[rgba(15,118,110,0.18)] bg-[rgba(240,253,250,0.72)]'"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-semibold text-slate-500">Saude da operacao</p>
                <div class="flex items-baseline gap-1">
                  <strong class="text-2xl text-slate-950">{{ healthScoreDisplay }}</strong>
                  <span class="text-xs text-slate-500">/100</span>
                </div>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="operationHealth.tone === 'danger'
                  ? 'bg-[var(--color-primary)] text-white'
                  : operationHealth.tone === 'warning'
                    ? 'bg-amber-500 text-white'
                    : 'bg-teal-600 text-white'"
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
      </div>

      <div class="mt-3 flex flex-wrap items-end gap-2">
        <label class="grid min-w-[130px] gap-1">
          <span class="text-xs font-semibold text-slate-500">Area interna</span>
          <select
            v-model="filters.queue"
            class="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option v-for="o in filterOptions.queue" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <label class="grid min-w-[130px] gap-1">
          <span class="text-xs font-semibold text-slate-500">Polos</span>
          <input
            v-model="ui.poloSearch"
            type="search"
            placeholder="Buscar polo"
            class="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          />
        </label>

        <label class="grid min-w-[130px] gap-1">
          <span class="text-xs font-semibold text-slate-500">Tema</span>
          <select
            v-model="filters.theme"
            class="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option v-for="o in filterOptions.theme" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <label class="grid min-w-[110px] gap-1">
          <span class="text-xs font-semibold text-slate-500">Status</span>
          <select
            v-model="filters.status"
            class="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option v-for="o in filterOptions.status" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>

        <button
          type="button"
          class="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-slate-50"
          @click="clearFilters"
        >
          Limpar filtros
        </button>
      </div>
    </section>

    <!-- 2. KPI ROW -->
    <section class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <button
        v-for="card in criticalKpiCards"
        :key="card.label"
        type="button"
        class="rounded-[14px] border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
        :class="card.tone === 'danger'
          ? 'border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.54)]'
          : card.tone === 'warning'
            ? 'border-[rgba(202,138,4,0.16)] bg-[rgba(254,243,199,0.48)]'
            : 'border-slate-200 bg-white'"
        @click="applyKpiFocus(card)"
      >
        <p class="text-xs font-semibold text-slate-500">{{ card.label }}</p>
        <p class="mt-1 text-3xl font-semibold text-slate-950">{{ card.value }}</p>
        <p class="mt-1 text-[11px] font-semibold text-slate-400">{{ card.trend }}</p>
      </button>
    </section>

    <!-- 3. DISTRIBUICAO + TENDENCIA -->
    <div class="grid gap-4 lg:grid-cols-[0.38fr_0.62fr]">

      <!-- Donut distribuicao -->
      <div class="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">Fluxo</p>
          <p class="text-sm font-semibold text-slate-950">Distribuicao da demanda</p>
          <p class="mt-0.5 text-xs text-slate-400">Caminho dos atendimentos na visao atual.</p>
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
                <p class="text-2xl font-semibold text-slate-950">{{ activeCasesFull.length }}</p>
                <p class="text-[10px] font-semibold text-slate-500">ativos</p>
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
              <span class="flex-1 truncate font-medium text-slate-700">{{ segment.label }}</span>
              <span class="shrink-0 font-semibold text-slate-950">{{ segment.percent }}%</span>
              <span class="shrink-0 text-slate-400">({{ segment.value }})</span>
            </div>
          </div>
        </div>

        <div class="mt-3 flex justify-end border-t border-slate-50 pt-2">
          <button
            type="button"
            class="text-xs font-semibold text-[var(--color-primary)]"
            @click="selectViewMode('faq')"
          >
            Ver detalhes &rarr;
          </button>
        </div>
      </div>

      <!-- Grafico de evolucao -->
      <div class="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-slate-500">Tendencia</p>
            <p class="text-sm font-semibold text-slate-950">Evolucao da demanda</p>
            <p class="mt-0.5 text-xs text-slate-400">Demanda nos {{ selectedPeriodLabel }}. Estimativa com a base atual.</p>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-500">
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2 w-5 rounded-full bg-[var(--color-primary)]"></span>
              Periodo atual
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block h-2 w-5 rounded-full bg-slate-200"></span>
              Periodo anterior
            </span>
          </div>
        </div>

        <div class="mt-2 flex items-baseline gap-2">
          <strong class="text-3xl text-slate-950">{{ demandTrend[demandTrend.length - 1]?.count || 0 }}</strong>
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

        <div class="mt-1 grid grid-cols-5 gap-1 text-center text-[10px] font-semibold text-slate-400">
          <span v-for="entry in demandTrend" :key="entry.label" class="truncate">{{ entry.label }}</span>
        </div>

        <div class="mt-3 flex justify-end border-t border-slate-50 pt-2">
          <button
            type="button"
            class="text-xs font-semibold text-[var(--color-primary)]"
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
      <div class="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">Risco</p>
          <p class="text-sm font-semibold text-slate-950">Areas internas em risco</p>
        </div>

        <div v-if="areaRiskRows.length" class="mt-3 overflow-x-auto">
          <div class="min-w-[420px]">
          <div class="mb-1.5 grid grid-cols-[1fr_52px_44px_44px_52px_44px] gap-x-2 border-b border-slate-100 pb-1.5 text-[10px] font-semibold text-slate-400">
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
            class="grid grid-cols-[1fr_52px_44px_44px_52px_44px] items-center gap-x-2 border-b border-slate-50 py-1.5 last:border-0"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-semibold text-slate-900">{{ area.cluster }}</p>
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  class="block h-full rounded-full bg-[var(--color-primary)]"
                  :style="{ width: `${Math.max(8, Math.round((area.riskScore / maxAreaRisk) * 100))}%` }"
                ></span>
              </div>
            </div>
            <span
              class="rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold"
              :class="getRiskLabel(area) === 'Alto'
                ? 'bg-red-100 text-red-700'
                : getRiskLabel(area) === 'Medio'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'"
            >
              {{ getRiskLabel(area) }}
            </span>
            <span class="text-center text-xs font-semibold text-slate-700">{{ area.slaOverdueCount }}</span>
            <span class="text-center text-xs font-semibold text-slate-700">{{ area.highCriticalityCount }}</span>
            <span class="text-center text-xs font-semibold text-slate-700">{{ area.escalationsCount }}</span>
            <button
              type="button"
              class="text-center text-[10px] font-semibold text-[var(--color-primary)]"
              @click="openInsight(area, 'areas')"
            >
              Abrir
            </button>
          </div>
          </div>
        </div>

        <div v-else class="mt-3 rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Ajuste os filtros para retomar a leitura por area.
        </div>

        <div class="mt-auto flex justify-end border-t border-slate-50 pt-3">
          <button
            type="button"
            class="text-xs font-semibold text-[var(--color-primary)]"
            @click="selectViewMode('areas')"
          >
            Ver todas as areas internas &rarr;
          </button>
        </div>
      </div>

      <!-- Polos em atencao -->
      <div class="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">Polos</p>
          <p class="text-sm font-semibold text-slate-950">Polos em atencao</p>
        </div>

        <div v-if="poloRiskRows.length" class="mt-3 overflow-x-auto">
          <div class="min-w-[420px]">
          <div class="mb-1.5 grid grid-cols-[1fr_52px_44px_44px_52px_44px] gap-x-2 border-b border-slate-100 pb-1.5 text-[10px] font-semibold text-slate-400">
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
            class="grid grid-cols-[1fr_52px_44px_44px_52px_44px] items-center gap-x-2 border-b border-slate-50 py-1.5 last:border-0"
          >
            <div class="min-w-0">
              <p class="truncate text-xs font-semibold text-slate-900">{{ polo.cluster }}</p>
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  class="block h-full rounded-full bg-[var(--color-primary)]"
                  :style="{ width: `${Math.max(8, Math.round((polo.riskScore / maxPoloRisk) * 100))}%` }"
                ></span>
              </div>
            </div>
            <span
              class="rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold"
              :class="getRiskLabel(polo) === 'Alto'
                ? 'bg-red-100 text-red-700'
                : getRiskLabel(polo) === 'Medio'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'"
            >
              {{ getRiskLabel(polo) }}
            </span>
            <span class="text-center text-xs font-semibold text-slate-700">{{ polo.slaOverdueCount }}</span>
            <span class="text-center text-xs font-semibold text-slate-700">{{ polo.highCriticalityCount }}</span>
            <span class="text-center text-xs font-semibold text-slate-700">{{ polo.volume }}</span>
            <button
              type="button"
              class="text-center text-[10px] font-semibold text-[var(--color-primary)]"
              @click="openInsight(polo, 'polos')"
            >
              Abrir
            </button>
          </div>
          </div>
        </div>

        <div v-else class="mt-3 rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Nenhum polo encontrado nos filtros atuais.
        </div>

        <div class="mt-3 flex justify-end border-t border-slate-50 pt-2">
          <button
            type="button"
            class="text-xs font-semibold text-[var(--color-primary)]"
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
      <div class="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">Temas</p>
          <p class="text-sm font-semibold text-slate-950">Temas em alta</p>
        </div>

        <div v-if="themeRanking.length" class="mt-3 flex-1 grid gap-2">
          <button
            v-for="theme in themeRanking"
            :key="theme.theme"
            type="button"
            class="grid gap-1 text-left"
            @click="applyThemeFilter(theme.theme)"
          >
            <div class="flex items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">{{ theme.theme }}</span>
              <span class="shrink-0 text-xs font-semibold text-slate-700">{{ theme.count }}</span>
              <span class="shrink-0 text-[11px] text-slate-400">{{ Math.round((theme.count / totalThemeCount) * 100) }}%</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <span
                class="block h-full rounded-full bg-[var(--color-primary)]"
                :style="{ width: `${Math.max(6, Math.round((theme.count / maxThemeCount) * 100))}%` }"
              ></span>
            </div>
          </button>
        </div>

        <div v-else class="mt-3 flex-1 rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Sem temas ativos nos filtros atuais.
        </div>

        <div class="mt-3 flex justify-end border-t border-slate-50 pt-2">
          <button
            type="button"
            class="text-xs font-semibold text-[var(--color-primary)]"
            @click="selectViewMode('temas')"
          >
            Ver todos &rarr;
          </button>
        </div>
      </div>

      <!-- Acoes recomendadas -->
      <div class="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">Agora</p>
          <p class="text-sm font-semibold text-slate-950">Acoes recomendadas</p>
        </div>

        <div class="mt-3 flex-1 grid gap-2">
          <button
            v-for="action in recommendedActions"
            :key="action.title"
            type="button"
            class="flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition hover:shadow-sm"
            :class="action.risk === 'alto'
              ? 'border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.5)]'
              : action.risk === 'medio'
                ? 'border-[rgba(202,138,4,0.18)] bg-[rgba(254,243,199,0.5)]'
                : 'border-slate-200 bg-white'"
            @click="applyRecommendedAction(action)"
          >
            <span
              class="shrink-0 text-sm leading-none"
              :class="action.risk === 'alto' ? 'text-red-500' : action.risk === 'medio' ? 'text-amber-500' : 'text-slate-300'"
            >
              {{ action.risk === 'alto' ? '⚡' : action.risk === 'medio' ? '▲' : '●' }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-semibold text-slate-900">{{ action.title }}</p>
              <p class="mt-0.5 truncate text-[11px] text-slate-500">{{ action.reason }}</p>
            </div>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="action.risk === 'alto'
                ? 'bg-red-100 text-red-700'
                : action.risk === 'medio'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'"
            >
              {{ action.risk === 'alto' ? 'Alta' : action.risk === 'medio' ? 'Media' : 'Baixa' }}
            </span>
            <span class="shrink-0 text-slate-400 text-sm">›</span>
          </button>
        </div>

        <div class="mt-3 flex justify-end border-t border-slate-50 pt-2">
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
      <div class="flex flex-col rounded-[16px] border border-slate-200 bg-white p-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">Escape da FAQ</p>
          <p class="text-sm font-semibold text-slate-950">Saida apos FAQ</p>
        </div>

        <!-- Dois indicadores de escape lado a lado -->
        <div class="mt-3 grid grid-cols-2 gap-2">
          <div class="rounded-[12px] bg-slate-50 px-3 py-2 text-center">
            <p class="text-2xl font-semibold text-slate-950">{{ faqEscapeRate }}%</p>
            <p class="text-xs font-semibold text-slate-700">{{ selfServiceEscape.sentToOp }} casos</p>
            <p class="mt-0.5 text-[10px] text-slate-400">OP apos FAQ</p>
          </div>
          <div class="rounded-[12px] bg-amber-50 px-3 py-2 text-center">
            <p class="text-2xl font-semibold text-slate-950">{{ areaEscapeRate }}%</p>
            <p class="text-xs font-semibold text-slate-700">{{ areaEscapeCount }} casos</p>
            <p class="mt-0.5 text-[10px] text-slate-400">Area interna</p>
          </div>
        </div>

        <!-- Secundarios compactos -->
        <div class="mt-2 flex items-center gap-4 text-xs text-slate-600">
          <span><strong class="font-semibold text-slate-900">{{ selfServiceEscape.recurrence }}</strong> reincidencias</span>
          <span><strong class="font-semibold text-slate-900">{{ selfServiceEscape.resolvedByFaq }}</strong> resolv. FAQ</span>
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
                class="w-full rounded-t-sm bg-[rgba(37,99,235,0.65)]"
                :style="{ height: `${Math.max(4, Math.round(entry.value * 0.28))}px` }"
              ></span>
            </span>
          </div>
          <div class="absolute inset-x-0 bottom-0 flex gap-1">
            <span
              v-for="entry in faqEscapeTrend"
              :key="`l-${entry.label}`"
              class="flex-1 truncate text-center text-[9px] text-slate-400"
            >{{ entry.label }}</span>
          </div>
        </div>

        <div class="mt-auto flex justify-end border-t border-slate-50 pt-3">
          <button
            type="button"
            class="text-xs font-semibold text-[var(--color-primary)]"
            @click="selectViewMode('faq')"
          >
            Ver analise completa &rarr;
          </button>
        </div>
      </div>
    </div>

    <!-- 6. RECORTE SELECIONADO (condicional) -->
    <div
      v-if="selectedClusterDetails"
      class="rounded-[16px] border border-slate-200 bg-white p-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold text-slate-500">{{ selectedClusterDetails.type }}</p>
          <h3 class="text-base font-semibold text-slate-950">{{ selectedClusterDetails.cluster }}</h3>
          <p class="mt-1 text-xs text-slate-600">{{ selectedClusterDetails.reason }}</p>
        </div>
        <button
          type="button"
          class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
          @click="selectCluster('')"
        >
          Voltar para visao geral
        </button>
      </div>
      <div class="mt-3 grid gap-4 xl:grid-cols-2">
        <div class="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-slate-600">
          <span class="rounded-[10px] bg-slate-50 px-2 py-2">{{ selectedClusterDetails.volume }} vol.</span>
          <span class="rounded-[10px] bg-slate-50 px-2 py-2">{{ selectedClusterDetails.slaOverdueCount }} SLA</span>
          <span class="rounded-[10px] bg-slate-50 px-2 py-2">{{ selectedClusterDetails.highCriticalityCount }} crit.</span>
          <span class="rounded-[10px] bg-slate-50 px-2 py-2">{{ selectedClusterDetails.escalationsCount }} esc.</span>
        </div>
        <ul class="grid gap-1.5">
          <li
            v-for="step in selectedClusterDetails.nextSteps"
            :key="step"
            class="rounded-[10px] bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {{ step }}
          </li>
        </ul>
      </div>
    </div>

    <!-- 7. ALERTAS RAPIDOS -->
    <section class="rounded-[14px] border border-slate-200 bg-white px-4 py-3">
      <p class="mb-2 text-xs font-semibold text-slate-500">Alertas rapidos</p>

      <div v-if="operationalAlerts.length" class="grid gap-3 md:grid-cols-3">
        <button
          v-for="alert in operationalAlerts"
          :key="alert.title"
          type="button"
          class="flex items-start gap-3 rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100"
          @click="alert.theme ? applyThemeFilter(alert.theme) : selectCluster(alert.clusterKey)"
        >
          <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]"></span>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-slate-900">{{ alert.title }}</p>
            <p class="mt-0.5 text-[11px] text-slate-500">{{ alert.detail }}</p>
          </div>
          <span class="shrink-0 text-xs font-semibold text-[var(--color-primary)]">Ver agora &rarr;</span>
        </button>
      </div>

      <div v-else class="rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
        Sem alertas operacionais nos filtros atuais.
      </div>
    </section>

    <!-- 8. ANALISE AVANCADA E AUDITORIA (recolhida) -->
    <details class="rounded-[16px] border border-slate-200 bg-white p-4">
      <summary class="cursor-pointer text-sm font-semibold text-slate-700">
        Analise avancada e auditoria
      </summary>

      <section class="mt-5">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Demais indicadores</h3>
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
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Movimentacoes auditaveis</h3>
        <div v-if="auditEntries.length" class="mt-3 grid gap-3">
          <article
            v-for="entry in auditEntries"
            :key="entry.id"
            class="inner-panel p-4"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-xs font-semibold text-slate-500">{{ entry.caseId }}</p>
                  <StatusBadge :label="entry.actionLabel" />
                </div>
                <h3 class="mt-2 text-base font-semibold text-slate-950">{{ entry.subject }}</h3>
                <p class="mt-1 text-xs text-slate-600">{{ entry.actor }} - {{ entry.occurredAtLabel }}</p>
                <p class="mt-0.5 text-xs text-slate-600">{{ entry.student }} - Polo {{ entry.polo }} - {{ entry.theme }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadge :label="entry.criticality" />
                <StatusBadge :label="entry.queueAfter" />
              </div>
            </div>
            <div class="mt-3 grid gap-2 md:grid-cols-2">
              <div class="rounded-[14px] bg-slate-50 px-3 py-2">
                <p class="text-xs font-semibold text-slate-400">Antes</p>
                <p class="mt-1 text-xs font-semibold text-slate-900">{{ entry.statusBefore }}</p>
                <p class="mt-0.5 text-xs text-slate-500">{{ entry.queueBefore }}</p>
              </div>
              <div class="rounded-[14px] bg-slate-50 px-3 py-2">
                <p class="text-xs font-semibold text-slate-400">Depois</p>
                <p class="mt-1 text-xs font-semibold text-slate-900">{{ entry.statusAfter }}</p>
                <p class="mt-0.5 text-xs text-slate-500">{{ entry.queueAfter }}</p>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="mt-3 rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
          Nenhum evento auditavel nos filtros atuais.
        </div>
      </section>

      <section class="mt-5">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Casos que pedem atencao</h3>
        <div v-if="activeCases.length" class="mt-3 grid gap-3">
          <article
            v-for="item in activeCases"
            :key="item.id"
            class="inner-panel p-4"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p class="text-xs font-semibold text-slate-500">{{ item.id }}</p>
                <h3 class="mt-2 text-base font-semibold text-slate-950">{{ item.subject }}</h3>
                <p class="mt-1 text-xs text-slate-600">{{ item.student }} - Polo {{ item.polo }}</p>
                <p class="mt-0.5 text-xs text-slate-600">{{ item.theme }} - {{ item.subsubject }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <PriorityBadge :priority="item.priority" />
                <StatusBadge :label="item.criticality" />
                <StatusBadge :label="item.status" />
                <SlaBadge :label="item.sla" />
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-500">
              <span v-if="item.recurrenceSignals?.repeatedTheme" class="rounded-full bg-slate-100 px-2.5 py-1">Repeticao no mesmo tema</span>
              <span v-if="item.recurrenceSignals?.repeatedSubsubject" class="rounded-full bg-slate-100 px-2.5 py-1">Repeticao no mesmo subtema</span>
              <span v-if="item.recurrenceSignals?.priorSelfServiceRelated" class="rounded-full bg-slate-100 px-2.5 py-1">Autoatendimento previo relacionado</span>
              <span class="rounded-full bg-slate-100 px-2.5 py-1">{{ item.queue }}</span>
            </div>
          </article>
        </div>

        <div v-else class="mt-3 rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
          Nenhum caso ativo nos filtros atuais.
        </div>
      </section>

      <section class="mt-5">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Frentes de governanca</h3>
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
