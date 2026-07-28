<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { buildStudentFaqRuntime } from '@/services/faqRuntime'
import { buildOperatorPlaybookGuide } from '@/services/operatorQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const searchQuery = ref('')
const selectedSubjectKey = ref('')
const showSuggestionComposer = ref(false)
const feedback = reactive({
  type: '',
  message: '',
})
const form = reactive({
  contentType: 'playbook_area',
  title: '',
  proposalText: '',
  rationale: '',
})

function normalizeText(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function titleCase(value = '') {
  const normalized = String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return 'Nao informado'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildSubjectKey(themeKey = '', subsubjectKey = '') {
  return `${normalizeText(themeKey)}::${normalizeText(subsubjectKey)}`
}

const knowledgeRows = computed(() => studentSupportStore.areaKnowledgeRows(auth.mockContext))
const faqRuntime = computed(() => buildStudentFaqRuntime())
const searchableRows = computed(() =>
  knowledgeRows.value.map((row) => ({
    ...row,
    key: buildSubjectKey(row.themeKey, row.subsubjectKey),
    themeLabel: titleCase(row.themeKey),
    subsubjectLabel: titleCase(row.subsubjectKey),
  })),
)

const filteredRows = computed(() => {
  const query = normalizeText(searchQuery.value)

  if (!query) {
    return searchableRows.value
  }

  return searchableRows.value.filter((row) =>
    normalizeText([row.subjectLabel, row.themeKey, row.subsubjectKey, row.themeLabel, row.subsubjectLabel].join(' ')).includes(query),
  )
})

const activeRow = computed(
  () => searchableRows.value.find((row) => row.key === selectedSubjectKey.value) || null,
)

const activeFaqLeaf = computed(() => {
  if (!activeRow.value) {
    return null
  }

  const leaves = []
  function walk(nodes = []) {
    for (const node of nodes) {
      if (node.children?.length) {
        walk(node.children)
      } else {
        leaves.push(node)
      }
    }
  }
  walk(faqRuntime.value.tree)

  return (
    leaves.find(
      (node) =>
        normalizeText(node.tema) === normalizeText(activeRow.value.themeKey) &&
        normalizeText(node.subtema) === normalizeText(activeRow.value.subsubjectKey),
    ) ||
    leaves.find((node) => normalizeText(node.tema) === normalizeText(activeRow.value.themeKey)) ||
    null
  )
})

const activeGuide = computed(() =>
  activeRow.value
    ? buildOperatorPlaybookGuide({
        theme: activeRow.value.themeKey,
        subsubject: activeRow.value.subsubjectKey,
      })
    : null,
)

const guideSections = computed(() => {
  if (!activeGuide.value) {
    return []
  }

  return [
    {
      title: 'O que verificar',
      items: activeGuide.value.checklist || [],
    },
    {
      title: 'Onde verificar',
      items: (activeGuide.value.systemsToCheck || []).map((item) => `Consultar sistema: ${item}`),
    },
    {
      title: 'Documentos a observar',
      items: (activeGuide.value.documentsRequested || []).map((item) => `Validar documento: ${item}`),
    },
  ].filter((section) => section.items.length)
})

const relatedSuggestions = computed(() => activeRow.value?.suggestions || [])
const isAreaManager = computed(() => auth.mockContext.profileKey === 'gestor_area')

function formatSuggestionStatus(item) {
  const statusCode = item.statusCode || ''

  if (statusCode === 'Pending Review' || item.status === 'pending') {
    return 'Sugestao pendente'
  }

  if (statusCode === 'Approved' || item.status === 'approved') {
    return 'Aprovada'
  }

  if (statusCode === 'Implemented' || item.status === 'implemented') {
    return 'Implementada'
  }

  if (statusCode === 'Superseded' || item.status === 'superseded') {
    return 'Substituida'
  }

  return 'Rejeitada'
}

function selectRow(row) {
  selectedSubjectKey.value = row.key
  feedback.type = ''
  feedback.message = ''

  router.replace({
    path: route.path,
    query: {
      theme: row.themeKey,
      subsubject: row.subsubjectKey,
      ...(showSuggestionComposer.value ? { mode: 'suggest' } : {}),
    },
  })
}

function openSuggestionComposer() {
  showSuggestionComposer.value = true
  if (!activeRow.value) {
    return
  }

  router.replace({
    path: route.path,
    query: {
      theme: activeRow.value.themeKey,
      subsubject: activeRow.value.subsubjectKey,
      mode: 'suggest',
      caseId: String(route.query.caseId || ''),
    },
  })
}

function closeSuggestionComposer() {
  showSuggestionComposer.value = false

  if (!activeRow.value) {
    return
  }

  router.replace({
    path: route.path,
    query: {
      theme: activeRow.value.themeKey,
      subsubject: activeRow.value.subsubjectKey,
      caseId: String(route.query.caseId || ''),
    },
  })
}

function resetForm() {
  form.title = ''
  form.proposalText = ''
  form.rationale = ''
}

function submitSuggestion() {
  if (!activeRow.value || !form.title.trim() || !form.proposalText.trim() || !form.rationale.trim()) {
    feedback.type = 'error'
    feedback.message = 'Preencha titulo, proposta e justificativa para registrar a sugestao.'
    return
  }

  studentSupportStore.submitKnowledgeSuggestion({
    areaLabel: auth.mockContext.currentArea,
    themeKey: activeRow.value.themeKey,
    subsubjectKey: activeRow.value.subsubjectKey,
    subjectLabel: activeRow.value.subjectLabel,
    contentType: form.contentType,
    title: form.title.trim(),
    currentContent: activeFaqLeaf.value?.resposta || activeGuide.value?.responseTemplate || '',
    proposalText: form.proposalText.trim(),
    rationale: form.rationale.trim(),
    sourceCaseId: String(route.query.caseId || ''),
    authorName: auth.mockContext.userName,
  })

  resetForm()
  feedback.type = 'success'
  feedback.message = 'Sugestao registrada. Ela agora depende de revisao e aprovacao antes de virar conteudo vigente.'
}

watch(
  () => [route.query.theme, route.query.subsubject],
  ([theme, subsubject]) => {
    const key = buildSubjectKey(theme, subsubject)
    if (!theme) {
      selectedSubjectKey.value = searchableRows.value[0]?.key || ''
      return
    }

    selectedSubjectKey.value =
      searchableRows.value.find((row) => row.key === key)?.key ||
      searchableRows.value.find((row) => normalizeText(row.themeKey) === normalizeText(theme))?.key ||
      ''
  },
  { immediate: true },
)

watch(
  () => route.query.mode,
  (mode) => {
    showSuggestionComposer.value = mode === 'suggest'
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div class="max-w-[760px]">
          <p class="text-sm font-semibold text-slate-900">
            Use esta camada para consultar o conteudo vigente da area. A consulta deve ser leve: assunto, subassunto, resposta e orientacao operacional no mesmo lugar.
          </p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Quando a operacao identificar erro ou lacuna, a sugestao de melhoria continua disponivel, mas como etapa secundaria.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-if="isAreaManager"
            to="/area/mudancas"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Mudancas pendentes
          </RouterLink>
          <button
            type="button"
            class="rounded-[8px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            @click="openSuggestionComposer"
          >
            Sugerir ajuste
          </button>
        </div>
      </div>

      <label class="mt-4 grid gap-2">
        <span class="text-sm font-semibold text-slate-700">Buscar assunto da area</span>
        <input
          v-model="searchQuery"
          type="search"
          class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
          placeholder="Assunto ou subassunto"
        />
      </label>
    </section>

    <section class="crm-split-grid gap-4">
      <article class="rounded-[8px] border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <p class="text-base font-semibold text-slate-950">Assuntos no escopo atual</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Escolha o assunto e o subassunto. O sistema continua estruturado em assunto, subassunto e decisoes internas, mas a leitura aqui deve ser simples para consulta.
          </p>
        </div>
        <div class="grid gap-3 px-5 py-4">
          <button
            v-for="row in filteredRows"
            :key="row.key"
            type="button"
            :class="[
              'rounded-[8px] border px-4 py-4 text-left transition',
              selectedSubjectKey === row.key
                ? 'border-[rgba(8,115,145,0.18)] bg-[rgba(224,242,254,0.48)]'
                : 'border-slate-200 bg-white hover:bg-slate-50',
            ]"
            @click="selectRow(row)"
          >
            <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Assunto</p>
            <p class="mt-1 text-sm font-semibold text-slate-950">{{ row.themeLabel }}</p>
            <p class="mt-3 text-xs font-semibold uppercase tracking-normal text-slate-500">Subassunto</p>
            <p class="mt-1 text-sm leading-6 text-slate-700">{{ row.subsubjectLabel }}</p>
            <p class="mt-3 text-xs text-slate-500">{{ row.suggestions.length }} sugestao(oes) registradas</p>
          </button>

          <p v-if="!filteredRows.length" class="text-sm leading-6 text-slate-600">
            Nenhum assunto foi encontrado neste escopo.
          </p>
        </div>
      </article>

      <article v-if="activeRow" class="grid gap-4">
        <section class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
          <div class="flex flex-wrap gap-2">
            <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Assunto: {{ activeRow.themeLabel }}
            </span>
            <span class="rounded-full border border-[rgba(8,115,145,0.12)] bg-[rgba(224,242,254,0.42)] px-3 py-1 text-xs font-semibold text-[#0b6e8c]">
              Subassunto: {{ activeRow.subsubjectLabel }}
            </span>
          </div>

          <div class="mt-4 grid gap-4">
            <div class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p class="text-sm font-semibold text-slate-900">FAQ do aluno</p>
              <p class="mt-2 text-sm leading-7 text-slate-700">
                {{ activeFaqLeaf?.resposta || 'Sem resposta vinculada da FAQ do aluno para este assunto.' }}
              </p>
            </div>

            <div class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p class="text-sm font-semibold text-slate-900">Orientacao operacional da area</p>
              <div class="mt-3 grid gap-4">
                <div v-for="section in guideSections" :key="section.title" class="grid gap-2">
                  <p class="text-sm font-semibold text-slate-900">{{ section.title }}</p>
                  <ul class="grid gap-1.5 text-sm leading-6 text-slate-700">
                    <li v-for="item in section.items" :key="item">{{ item }}</li>
                  </ul>
                </div>

                <div class="rounded-[8px] bg-white px-4 py-4 text-sm leading-6 text-slate-700">
                  <p><span class="font-semibold text-slate-900">Resposta sugerida:</span> {{ activeGuide?.responseTemplate || 'Sem resposta sugerida publicada para este assunto.' }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <details
          :open="showSuggestionComposer"
          class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white"
        >
          <summary class="cursor-pointer list-none border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-950">
            Sugerir melhoria da orientacao
          </summary>
          <div class="grid gap-3 px-5 py-5">
            <p class="text-sm leading-6 text-slate-600">
              Use esta etapa quando a operacao encontrar erro, lacuna, ambiguidade ou retrabalho recorrente neste assunto.
            </p>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Tipo de conteudo</span>
              <select
                v-model="form.contentType"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="faq_aluno">FAQ do aluno</option>
                <option value="orientacao_op">Orientacao do OP</option>
                <option value="playbook_area">Playbook da area</option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Titulo da sugestao</span>
              <input
                v-model="form.title"
                type="text"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
                placeholder="Ex.: esclarecer criterio de validacao"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Proposta de ajuste</span>
              <textarea
                v-model="form.proposalText"
                rows="4"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700"
                placeholder="Descreva o ajuste sugerido no conteudo vigente."
              ></textarea>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Justificativa operacional</span>
              <textarea
                v-model="form.rationale"
                rows="3"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700"
                placeholder="Explique o erro, lacuna ou retrabalho que motivou a sugestao."
              ></textarea>
            </label>

            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="rounded-[8px] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]"
                @click="submitSuggestion"
              >
                Registrar sugestao
              </button>
              <button
                type="button"
                class="rounded-[8px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                @click="closeSuggestionComposer"
              >
                Voltar para consulta
              </button>
              <p
                v-if="feedback.message"
                :class="[
                  'text-sm font-medium',
                  feedback.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]',
                ]"
              >
                {{ feedback.message }}
              </p>
            </div>
          </div>
        </details>

        <section v-if="relatedSuggestions.length" class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
          <p class="text-base font-semibold text-slate-950">Historico de sugestoes</p>
          <div class="mt-4 grid gap-3">
            <div
              v-for="item in relatedSuggestions"
              :key="item.id"
              class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
                <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {{ formatSuggestionStatus(item) }}
                </span>
              </div>
              <p class="mt-2 text-sm leading-6 text-slate-700">{{ item.proposalText }}</p>
              <p class="mt-2 text-xs text-slate-500">
                {{ item.authorName }} | {{ item.createdAtLabel }}
                <span v-if="item.reviewedAtLabel"> | {{ item.reviewedAtLabel }}</span>
              </p>
            </div>
          </div>
        </section>
      </article>

      <article v-else class="rounded-[8px] border border-slate-200 bg-white px-5 py-5">
        <p class="text-base font-semibold text-slate-950">Selecione um assunto</p>
        <p class="mt-2 text-sm leading-6 text-slate-600">
          Abra um assunto do escopo atual para consultar o conteudo vigente da area e, se necessario, registrar melhoria.
        </p>
      </article>
    </section>
  </div>
</template>
