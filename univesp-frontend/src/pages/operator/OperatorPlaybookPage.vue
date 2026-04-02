<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { buildStudentFaqHomeEntries, buildStudentFaqRuntime } from '@/services/faqRuntime'
import { buildOperationalStudentDirectory } from '@/services/operatorIntakeRuntime'
import { buildOperatorPlaybookGuide } from '@/services/operatorQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const isManagerView = computed(() => auth.mockContext.profileKey === 'gestor_polos')
const studentDirectory = buildOperationalStudentDirectory()
const selectedNodeId = ref(String(route.query.node || ''))
const isSubmitting = ref(false)
const feedback = ref({
  type: '',
  message: '',
})
const showEscalationConfirm = ref(false)
const manualStudentEntry = ref(String(route.query.manual || '') === '1')

const studentForm = reactive({
  nome: String(route.query.studentName || ''),
  ra: String(route.query.studentRa || ''),
  email: '',
  curso: '',
  polo: String(route.query.studentPolo || auth.mockContext.currentPolo || ''),
  contactChannel: String(route.query.contactChannel || 'telefone'),
  verifiedSummary: '',
})

const formErrors = reactive({
  nome: '',
  polo: '',
  node: '',
  verifiedSummary: '',
})

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

const availablePolos = computed(() =>
  Array.from(
    new Set([auth.mockContext.currentPolo, ...studentDirectory.map((student) => student.polo)].filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
)

const selectedStudentSummary = computed(() => {
  const parts = []

  if (studentForm.nome.trim()) {
    parts.push(studentForm.nome.trim())
  }

  if (studentForm.ra.trim()) {
    parts.push(`RA ${studentForm.ra.trim()}`)
  }

  if (studentForm.polo.trim()) {
    parts.push(`Polo ${studentForm.polo.trim()}`)
  }

  return parts.join(' - ')
})

const studentSuggestions = computed(() =>
  studentDirectory
    .filter((student) =>
      !studentForm.polo.trim() || normalizeText(student.polo) === normalizeText(studentForm.polo),
    )
    .map((student) => ({
      ...student,
      label: `${student.nome} - ${student.ra || 'Sem RA'} - ${student.polo}`,
    })),
)

function syncStudentFromKnownData() {
  if (manualStudentEntry.value) {
    return
  }

  const match = studentDirectory.find((student) => {
    const matchesPolo =
      !studentForm.polo.trim() || normalizeText(student.polo) === normalizeText(studentForm.polo)

    return (
      matchesPolo &&
      (
        (student.ra && student.ra === studentForm.ra) ||
        (student.email && student.email === studentForm.email) ||
        (student.nome && normalizeText(student.nome) === normalizeText(studentForm.nome))
      )
    )
  })

  if (!match) {
    return
  }

  studentForm.nome = match.nome
  studentForm.ra = match.ra || studentForm.ra
  studentForm.email = match.email || studentForm.email
  studentForm.curso = match.curso || studentForm.curso
  studentForm.polo = match.polo || studentForm.polo
}

const faqRuntime = computed(() => buildStudentFaqRuntime())
const faqNodeIndex = computed(() => {
  const index = new Map()

  function walk(nodes) {
    for (const node of nodes) {
      index.set(node.id, node)
      walk(node.children || [])
    }
  }

  walk(faqRuntime.value.tree)
  return index
})

const faqLeafNodes = computed(() => [...faqNodeIndex.value.values()].filter((node) => !node.children?.length))
const rootEntries = computed(() => buildStudentFaqHomeEntries())
const activeNode = computed(() =>
  selectedNodeId.value ? faqNodeIndex.value.get(selectedNodeId.value) || null : null,
)
const activeLineage = computed(() =>
  activeNode.value
    ? activeNode.value.runtime.lineage.map((nodeId) => faqNodeIndex.value.get(nodeId)).filter(Boolean)
    : [],
)
const activeChildren = computed(() => activeNode.value?.children || [])
const activeNodeIsLeaf = computed(() => Boolean(activeNode.value) && activeChildren.value.length === 0)
const playbookGuide = computed(() =>
  activeNodeIsLeaf.value
    ? buildOperatorPlaybookGuide({
        theme: activeNode.value.tema,
        subsubject: activeNode.value.subtema || activeNode.value.titulo_exibido,
      })
    : null,
)

const operatorGuideSections = computed(() => {
  if (!playbookGuide.value) {
    return []
  }

  return [
    {
      title: 'O que verificar',
      items: playbookGuide.value.checklist || [],
    },
    {
      title: 'Onde verificar',
      items: (playbookGuide.value.systemsToCheck || []).map((item) => `Consultar sistema: ${item}`),
    },
    {
      title: 'Documentos a observar',
      items: (playbookGuide.value.documentsRequested || []).map((item) => `Validar documento: ${item}`),
    },
  ].filter((section) => section.items.length)
})

const canProceedToSubject = computed(() => Boolean(studentForm.polo.trim() && (studentForm.nome.trim() || studentForm.ra.trim())))

const visibleOptions = computed(() => {
  if (!activeNode.value) {
    return rootEntries.value.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      highlighted: entry.highlighted,
      badgeLabel: entry.badgeLabel,
    }))
  }

  if (activeNodeIsLeaf.value) {
    return []
  }

  return activeChildren.value.map((child) => ({
    id: child.id,
    title: child.titulo_exibido,
    description: child.pergunta_exibida || child.descricao_interna || child.resposta || 'Continuar',
    highlighted: child.runtime.isHighlighted,
    badgeLabel: child.runtime.highlightLabel,
  }))
})

