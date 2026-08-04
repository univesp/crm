<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { isMockRuntimeEnabled, listTickets } from '@/services/appApi'
import { mapApiTicketToOperationalProtocol } from '@/services/ticketMapper'
import {
  buildOperatorQueueFilterOptions,
  filterOperatorQueueEntries,
  resolveOperationalStatus,
  resolveQueueBucket,
  shouldShowResponseDeadline,
} from '@/services/operatorQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const route = useRoute()

const isManagerView = computed(() => auth.mockContext.profileKey === 'gestor_polos')
const stateStorageKey = computed(() => `univesp-operator-queue:${auth.mockContext.profileKey}`)
const flashStorageKey = computed(() => `univesp-operator-queue-flash:${auth.mockContext.profileKey}`)
const flashMessage = ref('')
const showMobileFilters = ref(false)
const refreshTick = ref(0)
const liveQueueLoading = ref(false)
const liveQueueMessage = ref('')
const PAGE_INCREMENT = 25
const flatVisibleCount = ref(PAGE_INCREMENT)
const groupVisibleCounts = reactive({
  needs_action: PAGE_INCREMENT,
  waiting_student: PAGE_INCREMENT,
  waiting_area: PAGE_INCREMENT,
  completed: PAGE_INCREMENT,
})
const groupOpenState = reactive({
  needs_action: true,
  waiting_student: false,
  waiting_area: false,
  completed: false,
})

const bucketDefinitions = [
  {
    id: 'needs_action',
    label: 'Precisa da minha ação',
    activeClass: 'border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.88)] text-[var(--color-danger)]',
    inactiveClass: 'border-[rgba(166,31,40,0.16)] bg-white text-[var(--color-danger)]',
    rowClass: 'bg-[rgba(166,31,40,0.82)]',
    surfaceClass: 'bg-[rgba(253,236,237,0.06)]',
    sectionClass: 'bg-[rgba(253,236,237,0.58)] text-[var(--color-danger)]',
  },
  {
    id: 'waiting_student',
    label: 'Aguardando aluno',
    activeClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.92)] text-[#9a5b00]',
    inactiveClass: 'border-[rgba(202,138,4,0.16)] bg-white text-[#9a5b00]',
    rowClass: 'bg-[rgba(202,138,4,0.82)]',
    surfaceClass: 'bg-[rgba(254,243,199,0.05)]',
    sectionClass: 'bg-[rgba(254,243,199,0.62)] text-[#9a5b00]',
  },
  {
    id: 'waiting_area',
    label: 'Aguardando área',
    activeClass: 'border-[rgba(8,115,145,0.2)] bg-[rgba(224,242,254,0.92)] text-[#0b6e8c]',
    inactiveClass: 'border-[rgba(8,115,145,0.16)] bg-white text-[#0b6e8c]',
    rowClass: 'bg-[rgba(8,115,145,0.82)]',
    surfaceClass: 'bg-[rgba(224,242,254,0.05)]',
    sectionClass: 'bg-[rgba(224,242,254,0.6)] text-[#0b6e8c]',
  },
  {
    id: 'completed',
    label: 'Concluídos',
    activeClass: 'border-[rgba(26,111,67,0.2)] bg-[rgba(220,252,231,0.9)] text-[var(--color-success)]',
    inactiveClass: 'border-[rgba(26,111,67,0.16)] bg-white text-[var(--color-success)]',
    rowClass: 'bg-[rgba(26,111,67,0.82)]',
    surfaceClass: 'bg-[rgba(220,252,231,0.05)]',
    sectionClass: 'bg-[rgba(220,252,231,0.58)] text-[var(--color-success)]',
  },
  {
    id: 'all',
    label: 'Ver todos',
    activeClass: 'border-slate-300 bg-slate-100 text-slate-900',
    inactiveClass: 'border-slate-200 bg-white text-slate-700',
    rowClass: 'bg-transparent',
    surfaceClass: 'bg-white',
  },
]

function compareText(left = '', right = '') {
  return String(left).localeCompare(String(right), 'pt-BR', { sensitivity: 'base' })
}

function buildDefaultFilters() {
  return {
    search: '',
    status: 'todos',
    polo: auth.mockContext.currentPolo,
    sla: 'todos',
    origin: 'todos',
    pending: 'todos',
    escalation: 'todos',
    operator: 'todos',
    bucket: 'all',
    sortField: 'sla',
    sortDirection: 'asc',
  }
}

