<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  AREA_MANAGER_OPERATIONAL_SERVER_PARITY_NOTE,
  buildAreaManagerBackendReadiness,
} from '@/contracts/areaManagerOperationalContract'
import { AREA_OPERATIONAL_SERVER_PARITY_NOTE } from '@/contracts/areaOperationalContracts'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  AREA_QUEUE_DEFAULT_PAGE_SIZE,
  buildAreaQueueFilterOptions,
  buildAreaQueueQuery,
  filterAreaQueueEntries,
  resolveAreaQueueBucket,
  runAreaQueueQuery,
  shouldShowAreaResponseDeadline,
} from '@/services/areaQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const route = useRoute()
const isAreaManager = computed(() => auth.mockContext.profileKey === 'gestor_area')
const isMultiAreaAnalyst = computed(
  () => !isAreaManager.value && (auth.mockContext.linkedAreas || []).length > 1,
)
const showAssigneeColumn = computed(() => isAreaManager.value)
const tableGridClass = computed(() =>
  showAssigneeColumn.value
    ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)_minmax(0,0.95fr)_minmax(0,1.35fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.95fr)_auto]'
    : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)_minmax(0,0.95fr)_minmax(0,1.45fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.95fr)_auto]'
)

const stateStorageKey = computed(() => `univesp-area-queue:${auth.mockContext.profileKey}`)
const flashStorageKey = computed(() => `univesp-area-queue-flash:${auth.mockContext.profileKey}`)
const flashMessage = ref('')
const refreshTick = ref(0)

const bucketDefinitions = [
  {
    id: 'needs_review',
    label: 'Para resolver',
    activeClass: 'border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.88)] text-[var(--color-danger)]',
    inactiveClass: 'border-[rgba(166,31,40,0.16)] bg-white text-[var(--color-danger)]',
    rowClass: 'bg-[rgba(166,31,40,0.78)]',
    surfaceClass: 'bg-[rgba(253,236,237,0.04)]',
  },
  {
    id: 'waiting_complement',
    label: 'Aguardando complemento',
    activeClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.92)] text-[#9a5b00]',
    inactiveClass: 'border-[rgba(202,138,4,0.16)] bg-white text-[#9a5b00]',
    rowClass: 'bg-[rgba(202,138,4,0.78)]',
    surfaceClass: 'bg-[rgba(254,243,199,0.05)]',
  },
  {
    id: 'rerouted',
    label: 'Excecoes e reencaminhados',
    activeClass: 'border-[rgba(8,115,145,0.2)] bg-[rgba(224,242,254,0.92)] text-[#0b6e8c]',
    inactiveClass: 'border-[rgba(8,115,145,0.16)] bg-white text-[#0b6e8c]',
    rowClass: 'bg-[rgba(8,115,145,0.78)]',
    surfaceClass: 'bg-[rgba(224,242,254,0.05)]',
  },
  {
    id: 'completed',
    label: 'Concluidos',
    activeClass: 'border-[rgba(26,111,67,0.2)] bg-[rgba(220,252,231,0.9)] text-[var(--color-success)]',
    inactiveClass: 'border-[rgba(26,111,67,0.16)] bg-white text-[var(--color-success)]',
    rowClass: 'bg-[rgba(26,111,67,0.78)]',
    surfaceClass: 'bg-[rgba(220,252,231,0.05)]',
  },
  {
    id: 'all',
    label: 'Ver todos',
    activeClass: 'border-slate-300 bg-slate-100 text-slate-900',
    inactiveClass: 'border-slate-200 bg-white text-slate-700',
  },
]
const pageSizeOptions = [AREA_QUEUE_DEFAULT_PAGE_SIZE, 50, 100]

function buildDefaultFilters() {
  return {
    search: '',
    area: 'todos',
    subject: 'todos',
    status: 'todos',
    owner: 'todos',
    scopeState: 'todos',
    bucket: 'all',
    sortField: 'sla',
    sortDirection: 'asc',
    page: 1,
    pageSize: AREA_QUEUE_DEFAULT_PAGE_SIZE,
  }
}

