<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import OperationalInterventionBanner from '@/components/operational/OperationalInterventionBanner.vue'
import {
  buildInterventionContext,
  parseInterventionQuery,
} from '@/services/operationalInterventionRuntime'
import {
  createKnowledgeSuggestion,
  getTicket,
  isMockRuntimeEnabled,
  recordCaseKnowledgeApplied,
  transitionTicket,
} from '@/services/appApi'
import { mapApiTicketToOperationalProtocol } from '@/services/ticketMapper'
import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()

const selectedDecision = ref('')
const operatorNote = ref('')
const operatorNoteRef = ref(null)
const isSubmittingAction = ref(false)
const actionFeedback = ref({
  type: '',
  message: '',
})
const noteError = ref('')
const pendingConfirmationAction = ref('')
const lastActionFingerprint = ref('')
const lastActionAt = ref(0)
const lastSuggestedNote = ref('')
const confirmationPanelRef = ref(null)
const completedGuidanceItems = ref(new Set())
const knowledgeFeedback = ref('')
const suggestionOpen = ref(false)
const suggestionReason = ref('')
const suggestionText = ref('')
const suggestionBusy = ref(false)
const suggestionFeedback = ref('')
const queueFlashStorageKey = computed(() => `univesp-operator-queue-flash:${auth.mockContext.profileKey}`)