function resetQueueDensityWindows() {
  flatVisibleCount.value = PAGE_INCREMENT

  for (const bucket of ['needs_action', 'waiting_student', 'waiting_area', 'completed']) {
    groupVisibleCounts[bucket] = PAGE_INCREMENT
  }
}

function loadPersistedQueueState() {
  if (typeof window === 'undefined') {
    return {
      filters: buildDefaultFilters(),
      scrollY: 0,
    }
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
    return {
      filters: buildDefaultFilters(),
      scrollY: 0,
    }
  }
}

const persistedState = loadPersistedQueueState()
const filters = reactive(persistedState.filters)

function applyRouteSearch(searchValue) {
  const normalizedSearch = String(searchValue || '').trim()

  if (!normalizedSearch) {
    return
  }

  filters.search = normalizedSearch
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

const operatorQueueEntries = computed(() => {
  refreshTick.value
  return studentSupportStore.operatorQueueEntries(auth.mockContext)
})
const filterOptions = computed(() => buildOperatorQueueFilterOptions(operatorQueueEntries.value))
const defaultFilters = computed(() => buildDefaultFilters())

const utilityFilteredEntries = computed(() =>
  filterOperatorQueueEntries(operatorQueueEntries.value, {
    ...filters,
    bucket: 'all',
  }),
)

const bucketFilteredEntries = computed(() => {
  if (filters.bucket === 'all') {
    return utilityFilteredEntries.value
  }

  return utilityFilteredEntries.value.filter((entry) => resolveQueueBucket(entry) === filters.bucket)
})

function compareEntries(left, right, field) {
  switch (field) {
    case 'protocol':
      return compareText(left.id, right.id)
    case 'subject':
      return compareText(left.subject, right.subject)
    case 'student':
      return compareText(left.student, right.student)
    case 'polo':
      return compareText(left.polo, right.polo)
    case 'ra':
      return compareText(left.studentRa, right.studentRa)
    case 'pending':
      return compareText(left.pendingLabel, right.pendingLabel)
    case 'status':
      return compareText(resolveOperationalStatus(left), resolveOperationalStatus(right))
    case 'sla':
      return left.sortTokens.slaMinutes - right.sortTokens.slaMinutes
    default:
      return 0
  }
}

function sortQueueEntries(entries) {
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

const orderedQueue = computed(() => sortQueueEntries(bucketFilteredEntries.value))
const visibleFlatQueue = computed(() => orderedQueue.value.slice(0, flatVisibleCount.value))
const hasMoreFlatQueue = computed(() => orderedQueue.value.length > flatVisibleCount.value)

const groupedQueueSections = computed(() =>
  bucketDefinitions
    .filter((bucket) => bucket.id !== 'all')
    .map((bucket) => {
      const entries = sortQueueEntries(
        utilityFilteredEntries.value.filter((entry) => resolveQueueBucket(entry) === bucket.id),
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
  if (!isManagerView.value) {
    return []
  }

  const badges = []

  if (filters.polo !== 'todos') {
    badges.push(`Escopo: polo ${filters.polo}`)
  }

  if (filters.operator !== 'todos') {
    badges.push(`Escopo: operador ${filters.operator}`)
  }

  if (!badges.length) {
    badges.push('Visão consolidada')
  }

  return badges
})

const quickBuckets = computed(() =>
  bucketDefinitions.map((bucket) => ({
    ...bucket,
    count:
      bucket.id === 'all'
        ? utilityFilteredEntries.value.length
        : utilityFilteredEntries.value.filter((entry) => resolveQueueBucket(entry) === bucket.id).length,
    active: filters.bucket === bucket.id,
  })),
)

const visibleQuickBuckets = computed(() =>
  quickBuckets.value.filter((bucket) => bucket.id === 'all' || bucket.count > 0),
)
function lookupFilterLabel(field, value) {
  if (!value || value === 'todos') {
    return ''
  }

  const options = filterOptions.value[field] || []
  return options.find((option) => option.value === value)?.label || value
}

const activeFilterChips = computed(() => {
  const chips = []

  if (filters.search.trim()) {
    chips.push({
      key: 'search',
      label: `Busca: ${filters.search.trim()}`,
    })
  }

  for (const field of ['status', 'sla', 'pending', 'escalation', 'polo', 'operator']) {
    if (filters[field] !== defaultFilters.value[field] && filters[field] !== 'todos') {
      const prefixMap = {
        status: 'Status',
        sla: 'Prazo',
        pending: 'Pendência',
        escalation: 'Escalonamento',
        polo: 'Polo',
        operator: 'Operador',
      }

      chips.push({
        key: field,
        label: `${prefixMap[field]}: ${lookupFilterLabel(field, filters[field])}`,
      })
    }
  }

  return chips
})

const activeFilterCount = computed(() => activeFilterChips.value.length)
const showPoloFilter = computed(() => isManagerView.value && filterOptions.value.polo.length > 2)
const showOperatorFilter = computed(() => isManagerView.value && filterOptions.value.operator.length > 2)

function clearOperationalFilters() {
  Object.assign(filters, buildDefaultFilters())
}

function clearFilterChip(key) {
  if (key === 'search') {
    filters.search = ''
    return
  }

  filters[key] = defaultFilters.value[key]
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
  filters.sortDirection = field === 'sla' ? 'asc' : 'asc'
}

function sortMarker(field) {
  sortIndicator(field)

  if (filters.sortField !== field) {
    return ''
  }

  return filters.sortDirection === 'asc' ? '^' : 'v'
}

function sortIndicator(field) {
  if (filters.sortField !== field) {
    return ''
  }

  return filters.sortDirection === 'asc' ? '↑' : '↓'
}

function ariaSort(field) {
  if (filters.sortField !== field) {
    return 'none'
  }

  return filters.sortDirection === 'asc' ? 'ascending' : 'descending'
}

function headerId(field) {
  return `operator-queue-col-${field}`
}

function buildCaseRoute(caseId) {
  persistQueueState()
  return `/op/fila/${caseId}`
}

function refreshQueue() {
  refreshTick.value = Date.now()
  persistQueueState()
}

function rowToneClass(entry) {
  const bucket = resolveQueueBucket(entry)
  return bucketDefinitions.find((item) => item.id === bucket)?.rowClass || 'border-l-[3px] border-l-transparent'
}

function rowSurfaceClass(entry) {
  const bucket = resolveQueueBucket(entry)
  return bucketDefinitions.find((item) => item.id === bucket)?.surfaceClass || 'bg-white'
}

function resolveOwnershipStateLabel(entry = {}) {
  if (entry?.operationalOwnerStateLabel) {
    return entry.operationalOwnerStateLabel
  }

  return entry?.hasOperationalOwnerError
    ? 'Responsável operacional ausente'
    : 'Responsável operacional definido'
}

function ownershipToneClass(entry = {}) {
  if (entry?.hasOperationalOwnerError) {
    return 'border-[rgba(166,31,40,0.24)] bg-[rgba(253,236,237,0.72)] text-[var(--color-danger)]'
  }

  return 'border-[rgba(26,111,67,0.2)] bg-[rgba(220,252,231,0.7)] text-[var(--color-success)]'
}

function sectionToneClass(bucketId) {
  return bucketDefinitions.find((item) => item.id === bucketId)?.sectionClass || 'bg-slate-50 text-slate-700'
}

function toggleGroupedSection(bucketId) {
  groupOpenState[bucketId] = !groupOpenState[bucketId]
}

function showMoreFlatQueue() {
  flatVisibleCount.value += PAGE_INCREMENT
}

function showMoreGroup(bucketId) {
  groupVisibleCounts[bucketId] += PAGE_INCREMENT
}

watch(
  filters,
  () => {
    resetQueueDensityWindows()
    persistQueueState()
  },
  { deep: true },
)

watch(
  () => auth.mockContext.currentPolo,
  (currentPolo) => {
    if (!isManagerView.value) {
      return
    }

    filters.polo = currentPolo
  },
)

async function loadLiveQueue() {
  if (isMockRuntimeEnabled()) return

  liveQueueLoading.value = true
  liveQueueMessage.value = ''
  try {
    const result = await listTickets({ page: 1, page_size: 100 })
    const protocols = (result.data || []).map(mapApiTicketToOperationalProtocol)
    studentSupportStore.replaceLiveTickets(protocols)
    refreshTick.value += 1
    if (Number(result.meta?.total || 0) > protocols.length) {
      liveQueueMessage.value = `Exibindo os ${protocols.length} atendimentos mais recentes de ${result.meta.total}.`
    }
  } catch (error) {
    liveQueueMessage.value = error?.message || 'Não foi possível carregar a fila institucional.'
  } finally {
    liveQueueLoading.value = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    flashMessage.value = window.sessionStorage.getItem(flashStorageKey.value) || ''
    window.sessionStorage.removeItem(flashStorageKey.value)
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
  }

  applyRouteSearch(route.query.search)
  restoreQueueScroll()
  void loadLiveQueue()
})

watch(
  () => route.query.search,
  (searchValue) => {
    applyRouteSearch(searchValue)
  },
)

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', handleWindowScroll)
  }
})
</script>

