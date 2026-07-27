<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  clearFaqBuilderBundleLibraryLocal,
  createFaqBuilderBundleLibrary,
  createFaqBuilderBundleEntry,
  getFaqBuilderCatalogOptions,
  listFaqBuilderBundles,
  loadFaqBuilderBundleLibraryLocal,
  saveFaqBuilderBundleLibraryLocal,
} from '@/services/faqBuilderHybridRuntime'
import { FAQ_TYPE_CATALOG, getCatalogEntry } from '@/services/faqCatalogs'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const catalogs = getFaqBuilderCatalogOptions()

const currentEditorName = computed(
  () => auth.displayName || auth.mockContext?.userName || 'Admin local',
)

const runtimeError = ref('')

function safeRuntimeCall(executor, fallbackFactory = () => null) {
  try {
    return executor()
  } catch (error) {
    runtimeError.value = String(
      error?.message || 'Falha ao carregar dados locais da biblioteca de FAQ.',
    )
    console.error(error)
    try {
      return fallbackFactory()
    } catch (fallbackError) {
      console.error(fallbackError)
      return null
    }
  }
}

const library = reactive(
  safeRuntimeCall(
    () => loadFaqBuilderBundleLibraryLocal(currentEditorName.value),
    () => createFaqBuilderBundleLibrary(currentEditorName.value),
  ) || createFaqBuilderBundleLibrary(currentEditorName.value),
)

const filters = reactive({
  search: '',
  status: 'all',
  faqType: 'all',
})

const createForm = reactive({
  faqType: 'aluno',
  title: '',
  subjectKey: '',
})

const feedback = reactive({
  type: '',
  message: '',
})

const allRows = computed(() =>
  safeRuntimeCall(
    () =>
      listFaqBuilderBundles(library, {
        search: '',
        status: 'all',
        faqType: 'all',
        includeValidation: false,
      }),
    () => [],
  ),
)

const rows = computed(() =>
  safeRuntimeCall(
    () =>
      listFaqBuilderBundles(library, {
        search: filters.search,
        status: filters.status,
        faqType: filters.faqType,
        includeValidation: false,
      }),
    () => [],
  ),
)

const summary = computed(() => {
  const base = {
    total: allRows.value.length,
    draft: 0,
    review: 0,
    published: 0,
    archived: 0,
    withErrors: 0,
  }

  for (const item of allRows.value) {
    if (item.statusKey === 'draft') base.draft += 1
    if (item.statusKey === 'in review') base.review += 1
    if (item.statusKey === 'published') base.published += 1
    if (item.statusKey === 'archived') base.archived += 1
    if (item.hasBlockingError) base.withErrors += 1
  }

  return base
})

function setFeedback(type = '', message = '') {
  feedback.type = type
  feedback.message = message
}

function resetLibraryState() {
  clearFaqBuilderBundleLibraryLocal()
  const restored = safeRuntimeCall(
    () => loadFaqBuilderBundleLibraryLocal(currentEditorName.value),
    () => createFaqBuilderBundleLibrary(currentEditorName.value),
  )
  Object.assign(library, restored || createFaqBuilderBundleLibrary(currentEditorName.value))
  runtimeError.value = ''
  setFeedback('success', 'Biblioteca local reinicializada com sucesso.')
}

function openBundle(bundleId = '', query = {}) {
  const normalizedBundleId = String(bundleId || '')
    .split('?')[0]
    .split('#')[0]
    .split('/')[0]
    .trim()
  if (!normalizedBundleId) {
    setFeedback('error', 'Fluxo invalido: identificador ausente.')
    return
  }
  const encodedBundleId = encodeURIComponent(normalizedBundleId)
  router.push({
    path: `/admin/faq/${encodedBundleId}`,
    query,
  })
}