const detail = computed(() => studentSupportStore.operatorCaseById(route.params.caseId, auth.mockContext))
const intervention = computed(() => parseInterventionQuery(route.query))
const interventionContext = computed(() =>
  detail.value
    ? buildInterventionContext({
        intervention: intervention.value,
        detail: detail.value,
        currentUser: auth.mockContext.userName,
      })
    : null,
)
const interventionFeedback = ref({ type: '', message: '' })
const isAssumingCase = ref(false)
const escalationDestination = computed(() => detail.value?.lastMileAreaLabel || 'Area interna')
const escalationReason = computed(() =>
  detail.value?.playbook.escalationReason ||
  detail.value?.playbook.escalationCriteria ||
  'Escalonamento operacional necessario para continuidade segura.',
)
const canSuggestKnowledge = computed(() => {
  const knowledge = detail.value?.knowledge
  return Boolean(
    auth.mockContext.allowedActions?.includes('suggest_knowledge') &&
      knowledge?.bundle_id &&
      knowledge?.bundle_version_id &&
      knowledge?.node_id,
  )
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

function buildInteractionTitle(interaction = {}) {
  const actor = normalizeText(interaction.actor)

  if (actor.includes('op') || actor.includes('operador')) {
    return 'Registro do OP'
  }

  if (actor.includes('aluno')) {
    return 'Mensagem do aluno'
  }

  if (actor.includes('sistema')) {
    return 'Registro do sistema'
  }

  return interaction.actor || 'Interação registrada'
}

function clearActionFeedback() {
  actionFeedback.value = {
    type: '',
    message: '',
  }
}

function focusOperatorNote() {
  nextTick(() => {
    operatorNoteRef.value?.focus()
  })
}

const headerMeta = computed(() => {
  if (!detail.value) {
    return []
  }

  const status = normalizeText(detail.value.status)
  const pending = normalizeText(detail.value.pendingLabel)
  const hideDeadline =
    status.includes('complementação') ||
    pending.includes('aluno precisa') ||
    pending.includes('leitura do aluno')

  const items = [
    {
      key: 'student',
      label: detail.value.studentData.nome,
      clickable: true,
    },
    {
      key: 'ra',
      label: detail.value.studentData.ra ? `RA ${detail.value.studentData.ra}` : 'RA nao informado',
    },
    {
      key: 'protocol',
      label: `Protocolo ${detail.value.id}`,
    },
    {
      key: 'status',
      label: detail.value.status,
    },
  ]

  if (!hideDeadline) {
    items.splice(3, 0, {
      key: 'deadline',
      label: `Prazo: ${detail.value.sla}`,
    })
  }

  return items
})

const summaryBullets = computed(() => {
  if (!detail.value) {
    return []
  }

  const breadcrumb = detail.value.faqContext?.breadcrumb?.length
    ? detail.value.faqContext.breadcrumb.join(' > ')
    : ''
  const latestTimeline = detail.value.timeline.at(-1)
  const verifiedSummary =
    detail.value.operatorIntake?.verifiedSummary ||
    latestTimeline?.description ||
    ''

  return [
    `O aluno abriu este atendimento sobre ${withPeriod(detail.value.subject.toLowerCase())}`,
    breadcrumb ? `O caso chegou ate aqui pelo caminho ${withPeriod(breadcrumb)}` : '',
    verifiedSummary ? `Ja foi verificado: ${withPeriod(verifiedSummary)}` : '',
    `Agora falta ${withPeriod(detail.value.pendingLabel.toLowerCase())}`,
  ].filter(Boolean)
})

const analysisSections = computed(() => {
  if (!detail.value) {
    return []
  }

  const sections = []
  const checklistItems = (detail.value.playbook.checklist || []).map((item) => withPeriod(item))
  const systemItems = (detail.value.playbook.systemsToCheck || []).map((item) => `Consultar sistema: ${item}.`)
  const documentItems = (detail.value.playbook.documentsRequested || []).map(
    (item) => `Validar documento ou evidencia: ${item}.`,
  )
  const decisionItems = ['Se a checagem estiver completa, responder ao aluno pelo portal.']

  if ((detail.value.playbook.documentsRequested || []).length) {
    decisionItems.push('Se faltar documento, print ou contexto, pedir complementação ao aluno.')
  } else {
    decisionItems.push('Se o relato do aluno ainda nao sustentar a analise, pedir complementação.')
  }

  if (detail.value.playbook.escalationCriteria) {
    decisionItems.push(withPeriod(`Escalar apenas quando ${detail.value.playbook.escalationCriteria}`))
  }

  if (checklistItems.length) {
    sections.push({
      title: 'O que verificar',
      items: checklistItems,
    })
  }

  if (systemItems.length) {
    sections.push({
      title: 'Onde verificar',
      items: systemItems,
    })
  }

  if (documentItems.length) {
    sections.push({
      title: 'Documentos a observar',
      items: documentItems,
    })
  }

  sections.push({
    title: 'Quando decidir',
    items: Array.from(new Set(decisionItems.filter(Boolean))),
  })

  return sections
})

async function registerKnowledgeUse(actionKey = 'explicit_use') {
  if (!detail.value || detail.value.runtimeSource !== 'app_api') {
    knowledgeFeedback.value = 'Uso registrado nesta sessão operacional.'
    return
  }
  try {
    await recordCaseKnowledgeApplied(detail.value.id, {
      event_id: crypto.randomUUID(),
      action_key: actionKey,
    })
    knowledgeFeedback.value = 'Uso da orientação registrado.'
  } catch (error) {
    knowledgeFeedback.value =
      error?.message || 'Não foi possível registrar o uso da orientação.'
  }
}

async function submitKnowledgeSuggestion() {
  if (!canSuggestKnowledge.value || suggestionBusy.value) return
  if (suggestionReason.value.trim().length < 10 || !suggestionText.value.trim()) {
    suggestionFeedback.value = 'Explique o motivo e escreva a resposta sugerida.'
    return
  }
  const knowledge = detail.value.knowledge
  suggestionBusy.value = true
  suggestionFeedback.value = ''
  try {
    await createKnowledgeSuggestion({
      bundle_key: knowledge.bundle_id,
      version_id: knowledge.bundle_version_id,
      node_id: knowledge.node_id,
      audience_layer: auth.mockContext.profileKey === 'op_externo' ? 'bpo' : 'op',
      target_path:
        Array.isArray(knowledge.path) && knowledge.path.length
          ? knowledge.path
          : [knowledge.node_id],
      target_ref: {
        type: 'playbook_field',
        node_id: knowledge.node_id,
        field: 'suggested_reply',
      },
      proposed_value: suggestionText.value.trim(),
      reason: suggestionReason.value.trim(),
    })
    suggestionFeedback.value = 'Sugestão enviada para a equipe gestora do tema.'
    suggestionReason.value = ''
    suggestionText.value = ''
    suggestionOpen.value = false
  } catch (error) {
    suggestionFeedback.value = error?.message || 'Não foi possível enviar a sugestão.'
  } finally {
    suggestionBusy.value = false
  }
}

function toggleGuidanceItem(item, checked) {
  const next = new Set(completedGuidanceItems.value)
  if (checked) next.add(item)
  else next.delete(item)
  completedGuidanceItems.value = next
  if (checked) registerKnowledgeUse('checklist_completed')
}

function applySuggestedReply() {
  selectedDecision.value = 'reply'
  operatorNote.value =
    detail.value?.playbook.responseTemplate ||
    `Orientação registrada ao aluno sobre ${detail.value?.subject?.toLowerCase() || 'o atendimento'}.`
  registerKnowledgeUse('suggested_reply_applied')
  focusOperatorNote()
}

const decisionOptions = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    {
      id: 'reply',
      title: 'Responder ao aluno',
      description: 'Fiz a analise recomendada e tenho informacoes suficientes.',
      submitLabel: 'Registrar resposta ao aluno',
      fieldLabel: 'Resposta ao aluno',
      previewLabel: 'Resposta que sera registrada',
      placeholder: 'Escreva a resposta que sera enviada ao aluno pelo portal.',
      toneClass:
        selectedDecision.value === 'reply'
          ? 'border-[rgba(209,50,57,0.22)] bg-[rgba(209,50,57,0.06)] text-[var(--color-primary-dark)]'
          : 'border-slate-200 bg-white text-slate-700',
    },
    {
      id: 'request_info',
      title: 'Pedir complementação',
      description: 'Fiz a analise recomendada, mas ainda faltam informacoes ou evidencias.',
      submitLabel: 'Registrar pedido de complementação',
      fieldLabel: 'Pedido de complementação',
      previewLabel: 'Complementação que sera solicitada',
      placeholder: 'Explique ao aluno o que falta: informação, print, documento ou confirmação.',
      toneClass:
        selectedDecision.value === 'request_info'
          ? 'border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.18)] text-[#9a5b00]'
          : 'border-slate-200 bg-white text-slate-700',
    },
    {
      id: 'escalate',
      title: 'Escalar para area interna',
      description: 'Fiz toda a analise, mas preciso de apoio superior ou identifico possivel erro.',
      submitLabel: 'Continuar para escalonamento',
      fieldLabel: 'Subsidios para a area interna',
      previewLabel: 'Subsidios que serao registrados',
      placeholder: 'Descreva o que foi verificado, o que ainda falta e por que a area interna precisa atuar.',
      toneClass:
        selectedDecision.value === 'escalate'
          ? 'border-[rgba(8,115,145,0.22)] bg-[rgba(224,242,254,0.18)] text-[#0b6e8c]'
          : 'border-slate-200 bg-white text-slate-700',
    },
  ]
})

