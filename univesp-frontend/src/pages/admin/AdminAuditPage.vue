<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import StatusBadge from '@/components/StatusBadge.vue'
import AsyncPanel from '@/components/ui/AsyncPanel.vue'
import SgpButton from '@/components/ui/SgpButton.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { isMockRuntimeEnabled, listTicketAudit } from '@/services/appApi'
import {
  buildMockAuditPage,
  buildTicketAuditQuery,
  filterAuditEntriesLocally,
  mapApiAuditRow,
} from '@/services/ticketAuditRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const { loading, error, run } = useAsyncAction()

const filters = reactive({
  search: String(route.query.protocol || route.query.q || ''),
  polo: '',
  theme: '',
  queue: '',
  actionType: '',
  actor: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  pageSize: 25,
})

const listState = reactive({
  rows: [],
  total: 0,
  totalPages: 1,
  serverPaginated: false,
})

const dashboardData = computed(() => studentSupportStore.adminDashboardData(auth.mockContext))

async function loadAudit() {
  await run(async () => {
    if (isMockRuntimeEnabled()) {
      const page = buildMockAuditPage({
        dashboardData: dashboardData.value,
        filters,
        page: filters.page,
        pageSize: filters.pageSize,
      })
      listState.rows = page.items
      listState.total = page.total
      listState.totalPages = page.totalPages
      listState.serverPaginated = false
      return page
    }

    const response = await listTicketAudit(buildTicketAuditQuery(filters))
    const batch = Array.isArray(response.data) ? response.data.map(mapApiAuditRow) : []
    const filtered = filterAuditEntriesLocally(batch, filters)
    listState.serverPaginated = true
    listState.total = Number(response.meta?.total || filtered.length)
    listState.totalPages = Math.max(1, Math.ceil(listState.total / filters.pageSize))
    listState.rows = filtered.length !== batch.length ? filtered : batch
    return response
  }, {
    errorFallback: 'Nao foi possivel carregar a auditoria operacional.',
  })
}

function applyFilters() {
  filters.page = 1
  loadAudit()
}

function goToPage(nextPage) {
  filters.page = Math.min(Math.max(1, nextPage), listState.totalPages)
  loadAudit()
}

onMounted(loadAudit)

watch(
  () => route.query.protocol,
  (protocol) => {
    filters.search = String(protocol || route.query.q || '')
    applyFilters()
  },
)
</script>

<template>
  <div class="grid gap-5">
    <section class="surface-panel p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Auditoria operacional</p>
          <h2 class="mt-2 text-xl font-semibold text-slate-950">Analise avancada e auditoria</h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Consulta paginada de movimentacoes auditaveis por protocolo, aluno, polo, periodo, ator e tipo de acao.
          </p>
        </div>
        <SgpButton variant="secondary" to="/admin/protocolos">Voltar aos protocolos</SgpButton>
      </div>
    </section>

    <section class="inner-panel p-5">
      <form class="grid gap-4 xl:grid-cols-4" @submit.prevent="applyFilters">
        <label class="grid gap-1 text-sm xl:col-span-2">
          <span class="font-semibold text-slate-700">Busca</span>
          <input
            v-model="filters.search"
            type="search"
            placeholder="Protocolo, aluno, assunto ou ator"
            class="rounded-ui border border-slate-200 px-3 py-2"
          />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Polo</span>
          <input v-model="filters.polo" type="text" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Tema</span>
          <input v-model="filters.theme" type="text" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Fila</span>
          <input v-model="filters.queue" type="text" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Tipo de acao</span>
          <input v-model="filters.actionType" type="text" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Ator</span>
          <input v-model="filters.actor" type="text" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Periodo - inicio</span>
          <input v-model="filters.dateFrom" type="date" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Periodo - fim</span>
          <input v-model="filters.dateTo" type="date" class="rounded-ui border border-slate-200 px-3 py-2" />
        </label>
        <div class="flex items-end gap-2 xl:col-span-4">
          <SgpButton type="submit" :loading="loading">Aplicar filtros</SgpButton>
        </div>
      </form>
    </section>

    <AsyncPanel
      :loading="loading"
      :error="error"
      :is-empty="!listState.rows.length"
      loading-message="Carregando auditoria..."
      empty-title="Nenhuma movimentacao encontrada"
      empty-message="Ajuste os filtros ou confirme se o protocolo possui eventos auditaveis."
      empty-next-step="Abra um protocolo no diretorio e use o atalho de auditoria do caso."
      @retry="loadAudit"
    >
      <section class="grid gap-3">
        <article
          v-for="entry in listState.rows"
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
              <p class="mt-1 text-xs text-slate-600">{{ entry.actor }} - {{ entry.occurredAtLabel || entry.occurredAt }}</p>
              <p class="mt-0.5 text-xs text-slate-600">
                {{ entry.student }} - Polo {{ entry.polo }} - {{ entry.theme }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <StatusBadge :label="entry.criticality" />
              <StatusBadge :label="entry.queueAfter" />
            </div>
          </div>
          <div class="mt-3 grid gap-2 md:grid-cols-2">
            <div class="rounded-ui bg-slate-50 px-3 py-2">
              <p class="text-xs font-semibold text-slate-400">Antes</p>
              <p class="mt-1 text-xs font-semibold text-slate-900">{{ entry.statusBefore }}</p>
              <p class="mt-0.5 text-xs text-slate-500">{{ entry.queueBefore }}</p>
            </div>
            <div class="rounded-ui bg-slate-50 px-3 py-2">
              <p class="text-xs font-semibold text-slate-400">Depois</p>
              <p class="mt-1 text-xs font-semibold text-slate-900">{{ entry.statusAfter }}</p>
              <p class="mt-0.5 text-xs text-slate-500">{{ entry.queueAfter }}</p>
            </div>
          </div>
          <div class="mt-3">
            <RouterLink
              :to="{ name: 'admin-protocol-detail', params: { protocolId: entry.caseId } }"
              class="text-xs font-semibold text-[var(--color-primary)]"
            >
              Abrir protocolo &rarr;
            </RouterLink>
          </div>
        </article>
      </section>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-slate-600">
          {{ listState.total }} movimentacao(oes) - pagina {{ filters.page }} de {{ listState.totalPages }}
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
            Proxima
          </SgpButton>
        </div>
      </div>
    </AsyncPanel>
  </div>
</template>