const scopeBadge = computed(() => {
  if (isManagerView.value) {
    return studentForm.polo.trim() ? `Polo ${studentForm.polo.trim()}` : 'Escopo: polos vinculados'
  }

  return `Polo ${auth.mockContext.currentPolo}`
})

const queueFlashStorageKey = computed(() => `univesp-operator-queue-flash:${auth.mockContext.profileKey}`)

function findLeafByThemeSubtheme() {
  const queryTheme = String(route.query.theme || '').trim().toLowerCase()
  const querySubtheme = String(route.query.subtheme || '').trim().toLowerCase()

  if (!queryTheme) {
    return null
  }

  return (
    faqLeafNodes.value.find(
      (node) =>
        String(node.tema || '').trim().toLowerCase() === queryTheme &&
        String(node.subtema || '').trim().toLowerCase() === querySubtheme,
    ) ||
    faqLeafNodes.value.find((node) => String(node.tema || '').trim().toLowerCase() === queryTheme) ||
    null
  )
}

function buildBaseQuery() {
  const query = {}

  if (studentForm.nome.trim()) {
    query.studentName = studentForm.nome.trim()
  }

  if (studentForm.ra.trim()) {
    query.studentRa = studentForm.ra.trim()
  }

  if (studentForm.polo.trim()) {
    query.studentPolo = studentForm.polo.trim()
  }

  if (studentForm.contactChannel) {
    query.contactChannel = studentForm.contactChannel
  }

  if (manualStudentEntry.value) {
    query.manual = '1'
  }

  return query
}

function clearFeedback() {
  feedback.value = {
    type: '',
    message: '',
  }
}

function openNode(nodeId) {
  clearFeedback()
  selectedNodeId.value = nodeId
  router.replace({ path: route.path, query: { ...buildBaseQuery(), node: nodeId } })
}

function goBack() {
  if (!activeLineage.value.length) {
    return
  }

  if (activeLineage.value.length === 1) {
    selectedNodeId.value = ''
    router.replace({ path: route.path, query: buildBaseQuery() })
    return
  }

  openNode(activeLineage.value.at(-2).id)
}

function toggleManualStudentEntry() {
  manualStudentEntry.value = !manualStudentEntry.value
}