function loadPersistedState() {
  if (typeof window === 'undefined') {
    return { filters: buildDefaultFilters(), scrollY: 0 }
  }

  try {
    const storedValue = window.sessionStorage.getItem(stateStorageKey.value)
    const parsed = storedValue ? JSON.parse(storedValue) : {}

    return {
      filters: {
        ...buildDefaultFilters(),
        ...(parsed.filters || {}),
      },
      scrollY: Number(parsed.scrollY || 0),
    }
  } catch {
    return { filters: buildDefaultFilters(), scrollY: 0 }
  }
}

const persistedState = loadPersistedState()
const filters = reactive(persistedState.filters)

function resetQueuePagination() {
  filters.page = 1
}

function persistQueueState(scrollY = typeof window !== 'undefined' ? window.scrollY : 0) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(
    stateStorageKey.value,
    JSON.stringify({
      filters: { ...filters },
      scrollY,
    }),
  )
}

function restoreQueueScroll() {
  if (typeof window === 'undefined') {
    return
  }

  nextTick(() => {
    window.scrollTo({
      top: persistedState.scrollY || 0,
      behavior: 'auto',
    })
  })
}

function handleWindowScroll() {
  persistQueueState(window.scrollY)
}

function applyRouteFilters(query = {}) {
  const normalizedSearch = String(query.search || '').trim()
  if (normalizedSearch) {
    filters.search = normalizedSearch
  }

  const routeBucket = String(query.bucket || '').trim()
  if (bucketDefinitions.some((bucket) => bucket.id === routeBucket)) {
    filters.bucket = routeBucket
  }

  const scopeState = String(query.scopeState || '').trim()
  if (
    scopeState &&
    analystScopeShortcuts.value.some((item) => item.kind === 'scope' && item.value === scopeState)
  ) {
    filters.scopeState = scopeState
  }

  const owner = String(query.owner || '').trim()
  if (owner && filterOptions.value.owner.some((option) => option.value === owner)) {
    filters.owner = owner
  }

  const area = String(query.areaFilter || '').trim()
  if (area && filterOptions.value.area.some((option) => option.value === area)) {
    filters.area = area
  }

  const subject = String(query.subject || '').trim()
  if (subject && filterOptions.value.subject.some((option) => option.value === subject)) {
    filters.subject = subject
  }

  const status = String(query.status || '').trim()
  if (status && filterOptions.value.status.some((option) => option.value === status)) {
    filters.status = status
  }

  const sortField = String(query.sortField || '').trim()
  if (sortField) {
    filters.sortField = sortField
  }

  const sortDirection = String(query.sortDirection || '').trim().toLowerCase()
  if (sortDirection === 'asc' || sortDirection === 'desc') {
    filters.sortDirection = sortDirection
  }

  const page = Number(query.page || 0)
  if (Number.isFinite(page) && page > 0) {
    filters.page = page
  }
}

const areaViewerContext = computed(() =>
  isAreaManager.value
    ? auth.mockContext
    : {
        ...auth.mockContext,
        currentArea: '',
      },
)

const queueEntries = computed(() => {
  refreshTick.value
  return studentSupportStore.areaQueueEntries(areaViewerContext.value)
})
const filterOptions = computed(() => buildAreaQueueFilterOptions(queueEntries.value))
const utilityFilteredEntries = computed(() =>
  filterAreaQueueEntries(queueEntries.value, {
    ...buildAreaQueueQuery(filters),
    bucket: 'all',
  }),
)
const queueResult = computed(() =>
  runAreaQueueQuery(queueEntries.value, filters, {
    page: filters.page,
    pageSize: filters.pageSize,
  }),
)
const pagedEntries = computed(() => queueResult.value.items)
const queueTotals = computed(() => ({
  total: queueResult.value.total,
  start: queueResult.value.total ? (queueResult.value.query.page - 1) * queueResult.value.query.pageSize + 1 : 0,
  end: queueResult.value.total
    ? (queueResult.value.query.page - 1) * queueResult.value.query.pageSize + queueResult.value.items.length
    : 0,
}))
const unassignedCount = computed(() =>
  utilityFilteredEntries.value.filter((entry) => entry.currentAssigneeLabel === 'Sem responsavel').length,
)

