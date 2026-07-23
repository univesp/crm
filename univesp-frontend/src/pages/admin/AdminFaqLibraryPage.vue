<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import StatusBadge from '@/components/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import SgpButton from '@/components/ui/SgpButton.vue'
import {
  clearFaqBuilderBundleLibraryLocal,
  createFaqBuilderBundleLibrary,
  createFaqBuilderBundleEntry,
  getFaqBuilderCatalogOptions,
  listFaqBuilderBundles,
  loadFaqBuilderBundleLibraryLocal,
} from '@/services/faqBuilderHybridRuntime'
import { FAQ_TYPE_CATALOG } from '@/services/faqCatalogs'
import { hydrateFaqLibrary, persistFaqLibrary } from '@/services/faqLibraryApi'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const catalogs = getFaqBuilderCatalogOptions()

const AUDIENCE_SCOPES = Object.freeze([
  { key: 'all', label: 'Todos' },
  { key: 'atendimento', label: 'Atendimento', hint: 'Aluno e OP' },
  { key: 'publico', label: 'Público externo', hint: 'Visitantes' },
])

const currentEditorName = computed(
  () => auth.displayName || auth.mockContext?.userName || 'Admin local',
)

const runtimeError = ref('')
const audienceScope = ref('all')

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

const institutionalState = reactive({ loading: false, ready: false })

onMounted(async () => {
  institutionalState.loading = true
  runtimeError.value = ''
  try {
    await hydrateFaqLibrary(library, currentEditorName.value)
    institutionalState.ready = true
  } catch (error) {
    runtimeError.value = error?.message || 'Falha ao carregar a biblioteca FAQ institucional.'
  } finally {
    institutionalState.loading = false
  }
})

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

const createOpen = ref(false)
const importOpen = ref(false)

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

function uniqueById(items = []) {
  return Array.from(new Map(items.map((item) => [item.bundleId, item])).values())
}

const uniqueRows = computed(() => uniqueById(rows.value))

const displayRows = computed(() => {
  const base = uniqueRows.value
  if (audienceScope.value === 'atendimento') {
    return base.filter((row) => row.faqType === 'aluno' || row.faqType === 'op')
  }
  return base
})

watch(
  () => filters.faqType,
  (value) => {
    if (value === 'publico') {
      audienceScope.value = 'publico'
      return
    }
    if (value === 'aluno' || value === 'op') {
      audienceScope.value = 'atendimento'
      return
    }
    if (value === 'all' && audienceScope.value !== 'publico') {
      audienceScope.value = 'all'
    }
  },
)

const uniqueSummary = computed(() => {
  const result = { total: 0, draft: 0, review: 0, published: 0, withErrors: 0 }
  for (const item of uniqueById(allRows.value)) {
    result.total += 1
    if (item.statusKey === 'draft') result.draft += 1
    if (item.statusKey === 'in review') result.review += 1
    if (item.statusKey === 'published') result.published += 1
    if (item.hasBlockingError) result.withErrors += 1
  }
  return result
})

function setAudienceScope(scope = 'all') {
  audienceScope.value = scope
  if (scope === 'publico') {
    filters.faqType = 'publico'
    return
  }
  if (scope === 'atendimento') {
    filters.faqType = 'all'
    return
  }
  filters.faqType = 'all'
}

function setFeedback(type = '', message = '') {
  feedback.type = type
  feedback.message = message
}