function validateBeforeCreate() {
  formErrors.nome = studentForm.nome.trim() ? '' : 'Informe o aluno para continuar.'
  formErrors.polo = studentForm.polo.trim() ? '' : 'Informe o polo do atendimento.'
  formErrors.node = activeNodeIsLeaf.value ? '' : 'Percorra a orientacao ate chegar a uma resposta final.'
  formErrors.verifiedSummary = studentForm.verifiedSummary.trim()
    ? ''
    : 'Registre o que ja foi verificado antes de abrir, complementar ou escalar o atendimento.'

  return !formErrors.nome && !formErrors.polo && !formErrors.node && !formErrors.verifiedSummary
}

function buildStudentPayload() {
  return {
    nome: studentForm.nome.trim(),
    ra: studentForm.ra.trim(),
    email: studentForm.email.trim(),
    curso: studentForm.curso.trim(),
    polo: studentForm.polo.trim(),
  }
}

function buildContextPayload() {
  return {
    sessionId: `op-guidance-${Date.now()}`,
    capturedAt: new Date().toISOString(),
    capturedAtLabel: '',
    theme: activeNode.value.tema,
    subtheme: activeNode.value.subtema || null,
    breadcrumb: activeLineage.value.map((step) => step.titulo_exibido),
    breadcrumbPath: activeLineage.value.map((step) => ({
      id: step.id,
      title: step.titulo_exibido,
      nodeType: step.node_type || step.node_kind || 'leaf',
    })),
    finalNode: {
      id: activeNode.value.id,
      title: activeNode.value.titulo_exibido,
      nodeType: activeNode.value.node_type || activeNode.value.node_kind || 'leaf',
    },
    displayedAnswer: activeNode.value.resposta || '',
    action: activeNode.value.acao,
    queueDestination: activeNode.value.fila_destino,
    criticality: activeNode.value.criticidade_padrao,
    sla: activeNode.value.sla_padrao,
    calendarHighlight: activeNode.value.runtime.highlightLabel
      ? {
          label: activeNode.value.runtime.highlightLabel,
        }
      : null,
    studentPolo: studentForm.polo.trim(),
    entryOrigin:
      studentForm.contactChannel === 'presencial'
        ? 'Atendimento presencial'
        : studentForm.contactChannel === 'email'
          ? 'Atendimento por e-mail'
          : studentForm.contactChannel === 'outro'
            ? 'Atendimento por outro canal'
            : 'Atendimento por telefone',
    routing: activeNode.value.runtime.routing || null,
    opensTicket: Boolean(activeNode.value.abre_atendimento),
    allowsAttachment: Boolean(activeNode.value.permite_anexo),
    requiredFields: Array.isArray(activeNode.value.campos_exigidos) ? [...activeNode.value.campos_exigidos] : [],
    subject: activeNode.value.titulo_exibido || [activeNode.value.tema, activeNode.value.subtema].filter(Boolean).join(' / '),
  }
}

function submitAssistedCase(actionType) {
  if (!validateBeforeCreate()) {
    clearFeedback()
    return
  }

  isSubmitting.value = true
  clearFeedback()

  const result = studentSupportStore.createOperatorAssistedCase({
    studentData: buildStudentPayload(),
    context: buildContextPayload(),
    verifiedSummary: studentForm.verifiedSummary.trim(),
    contactChannel: studentForm.contactChannel,
    actorName: auth.mockContext.userName,
    actionType,
    playbook: playbookGuide.value,
  })

  isSubmitting.value = false
  showEscalationConfirm.value = false

  if (!result?.caseItem) {
    feedback.value = {
      type: 'error',
      message: 'Nao foi possivel registrar o atendimento agora. Tente novamente.',
    }
    return
  }

  feedback.value = {
    type: 'success',
    message:
      actionType === 'open_case'
        ? 'Atendimento aberto em nome do aluno com sucesso.'
        : actionType === 'request_info'
          ? 'Atendimento aberto e pedido de complementacao registrado.'
          : 'Atendimento aberto e escalado para area interna.',
  }

  if (actionType === 'escalate' && auth.mockContext.profileKey === 'op') {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        queueFlashStorageKey.value,
        'Atendimento aberto pelo OP e escalado para a area interna com triagem registrada.',
      )
    }

    router.push('/op/fila')
    return
  }

  router.push(`/op/fila/${result.caseItem.protocolNumber}`)
}