const activeDecision = computed(
  () => decisionOptions.value.find((item) => item.id === selectedDecision.value) || null,
)

function buildSuggestedNote(actionType) {
  if (!detail.value || !actionType) {
    return ''
  }

  if (actionType === 'reply') {
    return (
      detail.value.playbook.responseTemplate ||
      `Orientação registrada ao aluno sobre ${detail.value.subject.toLowerCase()}.`
    )
  }

  if (actionType === 'request_info') {
    if ((detail.value.playbook.documentsRequested || []).length) {
      return `Para continuar a analise, envie ${detail.value.playbook.documentsRequested.join(', ')} e, se necessario, mais detalhes sobre o ocorrido.`
    }

    return 'Para continuar a analise, preciso de mais informacoes, evidencias ou confirmação do relato.'
  }

  return `Encaminho o caso para ${escalationDestination.value}. Ja foi verificado: ${detail.value.playbook.checklist?.slice(0, 2).join('; ') || detail.value.pendingLabel}. Motivo do escalonamento: ${detail.value.playbook.escalationReason || detail.value.playbook.escalationCriteria || 'necessidade de validação interna adicional'}.`
}

function syncSuggestedNote(force = false) {
  const suggestion = buildSuggestedNote(selectedDecision.value)

  if (!suggestion) {
    return
  }

  if (force || !operatorNote.value.trim() || operatorNote.value === lastSuggestedNote.value) {
    operatorNote.value = suggestion
  }

  lastSuggestedNote.value = suggestion
}

watch(
  () => detail.value?.id,
  () => {
    selectedDecision.value = ''
    operatorNote.value = ''
    lastSuggestedNote.value = ''
    noteError.value = ''
    pendingConfirmationAction.value = ''
    clearActionFeedback()
  },
  { immediate: true },
)

watch(selectedDecision, () => {
  noteError.value = ''
  pendingConfirmationAction.value = ''
  clearActionFeedback()
  if (selectedDecision.value) {
    syncSuggestedNote(false)
    focusOperatorNote()
    return
  }

  operatorNote.value = ''
  lastSuggestedNote.value = ''
})

watch(pendingConfirmationAction, (actionType) => {
  if (!actionType) {
    return
  }

  nextTick(() => {
    confirmationPanelRef.value?.focus()
  })
})

const historySummary = computed(() => {
  if (!detail.value) {
    return []
  }

  const latestTimeline = [...detail.value.timeline].slice(-2).reverse()
  const latestInteraction = detail.value.interactions.at(-1)
  const latestAttachment = detail.value.attachments.at(-1)
  const items = latestTimeline.map((item) => `${item.atLabel}: ${withPeriod(item.title)}`)

  if (latestInteraction) {
    items.push(`${latestInteraction.atLabel}: ultima resposta registrada por ${latestInteraction.actor}.`)
  }

  if (latestAttachment) {
    items.push(`Ultimo documento registrado: ${withPeriod(latestAttachment.name)}`)
  }

  return items.filter(Boolean).slice(0, 3)
})

const exchangeItems = computed(() => {
  if (!detail.value) {
    return []
  }

  const items = []
  const normalizedStatus = normalizeText(detail.value.status)

  if (normalizedStatus.includes('faq') && detail.value.faqAnswer) {
    items.push({
      id: `${detail.value.id}-faq`,
      title: 'Resposta oficial da FAQ',
      description: withPeriod(detail.value.faqAnswer),
      atLabel: detail.value.timeline.at(-1)?.atLabel || 'Registro oficial',
    })
  }

  for (const interaction of [...detail.value.interactions].slice(-4).reverse()) {
    items.push({
      id: interaction.id,
      title: buildInteractionTitle(interaction),
      description: withPeriod(interaction.text),
      atLabel: interaction.atLabel,
    })
  }

  if (!items.length) {
    for (const item of [...detail.value.timeline].slice(-4).reverse()) {
      items.push({
        id: item.id,
        title: item.title,
        description: withPeriod(item.description),
        atLabel: item.atLabel,
      })
    }
  }

  return items
})

