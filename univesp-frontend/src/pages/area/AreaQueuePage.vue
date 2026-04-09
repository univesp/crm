<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  buildAreaQueueFilterOptions,
  filterAreaQueueEntries,
  resolveAreaQueueBucket,
  shouldShowAreaResponseDeadline,
} from '@/services/areaQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const route = useRoute()
const isAreaManager = computed(() => auth.mockContext.profileKey === 'gestor_area')
const showAssigneeColumn = computed(() => isAreaManager.value)
const tableGridClass = computed(() =>
  showAssigneeColumn.value
    ? 'lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.75fr)_minmax(0,1.4fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_auto]'
    : 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.8fr)_minmax(0,1.7fr)_minmax(0,2.4fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]'
)

const PAGE_INCREMENT = 20
const stateStorageKey = computed(() => `univesp-area-queue:${auth.mockContext.profileKey}`)
const flashStorageKey = computed(() => `univesp-area-queue-flash:${auth.mockContext.profileKey}`)
const flashMessage = ref('')
const refreshTick = ref(0)
const flatVisibleCount = ref(PAGE_INCREMENT)
const groupVisibleCounts = reactive({
  needs_review: PAGE_INCREMENT,
  waiting_complement: PAGE_INCREMENT,
  rerouted: PAGE_INCREMENT,
  completed: PAGE_INCREMENT,
})
const groupOpenState = reactive({
  needs_review: true,
  waiting_complement: false,
  rerouted: false,
  completed: false,
})

const bucketDefinitions = [
  {
    id: 'needs_review',
    label: 'Precisa da minha analise',
    activeClass: 'border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.88)] text-[var(--color-danger)]',
    inactiveClass: 'border-[rgba(166,31,40,0.16)] bg-white text-[var(--color-danger)]',
    rowClass: 'bg-[rgba(166,31,40,0.78)]',
    surfaceClass: 'bg-[rgba(253,236,237,0.04)]',
    sectionClass: 'bg-[rgba(253,236,237,0.58)] text-[var(--color-danger)]',
  },
  {
    id: 'waiting_complement',
    label: 'Aguardando complemento',
    activeClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.92)] text-[#9a5b00]',
    inactiveClass: 'border-[rgba(202,138,4,0.16)] bg-white text-[#9a5b00]',
    rowClass: 'bg-[rgba(202,138,4,0.78)]',
    surfaceClass: 'bg-[rgba(254,243,199,0.05)]',
    sectionClass: 'bg-[rgba(254,243,199,0.62)] text-[#9a5b00]',
  },
  {
    id: 'rerouted',
    label: 'Reencaminhados',
    activeClass: 'border-[rgba(8,115,145,0.2)] bg-[rgba(224,242,254,0.92)] text-[#0b6e8c]',
    inactiveClass: 'border-[rgba(8,115,145,0.16)] bg-white text-[#0b6e8c]',
    rowClass: 'bg-[rgba(8,115,145,0.78)]',
    surfaceClass: 'bg-[rgba(224,242,254,0.05)]',
    sectionClass: 'bg-[rgba(224,242,254,0.6)] text-[#0b6e8c]',
  },
  {
    id: 'completed',
    label: 'Concluidos',
    activeClass: 'border-[rgba(26,111,67,0.2)] bg-[rgba(220,252,231,0.9)] text-[var(--color-success)]',
    inactiveClass: 'border-[rgba(26,111,67,0.16)] bg-white text-[var(--color-success)]',
    rowClass: 'bg-[rgba(26,111,67,0.78)]',
    surfaceClass: 'bg-[rgba(220,252,231,0.05)]',
    sectionClass: 'bg-[rgba(220,252,231,0.58)] text-[var(--color-success)]',
  },
  {
    id: 'all',
    label: 'Ver todos',
    activeClass: 'border-slate-300 bg-slate-100 text-slate-900',
    inactiveClass: 'border-slate-200 bg-white text-slate-700',
  },
]