const scopeBadges = computed(() => {
  const badges = []

  if (auth.mockContext.profileKey === 'gestor_area') {
    badges.push(`Escopo: ${auth.mockContext.currentArea}`)
  } else if (isMultiAreaAnalyst.value) {
    badges.push('Escopo: todas as minhas areas')
  } else {
    badges.push(auth.mockContext.currentArea)
  }

  return badges
})

const managerOverview = computed(() =>
  isAreaManager.value ? studentSupportStore.areaManagerOverview(auth.mockContext) : null,
)
const managerBackendReadiness = buildAreaManagerBackendReadiness({ hasServerOverview: false })
const managerBackendFields = computed(() => Object.entries(managerBackendReadiness.minimalOverviewPayload || {}))
const managerQueueCards = computed(() =>
  !managerOverview.value
    ? []
    : [
        {
          id: 'backlog',
          label: 'Backlog',
          value: managerOverview.value.summary.find((item) => item.id === 'backlog')?.value || 0,
          helper: 'Casos ativos da area neste momento.',
        },
        {
          id: 'unassigned',
          label: 'Sem responsavel',
          value: managerOverview.value.summary.find((item) => item.id === 'unassigned')?.value || 0,
          helper: 'Casos que exigem intervencao de distribuicao.',
        },
        {
          id: 'overdue',
          label: 'Vencidos',
          value: managerOverview.value.summary.find((item) => item.id === 'overdue')?.value || 0,
          helper: 'Risco imediato de SLA.',
        },
        {
          id: 'risk',
          label: 'Em risco',
          value: managerOverview.value.summary.find((item) => item.id === 'risk')?.value || 0,
          helper: 'Casos perto do vencimento.',
        },
      ],
)
const managerFocusShortcuts = computed(() =>
  !managerOverview.value
    ? []
    : managerOverview.value.operationalQuestions.map((item) => ({
        id: item.id,
        label: item.question,
        helper: item.headline,
        query: item.routeQuery || {},
        tone: item.tone || 'info',
      })),
)
const managerPriorityAlerts = computed(() =>
  !managerOverview.value ? [] : managerOverview.value.interventionQueue.slice(0, 3),
)

const queueIntro = computed(() =>
  isAreaManager.value
    ? 'Use esta fila para intervencao gerencial por caso. A visao consolidada continua em Operacao da area.'
    : isMultiAreaAnalyst.value
      ? 'Use esta fila unica para resolver seus casos em todas as areas do seu escopo. Reencaminhamentos ficam como excecao operacional.'
      : 'Use a fila para resolver seus casos primeiro. Reencaminhamentos ficam como excecao operacional, nao como saida normal.',
)
const serverParityNote = computed(() =>
  isAreaManager.value ? AREA_MANAGER_OPERATIONAL_SERVER_PARITY_NOTE : AREA_OPERATIONAL_SERVER_PARITY_NOTE,
)

const quickBuckets = computed(() =>
  bucketDefinitions.map((bucket) => ({
    ...bucket,
    count:
      bucket.id === 'all'
        ? utilityFilteredEntries.value.length
        : utilityFilteredEntries.value.filter((entry) => resolveAreaQueueBucket(entry) === bucket.id).length,
    active: filters.bucket === bucket.id,
  })),
)

const analystScopeShortcuts = computed(() => [
  { id: 'mine', label: 'Meus casos', kind: 'scope', value: 'mine' },
  { id: 'unassigned', label: 'Sem responsavel', kind: 'scope', value: 'unassigned' },
  { id: 'waiting_complement', label: 'Aguardando complemento', kind: 'scope', value: 'waiting_complement' },
  { id: 'completed', label: 'Concluidos', kind: 'bucket', value: 'completed' },
  { id: 'todos', label: 'Todos do meu escopo', kind: 'reset', value: 'todos' },
])