function createFlow() {
  const result = createFaqBuilderBundleEntry(library, {
    faqType: createForm.faqType,
    title: createForm.title,
    subjectKey: createForm.subjectKey,
    actorName: currentEditorName.value,
  })
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  saveFaqBuilderBundleLibraryLocal(library)
  createForm.title = ''
  createForm.subjectKey = ''
  setFeedback('success', 'Novo fluxo criado com sucesso.')
  openBundle(result.entry.bundleId)
}

function statusLabel(status = '') {
  const normalized = String(status || '').toLowerCase()
  const labels = {
    draft: 'Rascunho',
    published: 'Publicado',
    'in review': 'Em revisão',
    review: 'Em revisão',
    archived: 'Arquivado',
  }
  return labels[normalized] || status || 'Nao informado'
}

function faqTypeLabel(type = '') {
  const entry = getCatalogEntry(FAQ_TYPE_CATALOG, String(type || '').toLowerCase())
  return entry?.label || type || 'Nao informado'
}

function formatDate(dateValue = '') {
  if (!dateValue) {
    return '-'
  }

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return String(dateValue).slice(0, 10) || '-'
  }

  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function situationLabel(row = {}) {
  if (row.hasBlockingError) {
    return 'Bloqueado'
  }

  if (row.hasOwnershipGap || Number(row.validationWarnings || 0) > 0) {
    return 'Atencao'
  }

  return 'OK'
}

function situationHint(row = {}) {
  if (row.hasBlockingError) {
    return 'Nao publicar'
  }

  if (row.hasOwnershipGap) {
    return 'Revisar responsavel'
  }

  if (Number(row.validationWarnings || 0) > 0) {
    return 'Revisar pendencias'
  }

  return 'Sem bloqueios'
}

function situationTone(row = {}) {
  const label = situationLabel(row)

  if (label === 'Bloqueado') {
    return 'danger'
  }

  if (label === 'Atencao') {
    return 'warning'
  }

  return 'success'
}
</script>