function buildDefaultFilters() {
  return {
    search: '',
    status: 'todos',
    owner: 'todos',
    scopeState: 'todos',
    bucket: 'all',
    sortField: 'sla',
    sortDirection: 'asc',
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

function resetDensityWindows() {
  flatVisibleCount.value = PAGE_INCREMENT
  for (const bucketId of ['needs_review', 'waiting_complement', 'rerouted', 'completed']) {
    groupVisibleCounts[bucketId] = PAGE_INCREMENT
  }
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
  if (scopeState && analystScopeShortcuts.value.some((item) => item.id === scopeState)) {
    filters.scopeState = scopeState
  }

  const owner = String(query.owner || '').trim()
  if (owner && filterOptions.value.owner.some((option) => option.value === owner)) {
    filters.owner = owner
  }

  const status = String(query.status || '').trim()
  if (status && filterOptions.value.status.some((option) => option.value === status)) {
    filters.status = status
  }
}

const queueEntries = computed(() => {
  refreshTick.value
  return studentSupportStore.areaQueueEntries(auth.mockContext)
})
const filterOptions = computed(() => buildAreaQueueFilterOptions(queueEntries.value))
const utilityFilteredEntries = computed(() =>
  filterAreaQueueEntries(queueEntries.value, {
    ...filters,
    bucket: 'all',
  }),
)
const bucketFilteredEntries = computed(() => {
  if (filters.bucket === 'all') {
    return utilityFilteredEntries.value
  }

  return utilityFilteredEntries.value.filter((entry) => resolveAreaQueueBucket(entry) === filters.bucket)
})

function compareText(left = '', right = '') {
  return String(left).localeCompare(String(right), 'pt-BR', { sensitivity: 'base' })
}

function compareEntries(left, right, field) {
  switch (field) {
    case 'student':
      return compareText(left.student, right.student)
    case 'ra':
      return compareText(left.studentRa, right.studentRa)
    case 'subject':
      return compareText(left.subject, right.subject)
    case 'handoff':
      return compareText(left.contextFromOp, right.contextFromOp)
    case 'status':
      return compareText(left.areaStatusLabel, right.areaStatusLabel)
    case 'owner':
      return compareText(left.currentAssigneeLabel, right.currentAssigneeLabel)
    case 'protocol':
      return compareText(left.id, right.id)
    case 'sla':
      return left.sortTokens.slaMinutes - right.sortTokens.slaMinutes
    default:
      return 0
  }
}

function sortEntries(entries) {
  const direction = filters.sortDirection === 'desc' ? -1 : 1
  const field = filters.sortField || 'sla'

  return [...entries].sort((left, right) => {
    const primary = compareEntries(left, right, field)

    if (primary !== 0) {
      return primary * direction
    }

    return compareEntries(left, right, 'sla')
  })
}

const orderedQueue = computed(() => sortEntries(bucketFilteredEntries.value))
const visibleFlatQueue = computed(() => orderedQueue.value.slice(0, flatVisibleCount.value))
const hasMoreFlatQueue = computed(() => orderedQueue.value.length > flatVisibleCount.value)
const groupedQueueSections = computed(() =>
  bucketDefinitions
    .filter((bucket) => bucket.id !== 'all')
    .map((bucket) => {
      const entries = sortEntries(
        utilityFilteredEntries.value.filter((entry) => resolveAreaQueueBucket(entry) === bucket.id),
      )

      return {
        ...bucket,
        entries,
        visibleEntries: entries.slice(0, groupVisibleCounts[bucket.id]),
        hasMore: entries.length > groupVisibleCounts[bucket.id],
      }
    })
    .filter((bucket) => bucket.entries.length),
)

const scopeBadges = computed(() => {
  const badges = []

  if (auth.mockContext.profileKey === 'gestor_area') {
    badges.push(`Escopo: ${auth.mockContext.currentArea}`)
  } else {
    badges.push(auth.mockContext.currentArea)
  }

  return badges
})

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
  { id: 'todos', label: 'Todos do meu escopo' },
  { id: 'mine', label: 'Meus casos' },
  { id: 'unassigned', label: 'Sem responsavel' },
  { id: 'returned_to_me', label: 'Devolvidos para mim' },
  { id: 'waiting_complement', label: 'Aguardando complemento' },
])

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
}