const actionAvailability = computed(() => {
  if (!detail.value) {
    return {
      canAct: false,
      reason: 'Atendimento indisponivel.',
    }
  }

  const status = normalizeText(detail.value.status)
  const pending = normalizeText(detail.value.pendingLabel)

  if (
    status.includes('respondido pela area') ||
    status.includes('complementação solicitada pela area')
  ) {
    return {
      canAct: true,
      reason: '',
    }
  }

  if (status.includes('respondido pelo op') || status.includes('faq') || status.includes('conclu')) {
    return {
      canAct: false,
      reason: 'Este atendimento ja foi encerrado. Nao ha nova ação do OP neste momento.',
    }
  }

  if (
    status.includes('complementação') ||
    pending.includes('aluno precisa') ||
    pending.includes('leitura do aluno')
  ) {
    return {
      canAct: false,
      reason: 'Este atendimento esta aguardando retorno do aluno. O OP nao precisa agir agora.',
    }
  }

  if (
    status.includes('retorno da area') ||
    status.includes('escalado') ||
    status.includes('reencaminhado') ||
    pending.includes('area') ||
    pending.includes('secretaria')
  ) {
    return {
      canAct: false,
      reason: 'Este atendimento esta aguardando retorno da area interna. O OP nao precisa agir agora.',
    }
  }

  return {
    canAct: true,
    reason: '',
  }
})

function openStudentCases() {
  if (!detail.value) {
    return
  }

  router.push({
    path: '/op/fila',
    query: {
      search: detail.value.studentData.ra || detail.value.studentData.nome,
    },
  })
}

function ensureEscalationReason() {
  if (operatorNote.value.trim()) {
    noteError.value = ''
    return true
  }

  noteError.value = 'Preencha os subsidios para a area interna antes de escalar.'
  focusOperatorNote()
  return false
}

async function submitLiveOperatorAction(actionType) {
  const ticketId = detail.value.id
  let currentStatus = detail.value.statusCode || 'open'
  if (['open', 'waiting_student', 'waiting_internal', 'resolved'].includes(currentStatus)) {
    await transitionTicket(ticketId, { status: 'in_analysis' })
  }
  const targetStatus = {
    reply: 'resolved',
    request_info: 'waiting_student',
    escalate: 'waiting_internal',
  }[actionType]
  if (!targetStatus) throw new Error('Ação operacional sem transição institucional.')
  const result = await transitionTicket(ticketId, {
    status: targetStatus,
    message: operatorNote.value.trim(),
  })
  studentSupportStore.upsertLiveTicket(mapApiTicketToOperationalProtocol(result.data))
  return {
    destinationLabel: detail.value.lastMileAreaLabel || detail.value.queueLabel || 'Área interna',
  }
}

async function submitOperatorAction(actionType) {
  if (!detail.value || isSubmittingAction.value || !actionAvailability.value.canAct) {
    return
  }

  if (actionType === 'escalate' && !ensureEscalationReason()) {
    return
  }

  const actionFingerprint = `${detail.value.id}:${actionType}:${operatorNote.value.trim()}`
  const now = Date.now()

  if (lastActionFingerprint.value === actionFingerprint && now - lastActionAt.value < 2500) {
    actionFeedback.value = {
      type: 'error',
      message: 'Esta ação acabou de ser registrada. Aguarde a atualização antes de repetir.',
    }
    pendingConfirmationAction.value = ''
    return
  }

  isSubmittingAction.value = true
  clearActionFeedback()

  let actionLog = null
  try {
    actionLog = isMockRuntimeEnabled()
      ? studentSupportStore.registerOperatorAction({
          caseId: detail.value.id,
          actionType,
          note: operatorNote.value,
          playbook: detail.value.playbook,
          actorName: auth.mockContext.userName,
        })
      : await submitLiveOperatorAction(actionType)
  } catch (error) {
    actionFeedback.value = {
      type: 'error',
      message: error?.message || 'Não foi possível registrar a ação institucional.',
    }
  } finally {
    isSubmittingAction.value = false
  }

  if (!actionLog) {
    actionFeedback.value = {
      type: 'error',
      message: 'Não foi possível registrar a ação agora. Tente novamente.',
    }
    return
  }

  noteError.value = ''
  pendingConfirmationAction.value = ''
  lastActionFingerprint.value = actionFingerprint
  lastActionAt.value = now

  actionFeedback.value = {
    type: 'success',
    message:
      actionType === 'reply'
        ? 'Resposta registrada no portal com sucesso.'
        : actionType === 'request_info'
          ? 'Pedido de complementação registrado com sucesso.'
          : `Escalonamento registrado para ${actionLog.destinationLabel}.`,
  }

  if (actionType === 'escalate' && auth.mockContext.profileKey === 'op' && typeof window !== 'undefined') {
    window.sessionStorage.setItem(
      queueFlashStorageKey.value,
      `Escalonamento registrado para ${actionLog.destinationLabel}. O caso saiu de Meus atendimentos.`,
    )
    router.push('/op/fila')
    return
  }

  operatorNote.value = ''
  lastSuggestedNote.value = ''
  syncSuggestedNote(true)
}