async function resetLibraryState() {
  clearFaqBuilderBundleLibraryLocal()
  const restored = createFaqBuilderBundleLibrary(currentEditorName.value)
  Object.assign(library, restored)
  runtimeError.value = ''
  try {
    await persistFaqLibrary(library, 'Reinicializacao administrativa da biblioteca FAQ')
    setFeedback('success', 'Biblioteca reinicializada e persistida com sucesso.')
  } catch (error) {
    runtimeError.value = error?.message || 'Falha ao reinicializar a biblioteca institucional.'
    setFeedback('error', runtimeError.value)
  }
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

async function createFlow() {
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
  try {
    await persistFaqLibrary(library, 'Criacao de novo fluxo na biblioteca FAQ')
    createForm.title = ''
    createForm.subjectKey = ''
    setFeedback('success', 'Novo fluxo criado e persistido com sucesso.')
    openBundle(result.entry.bundleId)
  } catch (error) {
    setFeedback('error', error?.message || 'Falha ao persistir o novo fluxo FAQ.')
  }
}

function statusLabel(status = '') {
  const normalized = String(status || '').toLowerCase()
  const labels = {
    draft: 'Rascunho',
    published: 'Publicado',
    'in review': 'Em revisao',
    review: 'Em revisao',
    archived: 'Arquivado',
  }
  return labels[normalized] || status || 'Nao informado'
}

function faqTypeLabel(faqType = '') {
  return FAQ_TYPE_CATALOG[faqType]?.label || faqType || 'Nao informado'
}

function faqTypeShortLabel(faqType = '') {
  const labels = {
    aluno: 'Aluno',
    op: 'OP',
    publico: 'Publico',
  }
  return labels[faqType] || faqType || '-'
}

function faqTypeBadgeClass(faqType = '') {
  if (faqType === 'publico') return 'badge-info'
  if (faqType === 'op') return 'badge-warning'
  return 'badge-success'
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
  <div class="grid gap-5">
    <section
      v-if="runtimeError"
      class="rounded-ui border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      <p class="font-semibold">Os dados nao puderam ser carregados.</p>
      <p class="mt-1">Tente novamente. Se o problema continuar, informe o horario ao suporte.</p>
      <SgpButton variant="secondary" class="mt-3" @click="resetLibraryState">Tentar novamente</SgpButton>
    </section>

    <section class="surface-panel p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Biblioteca institucional</p>
          <p class="mt-2 text-lg font-semibold text-slate-950">
            {{ uniqueSummary.total }} FAQs
            <span class="text-base font-normal text-slate-500">
              · {{ uniqueSummary.draft }} rascunhos · {{ uniqueSummary.review }} em revisao ·
              {{ uniqueSummary.published }} publicadas
            </span>
          </p>
          <p v-if="uniqueSummary.withErrors" class="mt-1 text-sm font-semibold text-red-700">
            {{ uniqueSummary.withErrors }}
            {{ uniqueSummary.withErrors === 1 ? 'FAQ precisa' : 'FAQs precisam' }} de correcao antes da publicacao.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <SgpButton variant="secondary" @click="importOpen = !importOpen">Importar arquivo</SgpButton>
          <SgpButton @click="createOpen = !createOpen">Nova FAQ</SgpButton>
        </div>
      </div>

      <div v-if="importOpen" class="inner-panel mt-4 p-4 text-sm text-slate-700">
        <p class="font-semibold text-slate-950">Importar conteudo</p>
        <p class="mt-1 leading-6">
          Abra a FAQ que sera atualizada e escolha “Importar conteudo”. O arquivo sera validado antes de substituir
          o rascunho e nunca sera publicado automaticamente.
        </p>
      </div>

      <form
        v-if="createOpen"
        class="inner-panel mt-4 grid gap-4 p-4 md:grid-cols-[minmax(180px,220px)_minmax(0,1fr)_auto]"
        @submit.prevent="createFlow"
      >
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Publico</span>
          <select
            v-model="createForm.faqType"
            class="rounded-ui border border-slate-200 bg-white px-3 py-2"
          >
            <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Nome da FAQ</span>
          <input
            v-model="createForm.title"
            type="text"
            required
            class="rounded-ui border border-slate-200 bg-white px-3 py-2"
            placeholder="Ex.: Segunda chamada de prova"
          />
        </label>
        <div class="flex flex-col gap-1 md:justify-end">
          <span class="text-sm font-semibold text-slate-700 md:sr-only">Acao</span>
          <SgpButton type="submit">Criar FAQ</SgpButton>
        </div>
      </form>
    </section>

    <section
      v-if="feedback.message"
      class="rounded-ui border px-4 py-3 text-sm"
      :class="
        feedback.type === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-green-200 bg-green-50 text-green-800'
      "
      role="status"
    >
      {{ feedback.message }}
    </section>

    <section class="inner-panel overflow-hidden">
      <div class="border-b border-slate-200 p-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Escopo</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="scope in AUDIENCE_SCOPES"
            :key="scope.key"
            type="button"
            class="rounded-full border px-3 py-2 text-sm font-semibold transition"
            :class="
              audienceScope === scope.key
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            "
            @click="setAudienceScope(scope.key)"
          >
            {{ scope.label }}
            <span v-if="scope.hint" class="font-normal text-slate-500">· {{ scope.hint }}</span>
          </button>
        </div>
      </div>

      <div class="grid gap-4 border-b border-slate-200 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Buscar FAQ</span>
          <input
            v-model="filters.search"
            type="search"
            class="rounded-ui border border-slate-200 bg-white px-3 py-2"
            placeholder="Nome ou assunto"
          />
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Estado</span>
          <select v-model="filters.status" class="rounded-ui border border-slate-200 bg-white px-3 py-2">
            <option value="all">Todos</option>
            <option value="draft">Rascunho</option>
            <option value="in review">Em revisao</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span class="font-semibold text-slate-700">Publico</span>
          <select v-model="filters.faqType" class="rounded-ui border border-slate-200 bg-white px-3 py-2">
            <option value="all">Todos</option>
            <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <LoadingState v-if="institutionalState.loading" message="Carregando biblioteca FAQ..." />

      <EmptyState
        v-else-if="!displayRows.length"
        title="Nenhuma FAQ encontrada"
        message="Ajuste os filtros ou crie uma nova FAQ para este publico."
        next-step="Use Atendimento para aluno e OP, ou Publico externo para visitantes sem login."
      />

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[860px] text-left text-sm">
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th class="px-4 py-3">FAQ</th>
              <th class="px-4 py-3">Publico</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Responsavel</th>
              <th class="px-4 py-3">Pendencia</th>
              <th class="px-4 py-3">Atualizacao</th>
              <th class="px-4 py-3"><span class="sr-only">Acao</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in displayRows" :key="row.bundleId" class="border-t border-slate-200">
              <td class="px-4 py-3">
                <p class="font-semibold text-slate-950">{{ row.title }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ faqTypeLabel(row.faqType) }}</p>
              </td>
              <td class="px-4 py-3">
                <span
                  class="badge-base"
                  :class="faqTypeBadgeClass(row.faqType)"
                  :title="faqTypeLabel(row.faqType)"
                >
                  {{ faqTypeShortLabel(row.faqType) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <StatusBadge :label="statusLabel(row.statusKey || row.workflowStatus)" />
              </td>
              <td class="px-4 py-3 text-slate-700">{{ row.bundleOwnerLabel || 'Nao definido' }}</td>
              <td class="px-4 py-3">
                <span
                  :class="
                    situationTone(row) === 'danger'
                      ? 'font-semibold text-red-700'
                      : situationTone(row) === 'warning'
                        ? 'font-semibold text-amber-700'
                        : 'text-green-700'
                  "
                >
                  {{ situationHint(row) }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">{{ formatDate(row.updatedAt) }}</td>
              <td class="px-4 py-3 text-right">
                <SgpButton variant="secondary" compact @click="openBundle(row.bundleId)">Abrir</SgpButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