function applyAnalystShortcut(shortcut) {
  if (!shortcut) {
    return
  }

  if (shortcut.kind === 'scope') {
    filters.scopeState = shortcut.value
    filters.bucket = 'all'
    resetQueuePagination()
    return
  }

  if (shortcut.kind === 'bucket') {
    filters.scopeState = 'todos'
    filters.bucket = shortcut.value
    resetQueuePagination()
    return
  }

  filters.scopeState = 'todos'
  filters.bucket = 'all'
  resetQueuePagination()
}

function isAnalystShortcutActive(shortcut) {
  if (!shortcut) {
    return false
  }

  if (shortcut.kind === 'scope') {
    return filters.scopeState === shortcut.value && filters.bucket === 'all'
  }

  if (shortcut.kind === 'bucket') {
    return filters.bucket === shortcut.value
  }

  return filters.scopeState === 'todos' && filters.bucket === 'all'
}

function managerShortcutToneClass(tone = '', active = false) {
  if (active) {
    if (tone === 'danger') {
      return 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.88)] text-[var(--color-danger)]'
    }

    if (tone === 'warning') {
      return 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.88)] text-[#8a5200]'
    }

    return 'border-[rgba(8,115,145,0.2)] bg-[rgba(224,242,254,0.92)] text-[#0b6e8c]'
  }

  return 'border-slate-200 bg-white text-slate-700'
}

function applyManagerShortcut(shortcut) {
  if (!shortcut?.query) {
    return
  }

  Object.assign(filters, {
    ...buildDefaultFilters(),
    ...shortcut.query,
    pageSize: filters.pageSize,
  })
}

function isManagerShortcutActive(shortcut) {
  if (!shortcut?.query) {
    return false
  }

  return Object.entries(shortcut.query).every(([key, value]) => filters[key] === value)
}

function managerAlertToneClass(tone = '') {
  if (tone === 'danger') {
    return 'border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.72)]'
  }

  if (tone === 'warning') {
    return 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.64)]'
  }

  return 'border-[rgba(8,115,145,0.16)] bg-[rgba(224,242,254,0.62)]'
}

function managerRowSignals(entry = {}) {
  if (!isAreaManager.value) {
    return []
  }

  const items = []

  if (entry.isUnassigned) {
    items.push({
      id: `${entry.id}-unassigned`,
      label: 'Sem responsavel',
      toneClass: 'border-[rgba(202,138,4,0.24)] bg-[rgba(254,243,199,0.56)] text-[#8a5200]',
    })
  }

  if (entry.isOverdue) {
    items.push({
      id: `${entry.id}-overdue`,
      label: 'SLA vencido',
      toneClass: 'border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.72)] text-[var(--color-danger)]',
    })
  } else if (entry.isAtRisk) {
    items.push({
      id: `${entry.id}-risk`,
      label: 'SLA em risco',
      toneClass: 'border-[rgba(202,138,4,0.24)] bg-[rgba(254,243,199,0.56)] text-[#8a5200]',
    })
  }

  if (entry.isExceptionRoute) {
    items.push({
      id: `${entry.id}-exception`,
      label: 'Excecao',
      toneClass: 'border-[rgba(8,115,145,0.22)] bg-[rgba(224,242,254,0.7)] text-[#0b6e8c]',
    })
  }

  if (entry.isWaitingComplement) {
    items.push({
      id: `${entry.id}-waiting`,
      label: 'Aguardando complemento',
      toneClass: 'border-slate-200 bg-slate-100 text-slate-700',
    })
  }

  return items
}

const activeFilterChips = computed(() => {
  const chips = []

  if (filters.search.trim()) {
    chips.push({
      key: 'search',
      label: `Busca: ${filters.search.trim()}`,
    })
  }

  if (filters.status !== 'todos') {
    chips.push({
      key: 'status',
      label: `Status: ${filters.status}`,
    })
  }

  if (filters.area !== 'todos') {
    chips.push({
      key: 'area',
      label: `Area: ${filters.area}`,
    })
  }

  if (filters.subject !== 'todos') {
    chips.push({
      key: 'subject',
      label: `Assunto: ${filters.subject}`,
    })
  }

  if (filters.owner !== 'todos') {
    chips.push({
      key: 'owner',
      label: `Responsavel: ${filters.owner}`,
    })
  }

  if (filters.scopeState !== 'todos') {
    const scopeLabels = {
      mine: 'Meus casos',
      unassigned: 'Sem responsavel',
      returned_to_me: 'Devolvidos para mim',
      waiting_complement: 'Aguardando complemento',
    }

    chips.push({
      key: 'scopeState',
      label: scopeLabels[filters.scopeState] || filters.scopeState,
    })
  }

  return chips
})