function toggleSort(field) {
  if (filters.sortField === field) {
    filters.sortDirection = filters.sortDirection === 'asc' ? 'desc' : 'asc'
    return
  }

  filters.sortField = field
  filters.sortDirection = 'asc'
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

function sectionToneClass(bucketId) {
  return bucketDefinitions.find((item) => item.id === bucketId)?.sectionClass || 'bg-slate-50 text-slate-700'
}

function showMoreFlatQueue() {
  flatVisibleCount.value += PAGE_INCREMENT
}

function showMoreGroup(bucketId) {
  groupVisibleCounts[bucketId] += PAGE_INCREMENT
}

function toggleGroupedSection(bucketId) {
  groupOpenState[bucketId] = !groupOpenState[bucketId]
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
  filters,
  () => {
    resetDensityWindows()
    persistQueueState()
  },
  { deep: true },
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
    resetDensityWindows()
  },
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

        <div v-if="!isAreaManager" class="flex flex-wrap gap-2">
          <button
            v-for="scope in analystScopeShortcuts"
            :key="scope.id"
            type="button"
            :class="[
              'inline-flex items-center rounded-full border px-3 py-2 text-xs font-semibold transition',
              filters.scopeState === scope.id
                ? 'border-[rgba(8,115,145,0.18)] bg-[rgba(224,242,254,0.48)] text-[#0b6e8c]'
                : 'border-slate-200 bg-white text-slate-700',
            ]"
            @click="filters.scopeState = scope.id"
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
              placeholder="Protocolo, RA, aluno, assunto ou contexto do OP"
            />
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
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="orderedQueue.length"
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
          <div :id="headerId('subject')" role="columnheader" :aria-sort="ariaSort('subject')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('subject')">
              Assunto <span aria-hidden="true">{{ sortMarker('subject') }}</span>
            </button>
          </div>
          <div :id="headerId('handoff')" role="columnheader" :aria-sort="ariaSort('handoff')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('handoff')">
              Contexto recebido do OP <span aria-hidden="true">{{ sortMarker('handoff') }}</span>
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

      <template v-if="filters.bucket === 'all'">
        <div class="divide-y divide-slate-200">
          <section v-for="bucket in groupedQueueSections" :key="bucket.id" class="bg-white">
            <button
              type="button"
              class="flex w-full items-center justify-between px-4 py-3 text-left"
              :class="sectionToneClass(bucket.id)"
              :aria-expanded="groupOpenState[bucket.id] ? 'true' : 'false'"
              @click="toggleGroupedSection(bucket.id)"
            >
              <span class="text-sm font-semibold">{{ bucket.label }} ({{ bucket.entries.length }})</span>
              <span aria-hidden="true">{{ groupOpenState[bucket.id] ? '−' : '+' }}</span>
            </button>

            <div v-if="groupOpenState[bucket.id]" class="divide-y divide-slate-200">
              <RouterLink
                v-for="entry in bucket.visibleEntries"
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
                      <div :aria-labelledby="headerId('subject')">
                        <p class="text-sm font-semibold leading-6 text-slate-900">{{ entry.subject }}</p>
                        <p class="mt-1 text-xs text-slate-500">{{ entry.id }}</p>
                      </div>
                      <div :aria-labelledby="headerId('handoff')">
                        <p class="text-sm leading-6 text-slate-700">{{ entry.contextFromOp }}</p>
                        <p class="mt-1 text-xs text-slate-500">
                          {{ entry.handoffByLabel }} · {{ entry.handoffAtLabel }}
                        </p>
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

              <div v-if="bucket.hasMore" class="px-4 py-4">
                <button
                  type="button"
                  class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  @click="showMoreGroup(bucket.id)"
                >
                  Mostrar mais {{ bucket.label.toLowerCase() }}
                </button>
              </div>
            </div>
          </section>
        </div>
      </template>

      <template v-else>
        <div class="divide-y divide-slate-200">
          <RouterLink
            v-for="entry in visibleFlatQueue"
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
                  <div :aria-labelledby="headerId('subject')">
                    <p class="text-sm font-semibold leading-6 text-slate-900">{{ entry.subject }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ entry.id }}</p>
                  </div>
                  <div :aria-labelledby="headerId('handoff')">
                    <p class="text-sm leading-6 text-slate-700">{{ entry.contextFromOp }}</p>
                    <p class="mt-1 text-xs text-slate-500">
                      {{ entry.handoffByLabel }} · {{ entry.handoffAtLabel }}
                    </p>
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

        <div v-if="hasMoreFlatQueue" class="border-t border-slate-200 px-4 py-4">
          <button
            type="button"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            @click="showMoreFlatQueue"
          >
            Carregar mais atendimentos
          </button>
        </div>
      </template>
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
