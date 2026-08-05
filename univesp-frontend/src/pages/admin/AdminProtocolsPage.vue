<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { RouterLink } from 'vue-router'

import PriorityBadge from '@/components/PriorityBadge.vue'
import SlaBadge from '@/components/SlaBadge.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AsyncPanel from '@/components/ui/AsyncPanel.vue'
import SgpButton from '@/components/ui/SgpButton.vue'
import { buildProtocolListQuery, createProtocolFilterState } from '@/composables/useProtocolSearch.js'
import { useAsyncAction } from '@/composables/useAsyncAction'
import {
  buildProtocolFilterOptions,
  filterProtocolEntries,
  mapTicketListRow,
  paginateEntries,
} from '@/services/protocolDirectoryRuntime'
import { isMockRuntimeEnabled, listTickets } from '@/services/appApi'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const { loading, error, run } = useAsyncAction()

const filters = createProtocolFilterState()
const listState = reactive({
  rows: [],
  total: 0,
  totalPages: 1,
  serverPaginated: false,
})

const dashboardData = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))
const filterOptions = computed(() => buildProtocolFilterOptions(listState.rows))

async function loadProtocols() {
  await run(async () => {
    if (isMockRuntimeEnabled()) {
      const entries = dashboardData.value.activeCases || []
      const filtered = filterProtocolEntries(entries, filters)
      const page = paginateEntries(filtered, filters.page, filters.pageSize)
      listState.rows = page.items
      listState.total = page.total
      listState.totalPages = page.totalPages
      listState.serverPaginated = false
      return page
    }

    const response = await listTickets(buildProtocolListQuery(filters))
    const batch = Array.isArray(response.data) ? response.data.map(mapTicketListRow) : []
    const filtered = filterProtocolEntries(batch, filters)
    listState.serverPaginated = true
    listState.total = Number(response.meta?.total || filtered.length)
    listState.totalPages = Math.max(1, Math.ceil(listState.total / filters.pageSize))
    listState.rows = filtered.length !== batch.length ? filtered : batch
    return response
  }, {
    errorFallback: 'Não foi possível carregar os protocolos. Tente novamente.',
  })
}

function applyFilters() {
  filters.page = 1
  loadProtocols()
}

function resetFilters() {
  filters.search = ''
  filters.student = ''
  filters.polo = ''
  filters.theme = ''
  filters.queue = ''
  filters.criticality = ''
  filters.status = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.page = 1
  filters.pageSize = 25
  applyFilters()
}

function goToPage(nextPage) {
  filters.page = Math.min(Math.max(1, nextPage), listState.totalPages)
  loadProtocols()
}

onMounted(loadProtocols)

watch(
  () => auth.mockContext.currentPolo,
  () => {
    if (isMockRuntimeEnabled() && filters.polo === '') {
      loadProtocols()
    }
  },
)
</script>

<template>
  <div class="grid gap-5">
    <section class="surface-panel p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Diretório institucional</p>
          <h2 class="mt-2 text-xl font-semibold text-slate-950">Protocolos</h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Combine aluno, polo, período, assunto, fila, criticidade e status. Use os filtros desta página
            para localizar o protocolo no escopo atual.
          </p>
        </div>
      </div>
    </section>

    <section class="inner-panel p-5">
      <form class="grid gap-4 xl:grid-cols-4" @submit.prevent="applyFilters">
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Busca</span>
          <input
            v-model="filters.search"
            type="search"
            placeholder="Protocolo, aluno, RA ou e-mail"
            class="rounded-ui border border-slate-200 px-3 py-2"
          />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Polo</span>
          <select v-model="filters.polo" class="rounded-ui border border-slate-200 px-3 py-2">
            <option value="">Todos</option>
            <option v-for="polo in filterOptions.polos" :key="polo" :value="polo">{{ polo }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Assunto / tema</span>
          <select v-model="filters.theme" class="rounded-ui border border-slate-200 px-3 py-2">
            <option value="">Todos</option>
            <option v-for="theme in filterOptions.themes" :key="theme" :value="theme">{{ theme }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Fila</span>
          <select v-model="filters.queue" class="rounded-ui border border-slate-200 px-3 py-2">
            <option value="">Todas</option>
            <option v-for="queue in filterOptions.queues" :key="queue" :value="queue">{{ queue }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Criticidade</span>
          <select v-model="filters.criticality" class="rounded-ui border border-slate-200 px-3 py-2">
            <option value="">Todas</option>
            <option
              v-for="criticality in filterOptions.criticalities"
              :key="criticality"
              :value="criticality"
            >
              {{ criticality }}
            </option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Status</span>
          <select v-model="filters.status" class="rounded-ui border border-slate-200 px-3 py-2">
            <option value="">Todos</option>
            <option v-for="status in filterOptions.statuses" :key="status" :value="status">{{ status }}</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Período — início</span>
          <input v-model="filters.dateFrom" type="date" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Período — fim</span>
          <input v-model="filters.dateTo" type="date" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <div class="flex items-end gap-2 xl:col-span-4">
          <SgpButton type="submit" :loading="loading">Aplicar filtros</SgpButton>
          <SgpButton
            variant="secondary"
            type="button"
            @click="resetFilters"
          >
            Limpar
          </SgpButton>
        </div>
      </form>
    </section>

    <AsyncPanel
      :loading="loading"
      :error="error"
      :is-empty="!listState.rows.length"
      loading-message="Buscando protocolos…"
      empty-title="Nenhum protocolo encontrado"
      empty-message="Ajuste os filtros ou confirme se o protocolo existe no escopo atual."
      empty-next-step="Use os filtros desta página para localizar o protocolo no escopo atual."
      @retry="loadProtocols"
    >
      <section class="grid gap-3">
        <article
          v-for="row in listState.rows"
          :key="row.id"
          class="inner-panel p-4 transition hover:-translate-y-0.5"
        >
          <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p class="text-xs font-semibold text-slate-500">{{ row.protocolNumber || row.id }}</p>
              <h3 class="mt-2 text-base font-semibold text-slate-950">{{ row.subject }}</h3>
              <p class="mt-1 text-xs text-slate-600">
                {{ row.student || row.studentData?.nome }} - Polo {{ row.polo }} - {{ row.theme }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <PriorityBadge :priority="row.priorityLabel || row.criticality" />
              <StatusBadge :label="row.status || row.statusLabel" />
              <SlaBadge :label="row.sla || row.slaLabel || 'SLA não calculado'" />
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <RouterLink
              :to="{ name: 'admin-protocol-detail', params: { protocolId: row.protocolNumber || row.id } }"
              class="button button-secondary button-compact"
            >
              Abrir detalhe
            </RouterLink>
          </div>
        </article>
      </section>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-600">
          {{ listState.total }} protocolo(s)
          <span v-if="listState.serverPaginated"> — página {{ filters.page }} de {{ listState.totalPages }}</span>
        </p>
        <div class="flex gap-2">
          <SgpButton
            variant="secondary"
            compact
            :disabled="filters.page <= 1 || loading"
            @click="goToPage(filters.page - 1)"
          >
            Anterior
          </SgpButton>
          <SgpButton
            variant="secondary"
            compact
            :disabled="filters.page >= listState.totalPages || loading"
            @click="goToPage(filters.page + 1)"
          >
            Próxima
          </SgpButton>
        </div>
      </div>
    </AsyncPanel>
  </div>
</template>
