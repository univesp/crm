<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  buildOperatorQueueFilterOptions,
  filterOperatorQueueEntries,
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

const bucketDefinitions = [
  {
    id: 'needs_action',
    label: 'Precisa da minha acao',
    activeClass: 'border-[rgba(166,31,40,0.22)] bg-[rgba(253,236,237,0.88)] text-[var(--color-danger)]',
    inactiveClass: 'border-[rgba(166,31,40,0.16)] bg-white text-[var(--color-danger)]',
    rowClass: 'bg-[rgba(166,31,40,0.82)]',
    surfaceClass: 'bg-[rgba(253,236,237,0.14)]',
  },
  {
    id: 'waiting_student',
    label: 'Aguardando aluno',
    activeClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.92)] text-[#9a5b00]',
    inactiveClass: 'border-[rgba(202,138,4,0.16)] bg-white text-[#9a5b00]',
    rowClass: 'bg-[rgba(202,138,4,0.82)]',
    surfaceClass: 'bg-[rgba(254,243,199,0.12)]',
  },
  {
    id: 'waiting_area',
    label: 'Aguardando area',
    activeClass: 'border-[rgba(8,115,145,0.2)] bg-[rgba(224,242,254,0.92)] text-[#0b6e8c]',
    inactiveClass: 'border-[rgba(8,115,145,0.16)] bg-white text-[#0b6e8c]',
    rowClass: 'bg-[rgba(8,115,145,0.82)]',
    surfaceClass: 'bg-[rgba(224,242,254,0.12)]',
  },
  {
    id: 'completed',
    label: 'Concluidos',
    activeClass: 'border-[rgba(26,111,67,0.2)] bg-[rgba(220,252,231,0.9)] text-[var(--color-success)]',
    inactiveClass: 'border-[rgba(26,111,67,0.16)] bg-white text-[var(--color-success)]',
    rowClass: 'bg-[rgba(26,111,67,0.82)]',
    surfaceClass: 'bg-[rgba(220,252,231,0.10)]',
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

const bucketOrder = {
  needs_action: 0,
  waiting_student: 1,
  waiting_area: 2,
  completed: 3,
  all: 4,
}

function normalizeText(value = '') {
  return String(value).trim().toLowerCase()
}

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

function resolveQueueBucket(entry) {
  const status = normalizeText(entry.status)
  const pending = normalizeText(entry.pendingLabel)

  if (status.includes('faq') || status.includes('respondido') || status.includes('conclu')) {
    return 'completed'
  }

  if (
    status.includes('complement') ||
    pending.includes('complement') ||
    pending.includes('anexo') ||
    pending.includes('aluno precisa')
  ) {
    return 'waiting_student'
  }

  if (
    status.includes('retorno da area') ||
    status.includes('escalado') ||
    pending.includes('secretaria') ||
    pending.includes('area')
  ) {
    return 'waiting_area'
  }

  return 'needs_action'
}

function resolveOperationalStatus(entry) {
  const status = normalizeText(entry.status)
  const bucket = resolveQueueBucket(entry)
  const sla = normalizeText(entry.sla)

  if (status.includes('faq')) {
    return 'Respondido FAQ'
  }

  if (status.includes('respondido') || status.includes('leitura do aluno')) {
    return 'Respondido OP'
  }

  if (sla.includes('vencid')) {
    return 'Atrasado'
  }

  if (bucket === 'waiting_student') {
    return 'Aguardando aluno'
  }

  if (bucket === 'waiting_area') {
    return 'Aguardando area'
  }

  if (status.includes('prioridade maxima') || entry.slaState === 'Em risco') {
    return 'Urgente'
  }

  if (status.includes('validacao')) {
    return 'Em andamento'
  }

  return 'Pendente'
}

function shouldShowResponseDeadline(entry) {
  return resolveQueueBucket(entry) !== 'waiting_student'
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
  filters.bucket = 'all'
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

const orderedQueue = computed(() => {
  const direction = filters.sortDirection === 'desc' ? -1 : 1
  const field = filters.sortField || 'sla'

  return [...bucketFilteredEntries.value].sort((left, right) => {
    if (filters.bucket === 'all') {
      const leftBucketOrder = bucketOrder[resolveQueueBucket(left)] ?? Number.MAX_SAFE_INTEGER
      const rightBucketOrder = bucketOrder[resolveQueueBucket(right)] ?? Number.MAX_SAFE_INTEGER

      if (leftBucketOrder !== rightBucketOrder) {
        return leftBucketOrder - rightBucketOrder
      }
    }

    const primary = compareEntries(left, right, field)

    if (primary !== 0) {
      return primary * direction
    }

    return compareEntries(left, right, 'sla')
  })
})

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
    badges.push('Visao consolidada')
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
        pending: 'Pendencia',
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

watch(
  filters,
  () => {
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

onMounted(() => {
  if (typeof window !== 'undefined') {
    flashMessage.value = window.sessionStorage.getItem(flashStorageKey.value) || ''
    window.sessionStorage.removeItem(flashStorageKey.value)
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
  }

  applyRouteSearch(route.query.search)
  restoreQueueScroll()
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
      v-if="flashMessage"
      class="rounded-[16px] border border-[rgba(26,111,67,0.16)] bg-[rgba(26,111,67,0.08)] px-4 py-3 text-sm leading-6 text-[var(--color-success)]"
    >
      {{ flashMessage }}
    </div>

    <section class="rounded-[16px] border border-slate-200 bg-white px-4 py-4">
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

        <div class="flex flex-wrap gap-2">
          <button
            v-for="bucket in quickBuckets"
            :key="bucket.id"
            type="button"
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
              placeholder="Protocolo, RA, aluno ou assunto"
            />
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
              type="button"
              class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:hidden"
              @click="showMobileFilters = true"
            >
              Filtros<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span>
            </button>
            <button
              v-if="activeFilterCount || filters.bucket !== 'all'"
              type="button"
              class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="clearOperationalFilters"
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
      </div>
    </section>

    <section
      v-if="orderedQueue.length"
      class="overflow-hidden rounded-[16px] border border-slate-200 bg-white"
    >
      <div
        :class="[
          'hidden gap-4 border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-500 lg:grid',
          isManagerView
            ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]'
            : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,2.4fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]',
        ]"
      >
        <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('student')">
          Aluno <span>{{ sortMarker('student') }}</span>
        </button>
        <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('ra')">
          RA <span>{{ sortMarker('ra') }}</span>
        </button>
        <button
          v-if="isManagerView"
          type="button"
          class="text-left transition hover:text-slate-900"
          @click="toggleSort('polo')"
        >
          Polo <span>{{ sortMarker('polo') }}</span>
        </button>
        <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('subject')">
          Assunto <span>{{ sortMarker('subject') }}</span>
        </button>
        <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('pending')">
          Pendencia atual <span>{{ sortMarker('pending') }}</span>
        </button>
        <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('protocol')">
          Protocolo <span>{{ sortMarker('protocol') }}</span>
        </button>
        <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('status')">
          Status <span>{{ sortMarker('status') }}</span>
        </button>
        <button type="button" class="text-left transition hover:text-slate-900" @click="toggleSort('sla')">
          Prazo de resposta <span>{{ sortMarker('sla') }}</span>
        </button>
        <p class="text-right">Acao</p>
      </div>

      <div class="divide-y divide-slate-200">
        <article
          v-for="item in orderedQueue"
          :key="item.id"
          :class="['grid grid-cols-[6px_minmax(0,1fr)]', rowSurfaceClass(item)]"
        >
          <div :class="rowToneClass(item)" aria-hidden="true"></div>
          <div class="px-4 py-4">
            <div
              :class="[
                'hidden gap-4 lg:grid lg:items-start',
                isManagerView
                  ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,2.3fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]'
                  : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,2.4fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.15fr)_minmax(0,1fr)_auto]',
              ]"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium leading-6 text-slate-900">{{ item.student }}</p>
              </div>

              <div class="min-w-0">
                <p class="text-sm leading-6 text-slate-700">{{ item.studentRa || 'Nao informado' }}</p>
              </div>

              <div v-if="isManagerView" class="min-w-0">
                <p class="text-sm leading-6 text-slate-700">{{ item.polo }}</p>
              </div>

              <div class="min-w-0">
                <p class="text-sm font-semibold leading-6 text-slate-950">{{ item.subject }}</p>
              </div>

              <div class="min-w-0">
                <p class="text-sm leading-6 text-slate-900">{{ item.pendingLabel }}</p>
              </div>

              <div class="min-w-0">
                <p class="text-sm leading-6 text-slate-700">{{ item.id }}</p>
              </div>

              <div class="min-w-0">
                <StatusBadge :label="resolveOperationalStatus(item)" />
              </div>

              <div class="min-w-0">
                <SlaBadge v-if="shouldShowResponseDeadline(item)" :label="item.sla" />
              </div>

              <div class="justify-self-end">
                <RouterLink
                  :to="buildCaseRoute(item.id)"
                  class="inline-flex items-center justify-center rounded-[14px] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(209,50,57,0.14)]"
                >
                  Abrir
                </RouterLink>
              </div>
            </div>

            <div class="grid gap-3 lg:hidden">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-base font-semibold leading-6 text-slate-950">{{ item.subject }}</p>
                  <p class="mt-1 text-sm leading-6 text-slate-600">{{ item.student }}</p>
                  <p class="mt-1 text-xs leading-5 text-slate-500">RA {{ item.studentRa || 'Nao informado' }} | {{ item.id }}</p>
                </div>

                <RouterLink
                  :to="buildCaseRoute(item.id)"
                  class="inline-flex items-center justify-center rounded-[14px] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(209,50,57,0.14)]"
                >
                  Abrir
                </RouterLink>
              </div>

              <p class="text-sm leading-6 text-slate-900">{{ item.pendingLabel }}</p>

              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge :label="resolveOperationalStatus(item)" />
                <SlaBadge v-if="shouldShowResponseDeadline(item)" :label="item.sla" />
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <div v-else class="rounded-[16px] border border-slate-200 bg-white px-6 py-6">
      <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">
        Nenhum atendimento encontrado
      </p>
      <h3 class="mt-3 text-2xl font-semibold text-slate-950">
        O recorte atual nao retornou itens operacionais.
      </h3>
      <p class="mt-3 text-sm leading-7 text-slate-600">
        Ajuste busca ou bucket para retomar a leitura da fila.
      </p>
    </div>

    <div
      v-if="showMobileFilters"
      class="fixed inset-0 z-[80] bg-slate-950/35 lg:hidden"
      @click.self="showMobileFilters = false"
    >
      <div class="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] bg-white p-4 shadow-[0_-18px_48px_rgba(16,18,20,0.14)]">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">Filtros</p>
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
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
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
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
            >
              <option v-for="option in filterOptions.sla" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-semibold text-slate-700">Pendencia</span>
            <select
              v-model="filters.pending"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
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
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
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
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
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
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
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
            class="rounded-[14px] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white"
            @click="showMobileFilters = false"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            @click="clearOperationalFilters"
          >
            Limpar filtros
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
