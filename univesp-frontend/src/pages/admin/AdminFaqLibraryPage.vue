<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import StatusBadge from '@/components/StatusBadge.vue'
import {
  clearFaqBuilderBundleLibraryLocal,
  createFaqBuilderBundleLibrary,
  createFaqBuilderBundleEntry,
  getFaqBuilderCatalogOptions,
  listFaqBuilderBundles,
  loadFaqBuilderBundleLibraryLocal,
} from '@/services/faqBuilderHybridRuntime'
import { hydrateFaqLibrary, persistFaqLibrary } from '@/services/faqLibraryApi'
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
  <div class="grid gap-4">
    <section v-if="runtimeError" class="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      <p class="font-semibold">Os dados não puderam ser carregados.</p>
      <p class="mt-1">Tente novamente. Se o problema continuar, informe o horário ao suporte.</p>
      <button type="button" class="mt-3 min-h-11 rounded-[10px] border border-red-300 bg-white px-4 font-semibold" @click="resetLibraryState">Tentar novamente</button>
    </section>

    <section class="rounded-[16px] border border-slate-200 bg-white p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="font-semibold text-slate-950">
            {{ uniqueSummary.total }} FAQs
            <span class="font-normal text-slate-500">· {{ uniqueSummary.draft }} rascunhos · {{ uniqueSummary.review }} em revisão · {{ uniqueSummary.published }} publicadas</span>
          </p>
          <p v-if="uniqueSummary.withErrors" class="mt-1 text-sm font-semibold text-red-700">
            {{ uniqueSummary.withErrors }} {{ uniqueSummary.withErrors === 1 ? 'FAQ precisa' : 'FAQs precisam' }} de correção antes da publicação.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-4 font-semibold text-slate-800" @click="importOpen = !importOpen">Importar arquivo</button>
          <button type="button" class="min-h-11 rounded-[10px] bg-[var(--color-primary)] px-4 font-semibold text-white" @click="createOpen = !createOpen">Nova FAQ</button>
        </div>
      </div>

      <div v-if="importOpen" class="mt-4 rounded-[12px] bg-slate-50 p-4 text-sm text-slate-700">
        <p class="font-semibold text-slate-950">Importar conteúdo</p>
        <p class="mt-1">Abra a FAQ que será atualizada e escolha “Importar conteúdo”. O arquivo será validado antes de substituir o rascunho e nunca será publicado automaticamente.</p>
      </div>

      <form v-if="createOpen" class="mt-4 grid gap-3 rounded-[12px] bg-slate-50 p-4 md:grid-cols-[200px_1fr_auto] md:items-end" @submit.prevent="createFlow">
        <label class="grid gap-1">
          <span class="text-sm font-semibold text-slate-700">Público</span>
          <select v-model="createForm.faqType" class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3">
            <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="grid gap-1">
          <span class="text-sm font-semibold text-slate-700">Nome da FAQ</span>
          <input v-model="createForm.title" type="text" required class="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3" placeholder="Ex.: Segunda chamada de prova" />
        </label>
        <button type="submit" class="min-h-11 rounded-[10px] bg-slate-950 px-5 font-semibold text-white">Criar FAQ</button>
      </form>
    </section>

    <section v-if="feedback.message" class="rounded-[14px] border px-4 py-3 text-sm" :class="feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'" role="status">
      {{ feedback.message }}
    </section>

    <section class="rounded-[16px] border border-slate-200 bg-white">
      <div class="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[minmax(220px,1fr)_180px_180px]">
        <label class="grid gap-1">
          <span class="text-sm font-semibold text-slate-700">Buscar FAQ</span>
          <input v-model="filters.search" type="search" class="min-h-11 rounded-[10px] border border-slate-300 px-3" placeholder="Nome ou assunto" />
        </label>
        <label class="grid gap-1">
          <span class="text-sm font-semibold text-slate-700">Estado</span>
          <select v-model="filters.status" class="min-h-11 rounded-[10px] border border-slate-300 px-3">
            <option value="all">Todos</option><option value="draft">Rascunho</option><option value="in review">Em revisão</option><option value="published">Publicado</option><option value="archived">Arquivado</option>
          </select>
        </label>
        <label class="grid gap-1">
          <span class="text-sm font-semibold text-slate-700">Público</span>
          <select v-model="filters.faqType" class="min-h-11 rounded-[10px] border border-slate-300 px-3">
            <option value="all">Todos</option>
            <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="bg-slate-50 text-slate-600"><tr><th class="px-4 py-3">FAQ</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Responsável</th><th class="px-4 py-3">Pendência</th><th class="px-4 py-3">Atualização</th><th class="px-4 py-3"><span class="sr-only">Ação</span></th></tr></thead>
          <tbody>
            <tr v-for="row in uniqueRows" :key="row.bundleId" class="border-t border-slate-200">
              <td class="px-4 py-3 font-semibold text-slate-950">{{ row.title }}</td>
              <td class="px-4 py-3"><StatusBadge :label="statusLabel(row.statusKey || row.workflowStatus)" /></td>
              <td class="px-4 py-3 text-slate-700">{{ row.bundleOwnerLabel || 'Não definido' }}</td>
              <td class="px-4 py-3"><span :class="situationTone(row) === 'danger' ? 'font-semibold text-red-700' : situationTone(row) === 'warning' ? 'font-semibold text-amber-700' : 'text-green-700'">{{ situationHint(row) }}</span></td>
              <td class="px-4 py-3 text-slate-600">{{ formatDate(row.updatedAt) }}</td>
              <td class="px-4 py-3 text-right"><button type="button" class="min-h-11 rounded-[10px] border border-slate-300 px-4 font-semibold text-slate-900" @click="openBundle(row.bundleId)">Abrir</button></td>
            </tr>
            <tr v-if="!uniqueRows.length" class="border-t border-slate-200"><td colspan="6" class="px-4 py-8 text-center text-slate-600">Nenhuma FAQ encontrada. Ajuste os filtros ou crie uma nova FAQ.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