async function loadLiveTicket() {
  if (isMockRuntimeEnabled()) return
  try {
    const result = await getTicket(route.params.caseId)
    studentSupportStore.upsertLiveTicket(mapApiTicketToOperationalProtocol(result.data))
  } catch (error) {
    actionFeedback.value = {
      type: 'error',
      message: error?.message || 'Não foi possível carregar o atendimento institucional.',
    }
  }
}

onMounted(() => {
  void loadLiveTicket()
})

function handleActionClick(actionType) {
  if (!actionAvailability.value.canAct) {
    return
  }

  noteError.value = ''

  if (actionType === 'escalate') {
    if (!ensureEscalationReason()) {
      return
    }
  }
  pendingConfirmationAction.value = actionType
  clearActionFeedback()
}

function selectDecision(actionType) {
  selectedDecision.value = actionType
}

function dismissIntervention() {
  const nextQuery = { ...route.query }
  delete nextQuery.intervene
  delete nextQuery.intent
  router.replace({ query: nextQuery })
}

function assumeCaseFromCockpit() {
  if (!detail.value || isAssumingCase.value) {
    return
  }

  isAssumingCase.value = true
  interventionFeedback.value = { type: '', message: '' }

  const actionLog = studentSupportStore.assumeOperatorCase({
    caseId: detail.value.id,
    actorName: auth.mockContext.userName,
    reason: 'Intervencao rapida via cockpit operacional.',
  })

  isAssumingCase.value = false

  if (!actionLog) {
    interventionFeedback.value = {
      type: 'error',
      message: 'Nao foi possivel assumir este caso agora.',
    }
    return
  }

  interventionFeedback.value = {
    type: 'success',
    message: 'Caso assumido com sucesso. Voce ja pode continuar a tratativa.',
  }
  dismissIntervention()
}

const recordPreview = computed(() => {
  const note = operatorNote.value.trim()

  if (note) {
    return note
  }

  return buildSuggestedNote(selectedDecision.value)
})

const confirmationCopy = computed(() => {
  if (!detail.value || !pendingConfirmationAction.value) {
    return null
  }

  if (pendingConfirmationAction.value === 'reply') {
    return {
      title: 'Confirmar resposta ao aluno',
      consequence: 'A resposta sera registrada no portal como devolutiva do OP.',
      buttonClass: 'bg-[var(--color-primary)] text-white',
      buttonLabel: 'Confirmar resposta ao aluno',
    }
  }

  if (pendingConfirmationAction.value === 'request_info') {
    return {
      title: 'Confirmar pedido de complementação',
      consequence: 'O aluno sera orientado a complementar o protocolo para continuidade da analise.',
      buttonClass: 'border border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.82)] text-[#8a5200]',
      buttonLabel: 'Confirmar pedido de complementação',
    }
  }

  return {
    title: 'Confirmar escalonamento',
    consequence: `O caso sai da fila atual e segue para ${escalationDestination.value} com os subsidios registrados.`,
    buttonClass: 'bg-[#0f4c81] text-white',
    buttonLabel: 'Confirmar escalonamento',
  }
})
</script>

