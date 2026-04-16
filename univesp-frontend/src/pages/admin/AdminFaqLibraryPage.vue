<script setup>
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'

import SectionPanel from '@/components/SectionPanel.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  archiveFaqBuilderBundleEntry,
  createFaqBuilderBundleEntry,
  duplicateFaqBuilderBundleEntry,
  getFaqBuilderCatalogOptions,
  listFaqBuilderBundles,
  loadFaqBuilderBundleLibraryLocal,
  saveFaqBuilderBundleLibraryLocal,
} from '@/services/faqBuilderHybridRuntime'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const catalogs = getFaqBuilderCatalogOptions()

const currentEditorName = computed(
  () => auth.displayName || auth.mockContext?.userName || 'Admin local',
)

const library = reactive(loadFaqBuilderBundleLibraryLocal(currentEditorName.value))

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
  listFaqBuilderBundles(library, {
    search: '',
    status: 'all',
    faqType: 'all',
  }),
)

const rows = computed(() =>
  listFaqBuilderBundles(library, {
    search: filters.search,
    status: filters.status,
    faqType: filters.faqType,
  }),
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

function openBundle(bundleId = '', query = {}) {
  router.push({
    path: `/admin/faq/${encodeURIComponent(bundleId)}`,
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

function duplicateFlow(bundleId = '') {
  const result = duplicateFaqBuilderBundleEntry(
    library,
    bundleId,
    currentEditorName.value,
  )
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  saveFaqBuilderBundleLibraryLocal(library)
  setFeedback('success', 'Fluxo duplicado com sucesso.')
}

function archiveFlow(bundleId = '') {
  const result = archiveFaqBuilderBundleEntry(
    library,
    bundleId,
    currentEditorName.value,
  )
  if (!result.ok) {
    setFeedback('error', result.message)
    return
  }
  saveFaqBuilderBundleLibraryLocal(library)
  setFeedback('success', 'Fluxo arquivado.')
}
</script>

<template>
  <div class="grid gap-5">
    <SectionPanel
      eyebrow="Admin / FAQ Builder"
      title="Biblioteca de fluxos da base de conhecimento"
      description="Escolha um fluxo para editar. O canvas abre apenas um bundle por vez em tela dedicada."
    >
      <div class="grid gap-3 md:grid-cols-5">
        <div class="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Fluxos</p>
          <p class="mt-1 text-xl font-semibold text-slate-900">{{ summary.total }}</p>
        </div>
        <div class="rounded-[14px] border border-slate-200 bg-slate-50 p-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-slate-500">Draft</p>
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

    <section
      v-if="feedback.message"
      class="rounded-[14px] border px-4 py-3 text-sm"
      :class="feedback.type === 'error' ? 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]' : 'border-[rgba(26,111,67,0.22)] bg-[rgba(220,252,231,0.75)] text-[var(--color-success)]'"
    >
      {{ feedback.message }}
    </section>

    <section class="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <article class="rounded-[18px] border border-slate-200 bg-white p-4">
        <p class="text-sm font-semibold text-slate-900">Filtros da biblioteca</p>
        <div class="mt-3 grid gap-3 md:grid-cols-3">
          <label class="grid gap-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Buscar</span>
            <input v-model="filters.search" type="text" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm" placeholder="Nome do fluxo, assunto ou tipo" />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Status</span>
            <select v-model="filters.status" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Todos</option>
              <option value="draft">Draft</option>
              <option value="in review">In Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Tipo de FAQ</span>
            <select v-model="filters.faqType" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Todos</option>
              <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>
      </article>

      <article class="rounded-[18px] border border-slate-200 bg-white p-4">
        <p class="text-sm font-semibold text-slate-900">Criar novo fluxo</p>
        <div class="mt-3 grid gap-3">
          <label class="grid gap-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Tipo</span>
            <select v-model="createForm.faqType" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm">
              <option v-for="option in catalogs.faqTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Nome do fluxo</span>
            <input v-model="createForm.title" type="text" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: Provas e segunda chamada" />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Chave do assunto (opcional)</span>
            <input v-model="createForm.subjectKey" type="text" class="rounded-[12px] border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: provas_segunda_chamada" />
          </label>
          <button type="button" class="rounded-[12px] bg-slate-900 px-3 py-2 text-xs font-semibold text-white" @click="createFlow">
            Criar fluxo
          </button>
        </div>
      </article>
    </section>

    <section class="rounded-[18px] border border-slate-200 bg-white p-4">
      <p class="text-sm font-semibold text-slate-900">Fluxos disponiveis para edicao</p>
      <div class="mt-3 overflow-auto rounded-[12px] border border-slate-200">
        <table class="w-full min-w-[1120px] text-left text-xs">
          <thead class="bg-slate-100 text-slate-600">
            <tr>
              <th class="px-3 py-2">Fluxo</th>
              <th class="px-3 py-2">Tipo</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Nos</th>
              <th class="px-3 py-2">Integridade</th>
              <th class="px-3 py-2">Ultima edicao</th>
              <th class="px-3 py-2">Acoes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.bundleId" class="border-t border-slate-200">
              <td class="px-3 py-3">
                <p class="font-semibold text-slate-900">{{ row.title }}</p>
                <p class="mt-1 text-slate-600">{{ row.subjectKey }}</p>
                <p class="mt-1 text-slate-500">{{ row.bundleId }}</p>
              </td>
              <td class="px-3 py-3">{{ row.faqType }}</td>
              <td class="px-3 py-3">
                <StatusBadge :label="row.workflowStatus" />
              </td>
              <td class="px-3 py-3">{{ row.nodeCount }}</td>
              <td class="px-3 py-3">
                <p :class="row.hasBlockingError ? 'text-[var(--color-danger)] font-semibold' : 'text-[var(--color-success)] font-semibold'">
                  {{ row.hasBlockingError ? `${row.validationErrors} erro(s)` : 'Sem erro bloqueador' }}
                </p>
                <p class="mt-1 text-slate-600">{{ row.validationWarnings }} warning(s)</p>
              </td>
              <td class="px-3 py-3">
                <p>{{ row.updatedAt }}</p>
                <p class="mt-1 text-slate-600">{{ row.updatedBy }}</p>
              </td>
              <td class="px-3 py-3">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-[10px] border border-slate-300 px-2 py-1 font-semibold text-slate-700" @click="openBundle(row.bundleId)">
                    Editar fluxo
                  </button>
                  <button type="button" class="rounded-[10px] border border-slate-300 px-2 py-1 font-semibold text-slate-700" @click="openBundle(row.bundleId, { mode: 'import' })">
                    Importar
                  </button>
                  <button type="button" class="rounded-[10px] border border-slate-300 px-2 py-1 font-semibold text-slate-700" @click="duplicateFlow(row.bundleId)">
                    Duplicar
                  </button>
                  <button type="button" class="rounded-[10px] border border-[rgba(166,31,40,0.28)] px-2 py-1 font-semibold text-[var(--color-danger)]" @click="archiveFlow(row.bundleId)">
                    Arquivar
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