<template>
  <div class="crm-content-stack">
    <section
      v-if="runtimeError"
      class="rounded-[8px] border border-[rgba(166,31,40,0.25)] bg-[rgba(253,236,237,0.8)] px-4 py-3 text-sm text-[var(--color-danger)]"
    >
      <p class="font-semibold">Não foi possível carregar a biblioteca local.</p>
      <p class="mt-1">{{ runtimeError }}</p>
      <button
        type="button"
        class="mt-3 rounded-[8px] border border-[rgba(166,31,40,0.28)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger)]"
        @click="resetLibraryState"
      >
        Reinicializar dados locais do FAQ Builder
      </button>
    </section>

    <SectionPanel
      eyebrow="Admin / FAQ Builder"
      title="Biblioteca de fluxos da base de conhecimento"
      description="Escolha um fluxo para editar. O canvas abre apenas um bundle por vez em tela dedicada."
    >
      <div class="crm-stat-grid">
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Fluxos</p>
          <p class="crm-stat-tile__value">{{ summary.total }}</p>
        </div>
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Rascunhos</p>
          <p class="crm-stat-tile__value">{{ summary.draft }}</p>
        </div>
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Em revisão</p>
          <p class="crm-stat-tile__value">{{ summary.review }}</p>
        </div>
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label">Publicados</p>
          <p class="crm-stat-tile__value">{{ summary.published }}</p>
        </div>
        <div class="crm-stat-tile">
          <p class="crm-stat-tile__label" title="Com erro estrutural">Com erro</p>
          <p class="crm-stat-tile__value is-danger">{{ summary.withErrors }}</p>
        </div>
      </div>
    </SectionPanel>

    <section
      v-if="feedback.message"
      class="rounded-[8px] border px-4 py-3 text-sm"
      :class="feedback.type === 'error' ? 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]' : 'border-[rgba(26,111,67,0.22)] bg-[rgba(220,252,231,0.75)] text-[var(--color-success)]'"
    >
      {{ feedback.message }}
    </section>

    <section class="grid gap-3">
      <article class="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
        <p class="text-sm font-semibold text-slate-900">Filtros da biblioteca</p>
        <div class="crm-filter-grid mt-2">
          <label class="crm-filter-field">
            <span class="crm-field-label">Buscar</span>
            <input v-model="filters.search" type="text" class="crm-field w-full min-w-0" placeholder="Nome do fluxo, assunto ou tipo" />
          </label>
          <label class="crm-filter-field">
            <span class="crm-field-label">Status</span>
            <select v-model="filters.status" class="crm-field w-full min-w-0">
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="in review">Em revisão</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <label class="crm-filter-field">
            <span class="crm-field-label">Tipo de FAQ</span>
            <select v-model="filters.faqType" class="crm-field w-full min-w-0">
              <option value="all">Todos</option>
              <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>
      </article>

      <details class="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
        <summary class="cursor-pointer text-sm font-semibold text-slate-900">
          Criar novo fluxo
          <span class="ml-2 text-xs font-normal text-slate-500">Cadastre um novo fluxo quando nao houver fluxo equivalente.</span>
        </summary>
        <div class="crm-form-grid mt-3">
          <label class="crm-filter-field">
            <span class="crm-field-label">Tipo</span>
            <select v-model="createForm.faqType" class="crm-field w-full min-w-0">
              <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="crm-filter-field">
            <span class="crm-field-label">Nome do fluxo</span>
            <input v-model="createForm.title" type="text" class="crm-field w-full min-w-0" placeholder="Ex.: Provas e segunda chamada" />
          </label>
          <label class="crm-filter-field">
            <span class="crm-field-label">Chave do assunto (opcional)</span>
            <input v-model="createForm.subjectKey" type="text" class="crm-field w-full min-w-0" placeholder="Ex.: provas_segunda_chamada" />
          </label>
          <button type="button" class="crm-button-primary w-full min-w-0 justify-center sm:w-auto" @click="createFlow">
            Criar fluxo
          </button>
        </div>
      </details>
    </section>

    <section class="rounded-[8px] border border-slate-200 bg-white p-4">
      <p class="text-sm font-semibold text-slate-900">Fluxos disponíveis</p>
      <div class="crm-table-scroll mt-3">
        <table class="text-left text-xs">
          <thead class="bg-slate-100 text-slate-600">
            <tr>
              <th class="px-3 py-2">Fluxo</th>
              <th class="px-3 py-2">Tipo de FAQ</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Área responsável</th>
              <th class="px-3 py-2">Situação</th>
              <th class="px-3 py-2">Atualizado em</th>
              <th class="px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.bundleId" class="border-t border-slate-200">
              <td class="px-3 py-2">
                <p class="font-semibold text-slate-900">{{ row.title }}</p>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <StatusBadge :label="faqTypeLabel(row.faqType)" />
              </td>
              <td class="px-3 py-2">
                <StatusBadge :label="statusLabel(row.statusKey || row.workflowStatus)" />
              </td>
              <td class="px-3 py-2">
                <p class="font-semibold text-slate-900">{{ row.bundleOwnerLabel || '-' }}</p>
              </td>
              <td class="px-3 py-2">
                <p
                  :class="
                    situationTone(row) === 'danger'
                      ? 'text-[var(--color-danger)] font-semibold'
                      : situationTone(row) === 'warning'
                        ? 'text-amber-700 font-semibold'
                        : 'text-[var(--color-success)] font-semibold'
                  "
                >
                  {{ situationLabel(row) }}
                </p>
                <p class="mt-1 text-slate-600">{{ situationHint(row) }}</p>
              </td>
              <td class="px-3 py-2">
                <p>{{ formatDate(row.updatedAt) }}</p>
              </td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-[8px] bg-slate-900 px-3 py-1.5 font-semibold text-white" @click="openBundle(row.bundleId)">
                    Ver fluxo
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length" class="border-t border-slate-200">
              <td colspan="7" class="px-3 py-4 text-slate-600">Nenhum fluxo encontrado com os filtros atuais.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