function handleEscalation() {
  if (!validateBeforeCreate()) {
    clearFeedback()
    return
  }

  showEscalationConfirm.value = true
}

watch(
  () => [studentForm.nome, studentForm.ra, studentForm.email, studentForm.polo, manualStudentEntry.value],
  () => {
    syncStudentFromKnownData()
  },
)

watch(
  () => route.query.node,
  (nodeId) => {
    const normalized = String(nodeId || '')

    if (!normalized) {
      const leaf = findLeafByThemeSubtheme()
      selectedNodeId.value = leaf?.id || ''
      return
    }

    if (faqNodeIndex.value.has(normalized)) {
      selectedNodeId.value = normalized
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[16px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">Abertura assistida</p>
          <h2 class="mt-2 text-[1.45rem] font-semibold leading-tight text-slate-950">
            Abrir atendimento em nome do aluno
          </h2>
          <p class="mt-2 max-w-[760px] text-sm leading-6 text-slate-600">
            Identifique o aluno, confirme o assunto e registre o atendimento somente quando a tratativa realmente precisar continuar no portal.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span
            class="rounded-full border border-[rgba(209,50,57,0.12)] bg-[rgba(209,50,57,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-dark)]"
          >
            {{ scopeBadge }}
          </span>
          <span
            v-if="selectedStudentSummary"
            class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {{ selectedStudentSummary }}
          </span>
        </div>
      </div>
    </section>

    <section class="rounded-[16px] border border-slate-200 bg-white px-5 py-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">1. Identificar o aluno</p>
          <h3 class="mt-2 text-[1.1rem] font-semibold text-slate-950">Quem e o aluno?</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Para o OP, o polo ja vem no escopo atual. Se o aluno nao estiver na base, voce pode informar manualmente.
          </p>
        </div>

        <button
          type="button"
          class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          @click="toggleManualStudentEntry"
        >
          {{ manualStudentEntry ? 'Usar base do polo' : 'Aluno nao encontrado?' }}
        </button>
      </div>

      <div class="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">Aluno</span>
          <input
            v-model="studentForm.nome"
            :list="manualStudentEntry ? undefined : 'operator-student-directory'"
            type="text"
            class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            placeholder="Nome do aluno"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">RA</span>
          <input
            v-model="studentForm.ra"
            type="text"
            class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            placeholder="RA"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">Polo</span>
          <template v-if="isManagerView">
            <select
              v-model="studentForm.polo"
              class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            >
              <option v-for="polo in availablePolos" :key="polo" :value="polo">
                {{ polo }}
              </option>
            </select>
          </template>
          <div
            v-else
            class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            {{ studentForm.polo }}
          </div>
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">Canal</span>
          <select
            v-model="studentForm.contactChannel"
            class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
          >
            <option value="telefone">Telefone</option>
            <option value="presencial">Presencial</option>
            <option value="email">E-mail</option>
            <option value="outro">Outro</option>
          </select>
        </label>
      </div>

      <div v-if="manualStudentEntry" class="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">E-mail</span>
          <input
            v-model="studentForm.email"
            type="email"
            class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            placeholder="E-mail do aluno"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-semibold text-slate-700">Curso</span>
          <input
            v-model="studentForm.curso"
            type="text"
            class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-700"
            placeholder="Curso do aluno"
          />
        </label>
      </div>

      <p v-if="formErrors.nome || formErrors.polo" class="mt-3 text-sm font-semibold text-[var(--color-danger)]">
        {{ formErrors.nome || formErrors.polo }}
      </p>
    </section>

    <section class="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
      <div class="px-5 py-5">
        <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">2. Escolher o assunto</p>
        <h3 class="mt-2 text-[1.1rem] font-semibold text-slate-950">Sobre o que e o atendimento?</h3>
        <p v-if="!canProceedToSubject" class="mt-2 text-sm leading-6 text-slate-600">
          Identifique primeiro o aluno para seguir pela FAQ e abrir o atendimento com o contexto correto.
        </p>
        <template v-else>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Siga o mesmo caminho da FAQ do aluno para registrar o atendimento com o assunto correto.
          </p>

          <div v-if="activeLineage.length" class="mt-4 flex flex-wrap gap-2">
            <button
              v-for="step in activeLineage"
              :key="step.id"
              type="button"
              class="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
              @click="openNode(step.id)"
            >
              {{ step.titulo_exibido }}
            </button>
          </div>
        </template>
      </div>

      <template v-if="canProceedToSubject">
        <div v-if="!activeNode" class="border-t border-slate-200 px-5 py-4">
          <div class="grid gap-3 md:grid-cols-2">
            <button
              v-for="option in visibleOptions"
              :key="option.id"
              type="button"
              :class="[
                'rounded-[14px] border px-4 py-4 text-left transition hover:bg-slate-50',
                option.highlighted
                  ? 'border-[rgba(209,50,57,0.16)] bg-[rgba(209,50,57,0.04)]'
                  : 'border-slate-200 bg-white',
              ]"
              @click="openNode(option.id)"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-base font-semibold text-slate-950">{{ option.title }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">{{ option.description }}</p>
                </div>
                <span
                  v-if="option.badgeLabel"
                  class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--color-primary-dark)] ring-1 ring-[rgba(209,50,57,0.12)]"
                >
                  {{ option.badgeLabel }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <div v-else-if="!activeNodeIsLeaf" class="border-t border-slate-200">
          <button
            v-for="option in visibleOptions"
            :key="option.id"
            type="button"
            :class="[
              'flex w-full items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-50',
              option.highlighted ? 'bg-[rgba(209,50,57,0.04)]' : 'bg-white',
            ]"
            @click="openNode(option.id)"
          >
            <div>
              <p class="text-base font-semibold text-slate-950">{{ option.title }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ option.description }}</p>
            </div>
            <span aria-hidden="true" class="mt-1 text-lg font-semibold text-slate-400">&gt;</span>
          </button>
        </div>

        <div v-else class="border-t border-slate-200 px-5 py-5">
          <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">Assunto confirmado</p>
              <h4 class="mt-2 text-[1.1rem] font-semibold text-slate-950">{{ activeNode.titulo_exibido }}</h4>
              <p class="mt-2 max-w-[720px] text-sm leading-6 text-slate-600">
                Confira a orientacao que o aluno encontraria e, em seguida, como o OP deve analisar antes de registrar o atendimento.
              </p>
            </div>

            <button
              type="button"
              class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="goBack"
            >
              Etapa anterior
            </button>
          </div>

          <div class="mt-4 grid gap-4">
            <div class="rounded-[16px] border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">FAQ do aluno</p>
              <p class="mt-3 text-sm leading-7 text-slate-700">{{ activeNode.resposta }}</p>
            </div>

            <div class="rounded-[16px] border border-slate-200 bg-white px-4 py-4">
              <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">Como o OP deve analisar</p>

              <div class="mt-4 grid gap-4">
                <div
                  v-for="section in operatorGuideSections"
                  :key="section.title"
                  class="grid gap-2"
                >
                  <p class="text-sm font-semibold text-slate-900">{{ section.title }}</p>
                  <ul class="grid gap-1.5 text-sm leading-6 text-slate-700">
                    <li v-for="item in section.items" :key="item">
                      {{ item }}
                    </li>
                  </ul>
                </div>

                <div class="grid gap-2 rounded-[14px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                  <p><span class="font-semibold text-slate-900">Abrir atendimento:</span> quando a tratativa precisar continuar no portal.</p>
                  <p><span class="font-semibold text-slate-900">Pedir complementacao:</span> quando ainda faltar documento, evidencia ou confirmacao.</p>
                  <p><span class="font-semibold text-slate-900">Escalar:</span> apenas quando a regra do caso exigir decisao da area interna.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>

    <section v-if="activeNodeIsLeaf" class="rounded-[16px] border border-slate-200 bg-white px-5 py-5">
      <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">3. Registrar a triagem</p>
      <h3 class="mt-2 text-[1.1rem] font-semibold text-slate-950">O que ja foi verificado?</h3>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        Registre a triagem feita antes de abrir, complementar ou escalar o atendimento.
      </p>

      <textarea
        v-model="studentForm.verifiedSummary"
        rows="4"
        class="mt-4 rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700"
        placeholder="Ex.: documento conferido, regra validada, contato confirmado, orientacao explicada ao aluno."
      />

      <p v-if="formErrors.verifiedSummary" class="mt-2 text-sm font-semibold text-[var(--color-danger)]">
        {{ formErrors.verifiedSummary }}
      </p>
    </section>

    <section v-if="activeNodeIsLeaf" class="rounded-[16px] border border-slate-200 bg-[rgba(209,50,57,0.03)] px-5 py-5">
      <p class="text-xs font-semibold tracking-[0.12em] text-slate-500">4. Registrar o atendimento</p>
      <h3 class="mt-2 text-[1.1rem] font-semibold text-slate-950">Como o atendimento deve seguir?</h3>
      <p class="mt-2 text-sm leading-6 text-slate-600">
        Use o assunto confirmado e a triagem registrada para abrir o atendimento correto no portal.
      </p>

      <div
        v-if="feedback.message"
        :class="[
          'mt-4 rounded-[14px] border px-4 py-3 text-sm leading-6',
          feedback.type === 'success'
            ? 'border-[rgba(26,111,67,0.16)] bg-[rgba(26,111,67,0.08)] text-[var(--color-success)]'
            : 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]',
        ]"
      >
        {{ feedback.message }}
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          :disabled="isSubmitting"
          class="min-w-0 rounded-[14px] bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold leading-5 text-white shadow-[0_12px_28px_rgba(209,50,57,0.16)] disabled:cursor-wait disabled:opacity-75"
          @click="submitAssistedCase('open_case')"
        >
          {{ isSubmitting ? 'Registrando...' : 'Abrir atendimento em nome do aluno' }}
        </button>

        <button
          type="button"
          :disabled="isSubmitting"
          class="min-w-0 rounded-[14px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold leading-5 text-slate-700 disabled:cursor-wait disabled:opacity-75"
          @click="submitAssistedCase('request_info')"
        >
          Registrar pedido de complementacao
        </button>

        <button
          type="button"
          :disabled="isSubmitting"
          class="min-w-0 rounded-[14px] border border-dashed border-[rgba(8,115,145,0.24)] bg-white px-5 py-3 text-sm font-semibold leading-5 text-[#0b4f75] disabled:cursor-wait disabled:opacity-75"
          @click="handleEscalation"
        >
          Continuar para escalonamento
        </button>
      </div>

      <div
        v-if="showEscalationConfirm"
        class="mt-4 rounded-[14px] border border-[rgba(8,115,145,0.16)] bg-white p-4"
      >
        <p class="text-sm font-semibold text-slate-900">Confirmar escalonamento</p>
        <div class="mt-3 grid gap-3 text-sm leading-6 text-slate-600">
          <div>
            <p class="text-xs font-semibold tracking-[0.08em] text-slate-500">Destino</p>
            <p class="mt-1 font-semibold text-slate-900">{{ activeNode.runtime.queueLabel || activeNode.fila_destino }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold tracking-[0.08em] text-slate-500">O que sera registrado</p>
            <p class="mt-1">{{ studentForm.verifiedSummary.trim() }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold tracking-[0.08em] text-slate-500">Regra observada</p>
            <p class="mt-1">{{ playbookGuide?.escalationCriteria || playbookGuide?.escalationReason || 'Sem regra adicional publicada.' }}</p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            :disabled="isSubmitting"
            class="rounded-[14px] bg-[#0b4f75] px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-75"
            @click="submitAssistedCase('escalate')"
          >
            Confirmar escalonamento
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            @click="showEscalationConfirm = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>

    <datalist id="operator-student-directory">
      <option
        v-for="student in studentSuggestions"
        :key="student.label"
        :value="student.nome"
      >
        {{ student.label }}
      </option>
    </datalist>
  </div>
</template>
