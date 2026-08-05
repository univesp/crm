<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { buildOperatorFaqHomeEntries, buildOperatorFaqRuntime } from '@/services/faqRuntime'
import { buildOperationalStudentDirectory } from '@/services/operatorIntakeRuntime'
import { buildOperatorPlaybookGuide } from '@/services/operatorQueueRuntime'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const selectedNodeId = ref(String(route.query.node || ''))
const manualStudentEntry = ref(false)
const selectedCandidate = ref(null)
const confirmedStudent = ref(null)
const selectedAction = ref('')
const verifiedSummary = ref('')
const verifiedSummaryRef = ref(null)
const pendingConfirmationAction = ref('')
const isSubmitting = ref(false)
const confirmationPanelRef = ref(null)
const actionFeedback = ref({
  type: '',
  message: '',
})

const formErrors = reactive({
  student: '',
  contactChannel: '',
  verifiedSummary: '',
  action: '',
})

const lookup = reactive({
  nome: '',
  ra: '',
  curso: '',
  polo: auth.mockContext.currentPolo || '',
  contactChannel: '',
})

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function withPeriod(value = '') {
  const text = String(value || '').trim()

  if (!text) {
    return ''
  }

  return /[.!?]$/.test(text) ? text : `${text}.`
}

const faqRuntime = computed(() => buildOperatorFaqRuntime())
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
const rootEntries = computed(() => buildOperatorFaqHomeEntries())
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

const directory = computed(() => buildOperationalStudentDirectory())
const courseOptions = computed(() =>
  Array.from(
    new Set(
      directory.value
        .filter((student) => (lookup.polo ? normalizeText(student.polo) === normalizeText(lookup.polo) : true))
        .map((student) => student.curso)
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, 'pt-BR')),
)

const filteredStudents = computed(() => {
  const nameQuery = normalizeText(lookup.nome)
  const raQuery = normalizeText(lookup.ra)
  const courseQuery = normalizeText(lookup.curso)

  return directory.value
    .filter((student) => (lookup.polo ? normalizeText(student.polo) === normalizeText(lookup.polo) : true))
    .filter((student) => (nameQuery ? normalizeText(student.nome).includes(nameQuery) : true))
    .filter((student) => (raQuery ? normalizeText(student.ra).includes(raQuery) : true))
    .filter((student) => (courseQuery ? normalizeText(student.curso).includes(courseQuery) : true))
    .slice(0, 8)
})

const shouldShowSuggestions = computed(
  () => !manualStudentEntry.value && Boolean(lookup.nome.trim() || lookup.ra.trim() || lookup.curso.trim()),
)

const activeContext = computed(() => {
  if (!activeNode.value) {
    return null
  }

  return {
    theme: activeNode.value.tema,
    subtheme: activeNode.value.subtema || activeNode.value.titulo_exibido,
    breadcrumb: activeLineage.value.map((item) => item.titulo_exibido),
    finalNode: {
      id: activeNode.value.id,
      title: activeNode.value.titulo_exibido,
      nodeType: activeNode.value.node_type || 'leaf',
    },
    displayedAnswer: activeNode.value.resposta || '',
    action: activeNode.value.ação || null,
    queueDestination: activeNode.value.fila_destino || null,
    criticality: activeNode.value.criticidade_padrao || null,
    sla: activeNode.value.sla_padrao || null,
    subject: activeNode.value.titulo_exibido,
  }
})

const playbookGuide = computed(() =>
  activeNodeIsLeaf.value
    ? buildOperatorPlaybookGuide({
        theme: activeNode.value.tema,
        subsubject: activeNode.value.subtema || activeNode.value.titulo_exibido,
      })
    : null,
)