function clearFilterChip(key) {
  if (key === 'search') {
    filters.search = ''
    return
  }

  filters[key] = 'todos'
}

function clearFilters() {
  Object.assign(filters, buildDefaultFilters())
}

function setQuickBucket(bucketId) {
  filters.bucket = bucketId
  resetQueuePagination()
}

function toggleSort(field) {
  if (filters.sortField === field) {
    filters.sortDirection = filters.sortDirection === 'asc' ? 'desc' : 'asc'
    resetQueuePagination()
    return
  }

  filters.sortField = field
  filters.sortDirection = 'asc'
  resetQueuePagination()
}

function sortMarker(field) {
  if (filters.sortField !== field) {
    return ''
  }

  return filters.sortDirection === 'asc' ? '^' : 'v'
}

function ariaSort(field) {
  if (filters.sortField !== field) {
    return 'none'
  }

  return filters.sortDirection === 'asc' ? 'ascending' : 'descending'
}

function headerId(field) {
  return `area-queue-col-${field}`
}

function rowToneClass(entry) {
  const bucket = resolveAreaQueueBucket(entry)
  return bucketDefinitions.find((item) => item.id === bucket)?.rowClass || 'bg-transparent'
}

function rowSurfaceClass(entry) {
  const bucket = resolveAreaQueueBucket(entry)
  return bucketDefinitions.find((item) => item.id === bucket)?.surfaceClass || 'bg-white'
}

function nextPage() {
  if (!queueResult.value.hasNextPage) {
    return
  }

  filters.page += 1
}

function previousPage() {
  if (!queueResult.value.hasPreviousPage) {
    return
  }

  filters.page -= 1
}

function buildCaseRoute(entry) {
  persistQueueState()
  const caseId = typeof entry === 'string' ? entry : entry?.id
  const areaLabel =
    typeof entry === 'string'
      ? ''
      : entry?.currentAreaLabel || entry?.lastMileAreaLabel || auth.mockContext.currentArea

  return {
    path: `/area/fila/${caseId}`,
    query: areaLabel
      ? {
          area: areaLabel,
        }
      : {},
  }
}

function refreshQueue() {
  refreshTick.value = Date.now()
  persistQueueState()
}

watch(
  [
    () => filters.search,
    () => filters.area,
    () => filters.subject,
    () => filters.status,
    () => filters.owner,
    () => filters.scopeState,
    () => filters.bucket,
    () => filters.sortField,
    () => filters.sortDirection,
  ],
  () => {
    resetQueuePagination()
  },
)

watch(
  () => filters.pageSize,
  () => {
    resetQueuePagination()
  },
)

watch(
  () => route.query,
  (query) => {
    applyRouteFilters(query || {})
  },
)

watch(
  () => auth.mockContext.currentArea,
  () => {
    resetQueuePagination()
  },
)

watch(
  filters,
  () => {
    persistQueueState()
  },
  { deep: true },
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    flashMessage.value = window.sessionStorage.getItem(flashStorageKey.value) || ''
    window.sessionStorage.removeItem(flashStorageKey.value)
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
  }

  applyRouteFilters(route.query || {})
  restoreQueueScroll()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleWindowScroll)
  }
})
</script>