<template>
  <div v-if="!detail" class="rounded-[8px] border border-slate-200 bg-white px-6 py-6">
    <p class="text-xs font-semibold text-slate-500">
      Atendimento indisponivel
    </p>
    <h3 class="mt-3 text-2xl font-semibold text-slate-950">
      O caso informado nao foi encontrado na base operacional.
    </h3>
    <p class="mt-3 text-sm leading-7 text-slate-600">
      Volte para a fila do OP e abra um atendimento existente para visualizar o detalhe.
    </p>
  </div>

  <div v-else class="grid gap-3">
    <OperationalInterventionBanner
      v-if="interventionContext"
      :context="interventionContext"
      :feedback="interventionFeedback"
      :loading="isAssumingCase"
      @assume="assumeCaseFromCockpit"
      @dismiss="dismissIntervention"
    />

    <section class="crm-queue-scroll rounded-[8px] border border-slate-200 bg-white">
      <div class="px-5 py-5">
        <p class="text-lg font-semibold text-slate-950">Detalhe do atendimento</p>
        <h2 class="mt-3 text-[1.45rem] font-semibold leading-tight text-slate-950">
          {{ detail.subject }}
        </h2>
        <div class="mt-4 rounded-[8px] border border-slate-300 bg-[rgba(248,250,252,0.95)] px-4 py-3 text-sm font-semibold leading-6 text-slate-800 shadow-sm">
          <div class="flex flex-wrap items-center gap-y-2">
            <template v-for="(item, index) in headerMeta" :key="item.key">
              <button
                v-if="item.clickable"
                type="button"
                class="font-semibold text-slate-950 transition hover:text-[var(--color-primary)]"
                @click="openStudentCases"
              >
                {{ item.label }}
              </button>
              <span v-else>{{ item.label }}</span>
              <span v-if="index < headerMeta.length - 1" class="px-2 text-slate-300" aria-hidden="true">|</span>
            </template>
          </div>
        </div>
        <div class="mt-3 rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-normal text-slate-500">Pendencia atual</p>
          <p class="mt-1 text-sm font-medium leading-6 text-slate-800">
            {{ detail.pendingLabel }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 px-5 pb-5">
        <details open class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Resumo do caso
          </summary>
          <div class="border-t border-slate-200 px-4 py-4">
            <ul class="grid gap-2 text-sm leading-6 text-slate-700">
              <li v-for="item in summaryBullets" :key="item" class="flex gap-2">
                <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </details>

        <details
          v-if="exchangeItems.length"
          class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70"
        >
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Troca do atendimento
          </summary>
          <div class="border-t border-slate-200 px-4 py-4">
            <div class="grid gap-3">
              <div
                v-for="item in exchangeItems"
                :key="item.id"
                class="rounded-[8px] border border-slate-200 bg-white px-4 py-3"
              >
                <div class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                  <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
                  <span class="text-xs font-semibold tracking-normal text-slate-500">{{ item.atLabel }}</span>
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
              </div>
            </div>
          </div>
        </details>

        <details open class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Orientação do fluxo
          </summary>
          <div class="border-t border-slate-200 px-4 py-4">
            <div class="grid gap-4">
              <div class="rounded-[8px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-sm font-semibold text-slate-950">
                  {{ detail.playbook.title }}
                </p>
                <p v-if="detail.faqContext?.breadcrumb?.length" class="mt-1 text-sm text-slate-600">
                  Caminho do aluno: {{ detail.faqContext.breadcrumb.join(' › ') }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    v-if="detail.playbook.responseTemplate"
                    type="button"
                    class="crm-button-secondary"
                    @click="applySuggestedReply"
                  >
                    Usar resposta sugerida
                  </button>
                  <button
                    type="button"
                    class="crm-button-secondary"
                    @click="registerKnowledgeUse('explicit_use')"
                  >
                    Registrei uso desta orientação
                  </button>
                  <button
                    v-if="canSuggestKnowledge"
                    type="button"
                    class="crm-button-secondary"
                    @click="suggestionOpen = !suggestionOpen"
                  >
                    Sugerir melhoria
                  </button>
                </div>
                <form
                  v-if="suggestionOpen"
                  class="mt-4 grid gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4"
                  @submit.prevent="submitKnowledgeSuggestion"
                >
                  <div>
                    <p class="text-sm font-semibold text-slate-950">Sugerir ajuste desta resposta</p>
                    <p class="mt-1 text-sm text-slate-600">
                      A sugestão não altera o conteúdo publicado. Ela seguirá para revisão.
                    </p>
                  </div>
                  <label class="grid gap-1 text-sm font-semibold text-slate-700">
                    Resposta sugerida
                    <textarea
                      v-model="suggestionText"
                      class="crm-field min-h-28"
                      :placeholder="detail.playbook.responseTemplate || 'Escreva uma resposta mais clara.'"
                    ></textarea>
                  </label>
                  <label class="grid gap-1 text-sm font-semibold text-slate-700">
                    Por que mudar?
                    <textarea
                      v-model="suggestionReason"
                      class="crm-field min-h-24"
                      placeholder="Explique o problema observado no atendimento."
                    ></textarea>
                  </label>
                  <div class="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      class="crm-button-primary"
                      :disabled="suggestionBusy"
                    >
                      {{ suggestionBusy ? 'Enviando…' : 'Enviar sugestão' }}
                    </button>
                    <button
                      type="button"
                      class="crm-button-secondary"
                      @click="suggestionOpen = false"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
                <p v-if="knowledgeFeedback" class="mt-2 text-sm text-slate-600" role="status">
                  {{ knowledgeFeedback }}
                </p>
                <p v-if="suggestionFeedback" class="mt-2 text-sm text-slate-600" role="status">
                  {{ suggestionFeedback }}
                </p>
              </div>
              <div
                v-for="section in analysisSections"
                :key="section.title"
                class="grid gap-2"
              >
                <p class="text-sm font-semibold text-slate-900">{{ section.title }}</p>
                <ul
                  v-if="section.title !== 'O que verificar'"
                  class="grid gap-2 text-sm leading-6 text-slate-700"
                >
                  <li v-for="item in section.items" :key="item" class="flex gap-2">
                    <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    <span>{{ item }}</span>
                  </li>
                </ul>
                <div v-else class="grid gap-2">
                  <label
                    v-for="item in section.items"
                    :key="item"
                    class="flex items-start gap-2 text-sm leading-6 text-slate-700"
                  >
                    <input
                      type="checkbox"
                      class="mt-1"
                      :checked="completedGuidanceItems.has(item)"
                      @change="toggleGuidanceItem(item, $event.target.checked)"
                    />
                    <span>{{ item }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </details>

        <div class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <div class="border-b border-slate-200 bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Proxima ação</h3>
          </div>

          <div v-if="!actionAvailability.canAct" class="px-4 py-4 text-sm leading-6 text-slate-700">
            {{ actionAvailability.reason }}
          </div>

          <template v-else>
            <div class="px-4 py-4">
              <p class="text-sm leading-6 text-slate-600">
                Escolha a ação somente depois de concluir a analise recomendada.
              </p>

              <div class="mt-4 grid gap-3 xl:grid-cols-3">
                <button
                  v-for="option in decisionOptions"
                  :key="option.id"
                  type="button"
                  :aria-pressed="selectedDecision === option.id ? 'true' : 'false'"
                  :class="[
                    'grid gap-1 rounded-[8px] border px-4 py-4 text-left transition',
                    option.toneClass,
                  ]"
                  @click="selectDecision(option.id)"
                >
                  <span class="text-sm font-semibold">{{ option.title }}</span>
                  <span class="text-sm leading-6">{{ option.description }}</span>
                </button>
              </div>

              <div
                v-if="activeDecision"
                class="mt-4 rounded-[8px] border border-slate-200 bg-white px-4 py-4"
              >
                <label class="grid gap-2">
                  <span class="text-sm font-semibold text-slate-900">{{ activeDecision.fieldLabel }}</span>
                  <textarea
                    ref="operatorNoteRef"
                    v-model="operatorNote"
                    rows="5"
                    :aria-invalid="noteError ? 'true' : 'false'"
                    :aria-describedby="noteError ? 'operator-note-error' : undefined"
                    class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                    :placeholder="activeDecision.placeholder"
                  />
                </label>

                <p
                  v-if="noteError"
                  id="operator-note-error"
                  role="alert"
                  class="mt-2 text-sm font-semibold text-[var(--color-danger)]"
                >
                  {{ noteError }}
                </p>

                <div class="mt-4 rounded-[8px] border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p class="text-xs font-semibold tracking-normal text-slate-500">{{ activeDecision.previewLabel }}</p>
                  <p class="mt-2 text-sm leading-6 text-slate-700">{{ recordPreview }}</p>
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
                    v-if="selectedDecision === 'reply'"
                    type="button"
                    :disabled="isSubmittingAction"
                    class="rounded-[8px] bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-wait disabled:opacity-75"
                    @click="handleActionClick('reply')"
                  >
                    {{ isSubmittingAction ? 'Registrando...' : activeDecision.submitLabel }}
                  </button>

                  <button
                    v-else-if="selectedDecision === 'request_info'"
                    type="button"
                    :disabled="isSubmittingAction"
                    class="rounded-[8px] border border-[rgba(202,138,4,0.24)] bg-[rgba(254,243,199,0.86)] px-5 py-3 text-sm font-semibold text-[#8a5200] disabled:cursor-wait disabled:opacity-75"
                    @click="handleActionClick('request_info')"
                  >
                    {{ isSubmittingAction ? 'Registrando...' : activeDecision.submitLabel }}
                  </button>

                  <button
                    v-else-if="selectedDecision === 'escalate'"
                    type="button"
                    :disabled="isSubmittingAction"
                    class="rounded-[8px] bg-[#0f4c81] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-75"
                    @click="handleActionClick('escalate')"
                  >
                    {{ isSubmittingAction ? 'Registrando...' : activeDecision.submitLabel }}
                  </button>
                  <p v-else class="text-sm font-semibold text-slate-600">
                    Selecione como este atendimento deve seguir para registrar a proxima ação.
                  </p>
                </div>

                <div
                  v-if="confirmationCopy"
                  ref="confirmationPanelRef"
                  tabindex="-1"
                  role="region"
                  aria-label="Confirmação da proxima ação"
                  class="mt-4 rounded-[8px] border border-[rgba(166,31,40,0.16)] bg-white p-4"
                >
                  <p class="text-sm font-semibold text-slate-900">{{ confirmationCopy.title }}</p>
                  <div class="mt-3 grid gap-3 text-sm leading-6 text-slate-600">
                    <div>
                      <p class="text-xs font-semibold tracking-normal text-slate-500">Consequencia</p>
                      <p class="mt-1">{{ confirmationCopy.consequence }}</p>
                    </div>
                    <div>
                      <p class="text-xs font-semibold tracking-normal text-slate-500">Registro</p>
                      <p class="mt-1">{{ operatorNote.trim() }}</p>
                    </div>
                    <div v-if="pendingConfirmationAction === 'escalate'">
                      <p class="text-xs font-semibold tracking-normal text-slate-500">Destino</p>
                      <p class="mt-1 font-semibold text-slate-900">{{ escalationDestination }}</p>
                    </div>
                    <div v-if="pendingConfirmationAction === 'escalate'">
                      <p class="text-xs font-semibold tracking-normal text-slate-500">Regra observada</p>
                      <p class="mt-1">{{ escalationReason }}</p>
                    </div>
                  </div>

                  <div class="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      :disabled="isSubmittingAction"
                      :class="['rounded-[8px] px-4 py-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-75', confirmationCopy.buttonClass]"
                      @click="submitOperatorAction(pendingConfirmationAction)"
                    >
                      {{ confirmationCopy.buttonLabel }}
                    </button>
                    <button
                      type="button"
                      :disabled="isSubmittingAction"
                      class="rounded-[8px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                      @click="pendingConfirmationAction = ''"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <details class="overflow-hidden rounded-[8px] border border-slate-200 bg-slate-50/70">
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Historico do caso
          </summary>

          <div class="border-t border-slate-200 px-4 py-4">
            <ul class="grid gap-2 text-sm leading-6 text-slate-700">
              <li v-for="item in historySummary" :key="item" class="flex gap-2">
                <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>{{ item }}</span>
              </li>
            </ul>

            <details class="mt-4 rounded-[8px] border border-slate-200 bg-white px-4 py-4">
              <summary class="cursor-pointer list-none text-sm font-semibold text-slate-900">
                Ver historico completo
              </summary>

              <div class="mt-4 grid gap-4">
                <div v-if="detail.timeline.length" class="grid gap-2">
                  <p class="text-sm font-semibold text-slate-900">Movimentacoes</p>
                  <div class="divide-y divide-slate-200 rounded-[8px] border border-slate-200 bg-white">
                    <div
                      v-for="item in detail.timeline"
                      :key="item.id"
                      class="grid gap-1 px-4 py-3"
                    >
                      <div class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
                        <span class="text-xs font-semibold tracking-normal text-slate-500">{{ item.atLabel }}</span>
                      </div>
                      <p class="text-sm leading-6 text-slate-600">{{ item.description }}</p>
                    </div>
                  </div>
                </div>

                <div v-if="detail.interactions.length" class="grid gap-2">
                  <p class="text-sm font-semibold text-slate-900">Interacoes registradas</p>
                  <div class="divide-y divide-slate-200 rounded-[8px] border border-slate-200 bg-white">
                    <div
                      v-for="interaction in detail.interactions"
                      :key="interaction.id"
                      class="grid gap-1 px-4 py-3"
                    >
                      <div class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p class="text-sm font-semibold text-slate-950">{{ interaction.actor }}</p>
                          <p class="text-xs font-semibold tracking-normal text-slate-500">
                            {{ interaction.channel }}
                          </p>
                        </div>
                        <span class="text-xs font-semibold tracking-normal text-slate-500">{{ interaction.atLabel }}</span>
                      </div>
                      <p class="text-sm leading-6 text-slate-600">{{ interaction.text }}</p>
                    </div>
                  </div>
                </div>

                <div v-if="detail.attachments.length" class="grid gap-2">
                  <p class="text-sm font-semibold text-slate-900">Documentos registrados</p>
                  <div class="divide-y divide-slate-200 rounded-[8px] border border-slate-200 bg-white">
                    <div
                      v-for="attachment in detail.attachments"
                      :key="attachment.id"
                      class="grid gap-1 px-4 py-3"
                    >
                      <p class="text-sm font-semibold text-slate-950">{{ attachment.name }}</p>
                      <p class="text-sm leading-6 text-slate-600">{{ attachment.status }}</p>
                    </div>
                  </div>
                </div>

                <div v-if="detail.correlatedHistory.items.length" class="grid gap-2">
                  <p class="text-sm font-semibold text-slate-900">Atendimentos relacionados</p>
                  <div class="divide-y divide-slate-200 rounded-[8px] border border-slate-200 bg-white">
                    <RouterLink
                      v-for="item in detail.correlatedHistory.items"
                      :key="item.id"
                      :to="`/op/fila/${item.id}`"
                      class="grid gap-1 px-4 py-3 transition hover:bg-slate-50"
                    >
                      <div class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p class="text-xs font-semibold text-slate-500">{{ item.createdAtLabel }}</p>
                          <p class="mt-1 text-sm font-semibold text-slate-950">{{ item.subject }}</p>
                          <p class="mt-1 text-sm leading-6 text-slate-600">{{ item.theme }} - {{ item.subsubject }}</p>
                        </div>
                        <span class="text-sm font-semibold text-slate-700">{{ item.status }}</span>
                      </div>
                    </RouterLink>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </details>
      </div>
    </section>
  </div>
</template>