const guideSections = computed(() => {
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

const actionOptions = computed(() => [
  {
    id: 'open_case',
    title: 'Abrir atendimento para o aluno',
    description: 'A tratativa precisa continuar no portal com um registro formal.',
    buttonLabel: 'Confirmar abertura do atendimento',
    toneClass:
      selectedAction.value === 'open_case'
        ? 'border-[rgba(209,50,57,0.22)] bg-[rgba(209,50,57,0.06)] text-[var(--color-primary-dark)]'
        : 'border-slate-200 bg-white text-slate-700',
    confirmClass: 'bg-[var(--color-primary)] text-white',
  },
  {
    id: 'request_info',
    title: 'Registrar pedido de complementação',
    description: 'Ainda faltam informações, print, documento ou confirmação do relato.',
    buttonLabel: 'Confirmar pedido de complementação',
    toneClass:
      selectedAction.value === 'request_info'
        ? 'border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.16)] text-[#9a5b00]'
        : 'border-slate-200 bg-white text-slate-700',
    confirmClass: 'border border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.86)] text-[#8a5200]',
  },
  {
    id: 'escalate',
    title: 'Continuar para escalonamento',
    description: 'A triagem foi feita, mas a regra do caso exige apoio da área interna.',
    buttonLabel: 'Confirmar escalonamento',
    toneClass:
      selectedAction.value === 'escalate'
        ? 'border-[rgba(8,115,145,0.22)] bg-[rgba(224,242,254,0.16)] text-[#0b6e8c]'
        : 'border-slate-200 bg-white text-slate-700',
    confirmClass: 'bg-[#0f4c81] text-white',
  },
])

const activeAction = computed(
  () => actionOptions.value.find((item) => item.id === selectedAction.value) || null,
)

const selectedStudentSummary = computed(() => {
  if (!confirmedStudent.value) {
    return []
  }

  return [
    confirmedStudent.value.nome,
    confirmedStudent.value.ra ? `RA ${confirmedStudent.value.ra}` : '',
    confirmedStudent.value.curso || '',
    confirmedStudent.value.contactChannelLabel,
  ].filter(Boolean)
})

const canChooseSubject = computed(() => Boolean(confirmedStudent.value))
const canShowDetailFlow = computed(() => Boolean(confirmedStudent.value && activeNodeIsLeaf.value && activeContext.value))
const confirmationCopy = computed(() => {
  if (!pendingConfirmationAction.value || !activeAction.value) {
    return null
  }

  if (pendingConfirmationAction.value === 'open_case') {
    return {
      title: 'Confirmar abertura do atendimento',
      consequence: 'Um novo atendimento será registrado em nome do aluno com a triagem informada.',
      buttonLabel: activeAction.value.buttonLabel,
      buttonClass: activeAction.value.confirmClass,
    }
  }

  if (pendingConfirmationAction.value === 'request_info') {
    return {
      title: 'Confirmar pedido de complementação',
      consequence: 'O atendimento já será criado com pedido de complementação ao aluno e ficará aguardando retorno.',
      buttonLabel: activeAction.value.buttonLabel,
      buttonClass: activeAction.value.confirmClass,
    }
  }

  return {
    title: 'Confirmar escalonamento',
    consequence: 'O atendimento será aberto e encaminhado para a área interna com os subsídios registrados.',
    buttonLabel: activeAction.value.buttonLabel,
    buttonClass: activeAction.value.confirmClass,
  }
})

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

function openNode(nodeId) {
  selectedNodeId.value = nodeId
  router.replace({ path: route.path, query: { node: nodeId } })
}

function goBackFaqStep() {
  if (!activeLineage.value.length) {
    return
  }

  if (activeLineage.value.length === 1) {
    selectedNodeId.value = ''
    router.replace({ path: route.path, query: {} })
    return
  }

  openNode(activeLineage.value.at(-2).id)
}

function pickStudent(student) {
  selectedCandidate.value = {
    nome: student.nome,
    ra: student.ra,
    curso: student.curso,
    email: student.email || '',
    polo: student.polo,
  }

  lookup.nome = student.nome || ''
  lookup.ra = student.ra || ''
  lookup.curso = student.curso || ''
  lookup.polo = student.polo || lookup.polo
  formErrors.student = ''
}

function resetConfirmedStudent() {
  confirmedStudent.value = null
}

function toggleManualEntry() {
  manualStudentEntry.value = !manualStudentEntry.value
  selectedCandidate.value = null
  resetConfirmedStudent()
  formErrors.student = ''

  if (manualStudentEntry.value) {
    lookup.nome = ''
    lookup.ra = ''
  }
}

function confirmStudent() {
  formErrors.student = ''
  formErrors.contactChannel = ''

  if (!lookup.contactChannel) {
    formErrors.contactChannel = 'Escolha a forma de atendimento antes de continuar.'
  }

  let payload = null

  if (manualStudentEntry.value) {
    if (!lookup.nome.trim()) {
      formErrors.student = 'Informe pelo menos o nome do aluno para continuar.'
    } else {
      payload = {
        nome: lookup.nome.trim(),
        ra: lookup.ra.trim(),
        curso: lookup.curso.trim(),
        email: '',
        polo: lookup.polo || auth.mockContext.currentPolo || '',
      }
    }
  } else if (selectedCandidate.value) {
    payload = {
      ...selectedCandidate.value,
      polo: selectedCandidate.value.polo || lookup.polo || auth.mockContext.currentPolo || '',
    }
  } else {
    formErrors.student = 'Selecione um aluno da base ou use a entrada manual.'
  }

  if (formErrors.student || formErrors.contactChannel || !payload) {
    return
  }

  confirmedStudent.value = {
    ...payload,
    contactChannel: lookup.contactChannel,
    contactChannelLabel: lookup.contactChannel === 'presencial'
      ? 'Presencial'
      : lookup.contactChannel === 'email'
        ? 'E-mail'
        : lookup.contactChannel === 'outro'
          ? 'Outro'
          : 'Telefone',
  }
}

function editConfirmedStudent() {
  resetConfirmedStudent()
}

function resetActionState() {
  selectedAction.value = ''
  verifiedSummary.value = ''
  pendingConfirmationAction.value = ''
  actionFeedback.value = {
    type: '',
    message: '',
  }
  formErrors.verifiedSummary = ''
  formErrors.action = ''
}

function chooseAction(actionId) {
  selectedAction.value = actionId
  pendingConfirmationAction.value = ''
  formErrors.action = ''
  actionFeedback.value = {
    type: '',
    message: '',
  }
}

function requestActionConfirmation() {
  formErrors.verifiedSummary = ''
  formErrors.action = ''
  actionFeedback.value = {
    type: '',
    message: '',
  }

  if (!selectedAction.value) {
    formErrors.action = 'Escolha como o atendimento deve seguir antes de confirmar.'
    return
  }

  if (!verifiedSummary.value.trim()) {
    formErrors.verifiedSummary = 'Registre o que já foi verificado antes de continuar.'
    nextTick(() => {
      verifiedSummaryRef.value?.focus()
    })
    return
  }

  pendingConfirmationAction.value = selectedAction.value
}

function submitAssistedAction() {
  if (!confirmedStudent.value || !activeContext.value || !pendingConfirmationAction.value || isSubmitting.value) {
    return
  }

  isSubmitting.value = true

  const result = studentSupportStore.createOperatorAssistedCase({
    studentData: {
      nome: confirmedStudent.value.nome,
      email: confirmedStudent.value.email || '',
      ra: confirmedStudent.value.ra || '',
      curso: confirmedStudent.value.curso || '',
      polo: confirmedStudent.value.polo || auth.mockContext.currentPolo || '',
    },
    context: activeContext.value,
    verifiedSummary: verifiedSummary.value.trim(),
    contactChannel: confirmedStudent.value.contactChannel,
    actorName: auth.mockContext.userName,
    actionType: pendingConfirmationAction.value,
    playbook: playbookGuide.value,
    currentDate: new Date(),
  })

  isSubmitting.value = false

  if (!result?.caseItem) {
    actionFeedback.value = {
      type: 'error',
      message:
        result?.errorMessage ||
        'Não foi possível registrar o atendimento agora. Verifique o responsável pelo atendimento e tente novamente.',
    }
    return
  }

  router.push(`/op/fila/${result.caseItem.protocolNumber}`)
}

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

watch(
  () => [lookup.nome, lookup.ra, lookup.curso, lookup.polo, lookup.contactChannel, manualStudentEntry.value],
  () => {
    resetConfirmedStudent()
    formErrors.student = ''
    formErrors.contactChannel = ''
  },
)

watch(
  () => [confirmedStudent.value?.nome, selectedNodeId.value],
  () => {
    resetActionState()
  },
)

watch(pendingConfirmationAction, (actionType) => {
  if (!actionType) {
    return
  }

  nextTick(() => {
    confirmationPanelRef.value?.focus()
  })
})

watch(
  () => auth.mockContext.currentPolo,
  (currentPolo) => {
    lookup.polo = currentPolo || ''
  },
)
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-[8px] border border-slate-200 bg-white px-4 py-4">
      <p class="max-w-[860px] text-sm font-semibold leading-6 text-slate-900">
        Identifique o aluno, confirme o assunto pela mesma FAQ do portal e registre o atendimento somente quando a tratativa realmente precisar continuar.
      </p>
    </section>

    <section class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 bg-slate-100/90 px-4 py-3">
        <p class="text-base font-semibold text-slate-950">1. Identificar o aluno</p>
      </div>

      <div class="grid gap-4 px-4 py-4">
        <template v-if="!confirmedStudent">
          <div class="crm-filter-grid--dense">
            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Aluno</span>
              <input
                v-model="lookup.nome"
                type="text"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
                placeholder="Buscar por nome"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">RA</span>
              <input
                v-model="lookup.ra"
                type="text"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
                placeholder="Buscar por RA"
              />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Curso</span>
              <select
                v-model="lookup.curso"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
              >
                <option value="">Todos os cursos</option>
                <option v-for="course in courseOptions" :key="course" :value="course">
                  {{ course }}
                </option>
              </select>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-semibold text-slate-700">Forma de atendimento</span>
              <select
                v-model="lookup.contactChannel"
                class="rounded-[8px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700"
              >
                <option value="">Selecione</option>
                <option value="telefone">Telefone</option>
                <option value="presencial">Presencial</option>
                <option value="email">E-mail</option>
                <option value="outro">Outro</option>
              </select>
            </label>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="toggleManualEntry"
            >
              {{ manualStudentEntry ? 'Voltar para busca na base' : 'Aluno não encontrado?' }}
            </button>
          </div>

          <div v-if="formErrors.contactChannel" role="alert" class="text-sm font-semibold text-[var(--color-danger)]">
            {{ formErrors.contactChannel }}
          </div>

          <template v-if="manualStudentEntry">
            <div class="rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p class="text-sm font-semibold text-slate-900">Entrada manual do aluno</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                Use esta opção somente quando o aluno não aparecer na base do polo.
              </p>

              <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="grid gap-2">
                  <span class="text-sm font-semibold text-slate-700">Nome do aluno</span>
                  <input
                    v-model="lookup.nome"
                    type="text"
                    class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    placeholder="Nome completo"
                  />
                </label>

                <label class="grid gap-2">
                  <span class="text-sm font-semibold text-slate-700">RA</span>
                  <input
                    v-model="lookup.ra"
                    type="text"
                    class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                    placeholder="RA, se houver"
                  />
                </label>

                <label class="grid gap-2">
                  <span class="text-sm font-semibold text-slate-700">Curso</span>
                  <select
                    v-model="lookup.curso"
                    class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <option value="">Selecione</option>
                    <option v-for="course in courseOptions" :key="course" :value="course">
                      {{ course }}
                    </option>
                  </select>
                </label>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-if="shouldShowSuggestions" class="rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-900">Resultados encontrados</p>
                  <p class="mt-1 text-sm leading-6 text-slate-600">
                    Selecione o aluno e confirme antes de continuar para o assunto.
                  </p>
                </div>
                <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {{ filteredStudents.length }} resultado(s)
                </span>
              </div>

              <div v-if="filteredStudents.length" class="mt-4 grid gap-3">
                <button
                  v-for="student in filteredStudents"
                  :key="`${student.ra}-${student.email}-${student.nome}`"
                  type="button"
                  :class="[
                    'rounded-[8px] border px-4 py-3 text-left transition',
                    selectedCandidate?.ra === student.ra && selectedCandidate?.nome === student.nome
                      ? 'border-[rgba(209,50,57,0.2)] bg-[rgba(209,50,57,0.05)]'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  ]"
                  @click="pickStudent(student)"
                >
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p class="text-sm font-semibold text-slate-950">{{ student.nome }}</p>
                    <p class="text-sm text-slate-600">RA {{ student.ra || 'Não informado' }}</p>
                    <p class="text-sm text-slate-600">{{ student.curso || 'Curso não informado' }}</p>
                  </div>
                </button>
              </div>

              <p v-else class="mt-4 text-sm leading-6 text-slate-600">
                Nenhum aluno encontrado com esse recorte. Se precisar continuar, use a entrada manual.
              </p>
            </div>
          </template>

          <div
            v-if="selectedCandidate || manualStudentEntry"
            class="rounded-[8px] border border-slate-200 bg-white px-4 py-4"
          >
            <p class="text-xs font-semibold tracking-normal text-slate-500">Aluno para continuar</p>
            <p class="mt-2 text-base font-semibold text-slate-950">
              {{ selectedCandidate?.nome || lookup.nome || 'Aluno manual' }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-y-2 text-sm text-slate-600">
              <span>RA {{ selectedCandidate?.ra || lookup.ra || 'Não informado' }}</span>
              <span class="px-2 text-slate-300" aria-hidden="true">|</span>
              <span>{{ selectedCandidate?.curso || lookup.curso || 'Curso não informado' }}</span>
              <span class="px-2 text-slate-300" aria-hidden="true">|</span>
              <span>{{ lookup.contactChannel || 'Selecione a forma de atendimento' }}</span>
            </div>

            <div v-if="formErrors.student" role="alert" class="mt-3 text-sm font-semibold text-[var(--color-danger)]">
              {{ formErrors.student }}
            </div>

            <div class="mt-4">
              <button
                type="button"
                class="rounded-[8px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                @click="confirmStudent"
              >
                Confirmar que é este aluno
              </button>
            </div>
          </div>
        </template>

        <div
          v-if="confirmedStudent"
          class="rounded-[8px] border border-[rgba(26,111,67,0.16)] bg-[rgba(26,111,67,0.08)] px-4 py-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold tracking-normal text-[var(--color-success)]">Aluno confirmado</p>
              <div class="mt-2 flex flex-wrap items-center gap-y-2 text-sm font-semibold text-slate-900">
                <template v-for="(item, index) in selectedStudentSummary" :key="`${item}-${index}`">
                  <span>{{ item }}</span>
                  <span v-if="index < selectedStudentSummary.length - 1" class="px-2 text-slate-300" aria-hidden="true">|</span>
                </template>
              </div>
            </div>

            <button
              type="button"
              class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="editConfirmedStudent"
            >
              Trocar aluno
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white">
      <div class="border-b border-slate-200 bg-slate-100/90 px-4 py-3">
        <p class="text-base font-semibold text-slate-950">2. Escolher o assunto</p>
      </div>

      <div v-if="!canChooseSubject" class="px-4 py-4 text-sm leading-6 text-slate-600">
        Confirme primeiro o aluno e a forma de atendimento para seguir pela FAQ e abrir o atendimento com o contexto correto.
      </div>

      <template v-else>
        <div v-if="!activeNode" class="px-4 py-4">
          <div class="grid gap-3 md:grid-cols-2">
            <button
              v-for="option in rootEntries"
              :key="option.id"
              type="button"
              :class="[
                'rounded-[8px] border px-4 py-4 text-left transition hover:bg-slate-50',
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
          <div class="flex items-center justify-between px-4 py-3">
            <div class="flex flex-wrap gap-2">
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

            <button
              type="button"
              class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="goBackFaqStep"
            >
              Etapa anterior
            </button>
          </div>

          <button
            v-for="option in activeChildren"
            :key="option.id"
            type="button"
            :class="[
              'flex w-full items-start justify-between gap-4 border-t border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50',
              option.runtime.isHighlighted ? 'bg-[rgba(209,50,57,0.04)]' : 'bg-white',
            ]"
            @click="openNode(option.id)"
          >
            <div>
              <p class="text-base font-semibold text-slate-950">{{ option.titulo_exibido }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">
                {{ option.pergunta_exibida || option.descricao_interna || option.resposta || 'Continuar' }}
              </p>
            </div>
            <span aria-hidden="true" class="mt-1 text-lg font-semibold text-slate-400">&gt;</span>
          </button>
        </div>

        <div v-else class="px-4 py-4">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-4">
            <div>
              <p class="text-xs font-semibold tracking-normal text-slate-500">Assunto confirmado</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">{{ activeContext.subject }}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="step in activeLineage"
                  :key="step.id"
                  class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {{ step.titulo_exibido }}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="goBackFaqStep"
            >
              Trocar assunto
            </button>
          </div>
        </div>
      </template>
    </section>

    <section v-if="canShowDetailFlow" class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white">
      <div class="px-5 py-5">
        <h2 class="text-[1.45rem] font-semibold leading-tight text-slate-950">
          {{ activeContext.subject }}
        </h2>

        <div class="mt-4 rounded-[8px] border border-slate-300 bg-[rgba(248,250,252,0.95)] px-4 py-3 text-sm font-semibold leading-6 text-slate-800 shadow-sm">
          <div class="flex flex-wrap items-center gap-y-2">
            <template v-for="(item, index) in selectedStudentSummary" :key="`${item}-${index}`">
              <span>{{ item }}</span>
              <span v-if="index < selectedStudentSummary.length - 1" class="px-2 text-slate-300" aria-hidden="true">|</span>
            </template>
          </div>
        </div>
      </div>

      <div class="grid gap-4 px-5 pb-5">
        <div class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <div class="border-b border-slate-200 bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">FAQ do aluno</h3>
          </div>
          <div class="px-4 py-4 text-sm leading-7 text-slate-700">
            {{ activeContext.displayedAnswer }}
          </div>
        </div>

        <div class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <div class="border-b border-slate-200 bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Como analisar este caso</h3>
          </div>
          <div class="grid gap-4 px-4 py-4">
            <div
              v-for="section in guideSections"
              :key="section.title"
              class="grid gap-2"
            >
              <p class="text-sm font-semibold text-slate-900">{{ section.title }}</p>
              <ul class="grid gap-1.5 text-sm leading-6 text-slate-700">
                <li v-for="item in section.items" :key="item" class="flex gap-2">
                  <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                  <span>{{ withPeriod(item) }}</span>
                </li>
              </ul>
            </div>

            <div class="rounded-[8px] bg-white px-4 py-4 text-sm leading-6 text-slate-700">
              <p><span class="font-semibold text-slate-900">Abrir atendimento:</span> quando a tratativa precisar continuar no portal.</p>
              <p class="mt-2"><span class="font-semibold text-slate-900">Pedir complementação:</span> quando ainda faltar documento, evidência ou confirmação.</p>
              <p class="mt-2"><span class="font-semibold text-slate-900">Escalar:</span> quando a regra do caso exigir decisão da área interna.</p>
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <div class="border-b border-slate-200 bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">O que já foi verificado</h3>
          </div>
          <div class="px-4 py-4">
            <p class="text-sm leading-6 text-slate-600">
              Registre a triagem feita antes de abrir, pedir complementação ou escalar o atendimento.
            </p>

            <textarea
              ref="verifiedSummaryRef"
              v-model="verifiedSummary"
              rows="5"
              :aria-invalid="formErrors.verifiedSummary ? 'true' : 'false'"
              :aria-describedby="formErrors.verifiedSummary ? 'verified-summary-error' : undefined"
              class="mt-4 w-full rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
              placeholder="Ex.: documento conferido, regra validada, contato confirmado, orientação explicada ao aluno."
            />

            <p
              v-if="formErrors.verifiedSummary"
              id="verified-summary-error"
              role="alert"
              class="mt-2 text-sm font-semibold text-[var(--color-danger)]"
            >
              {{ formErrors.verifiedSummary }}
            </p>
          </div>
        </div>

        <div class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <div class="border-b border-slate-200 bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Próxima ação</h3>
          </div>

          <div class="px-4 py-4">
            <p class="text-sm leading-6 text-slate-600">
              Escolha a ação somente depois de confirmar o aluno, percorrer a FAQ e registrar a triagem.
            </p>

            <div class="mt-4 grid gap-3 xl:grid-cols-3">
              <button
                v-for="option in actionOptions"
                :key="option.id"
                type="button"
                :aria-pressed="selectedAction === option.id ? 'true' : 'false'"
                :class="['grid gap-1 rounded-[8px] border px-4 py-4 text-left transition', option.toneClass]"
                @click="chooseAction(option.id)"
              >
                <span class="text-sm font-semibold">{{ option.title }}</span>
                <span class="text-sm leading-6">{{ option.description }}</span>
              </button>
            </div>

            <div
              v-if="actionFeedback.message"
              :role="actionFeedback.type === 'success' ? 'status' : 'alert'"
              :aria-live="actionFeedback.type === 'success' ? 'polite' : 'assertive'"
              :class="[
                'mt-4 rounded-[8px] border px-4 py-3 text-sm leading-6',
                actionFeedback.type === 'success'
                  ? 'border-[rgba(26,111,67,0.16)] bg-[rgba(26,111,67,0.08)] text-[var(--color-success)]'
                  : 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.8)] text-[var(--color-danger)]',
              ]"
            >
              {{ actionFeedback.message }}
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
              <button
                v-if="selectedAction === 'open_case'"
                type="button"
                :disabled="isSubmitting"
                class="rounded-[8px] bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-wait disabled:opacity-75"
                @click="requestActionConfirmation"
              >
                {{ isSubmitting ? 'Registrando...' : activeAction.buttonLabel }}
              </button>

              <button
                v-if="selectedAction === 'request_info'"
                type="button"
                :disabled="isSubmitting"
                class="rounded-[8px] border border-[rgba(202,138,4,0.24)] bg-[rgba(254,243,199,0.86)] px-5 py-3 text-sm font-semibold text-[#8a5200] disabled:cursor-wait disabled:opacity-75"
                @click="requestActionConfirmation"
              >
                {{ isSubmitting ? 'Registrando...' : activeAction.buttonLabel }}
              </button>

              <button
                v-if="selectedAction === 'escalate'"
                type="button"
                :disabled="isSubmitting"
                class="rounded-[8px] bg-[#0f4c81] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-75"
                @click="requestActionConfirmation"
              >
                {{ isSubmitting ? 'Registrando...' : activeAction.buttonLabel }}
              </button>
              <p v-else class="text-sm font-semibold text-slate-600">
                Escolha como o atendimento deve seguir para liberar o registro final.
              </p>
            </div>

            <p v-if="formErrors.action" role="alert" class="mt-3 text-sm font-semibold text-[var(--color-danger)]">
              {{ formErrors.action }}
            </p>

            <div
              v-if="confirmationCopy"
              ref="confirmationPanelRef"
              tabindex="-1"
              role="region"
              aria-label="Confirmação da abertura assistida"
              class="mt-4 rounded-[8px] border border-[rgba(166,31,40,0.16)] bg-white p-4"
            >
              <p class="text-sm font-semibold text-slate-900">{{ confirmationCopy.title }}</p>
              <div class="mt-3 grid gap-3 text-sm leading-6 text-slate-600">
                <div>
                  <p class="text-xs font-semibold tracking-normal text-slate-500">Consequência</p>
                  <p class="mt-1">{{ confirmationCopy.consequence }}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold tracking-normal text-slate-500">Registro</p>
                  <p class="mt-1">{{ verifiedSummary.trim() }}</p>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  :disabled="isSubmitting"
                  :class="['rounded-[8px] px-4 py-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-75', confirmationCopy.buttonClass]"
                  @click="submitAssistedAction"
                >
                  {{ confirmationCopy.buttonLabel }}
                </button>
                <button
                  type="button"
                  :disabled="isSubmitting"
                  class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                  @click="pendingConfirmationAction = ''"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