<template>
  <div class="grid gap-3">
    <div
      v-if="liveQueueLoading || liveQueueMessage"
      role="status"
      aria-live="polite"
      class="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
    >
      {{ liveQueueLoading ? 'Carregando fila institucional...' : liveQueueMessage }}
    </div>
    <div
      v-if="flashMessage"
      role="status"
      aria-live="polite"
      class="rounded-[8px] border border-[rgba(26,111,67,0.16)] bg-[rgba(26,111,67,0.08)] px-4 py-3 text-sm leading-6 text-[var(--color-success)]"
    >
      {{ flashMessage }}
    </div>

    <section class="rounded-[8px] border border-slate-200 bg-white px-4 py-4">
      <div class="flex flex-col gap-4">
        <div v-if="scopeBadges.length" class="flex flex-wrap items-center gap-2">
          <span
            v-for="badge in scopeBadges"
            :key="badge"
            class="rounded-full border border-[rgba(209,50,57,0.12)] bg-[rgba(209,50,57,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-dark)]"
          >
            {{ badge }}
          </span>
        </div>

        <div v-if="operatorQueueEntries.length" class="flex flex-wrap gap-2">
          <button
            v-for="bucket in visibleQuickBuckets"
            :key="bucket.id"
            type="button"
            :aria-pressed="bucket.active ? 'true' : 'false'"
            :class="[
              'inline-flex items-center gap-2 rounded-[8px] border px-4 py-2.5 text-sm font-semibold transition',
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
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
              placeholder="Protocolo, RA, aluno ou assunto"
            />
          </label>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="refreshQueue"
            >
              Atualizar
            </button>
            <button
              type="button"
              class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:hidden"
              @click="showMobileFilters = true"
            >
              Filtros<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span>
            </button>
            <button
              v-if="activeFilterCount || filters.bucket !== 'all'"
              type="button"
              class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="clearOperationalFilters"
            >
              Limpar
            </button>
          </div>
        </div>

        <div class="crm-filter-grid--dense hidden lg:grid gap-3">
          <label class="grid gap-2">
            <span class="text-xs font-semibold uppercase tracking-normal text-slate-500">Status</span>
            <select
              v-model="filters.status"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.status" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-semibold uppercase tracking-normal text-slate-500">Prazo</span>
            <select
              v-model="filters.sla"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.sla" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-semibold uppercase tracking-normal text-slate-500">Pendência</span>
            <select
              v-model="filters.pending"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.pending" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2">
            <span class="text-xs font-semibold uppercase tracking-normal text-slate-500">Escalonamento</span>
            <select
              v-model="filters.escalation"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
            >
              <option
                v-for="option in filterOptions.escalation"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label v-if="showPoloFilter" class="grid gap-2">
            <span class="text-xs font-semibold uppercase tracking-normal text-slate-500">Polo</span>
            <select
              v-model="filters.polo"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.polo" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label v-if="showOperatorFilter" class="grid gap-2">
            <span class="text-xs font-semibold uppercase tracking-normal text-slate-500">Operador</span>
            <select
              v-model="filters.operator"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.operator" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="activeFilterChips.length" class="flex flex-wrap gap-2">
          <button
            v-for="chip in activeFilterChips"
            :key="chip.key"
            type="button"
            :aria-label="`Remover filtro ${chip.label}`"
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
      aria-label="Fila operacional de atendimentos"
      class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white"
    >
      <div role="rowgroup" class="hidden border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:block">
        <div
          :class="[
            'gap-4 text-xs font-semibold text-slate-500 lg:grid',
            isManagerView
              ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]'
              : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,2.4fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]',
          ]"
          role="row"
        >
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
          <div
            v-if="isManagerView"
            :id="headerId('polo')"
            role="columnheader"
            :aria-sort="ariaSort('polo')"
          >
            <button
              type="button"
              class="text-left transition hover:text-slate-900"
              @click="toggleSort('polo')"
            >
              Polo <span aria-hidden="true">{{ sortMarker('polo') }}</span>
            </button>
          </div>
          <div :id="headerId('subject')" role="columnheader" :aria-sort="ariaSort('subject')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('subject')">
              Assunto <span aria-hidden="true">{{ sortMarker('subject') }}</span>
            </button>
          </div>
          <div :id="headerId('pending')" role="columnheader" :aria-sort="ariaSort('pending')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('pending')">
              Pendência atual <span aria-hidden="true">{{ sortMarker('pending') }}</span>
            </button>
          </div>
          <div :id="headerId('protocol')" role="columnheader" :aria-sort="ariaSort('protocol')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('protocol')">
              Protocolo <span aria-hidden="true">{{ sortMarker('protocol') }}</span>
            </button>
          </div>
          <div :id="headerId('status')" role="columnheader" :aria-sort="ariaSort('status')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('status')">
              Status <span aria-hidden="true">{{ sortMarker('status') }}</span>
            </button>
          </div>
          <div :id="headerId('sla')" role="columnheader" :aria-sort="ariaSort('sla')">
            <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('sla')">
              Prazo de resposta <span aria-hidden="true">{{ sortMarker('sla') }}</span>
            </button>
          </div>
          <div :id="headerId('action')" role="columnheader" class="text-right">Ação</div>
        </div>
      </div>

      <template v-if="filters.bucket === 'all'">
        <div class="divide-y divide-slate-200">
          <section
            v-for="bucket in groupedQueueSections"
            :key="bucket.id"
            class="bg-white"
          >
            <button
              type="button"
              :aria-expanded="groupOpenState[bucket.id] ? 'true' : 'false'"
              :aria-controls="`queue-group-${bucket.id}`"
              :class="['flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold', sectionToneClass(bucket.id)]"
              @click="toggleGroupedSection(bucket.id)"
            >
              <div class="flex items-center gap-3">
                <span class="h-2.5 w-2.5 rounded-full bg-current"></span>
                <span>{{ bucket.label }}</span>
                <span class="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {{ bucket.entries.length }}
                </span>
              </div>
              <span class="text-xs font-semibold text-slate-500">
                {{ groupOpenState[bucket.id] ? 'Ocultar' : 'Mostrar' }}
              </span>
            </button>

            <div
              v-if="groupOpenState[bucket.id]"
              :id="`queue-group-${bucket.id}`"
              role="rowgroup"
              class="divide-y divide-slate-200"
            >
              <article
                v-for="item in bucket.visibleEntries"
                :key="item.id"
                role="row"
                :class="['grid grid-cols-[6px_minmax(0,1fr)]', rowSurfaceClass(item)]"
              >
                <div :class="rowToneClass(item)" aria-hidden="true"></div>
                <div class="px-4 py-3">
                  <div
                    :class="[
                      'hidden gap-4 lg:grid lg:items-center',
                      isManagerView
                        ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]'
                        : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,2.4fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]',
                    ]"
                  >
                    <div class="min-w-0" role="cell" :aria-labelledby="headerId('student')">
                      <p class="truncate text-sm font-medium leading-5 text-slate-900">{{ item.student }}</p>
                    </div>
                    <div class="min-w-0" role="cell" :aria-labelledby="headerId('ra')">
                      <p class="truncate text-sm leading-5 text-slate-700">{{ item.studentRa || 'Não informado' }}</p>
                    </div>
                    <div v-if="isManagerView" class="min-w-0" role="cell" :aria-labelledby="headerId('polo')">
                      <p class="truncate text-sm leading-5 text-slate-700">{{ item.polo }}</p>
                    </div>
                    <div class="min-w-0" role="cell" :aria-labelledby="headerId('subject')">
                      <p class="truncate text-sm font-semibold leading-5 text-slate-950">{{ item.subject }}</p>
                    </div>
                    <div class="min-w-0" role="cell" :aria-labelledby="headerId('pending')">
                      <p class="line-clamp-2 text-sm leading-5 text-slate-900">{{ item.pendingLabel }}</p>
                      <div class="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          :class="[
                            'rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-normal',
                            ownershipToneClass(item),
                          ]"
                        >
                          {{ resolveOwnershipStateLabel(item) }}
                        </span>
                      </div>
                    </div>
                    <div class="min-w-0" role="cell" :aria-labelledby="headerId('protocol')">
                      <p class="truncate text-xs font-medium leading-5 text-slate-600">{{ item.id }}</p>
                      <p class="mt-1 text-[0.7rem] leading-5 text-slate-500">
                        Responsável: {{ item.operationalOwnerLabel || 'Não resolvido' }}
                      </p>
                    </div>
                    <div class="min-w-0" role="cell" :aria-labelledby="headerId('status')">
                      <StatusBadge :label="resolveOperationalStatus(item)" />
                    </div>
                    <div class="min-w-0" role="cell" :aria-labelledby="headerId('sla')">
                      <SlaBadge v-if="shouldShowResponseDeadline(item)" :label="item.sla" />
                    </div>
                    <div class="justify-self-end" role="cell" :aria-labelledby="headerId('action')">
                      <RouterLink
                        :to="buildCaseRoute(item.id)"
                        class="inline-flex items-center justify-center rounded-[8px] bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                      >
                        Abrir
                      </RouterLink>
                    </div>
                  </div>

                  <div class="grid gap-2.5 lg:hidden">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0 flex-1">
                        <p class="text-base font-semibold leading-6 text-slate-950">{{ item.subject }}</p>
                        <p class="mt-1 text-sm leading-5 text-slate-600">{{ item.student }}</p>
                        <p class="mt-1 text-xs leading-5 text-slate-500">RA {{ item.studentRa || 'Não informado' }} | {{ item.id }}</p>
                      </div>

                      <RouterLink
                        :to="buildCaseRoute(item.id)"
                        class="inline-flex items-center justify-center rounded-[8px] bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                      >
                        Abrir
                      </RouterLink>
                    </div>

                    <p class="text-sm leading-5 text-slate-900">{{ item.pendingLabel }}</p>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <span
                        :class="[
                          'rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-normal',
                          ownershipToneClass(item),
                        ]"
                      >
                        {{ resolveOwnershipStateLabel(item) }}
                      </span>
                      <span class="text-[0.72rem] text-slate-500">Responsável: {{ item.operationalOwnerLabel || 'Não resolvido' }}</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <StatusBadge :label="resolveOperationalStatus(item)" />
                      <SlaBadge v-if="shouldShowResponseDeadline(item)" :label="item.sla" />
                    </div>
                  </div>
                </div>
              </article>

              <div v-if="bucket.hasMore" class="px-4 py-3">
                <button
                  type="button"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  @click="showMoreGroup(bucket.id)"
                >
                  Mostrar mais {{ bucket.label.toLowerCase() }}
                </button>
              </div>
            </div>
          </section>
        </div>
      </template>

      <div v-else role="rowgroup" class="divide-y divide-slate-200">
        <article
          v-for="item in visibleFlatQueue"
          :key="item.id"
          role="row"
          :class="['grid grid-cols-[6px_minmax(0,1fr)]', rowSurfaceClass(item)]"
        >
          <div :class="rowToneClass(item)" aria-hidden="true"></div>
          <div class="px-4 py-3">
            <div
              :class="[
                'hidden gap-4 lg:grid lg:items-center',
                isManagerView
                  ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]'
                  : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,2.4fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]',
              ]"
            >
              <div class="min-w-0" role="cell" :aria-labelledby="headerId('student')">
                <p class="truncate text-sm font-medium leading-5 text-slate-900">{{ item.student }}</p>
              </div>

              <div class="min-w-0" role="cell" :aria-labelledby="headerId('ra')">
                <p class="truncate text-sm leading-5 text-slate-700">{{ item.studentRa || 'Não informado' }}</p>
              </div>

              <div v-if="isManagerView" class="min-w-0" role="cell" :aria-labelledby="headerId('polo')">
                <p class="truncate text-sm leading-5 text-slate-700">{{ item.polo }}</p>
              </div>

              <div class="min-w-0" role="cell" :aria-labelledby="headerId('subject')">
                <p class="truncate text-sm font-semibold leading-5 text-slate-950">{{ item.subject }}</p>
              </div>

              <div class="min-w-0" role="cell" :aria-labelledby="headerId('pending')">
                <p class="line-clamp-2 text-sm leading-5 text-slate-900">{{ item.pendingLabel }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    :class="[
                      'rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-normal',
                      ownershipToneClass(item),
                    ]"
                  >
                    {{ resolveOwnershipStateLabel(item) }}
                  </span>
                </div>
              </div>

              <div class="min-w-0" role="cell" :aria-labelledby="headerId('protocol')">
                <p class="truncate text-xs font-medium leading-5 text-slate-600">{{ item.id }}</p>
                <p class="mt-1 text-[0.7rem] leading-5 text-slate-500">
                  Responsável: {{ item.operationalOwnerLabel || 'Não resolvido' }}
                </p>
              </div>

              <div class="min-w-0" role="cell" :aria-labelledby="headerId('status')">
                <StatusBadge :label="resolveOperationalStatus(item)" />
              </div>

              <div class="min-w-0" role="cell" :aria-labelledby="headerId('sla')">
                <SlaBadge v-if="shouldShowResponseDeadline(item)" :label="item.sla" />
              </div>

              <div class="justify-self-end" role="cell" :aria-labelledby="headerId('action')">
                <RouterLink
                  :to="buildCaseRoute(item.id)"
                  class="inline-flex items-center justify-center rounded-[8px] bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                >
                  Abrir
                </RouterLink>
              </div>
            </div>

            <div class="grid gap-2.5 lg:hidden">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-base font-semibold leading-6 text-slate-950">{{ item.subject }}</p>
                  <p class="mt-1 text-sm leading-5 text-slate-600">{{ item.student }}</p>
                  <p class="mt-1 text-xs leading-5 text-slate-500">RA {{ item.studentRa || 'Não informado' }} | {{ item.id }}</p>
                </div>

                <RouterLink
                  :to="buildCaseRoute(item.id)"
                  class="inline-flex items-center justify-center rounded-[8px] bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
                >
                  Abrir
                </RouterLink>
              </div>

              <p class="text-sm leading-5 text-slate-900">{{ item.pendingLabel }}</p>
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  :class="[
                    'rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-normal',
                    ownershipToneClass(item),
                  ]"
                >
                  {{ resolveOwnershipStateLabel(item) }}
                </span>
                <span class="text-[0.72rem] text-slate-500">Responsável: {{ item.operationalOwnerLabel || 'Não resolvido' }}</span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge :label="resolveOperationalStatus(item)" />
                <SlaBadge v-if="shouldShowResponseDeadline(item)" :label="item.sla" />
              </div>
            </div>
          </div>
        </article>

        <div v-if="hasMoreFlatQueue" class="px-4 py-3">
          <button
            type="button"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            @click="showMoreFlatQueue"
          >
            Carregar mais atendimentos
          </button>
        </div>
      </div>
    </section>

    <div v-else role="status" aria-live="polite" class="rounded-[8px] border border-slate-200 bg-white px-6 py-6">
      <p class="text-xs font-semibold tracking-normal text-slate-500">
        Nenhum atendimento encontrado
      </p>
      <h3 class="mt-3 text-2xl font-semibold text-slate-950">
        Nenhum atendimento corresponde aos filtros.
      </h3>
      <p class="mt-3 text-sm leading-7 text-slate-600">
        Limpe os filtros ou faça uma nova busca.
      </p>
      <button
        v-if="activeFilterCount || filters.bucket !== 'all'"
        type="button"
        class="mt-4 rounded-[8px] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        @click="clearOperationalFilters"
      >
        Limpar filtros
      </button>
    </div>

    <div
      v-if="showMobileFilters"
      class="fixed inset-0 z-[80] bg-slate-950/35 lg:hidden"
      @click.self="showMobileFilters = false"
    >
      <div class="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[8px] bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold tracking-normal text-slate-500">Filtros</p>
            <h3 class="mt-2 text-xl font-semibold text-slate-950">Refinar atendimentos</h3>
          </div>
          <button
            type="button"
            class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            @click="showMobileFilters = false"
          >
            Fechar
          </button>
        </div>

        <div class="mt-4 grid gap-4">
          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Status</span>
            <select
              v-model="filters.status"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.status" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Prazo de resposta</span>
            <select
              v-model="filters.sla"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.sla" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Pendência</span>
            <select
              v-model="filters.pending"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.pending" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Escalonamento</span>
            <select
              v-model="filters.escalation"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <option
                v-for="option in filterOptions.escalation"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label v-if="showPoloFilter" class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Polo</span>
            <select
              v-model="filters.polo"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.polo" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label v-if="showOperatorFilter" class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Operador</span>
            <select
              v-model="filters.operator"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.operator" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div class="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="rounded-[8px] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
            @click="showMobileFilters = false"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            @click="clearOperationalFilters"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
