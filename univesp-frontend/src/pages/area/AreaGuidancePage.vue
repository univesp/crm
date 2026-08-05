<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createKnowledgeSuggestion,
  getKnowledgeV3Bundle,
  isMockRuntimeEnabled,
  listKnowledgeSuggestions,
  listKnowledgeV3Bundles,
} from '@/services/appApi'
import { buildStudentFaqRuntime } from '@/services/faqRuntime'
import { buildOperatorPlaybookGuide } from '@/services/operatorQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const remoteBundles = ref([])
const remoteSuggestions = ref([])
const remoteLoading = ref(false)
const remoteError = ref('')

const usesRemoteKnowledge = computed(() => !isMockRuntimeEnabled())

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

function graphPath(payload = {}, nodeId = '') {
  const parentByChild = new Map()
  for (const edge of payload.edges || []) {
    if (edge?.child_node_id && edge?.parent_node_id) {
      parentByChild.set(edge.child_node_id, edge.parent_node_id)
    }
  }

  const path = []
  const visited = new Set()
  let current = nodeId
  while (current && !visited.has(current)) {
    visited.add(current)
    path.unshift(current)
    current = parentByChild.get(current) || ''
  }
  return path
}

function firstTextBlock(node, layer = 'student') {
  return (node?.content?.[layer]?.blocks || []).find(
    (block) => block?.type === 'text' && block?.block_id,
  ) || null
}

function textFromBlocks(node, layer = 'student') {
  return (node?.content?.[layer]?.blocks || [])
    .map((block) => block?.body || block?.text || '')
    .filter(Boolean)
    .join('\n')
}

function playbookGuide(node, layer = 'analyst') {
  const playbook = node?.playbooks?.[layer] || node?.playbooks?.op || {}
  return {
    checklist: playbook.checklist || [],
    systemsToCheck: playbook.systems || [],
    documentsRequested: playbook.documents_to_request || [],
    responseTemplate: playbook.suggested_reply || '',
  }
}

function buildRemoteRows() {
  const suggestionsByNode = new Map()
  for (const suggestion of remoteSuggestions.value) {
    const key = `${suggestion.bundle_key}::${suggestion.node_id}`
    suggestionsByNode.set(key, [...(suggestionsByNode.get(key) || []), suggestion])
  }

  return remoteBundles.value.flatMap((bundle) => {
    const payload = bundle.published?.payload || {}
    const nodes = (payload.nodes || []).filter(
      (node) => node?.node_id && ['final', 'leaf', 'answer'].includes(node.node_kind),
    )
    return nodes.map((node) => {
      const operational = node.operational || {}
      const themeKey = payload.theme_key || bundle.theme_key || ''
      const subsubjectKey = operational.subsubject_key || node.display?.title || node.node_id
      const block = firstTextBlock(node, 'student')
      const playbook = node.playbooks?.analyst || node.playbooks?.op || {}
      const targetRef = block
        ? { type: 'content_block', id: block.block_id, node_id: node.node_id }
        : { type: 'node', id: node.node_id, node_id: node.node_id }

      return {
        bundleKey: bundle.bundle_key,
        versionId: bundle.published?.version_id || bundle.published_version || '',
        nodeId: node.node_id,
        targetPath: graphPath(payload, node.node_id),
        targetRef,
        currentValue: block || node,
        themeKey,
        subsubjectKey,
        subjectLabel: payload.metadata?.title || bundle.title || themeKey,
        faqLeaf: { resposta: textFromBlocks(node, 'student') },
        guide: playbookGuide(node, 'analyst'),
        playbook,
        suggestions: suggestionsByNode.get(`${bundle.bundle_key}::${node.node_id}`) || [],
      }
    })
  })
}

const remoteKnowledgeRows = computed(() => buildRemoteRows())

async function loadRemoteKnowledge() {
  remoteLoading.value = true
  remoteError.value = ''
  try {
    const bundlesResponse = await listKnowledgeV3Bundles({ status: 'active', page_size: 100 })
    const bundles = bundlesResponse.data || []
    const details = await Promise.all(
      bundles.map(async (bundle) => {
        try {
          return (await getKnowledgeV3Bundle(bundle.bundle_key)).data
        } catch {
          return null
        }
      }),
    )
    remoteBundles.value = details.filter(Boolean)
    remoteSuggestions.value = (await listKnowledgeSuggestions({ page_size: 100 })).data || []
    if (!selectedSubjectKey.value && searchableRows.value[0]) {
      selectedSubjectKey.value = searchableRows.value[0].key
    }
  } catch (error) {
    remoteError.value = error?.message || 'Não foi possível carregar o conteúdo vigente da área.'
  } finally {
    remoteLoading.value = false
  }
}

onMounted(() => {
  if (usesRemoteKnowledge.value) {
    loadRemoteKnowledge()
  }
})

