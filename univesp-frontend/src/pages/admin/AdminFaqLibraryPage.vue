<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
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
  <div class="grid gap-5">
    <section
      v-if="runtimeError"
      class="rounded-[14px] border border-[rgba(166,31,40,0.25)] bg-[rgba(253,236,237,0.8)] px-4 py-3 text-sm text-[var(--color-danger)]"
    >
      <p class="font-semibold">Nao foi possivel carregar a biblioteca local.</p>
      <p class="mt-1">{{ runtimeError }}</p>
      <button
        type="button"
        class="mt-3 rounded-[10px] border border-[rgba(166,31,40,0.28)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger)]"
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
      <div class="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <div class="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Fluxos</p>
          <p class="mt-1 text-xl font-semibold text-slate-900">{{ summary.total }}</p>
        </div>
        <div class="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Rascunhos</p>
          <p class="mt-1 text-xl font-semibold text-slate-900">{{ summary.draft }}</p>
        </div>
        <div class="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Em revisao</p>
          <p class="mt-1 text-xl font-semibold text-slate-900">{{ summary.review }}</p>
        </div>
        <div class="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Publicados</p>
          <p class="mt-1 text-xl font-semibold text-slate-900">{{ summary.published }}</p>
        </div>
        <div class="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Com erro estrutural</p>
          <p class="mt-1 text-xl font-semibold text-[var(--color-danger)]">{{ summary.withErrors }}</p>
        </div>
      </div>
    </SectionPanel>

    <details open class="rounded-[14px] border border-indigo-200 bg-indigo-50/70 px-4 py-3">
      <summary class="cursor-pointer text-sm font-semibold text-slate-900">
        Carga rapida por planilha
      </summary>
      <ol class="mt-3 grid gap-2 text-xs text-slate-700 md:grid-cols-5">
        <li><strong>1.</strong> Crie um fluxo por assunto.</li>
        <li><strong>2.</strong> Abra o fluxo e baixe o template XLSX.</li>
        <li><strong>3.</strong> Preencha perguntas, respostas e ownership.</li>
        <li><strong>4.</strong> Rode o dry-run no modo Importacao.</li>
        <li><strong>5.</strong> Aplique, salve, revise e publique.</li>
      </ol>
      <p class="mt-3 text-xs text-slate-600">
        A importacao e tudo-ou-nada, substitui apenas o rascunho do fluxo aberto e nunca publica automaticamente.
      </p>
    </details>

    <section
      v-if="feedback.message"
      class="rounded-[14px] border px-4 py-3 text-sm"
      :class="feedback.type === 'error' ? 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]' : 'border-[rgba(26,111,67,0.22)] bg-[rgba(220,252,231,0.75)] text-[var(--color-success)]'"
    >
      {{ feedback.message }}
    </section>

    <section class="grid gap-3">
      <article class="rounded-[14px] border border-slate-200 bg-white px-4 py-3">
        <p class="text-sm font-semibold text-slate-900">Filtros da biblioteca</p>
        <div class="mt-2 grid gap-2 md:grid-cols-[minmax(220px,1fr)_minmax(150px,180px)_minmax(150px,180px)]">
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Buscar</span>
            <input v-model="filters.search" type="text" class="w-full min-w-0 rounded-[10px] border border-slate-300 px-3 py-1.5 text-sm" placeholder="Nome do fluxo, assunto ou tipo" />
          </label>
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Status</span>
            <select v-model="filters.status" class="w-full min-w-0 rounded-[10px] border border-slate-300 px-3 py-1.5 text-sm">
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="in review">Em revisao</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Tipo de FAQ</span>
            <select v-model="filters.faqType" class="w-full min-w-0 rounded-[10px] border border-slate-300 px-3 py-1.5 text-sm">
              <option value="all">Todos</option>
              <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>
      </article>

      <details class="rounded-[14px] border border-slate-200 bg-white px-4 py-3">
        <summary class="cursor-pointer text-sm font-semibold text-slate-900">
          Criar novo fluxo
          <span class="ml-2 text-xs font-normal text-slate-500">Cadastre um novo fluxo quando nao houver fluxo equivalente.</span>
        </summary>
        <div class="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-[220px_minmax(220px,1fr)_minmax(220px,1fr)_140px] lg:items-end">
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Tipo</span>
            <select v-model="createForm.faqType" class="w-full min-w-0 rounded-[10px] border border-slate-300 px-3 py-1.5 text-sm">
              <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Nome do fluxo</span>
            <input v-model="createForm.title" type="text" class="w-full min-w-0 rounded-[10px] border border-slate-300 px-3 py-1.5 text-sm" placeholder="Ex.: Provas e segunda chamada" />
          </label>
          <label class="grid min-w-0 gap-1">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Chave do assunto (opcional)</span>
            <input v-model="createForm.subjectKey" type="text" class="w-full min-w-0 rounded-[10px] border border-slate-300 px-3 py-1.5 text-sm" placeholder="Ex.: provas_segunda_chamada" />
          </label>
          <button type="button" class="rounded-[10px] bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" @click="createFlow">
            Criar fluxo
          </button>
        </div>
      </details>
    </section>

    <section class="rounded-[18px] border border-slate-200 bg-white p-4">
      <p class="text-sm font-semibold text-slate-900">Fluxos disponiveis</p>
      <div class="mt-3 overflow-auto rounded-[12px] border border-slate-200">
        <table class="w-full min-w-[900px] text-left text-xs">
          <thead class="bg-slate-100 text-slate-600">
            <tr>
              <th class="px-3 py-2">Fluxo</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Area responsavel</th>
              <th class="px-3 py-2">Situacao</th>
              <th class="px-3 py-2">Atualizado em</th>
              <th class="px-3 py-2">Acao</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.bundleId" class="border-t border-slate-200">
              <td class="px-3 py-2">
                <p class="font-semibold text-slate-900">{{ row.title }}</p>
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
                  <button type="button" class="rounded-[10px] bg-slate-900 px-3 py-1.5 font-semibold text-white" @click="openBundle(row.bundleId)">
                    Ver fluxo
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length" class="border-t border-slate-200">
              <td colspan="6" class="px-3 py-4 text-slate-600">Nenhum fluxo encontrado com os filtros atuais.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