<template>
  <div class="grid gap-3">
    <div
      v-if="flashMessage"
      role="status"
      aria-live="polite"
      class="rounded-[16px] border border-[rgba(26,111,67,0.16)] bg-[rgba(26,111,67,0.08)] px-4 py-3 text-sm leading-6 text-[var(--color-success)]"
    >
      {{ flashMessage }}
    </div>

    <section class="rounded-[16px] border border-slate-200 bg-white px-4 py-4">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-for="badge in scopeBadges"
            :key="badge"
            class="rounded-full border border-[rgba(8,115,145,0.12)] bg-[rgba(224,242,254,0.42)] px-3 py-1.5 text-xs font-semibold text-[#0b6e8c]"
          >
            {{ badge }}
          </span>
        </div>

        <p class="text-sm leading-6 text-slate-600">
          {{ queueIntro }}
        </p>

        <p class="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
          {{ serverParityNote }}
        </p>
        <details v-if="isAreaManager" class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
          <summary class="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Payload minimo esperado para leitura gerencial
          </summary>
          <ul class="mt-3 grid gap-1 text-xs leading-5 text-slate-600">
            <li v-for="[field, type] in managerBackendFields" :key="field">
              <strong>{{ field }}:</strong> {{ type }}
            </li>
          </ul>
        </details>

        <div v-if="isAreaManager && managerQueueCards.length" class="grid gap-3 md:grid-cols-4">
          <article
            v-for="card in managerQueueCards"
            :key="card.id"
            class="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-3"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{{ card.label }}</p>
            <p class="mt-2 text-xl font-semibold text-slate-950">{{ card.value }}</p>
            <p class="mt-1 text-xs leading-5 text-slate-600">{{ card.helper }}</p>
          </article>
        </div>

        <div v-if="isAreaManager && managerFocusShortcuts.length" class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <button
            v-for="shortcut in managerFocusShortcuts"
            :key="shortcut.id"
            type="button"
            :class="[
              'rounded-[14px] border px-3 py-3 text-left transition',
              managerShortcutToneClass(shortcut.tone, isManagerShortcutActive(shortcut)),
            ]"
            @click="applyManagerShortcut(shortcut)"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.08em]">{{ shortcut.label }}</p>
            <p class="mt-1 text-xs leading-5">{{ shortcut.helper }}</p>
          </button>
        </div>

        <div v-if="isAreaManager && managerPriorityAlerts.length" class="grid gap-2 lg:grid-cols-3">
          <RouterLink
            v-for="alert in managerPriorityAlerts"
            :key="alert.id"
            :to="{ path: '/area/fila', query: alert.routeQuery || {} }"
            :class="['rounded-[14px] border px-3 py-3 text-sm leading-6 transition hover:opacity-95', managerAlertToneClass(alert.tone)]"
          >
            <p class="font-semibold text-slate-900">{{ alert.title }}</p>
            <p class="mt-1 text-slate-700">{{ alert.description }}</p>
          </RouterLink>
        </div>

        <div v-if="!isAreaManager" class="flex flex-wrap gap-2">
          <button
            v-for="scope in analystScopeShortcuts"
            :key="scope.id"
            type="button"
            :class="[
              'inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold transition',
              isAnalystShortcutActive(scope)
                ? 'border-[rgba(8,115,145,0.18)] bg-[rgba(224,242,254,0.48)] text-[#0b6e8c]'
                : 'border-slate-200 bg-white text-slate-700',
            ]"
            @click="applyAnalystShortcut(scope)"
          >
            {{ scope.label }}
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="bucket in quickBuckets"
            :key="bucket.id"
            type="button"
            :aria-pressed="bucket.active ? 'true' : 'false'"
            :class="[
              'inline-flex items-center gap-2 rounded-[14px] border px-4 py-2.5 text-sm font-semibold transition',
              bucket.active ? bucket.activeClass : bucket.inactiveClass,
            ]"
            @click="setQuickBucket(bucket.id)"
          >
            <span>{{ bucket.label }}</span>
            <span class="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {{ bucket.count }}
            </span>
          </button>
        </div>

        <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label class="grid flex-1 gap-2">
            <span class="text-sm font-semibold text-slate-700">Buscar</span>
            <input
              v-model="filters.search"
              type="search"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
              placeholder="Protocolo, RA, aluno, polo ou assunto"
            />
          </label>

          <label v-if="isMultiAreaAnalyst" class="grid min-w-[220px] gap-2">
            <span class="text-sm font-semibold text-slate-700">Area</span>
            <select
              v-model="filters.area"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.area" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid min-w-[220px] gap-2">
            <span class="text-sm font-semibold text-slate-700">Status</span>
            <select
              v-model="filters.status"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.status" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label v-if="isAreaManager" class="grid min-w-[240px] gap-2">
            <span class="text-sm font-semibold text-slate-700">Assunto/subassunto</span>
            <select
              v-model="filters.subject"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.subject" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label v-if="isAreaManager" class="grid min-w-[220px] gap-2">
            <span class="text-sm font-semibold text-slate-700">Responsavel atual</span>
            <select
              v-model="filters.owner"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.owner" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid min-w-[150px] gap-2">
            <span class="text-sm font-semibold text-slate-700">Itens por pagina</span>
            <select
              v-model.number="filters.pageSize"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            >
              <option v-for="size in pageSizeOptions" :key="size" :value="size">
                {{ size }}
              </option>
            </select>
          </label>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="refreshQueue"
            >
              Atualizar
            </button>
            <button
              v-if="activeFilterChips.length || filters.bucket !== 'all'"
              type="button"
              class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="clearFilters"
            >
              Limpar
            </button>
          </div>
        </div>

        <div v-if="activeFilterChips.length" class="flex flex-wrap gap-2">
          <button
            v-for="chip in activeFilterChips"
            :key="chip.key"
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            @click="clearFilterChip(chip.key)"
          >
            <span>{{ chip.label }}</span>
            <span aria-hidden="true">x</span>
          </button>
        </div>

        <div
          v-if="unassignedCount > 0"
          class="rounded-[14px] border border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.5)] px-4 py-3 text-sm leading-6 text-[#8a5200]"
        >
          <p class="font-semibold">Sem responsavel: {{ unassignedCount }} caso(s)</p>
          <p class="mt-1">Priorize distribuicao para reduzir risco de SLA e retrabalho.</p>
        </div>
      </div>
    </section>

    <section
      v-if="queueResult.total"
      role="table"
      aria-label="Fila especializada da area"
      class="overflow-hidden rounded-[16px] border border-slate-200 bg-white"
    >
      <div role="rowgroup" class="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div :class="['hidden gap-4 text-xs font-semibold text-slate-500 lg:grid', tableGridClass]" role="row">
          <div :id="headerId('student')" role="columnheader" :aria-sort="ariaSort('student')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('student')">
              Aluno <span aria-hidden="true">{{ sortMarker('student') }}</span>
            </button>
          </div>
          <div :id="headerId('ra')" role="columnheader" :aria-sort="ariaSort('ra')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('ra')">
              RA <span aria-hidden="true">{{ sortMarker('ra') }}</span>
            </button>
          </div>
          <div :id="headerId('polo')" role="columnheader" :aria-sort="ariaSort('polo')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('polo')">
              Polo <span aria-hidden="true">{{ sortMarker('polo') }}</span>
            </button>
          </div>
          <div :id="headerId('subject')" role="columnheader" :aria-sort="ariaSort('subject')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('subject')">
              Assunto <span aria-hidden="true">{{ sortMarker('subject') }}</span>
            </button>
          </div>
          <div :id="headerId('next_step')" role="columnheader" :aria-sort="ariaSort('next_step')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('next_step')">
              O que falta <span aria-hidden="true">{{ sortMarker('next_step') }}</span>
            </button>
          </div>
          <div v-if="showAssigneeColumn" :id="headerId('owner')" role="columnheader" :aria-sort="ariaSort('owner')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('owner')">
              Responsavel atual <span aria-hidden="true">{{ sortMarker('owner') }}</span>
            </button>
          </div>
          <div :id="headerId('status')" role="columnheader" :aria-sort="ariaSort('status')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('status')">
              Status <span aria-hidden="true">{{ sortMarker('status') }}</span>
            </button>
          </div>
          <div :id="headerId('sla')" role="columnheader" :aria-sort="ariaSort('sla')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('sla')">
              Prazo <span aria-hidden="true">{{ sortMarker('sla') }}</span>
            </button>
          </div>
          <div role="columnheader" class="text-right">Acao</div>
        </div>
      </div>

      <div class="divide-y divide-slate-200">
        <RouterLink
          v-for="entry in pagedEntries"
          :key="entry.id"
          :to="buildCaseRoute(entry)"
          role="row"
          class="group block px-4 py-4 transition hover:bg-slate-50/80"
        >
          <div class="flex gap-3">
            <div class="w-2 shrink-0 rounded-full" :class="rowToneClass(entry)"></div>
            <div :class="['min-w-0 flex-1 rounded-[14px] px-1', rowSurfaceClass(entry)]">
              <div :class="['grid gap-3 lg:items-start', tableGridClass]">
                <div :aria-labelledby="headerId('student')">
                  <p class="text-sm font-semibold text-slate-950">{{ entry.student }}</p>
                </div>
                <div :aria-labelledby="headerId('ra')" class="text-sm text-slate-700">
                  {{ entry.studentRa || 'Nao informado' }}
                </div>
                <div :aria-labelledby="headerId('polo')" class="text-sm text-slate-700">
                  {{ entry.polo || 'Nao informado' }}
                </div>
                <div :aria-labelledby="headerId('subject')">
                  <p class="text-sm font-semibold leading-6 text-slate-900">{{ entry.subject }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ entry.id }}</p>
                  <p v-if="isMultiAreaAnalyst" class="mt-1 text-xs font-semibold text-[#0b6e8c]">
                    Area: {{ entry.currentAreaLabel }}
                  </p>
                </div>
                <div :aria-labelledby="headerId('next_step')">
                  <p class="text-sm leading-6 text-slate-700">{{ entry.nextStepLabel }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ entry.pendingLabel }}</p>
                  <div v-if="isAreaManager" class="mt-2 flex flex-wrap gap-1.5">
                    <span
                      v-for="signal in managerRowSignals(entry)"
                      :key="signal.id"
                      :class="['rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.05em]', signal.toneClass]"
                    >
                      {{ signal.label }}
                    </span>
                  </div>
                </div>
                <div v-if="showAssigneeColumn" :aria-labelledby="headerId('owner')">
                  <p class="text-sm font-semibold text-slate-900">{{ entry.currentAssigneeLabel }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ entry.currentAssigneeMeta }}</p>
                </div>
                <div :aria-labelledby="headerId('status')">
                  <StatusBadge :label="entry.areaStatusLabel" />
                </div>
                <div :aria-labelledby="headerId('sla')">
                  <SlaBadge v-if="shouldShowAreaResponseDeadline(entry)" :label="entry.sla" />
                  <span v-else class="badge-base badge-neutral">Encerrado</span>
                </div>
                <div class="flex justify-end">
                  <span class="inline-flex items-center rounded-[14px] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-[var(--color-primary-dark)]">
                    Abrir
                  </span>
                </div>
              </div>
            </div>
          </div>
        </RouterLink>
      </div>

      <div class="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <p class="text-sm text-slate-600">
          Mostrando {{ queueTotals.start }}-{{ queueTotals.end }} de {{ queueTotals.total }} caso(s).
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!queueResult.hasPreviousPage"
            @click="previousPage"
          >
            Pagina anterior
          </button>
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Pagina {{ queueResult.query.page }}
          </span>
          <button
            type="button"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!queueResult.hasNextPage"
            @click="nextPage"
          >
            Proxima pagina
          </button>
        </div>
      </div>
    </section>

    <section
      v-else
      class="rounded-[16px] border border-slate-200 bg-white px-6 py-8 text-center"
    >
      <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        Fila vazia
      </p>
      <h2 class="mt-3 text-2xl font-semibold text-slate-950">
        Nenhum caso da area foi encontrado neste recorte.
      </h2>
      <p class="mt-3 text-sm leading-7 text-slate-600">
        Ajuste a busca, mude o bucket selecionado ou revise o escopo atual da area.
      </p>
    </section>
  </div>
</template>