const localKnowledgeRows = computed(() => studentSupportStore.areaKnowledgeRows(auth.mockContext))
const knowledgeRows = computed(() => (usesRemoteKnowledge.value ? remoteKnowledgeRows.value : localKnowledgeRows.value))
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

  if (usesRemoteKnowledge.value) {
    return activeRow.value.faqLeaf || null
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

const activeGuide = computed(() => {
  if (!activeRow.value) {
    return null
  }

  if (usesRemoteKnowledge.value) {
    return activeRow.value.guide || null
  }

  return buildOperatorPlaybookGuide({
    theme: activeRow.value.themeKey,
    subsubject: activeRow.value.subsubjectKey,
  })
})

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

  if (item.state === 'received' || statusCode === 'Pending Review' || item.status === 'pending') {
    return 'Sugestao pendente'
  }

  if (item.state === 'in_review') {
    return 'Em analise'
  }

  if (item.state === 'incorporated') {
    return 'Incorporada ao rascunho'
  }

  if (item.state === 'rejected') {
    return 'Recusada'
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

function suggestionTitle(item) {
  if (!usesRemoteKnowledge.value) return item.title
  return String(item.reason || 'Sugestão de melhoria').split(':')[0]
}

function suggestionProposal(item) {
  if (!usesRemoteKnowledge.value) return item.proposalText
  const value = item.proposed_value
  if (typeof value === 'string') return value
  if (value?.body) return value.body
  return JSON.stringify(value || {}, null, 2)
}

function suggestionAuthor(item) {
  return item.author_name || item.authorName || 'Você'
}

function suggestionDate(item) {
  return item.created_at || item.createdAtLabel || ''
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

function buildRemoteSuggestionPayload() {
  const layer =
    form.contentType === 'faq_aluno'
      ? 'student'
      : form.contentType === 'orientacao_op'
        ? 'op'
        : 'analyst'
  const target = activeRow.value
  const targetRef =
    layer === 'student'
      ? target.targetRef
      : {
          type: 'playbook_field',
          field: 'suggested_reply',
          node_id: target.nodeId,
        }
  const proposedValue =
    layer === 'student' && target.targetRef?.type === 'content_block'
      ? { ...target.currentValue, body: form.proposalText.trim() }
      : layer === 'student'
        ? {
            ...target.currentValue,
            content: {
              ...(target.currentValue.content || {}),
              student: {
                ...(target.currentValue.content?.student || {}),
                blocks: [
                  {
                    block_id: `${target.nodeId}-suggestion`,
                    type: 'text',
                    body: form.proposalText.trim(),
                  },
                ],
              },
            },
          }
        : form.proposalText.trim()

  return {
    bundle_key: target.bundleKey,
    version_id: target.versionId,
    node_id: target.nodeId,
    audience_layer: layer,
    target_path: target.targetPath,
    target_ref: targetRef,
    proposed_value: proposedValue,
    reason: `${form.title.trim()}: ${form.rationale.trim()}`,
  }
}

async function submitSuggestion() {
  if (!activeRow.value || !form.title.trim() || !form.proposalText.trim() || !form.rationale.trim()) {
    feedback.type = 'error'
    feedback.message = 'Preencha titulo, proposta e justificativa para registrar a sugestao.'
    return
  }

  if (usesRemoteKnowledge.value) {
    if (
      !activeRow.value.bundleKey ||
      !activeRow.value.versionId ||
      !activeRow.value.targetPath?.length
    ) {
      feedback.type = 'error'
      feedback.message = 'Esta orientação ainda não possui uma referência publicada para receber sugestões.'
      return
    }

    try {
      const result = await createKnowledgeSuggestion(buildRemoteSuggestionPayload())
      remoteSuggestions.value = [result.data, ...remoteSuggestions.value]
    } catch (error) {
      feedback.type = 'error'
      feedback.message = error?.message || 'Não foi possível registrar a sugestão.'
      return
    }
  } else {
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
  }

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

    <p v-if="remoteLoading" class="text-sm text-slate-600" role="status">
      Carregando conteúdo vigente da área…
    </p>
    <p v-if="remoteError" class="crm-alert crm-alert--danger" role="alert">
      {{ remoteError }}
    </p>

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
                <p class="text-sm font-semibold text-slate-950">{{ suggestionTitle(item) }}</p>
                <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {{ formatSuggestionStatus(item) }}
                </span>
              </div>
              <p class="mt-2 text-sm leading-6 text-slate-700">{{ suggestionProposal(item) }}</p>
              <p class="mt-2 text-xs text-slate-500">
                {{ suggestionAuthor(item) }} | {{ suggestionDate(item) }}
                <span v-if="item.reviewedAtLabel || item.reviewed_at"> | {{ item.reviewedAtLabel || item.reviewed_at }}</span>
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
