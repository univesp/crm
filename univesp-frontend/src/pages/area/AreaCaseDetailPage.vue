<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useStudentSupportStore } from '@/stores/studentSupport'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const studentSupportStore = useStudentSupportStore()
const isAreaManager = computed(() => auth.mockContext.profileKey === 'gestor_area')

const selectedAction = ref('')
const selectedDestinationArea = ref('')
const actionNote = ref('')
const actionNoteRef = ref(null)
const actionFeedback = ref({ type: '', message: '' })
const noteError = ref('')
const destinationError = ref('')
const reassignReasonError = ref('')
const reassignVerifiedError = ref('')
const isSubmitting = ref(false)
const pendingConfirmationAction = ref('')
const confirmationPanelRef = ref(null)
const lastSuggestedNote = ref('')
const selectedAssignee = ref('')
const assignmentReason = ref('')
const assignmentFeedback = ref({ type: '', message: '' })
const assignmentError = ref('')
const selectedReassignReason = ref('')
const reassignVerifiedContext = ref('')

const REASSIGN_REASON_OPTIONS = [
  {
    value: 'assunto_de_outra_area',
    label: 'O assunto pertence a outra area',
  },
  {
    value: 'dependencia_exclusiva',
    label: 'Depende de validacao exclusiva de outra area',
  },
  {
    value: 'entrada_incorreta',
    label: 'O caso entrou na area errada',
  },
  {
    value: 'excecao_operacional',
    label: 'Excecao operacional validada',
  },
]

const areaViewerContext = computed(() =>
  isAreaManager.value
    ? auth.mockContext
    : {
        ...auth.mockContext,
        currentArea: '',
      },
)
const detail = computed(() => studentSupportStore.areaCaseById(route.params.caseId, areaViewerContext.value))
const queueFlashStorageKey = computed(() => `univesp-area-queue-flash:${auth.mockContext.profileKey}`)
const teamMembers = computed(() =>
  detail.value ? studentSupportStore.areaTeamMembers(detail.value.currentAreaLabel || auth.mockContext.currentArea) : [],
)
const guidanceRoute = computed(() => {
  if (!detail.value) {
    return '/area/orientacao'
  }

  return {
    path: '/area/orientacao',
    query: {
      theme: detail.value.themeKey,
      subsubject: detail.value.subsubjectKey,
      caseId: detail.value.id,
    },
  }
})
const isManagerExceptionSelected = computed(
  () =>
    isAreaManager.value &&
    selectedAction.value === 'reassign' &&
    selectedDestinationArea.value &&
    !detail.value?.standardAreas?.includes(selectedDestinationArea.value),
)

function buildActionAvailabilityState(detailValue) {
  if (!detailValue) {
    return { canAct: false, reason: 'Caso indisponivel.' }
  }

  if (
    !isAreaManager.value &&
    detailValue.currentAssigneeLabel &&
    detailValue.currentAssigneeLabel !== 'Sem responsavel' &&
    normalizeText(detailValue.currentAssigneeLabel) !== normalizeText(auth.mockContext.userName)
  ) {
    return {
      canAct: false,
      reason: `Este caso esta atribuido para ${detailValue.currentAssigneeLabel}. Redistribua pelo gestor antes de atuar.`,
    }
  }

  const status = normalizeText(detailValue.status)

  if (status.includes('respondido pela area') || status.includes('concluido pela area') || status.includes('reencaminhado')) {
    return {
      canAct: false,
      reason: 'A area ja concluiu a atuacao principal neste caso. Ele fica disponivel apenas para consulta.',
    }
  }

  if (status.includes('complementacao solicitada pela area')) {
    return {
      canAct: false,
      reason: 'O caso esta aguardando o polo complementar subsidios antes de nova analise da area.',
    }
  }

  return {
    canAct: true,
    reason: '',
  }
}

const ownershipSummary = computed(() => {
  if (!detail.value) {
    return []
  }

  if (isAreaManager.value) {
    const assignee = detail.value.currentAssigneeLabel || 'Sem responsavel'
    return [
      {
        label: 'Responsavel atual',
        value: assignee,
      },
      {
        label: 'Escopo do assunto',
        value:
          detail.value.subjectScopeRule?.accessMode === 'restricted'
            ? 'Restrito a analistas selecionados'
            : 'Aberto para o time da area',
      },
      {
        label: 'Dono do caso',
        value: detail.value.currentAssigneeLabel ? 'Caso atribuido' : 'Caso sem dono',
      },
    ]
  }

  return []
})

const latestRoutingDecision = computed(() =>
  (Array.isArray(detail.value?.routingDecisions) ? detail.value.routingDecisions : [])
    .slice()
    .sort((left, right) => new Date(right.decidedAt || 0).getTime() - new Date(left.decidedAt || 0).getTime())[0] || null,
)

function assignmentModeLabel(mode = '') {
  if (mode === 'auto') {
    return 'Distribuicao automatica'
  }

  if (mode === 'manager_override') {
    return 'Redistribuicao gerencial'
  }

  if (mode === 'manager_manual') {
    return 'Atribuicao gerencial'
  }

  return 'Aguardando atribuicao'
}

function routingModeLabel(mode = '') {
  return mode === 'manager_exception' ? 'Excecao gerencial' : 'Fluxo padrao'
}

const distributionOverview = computed(() => {
  if (!detail.value) {
    return null
  }

  const assignment = detail.value.currentAssignment
  const suggestion = detail.value.distributionSuggestion
  const scoreSummary = assignment?.scoreSummary || suggestion?.scoreSummary || null
  const routeDecision = latestRoutingDecision.value

  return {
    assignmentLabel: assignment?.analystName || suggestion?.analystName || 'Sem responsavel definido',
    assignmentMode: assignmentModeLabel(assignment?.assignmentMode || suggestion?.assignmentMode || ''),
    assignmentReason:
      assignment?.reason ||
      suggestion?.reason ||
      'Sem justificativa de distribuicao registrada neste caso.',
    routingLabel: routingModeLabel(routeDecision?.routingMode || detail.value.routingMode),
    routingReason:
      routeDecision?.justification ||
      detail.value.exceptionReason ||
      'Caso seguindo o fluxo padrao definido pelo conhecimento vigente.',
    defaultAreaLabel:
      routeDecision?.defaultAreaLabel || detail.value.lastMileAreaLabel || detail.value.currentAreaLabel || '',
    resolvedAreaLabel:
      routeDecision?.resolvedAreaLabel || detail.value.currentAreaLabel || detail.value.lastMileAreaLabel || '',
    eligibleUsers: scoreSummary?.eligibleUsers || [],
    unavailableUsers: scoreSummary?.unavailableUsers || [],
    candidateScores: scoreSummary?.candidateScores || [],
  }
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

const headerMeta = computed(() => {
  if (!detail.value) {
    return []
  }

  const studentData = detail.value.studentData || {}
  const items = [
    { key: 'student', label: studentData.nome || 'Aluno nao informado', clickable: true },
    {
      key: 'ra',
      label: studentData.ra ? `RA ${studentData.ra}` : 'RA nao informado',
    },
    {
      key: 'polo',
      label: `Polo ${studentData.polo || 'Nao informado'}`,
    },
    {
      key: 'area',
      label: `Area ${detail.value.currentAreaLabel || 'Nao informada'}`,
    },
    { key: 'protocol', label: `Protocolo ${detail.value.id}` },
    { key: 'status', label: detail.value.areaStatusLabel },
  ]

  if (detail.value.sla && detail.value.sla !== 'Encerrado') {
    items.splice(3, 0, {
      key: 'deadline',
      label: `Prazo: ${detail.value.sla}`,
    })
  }

  return items
})

const exchangeItems = computed(() => {
  if (!detail.value) {
    return []
  }

  const interactions =
    Array.isArray(detail.value.interactions)
      ? detail.value.interactions.filter((item) => item && typeof item === 'object')
      : []

  return [...interactions]
    .slice(-5)
    .reverse()
    .map((item) => ({
      id: item.id,
      title: item.actor || 'Interacao registrada',
      description: withPeriod(item.text),
      atLabel: item.atLabel,
    }))
})

const decisionSuggestion = computed(() => {
  if (!detail.value) {
    return null
  }

  const attachments = Array.isArray(detail.value.attachments) ? detail.value.attachments.length : 0
  const requiredDocuments = detail.value.playbook?.documentsRequested || []
  const systemsToCheck = detail.value.playbook?.systemsToCheck || []
  const needsComplement = requiredDocuments.length > 0 && attachments === 0

  if (needsComplement) {
    return {
      actionId: 'request_complement',
      title: 'Saida sugerida: solicitar complementacao',
      description: 'Ainda faltam evidencias basicas. O caminho normal aqui e pedir complemento ao aluno e ao polo.',
      toneClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.4)] text-[#8a5200]',
    }
  }

  if (systemsToCheck.length > 0) {
    return {
      actionId: 'technical_reply',
      title: 'Saida sugerida: validar e enviar resposta',
      description: 'O caso ja tem base inicial. Confira os sistemas indicados e, se nao surgir impeditivo, responda.',
      toneClass: 'border-[rgba(209,50,57,0.18)] bg-[rgba(253,236,237,0.35)] text-[var(--color-primary-dark)]',
    }
  }

  return {
    actionId: 'technical_reply',
    title: 'Saida sugerida: enviar resposta',
    description: 'Nao ha sinal forte de dependencia de outra area. Se a checagem estiver coerente, resolva aqui.',
    toneClass: 'border-[rgba(209,50,57,0.18)] bg-[rgba(253,236,237,0.35)] text-[var(--color-primary-dark)]',
  }
})

const preDecisionChecks = computed(() => {
  if (!detail.value) {
    return []
  }

  const attachments = Array.isArray(detail.value.attachments) ? detail.value.attachments : []
  const requiredDocuments = detail.value.playbook?.documentsRequested || []
  const systemsToCheck = detail.value.playbook?.systemsToCheck || []
  const evidenceMissing = requiredDocuments.length > 0 && attachments.length === 0

  return [
    {
      title: 'Ha base para responder?',
      toneClass: evidenceMissing
        ? 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.36)]'
        : 'border-[rgba(26,111,67,0.16)] bg-[rgba(220,252,231,0.25)]',
      statusLabel: evidenceMissing ? 'Ainda nao' : 'Sim, ha base inicial',
      helperText: requiredDocuments.length > 0
        ? evidenceMissing
          ? `Faltam ${requiredDocuments.join(', ')}.`
          : `Documentos obrigatorios recebidos.`
        : 'Nao ha documento obrigatorio pendente.',
    },
    {
      title: 'Ainda falta alguma checagem?',
      toneClass: systemsToCheck.length
        ? 'border-[rgba(8,115,145,0.16)] bg-[rgba(224,242,254,0.32)]'
        : 'border-slate-200 bg-white',
      statusLabel: systemsToCheck.length ? 'Sim, ha checagem pendente' : 'Nao ha checagem obrigatoria aberta',
      helperText: systemsToCheck.length
        ? `Consulte ${systemsToCheck.join(', ')} antes de responder.`
        : 'Nada bloqueia a resposta por sistema.',
    },
    {
      title: 'Depende mesmo de outra area?',
      toneClass: 'border-slate-200 bg-white',
      statusLabel: 'Use isso so como excecao',
      helperText: 'Se sua area consegue resolver, responda ou peca complemento.',
    },
  ]
})

const actionOptions = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    {
      id: 'technical_reply',
      kind: 'primary',
      title: 'Enviar resposta ao aluno',
      description: 'Saida normal quando a area ja tiver base suficiente para resolver o caso.',
      submitLabel: 'Enviar resposta ao aluno',
      fieldLabel: 'Resposta final para aluno e OP',
      previewLabel: 'Resposta final que sera enviada ao aluno e ao OP',
      placeholder: 'Escreva a resposta final que o aluno vai receber. O OP recebera o mesmo texto para finalizar o caso.',
      toneClass:
        selectedAction.value === 'technical_reply'
          ? 'border-[rgba(209,50,57,0.22)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary-dark)] shadow-[0_10px_24px_rgba(166,31,40,0.08)]'
          : 'border-[rgba(209,50,57,0.16)] bg-white text-slate-700',
    },
    {
      id: 'request_complement',
      kind: 'secondary',
      title: 'Solicitar complementacao',
      description: 'Use quando ainda faltarem subsidios, evidencias ou nova validacao antes da resposta final.',
      submitLabel: 'Solicitar complementacao',
      fieldLabel: 'Solicitacao para aluno e OP',
      previewLabel: 'Complementacao que sera enviada ao aluno e ao OP',
      placeholder: 'Explique o que ainda falta para a area retomar a analise do caso.',
      toneClass:
        selectedAction.value === 'request_complement'
          ? 'border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.18)] text-[#9a5b00]'
          : 'border-slate-200 bg-white text-slate-700',
    },
    {
      id: 'reassign',
      kind: 'exception',
      title: 'Tratar como excecao',
      description: 'Use so quando esta area realmente nao puder resolver e o caso precisar sair do fluxo normal.',
      submitLabel: 'Registrar excecao',
      fieldLabel: 'Motivo da excecao',
      previewLabel: 'Registro excepcional que sera enviado para a nova area',
      placeholder: '',
      toneClass:
        selectedAction.value === 'reassign'
          ? 'border-[rgba(8,115,145,0.18)] bg-[rgba(224,242,254,0.16)] text-[#0b6e8c]'
          : 'border-[rgba(8,115,145,0.14)] bg-white text-slate-700',
    },
  ]
})

const activeAction = computed(
  () => actionOptions.value.find((option) => option.id === selectedAction.value) || null,
)

const primaryActionOption = computed(() => actionOptions.value.find((option) => option.kind === 'primary') || null)
const secondaryActionOption = computed(() => actionOptions.value.find((option) => option.kind === 'secondary') || null)
const exceptionActionOption = computed(() => actionOptions.value.find((option) => option.kind === 'exception') || null)
const normalDecisionActions = computed(() =>
  [primaryActionOption.value, secondaryActionOption.value].filter(Boolean),
)

function buildSuggestedNote(actionType) {
  if (!detail.value || !actionType) {
    return ''
  }

  const playbook = detail.value.playbook || {}
  const subjectLabel = String(detail.value.subject || 'este atendimento').trim().toLowerCase()

  if (actionType === 'technical_reply') {
    return (
      playbook.responseTemplate ||
      `Resposta final da area sobre ${subjectLabel}.`
    )
  }

  if (actionType === 'request_complement') {
    return 'Para retomar a analise, ainda faltam subsidios, evidencias ou validacoes do aluno e do polo.'
  }

  if (actionType === 'reassign') {
    return detail.value.handoffItems?.[1]?.value || detail.value.pendingLabel || ''
  }

  return `Resposta final da area sobre ${subjectLabel}.`
}

function getReassignReasonLabel(reasonCode = '') {
  return REASSIGN_REASON_OPTIONS.find((option) => option.value === reasonCode)?.label || ''
}

function buildStructuredReassignNote() {
  const reasonLabel = getReassignReasonLabel(selectedReassignReason.value)
  const verifiedText = String(reassignVerifiedContext.value || '').trim()

  if (!reasonLabel && !verifiedText) {
    return ''
  }

  return [
    reasonLabel ? `Motivo do encaminhamento excepcional: ${reasonLabel}.` : '',
    verifiedText ? `O que ja foi verificado nesta area: ${withPeriod(verifiedText)}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function clearFeedback() {
  actionFeedback.value = { type: '', message: '' }
}

function focusNoteField() {
  nextTick(() => {
    actionNoteRef.value?.focus()
  })
}

function syncSuggestedNote(force = false) {
  const suggestion = buildSuggestedNote(selectedAction.value)

  if (!suggestion) {
    return
  }

  if (selectedAction.value === 'reassign') {
    if (force || !reassignVerifiedContext.value.trim() || reassignVerifiedContext.value === lastSuggestedNote.value) {
      reassignVerifiedContext.value = suggestion
    }

    lastSuggestedNote.value = suggestion
    return
  }

  if (force || !actionNote.value.trim() || actionNote.value === lastSuggestedNote.value) {
    actionNote.value = suggestion
  }

  lastSuggestedNote.value = suggestion
}

function syncOperationalArea(areaLabel = '') {
  const nextArea = String(Array.isArray(areaLabel) ? areaLabel[0] : areaLabel || '').trim()

  if (!nextArea) {
    return
  }

  if (!(auth.mockContext.linkedAreas || []).includes(nextArea)) {
    return
  }

  if (auth.mockContext.currentArea === nextArea) {
    return
  }

  auth.setSelectedOperationalArea(nextArea)
}

watch(
  () => detail.value?.id,
  () => {
    selectedAction.value = ''
    selectedDestinationArea.value = ''
    selectedReassignReason.value = ''
    reassignVerifiedContext.value = ''
    actionNote.value = ''
    lastSuggestedNote.value = ''
    noteError.value = ''
    destinationError.value = ''
    reassignReasonError.value = ''
    reassignVerifiedError.value = ''
    pendingConfirmationAction.value = ''
    selectedAssignee.value = detail.value?.currentAssigneeLabel && detail.value.currentAssigneeLabel !== 'Sem responsavel'
      ? detail.value.currentAssigneeLabel
      : ''
    assignmentReason.value = ''
    assignmentError.value = ''
    assignmentFeedback.value = { type: '', message: '' }
    clearFeedback()
  },
  { immediate: true },
)

watch(
  () => route.query.area,
  (areaLabel) => {
    syncOperationalArea(areaLabel)
  },
  { immediate: true },
)

watch(
  () => detail.value?.currentAreaLabel,
  (areaLabel) => {
    if (route.query.area) {
      return
    }

    syncOperationalArea(areaLabel)
  },
  { immediate: true },
)

watch(selectedAction, () => {
  noteError.value = ''
  destinationError.value = ''
  reassignReasonError.value = ''
  reassignVerifiedError.value = ''
  pendingConfirmationAction.value = ''
  clearFeedback()

  if (selectedAction.value !== 'reassign') {
    selectedDestinationArea.value = ''
    selectedReassignReason.value = ''
    reassignVerifiedContext.value = ''
  }

  if (selectedAction.value) {
    syncSuggestedNote(false)
    focusNoteField()
    return
  }

  actionNote.value = ''
  selectedDestinationArea.value = ''
  selectedReassignReason.value = ''
  reassignVerifiedContext.value = ''
  lastSuggestedNote.value = ''
})

watch(
  () => detail.value?.currentAssigneeLabel,
  (assigneeLabel) => {
    if (!assigneeLabel || assigneeLabel === 'Sem responsavel') {
      selectedAssignee.value = ''
      return
    }

    selectedAssignee.value = assigneeLabel
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

const actionAvailability = computed(() => {
  return buildActionAvailabilityState(detail.value)
})

watch(
  [() => detail.value?.id, () => decisionSuggestion.value?.actionId, () => actionAvailability.value.canAct],
  ([caseId, suggestedAction, canAct]) => {
    if (!caseId || !canAct || !suggestedAction) {
      return
    }

    if (!selectedAction.value) {
      selectedAction.value = suggestedAction
    }
  },
  { immediate: true },
)

function openStudentCases() {
  if (!detail.value) {
    return
  }

  router.push({
    path: '/area/fila',
    query: {
      search: detail.value.studentData.ra || detail.value.studentData.nome,
    },
  })
}

function ensureActionReady(actionType) {
  if (actionType === 'reassign') {
    if (!selectedReassignReason.value) {
      reassignReasonError.value = 'Escolha por que este caso precisa sair da area antes de encaminhar.'
      return false
    }

    reassignReasonError.value = ''

    if (!reassignVerifiedContext.value.trim()) {
      reassignVerifiedError.value = 'Explique o que ja foi verificado nesta area antes de encaminhar.'
      focusNoteField()
      return false
    }

    reassignVerifiedError.value = ''

    if (!selectedDestinationArea.value) {
      destinationError.value = 'Selecione a area de destino antes de encaminhar.'
      return false
    }

    destinationError.value = ''
    noteError.value = ''
    return true
  }

  if (!actionNote.value.trim()) {
    noteError.value = 'Preencha o registro da area antes de continuar.'
    focusNoteField()
    return false
  }

  noteError.value = ''

  if (actionType === 'reassign' && !selectedDestinationArea.value) {
    destinationError.value = 'Selecione a area de destino antes de reencaminhar.'
    return false
  }

  destinationError.value = ''
  return true
}

function handleActionClick(actionType) {
  if (!actionAvailability.value.canAct) {
    return
  }

  if (!ensureActionReady(actionType)) {
    return
  }

  pendingConfirmationAction.value = actionType
  clearFeedback()
}

function selectAction(actionType) {
  selectedAction.value = actionType
}

const recordPreview = computed(() => {
  if (selectedAction.value === 'reassign') {
    return buildStructuredReassignNote() || 'O encaminhamento excepcional so deve ser usado quando a area realmente nao puder resolver o caso.'
  }

  return actionNote.value.trim() || buildSuggestedNote(selectedAction.value)
})

const confirmationCopy = computed(() => {
  if (!pendingConfirmationAction.value) {
    return null
  }

  if (pendingConfirmationAction.value === 'technical_reply') {
    return {
      title: 'Confirmar envio da resposta',
      consequence: 'A resposta final ficara disponivel para o aluno e tambem para o OP encerrar o caso.',
      buttonClass: 'bg-[var(--color-primary)] text-white',
      buttonLabel: 'Confirmar envio da resposta',
    }
  }

  if (pendingConfirmationAction.value === 'request_complement') {
    return {
      title: 'Confirmar solicitacao de complementacao',
      consequence: 'A solicitacao sera enviada ao aluno e ao OP para que a tratativa continue.',
      buttonClass: 'border border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.82)] text-[#8a5200]',
      buttonLabel: 'Confirmar solicitacao de complementacao',
    }
  }

  if (pendingConfirmationAction.value === 'reassign') {
    return {
      title: isManagerExceptionSelected.value ? 'Confirmar encaminhamento excepcional' : 'Confirmar encaminhamento excepcional',
      consequence: isManagerExceptionSelected.value
        ? `O caso saira do caminho preferencial da area e seguira para ${selectedDestinationArea.value} com excecao gerencial justificada.`
        : `O caso saira do fluxo preferencial desta area e seguira para ${selectedDestinationArea.value}.`,
      buttonClass: 'bg-[#0f4c81] text-white',
      buttonLabel: 'Confirmar encaminhamento excepcional',
    }
  }

  return null
})

function submitAreaAction(actionType) {
  if (!detail.value || isSubmitting.value || !actionAvailability.value.canAct) {
    return
  }

  if (!ensureActionReady(actionType)) {
    return
  }

  isSubmitting.value = true
  clearFeedback()

  const actionLog = studentSupportStore.registerAreaAction({
    caseId: detail.value.id,
    actionType,
    note: actionType === 'reassign' ? buildStructuredReassignNote() : actionNote.value,
    actorName: auth.mockContext.userName,
    nextArea: selectedDestinationArea.value,
    isManagerException: isManagerExceptionSelected.value,
  })

  isSubmitting.value = false

  if (!actionLog) {
    actionFeedback.value = {
      type: 'error',
      message: 'Nao foi possivel registrar a acao da area agora. Tente novamente.',
    }
    return
  }

  pendingConfirmationAction.value = ''
  actionFeedback.value = {
    type: 'success',
    message:
      actionType === 'technical_reply'
        ? 'Resposta final enviada com sucesso para aluno e OP.'
        : actionType === 'request_complement'
          ? 'Solicitacao de complementacao enviada com sucesso para aluno e OP.'
          : actionType === 'reassign'
            ? isManagerExceptionSelected.value
              ? `Caso reencaminhado para ${actionLog.destinationLabel} por excecao gerencial.`
              : `Caso reencaminhado para ${actionLog.destinationLabel}.`
            : 'Acao da area registrada com sucesso.',
  }

  if (actionType === 'reassign' && typeof window !== 'undefined') {
    window.sessionStorage.setItem(
      queueFlashStorageKey.value,
      `Caso reencaminhado para ${actionLog.destinationLabel}.`,
    )
    router.push('/area/fila')
    return
  }

  actionNote.value = ''
  selectedReassignReason.value = ''
  reassignVerifiedContext.value = ''
  lastSuggestedNote.value = ''
  syncSuggestedNote(true)
}

function assignCase() {
  if (!detail.value || !isAreaManager.value) {
    return
  }

  if (!selectedAssignee.value) {
    assignmentError.value = 'Selecione um analista para atribuir ou redistribuir este caso.'
    return
  }

  assignmentError.value = ''

  studentSupportStore.assignAreaCase({
    caseId: detail.value.id,
    areaLabel: detail.value.currentAreaLabel,
    analystName: selectedAssignee.value,
    actorName: auth.mockContext.userName,
    reason: assignmentReason.value || 'Redistribuicao gerencial da area.',
  })

  assignmentReason.value = ''
  assignmentFeedback.value = {
    type: 'success',
    message: `Caso atribuido para ${selectedAssignee.value}.`,
  }
}
</script>

<template>
  <div v-if="!detail" class="rounded-[16px] border border-slate-200 bg-white px-6 py-6">
    <p class="text-xs font-semibold text-slate-500">Caso indisponivel</p>
    <h3 class="mt-3 text-2xl font-semibold text-slate-950">
      O caso informado nao foi encontrado no escopo atual da area.
    </h3>
    <p class="mt-3 text-sm leading-7 text-slate-600">
      Volte para a fila da area e abra um caso que realmente esteja no escopo deste perfil.
    </p>
  </div>

  <div v-else class="grid gap-3">
    <section class="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
      <div class="px-5 py-5">
        <p class="text-lg font-semibold text-slate-950">Detalhe da analise</p>
        <h2 class="mt-3 text-[1.45rem] font-semibold leading-tight text-slate-950">
          {{ detail.subject }}
        </h2>
        <div class="mt-4 rounded-[14px] border border-slate-300 bg-[rgba(248,250,252,0.95)] px-4 py-3 text-sm font-semibold leading-6 text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
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
        <div class="mt-3 rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">O que falta agora</p>
          <p class="mt-1 text-sm font-medium leading-6 text-slate-800">
            {{ detail.pendingLabel }}
          </p>
        </div>
        <div v-if="ownershipSummary.length" class="mt-3 grid gap-3 md:grid-cols-3">
          <div
            v-for="item in ownershipSummary"
            :key="item.label"
            class="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-3"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{{ item.label }}</p>
            <p class="mt-1 text-sm font-medium leading-6 text-slate-800">{{ item.value }}</p>
          </div>
        </div>
      </div>

      <div class="grid gap-4 px-5 pb-5">
        <details open class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            O caso em 3 pontos
          </summary>
          <div class="border-t border-slate-200 px-4 py-4">
            <ul class="grid gap-2 text-sm leading-6 text-slate-700">
              <li v-for="item in detail.summaryBullets" :key="item" class="flex gap-2">
                <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </details>

        <details open class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            O que ja foi feito
          </summary>
          <div class="grid gap-3 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
            <div
              v-for="item in detail.handoffItems"
              :key="item.label"
              class="rounded-[12px] border border-slate-200 bg-white px-4 py-3"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{{ item.label }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-800">{{ item.value }}</p>
            </div>
          </div>
        </details>

        <section v-if="isAreaManager" class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Distribuicao e ownership</h3>
          </div>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div class="grid gap-3">
              <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Responsavel atual</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ distributionOverview.assignmentLabel }}</p>
                <p class="mt-1 text-sm leading-6 text-slate-700">{{ distributionOverview.assignmentMode }}</p>
              </div>

              <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Por que este caso caiu aqui</p>
                <p class="mt-2 text-sm font-semibold text-slate-900">{{ distributionOverview.routingLabel }}</p>
                <p class="mt-1 text-sm leading-6 text-slate-700">{{ distributionOverview.routingReason }}</p>
                <p class="mt-2 text-xs text-slate-500">
                  Area padrao: {{ distributionOverview.defaultAreaLabel || 'Nao informada' }} | Area resolvida: {{ distributionOverview.resolvedAreaLabel || 'Nao informada' }}
                </p>
              </div>

              <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Motivo da atribuicao</p>
                <p class="mt-2 text-sm leading-6 text-slate-700">{{ distributionOverview.assignmentReason }}</p>
              </div>
            </div>

            <div class="grid gap-3">
              <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-sm font-semibold text-slate-950">Elegibilidade considerada</p>
                <p class="mt-2 text-sm leading-6 text-slate-700">
                  {{
                    distributionOverview.eligibleUsers.length
                      ? distributionOverview.eligibleUsers.join(', ')
                      : 'Nenhuma lista detalhada de elegibilidade foi registrada neste caso.'
                  }}
                </p>
              </div>

              <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-sm font-semibold text-slate-950">Indisponibilidades relevantes</p>
                <p class="mt-2 text-sm leading-6 text-slate-700">
                  {{
                    distributionOverview.unavailableUsers.length
                      ? distributionOverview.unavailableUsers.join(', ')
                      : 'Nenhuma indisponibilidade forte impactou a distribuicao atual.'
                  }}
                </p>
              </div>

              <div
                v-if="distributionOverview.candidateScores.length"
                class="rounded-[12px] border border-slate-200 bg-white px-4 py-3"
              >
                <p class="text-sm font-semibold text-slate-950">Leitura da distribuicao</p>
                <ul class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                  <li
                    v-for="item in distributionOverview.candidateScores"
                    :key="`${item.analystName}-${item.score}`"
                    class="flex gap-2"
                  >
                    <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    <span>{{ item.analystName }}: {{ item.activeCases }} ativo(s), {{ item.overdueCases }} vencido(s), capacidade {{ Math.round((item.capacityFactor || 0) * 100) }}%, score {{ item.score }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="isAreaManager"
          class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70"
        >
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Gestao do caso na area</h3>
          </div>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div class="grid gap-3">
              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Responsavel da analise</span>
                <select
                  v-model="selectedAssignee"
                  class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                >
                  <option value="">Selecione</option>
                  <option v-for="analyst in teamMembers" :key="analyst" :value="analyst">
                    {{ analyst }}
                  </option>
                </select>
              </label>

              <label class="grid gap-2">
                <span class="text-sm font-semibold text-slate-700">Motivo da atribuicao</span>
                <textarea
                  v-model="assignmentReason"
                  rows="3"
                  class="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                  placeholder="Explique a redistribuicao, excecao ou ajuste de ownership."
                ></textarea>
              </label>

              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  @click="assignCase"
                >
                  Salvar atribuicao
                </button>
              </div>

              <p v-if="assignmentError" class="text-sm font-medium text-[var(--color-danger)]">{{ assignmentError }}</p>
              <p
                v-if="assignmentFeedback.message"
                :class="[
                  'text-sm font-medium',
                  assignmentFeedback.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]',
                ]"
              >
                {{ assignmentFeedback.message }}
              </p>
            </div>

            <div class="grid gap-3">
              <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
                <p class="text-sm font-semibold text-slate-950">Leitura gerencial</p>
                <ul class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                  <li class="flex gap-2">
                    <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    <span>Casos sem responsavel devem ser assumidos ou redistribuidos antes de ficarem vencidos.</span>
                  </li>
                  <li class="flex gap-2">
                    <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    <span>Reencaminhamento fora do caminho padrao da FAQ fica rastreado como excecao gerencial.</span>
                  </li>
                  <li class="flex gap-2">
                    <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                    <span>Use esta camada para equilibrar carga e intervir em assunto restrito ou travado.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <details
          v-if="exchangeItems.length"
          :class="[
            'overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70',
            !isAreaManager ? 'order-last' : '',
          ]"
        >
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Troca do atendimento
          </summary>
          <div class="grid gap-3 border-t border-slate-200 px-4 py-4">
            <div
              v-for="item in exchangeItems"
              :key="item.id"
              class="rounded-[12px] border border-slate-200 bg-white px-4 py-3"
            >
              <div class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
                <span class="text-xs font-semibold tracking-[0.08em] text-slate-500">{{ item.atLabel }}</span>
              </div>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
            </div>
          </div>
        </details>

        <section class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Confirme antes de responder</h3>
          </div>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4">
            <div
              v-if="decisionSuggestion"
              :class="['rounded-[12px] border px-4 py-3', decisionSuggestion.toneClass]"
            >
              <p class="text-sm font-semibold">{{ decisionSuggestion.title }}</p>
              <p class="mt-2 text-sm leading-6">{{ decisionSuggestion.description }}</p>
            </div>

            <div class="grid gap-3">
              <div
                v-for="item in preDecisionChecks"
                :key="item.title"
                :class="['rounded-[12px] border px-4 py-3', item.toneClass]"
              >
                <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{{ item.title }}</p>
                    <p class="mt-1 text-sm leading-6 text-slate-700">{{ item.helperText }}</p>
                  </div>
                  <span class="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                    {{ item.statusLabel }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <details open class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Orientacao rapida da area
          </summary>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4">
            <p class="text-sm leading-6 text-slate-600">
              Use estes pontos para confirmar se ja da para responder, se ainda falta complemento ou se existe uma excecao real.
            </p>

            <div
              v-for="section in detail.analysisSections"
              :key="section.title"
              class="rounded-[12px] border border-slate-200 bg-white px-4 py-3"
            >
              <p class="text-sm font-semibold text-slate-950">{{ section.title }}</p>
              <ul class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <li v-for="item in section.items" :key="item" class="flex gap-2">
                  <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <RouterLink
              :to="guidanceRoute"
              class="inline-flex w-fit items-center text-sm font-semibold text-[#0b6e8c] transition hover:text-[#09566d]"
            >
              Ver orientacao completa
            </RouterLink>
          </div>
        </details>

        <section class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Resposta da area</h3>
          </div>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4">
            <p
              v-if="!actionAvailability.canAct"
              class="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600"
            >
              {{ actionAvailability.reason }}
            </p>

            <template v-else>
              <div class="grid gap-4">
                <div class="grid gap-3">
                  <p class="text-sm font-semibold text-slate-950">Saida normal do caso</p>
                  <div class="grid gap-3">
                    <button
                      v-for="option in normalDecisionActions"
                      :key="option.id"
                      type="button"
                      :class="[
                        'rounded-[14px] border px-4 py-3 text-left transition',
                        option.toneClass,
                      ]"
                      @click="selectAction(option.id)"
                    >
                      <p class="text-sm font-semibold">{{ option.title }}</p>
                      <p class="mt-1 text-sm leading-6">{{ option.description }}</p>
                    </button>
                  </div>
                </div>

                <div class="rounded-[14px] border border-[rgba(8,115,145,0.14)] bg-[rgba(241,245,249,0.78)] px-4 py-4">
                  <p class="text-sm font-semibold text-slate-950">Nao consigo resolver nesta area</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    Encaminhar para outra area nao e a saida normal. Use isso apenas quando sua area realmente nao puder resolver o caso. Se a duvida for de criterio, fale com o gestor antes de encaminhar.
                  </p>
                  <button
                    v-if="exceptionActionOption && detail.availableAreas.length"
                    type="button"
                    :class="[
                      'mt-4 rounded-[14px] border border-dashed px-4 py-3 text-left transition',
                      exceptionActionOption.toneClass,
                    ]"
                    @click="selectAction(exceptionActionOption.id)"
                  >
                    <p class="text-sm font-semibold">{{ exceptionActionOption.title }}</p>
                    <p class="mt-1 text-sm leading-6">{{ exceptionActionOption.description }}</p>
                  </button>
                  <p v-else class="mt-4 text-sm leading-6 text-slate-600">
                    Nao ha outra area sugerida para este caso no escopo atual.
                  </p>
                </div>
              </div>

              <div
                v-if="activeAction"
                class="rounded-[14px] border border-slate-200 bg-white px-4 py-4"
              >
                <div class="grid gap-4">
                  <div
                    v-if="activeAction.id !== 'reassign'"
                    class="grid gap-4"
                  >
                    <label class="grid gap-2">
                      <span class="text-sm font-semibold text-slate-700">{{ activeAction.fieldLabel }}</span>
                      <textarea
                        ref="actionNoteRef"
                        v-model="actionNote"
                        rows="5"
                        class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700"
                        :placeholder="activeAction.placeholder"
                      ></textarea>
                    </label>
                  </div>

                  <div v-else class="grid gap-4 rounded-[14px] border border-[rgba(8,115,145,0.14)] bg-[rgba(241,245,249,0.6)] px-4 py-4">
                    <p class="text-sm font-semibold text-slate-950">Registrar excecao operacional</p>
                    <p class="text-sm leading-6 text-slate-600">
                      Use este caminho apenas quando sua area realmente nao puder resolver nem com complemento do polo.
                    </p>

                    <label class="grid gap-2">
                      <span class="text-sm font-semibold text-slate-700">Motivo do encaminhamento excepcional</span>
                      <select
                        v-model="selectedReassignReason"
                        class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                      >
                        <option value="">Selecione</option>
                        <option v-for="option in REASSIGN_REASON_OPTIONS" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </option>
                      </select>
                    </label>

                    <label class="grid gap-2">
                      <span class="text-sm font-semibold text-slate-700">O que ja foi verificado nesta area</span>
                      <textarea
                        ref="actionNoteRef"
                        v-model="reassignVerifiedContext"
                        rows="5"
                        class="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
                        placeholder="Explique o que a area ja validou e por que este caso realmente precisa sair daqui."
                      ></textarea>
                    </label>

                    <label class="grid gap-2">
                      <span class="text-sm font-semibold text-slate-700">Area de destino</span>
                      <select
                        v-model="selectedDestinationArea"
                        class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
                      >
                        <option value="">Selecione</option>
                        <option v-for="area in detail.availableAreas" :key="area" :value="area">
                          {{ area }}
                        </option>
                      </select>
                    </label>
                  </div>

                  <p
                    v-if="activeAction.id === 'reassign' && isManagerExceptionSelected"
                    class="rounded-[12px] border border-[rgba(8,115,145,0.16)] bg-[rgba(224,242,254,0.55)] px-4 py-3 text-sm leading-6 text-[#0b6e8c]"
                  >
                    Este encaminhamento esta fora do caminho padrao da FAQ e sera registrado como excecao gerencial.
                  </p>

                  <p v-if="noteError" class="text-sm font-medium text-[var(--color-danger)]">{{ noteError }}</p>
                  <p v-if="reassignReasonError" class="text-sm font-medium text-[var(--color-danger)]">{{ reassignReasonError }}</p>
                  <p v-if="reassignVerifiedError" class="text-sm font-medium text-[var(--color-danger)]">{{ reassignVerifiedError }}</p>
                  <p v-if="destinationError" class="text-sm font-medium text-[var(--color-danger)]">{{ destinationError }}</p>

                  <div class="rounded-[12px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {{ activeAction.previewLabel }}
                    </p>
                    <p class="mt-2 text-sm leading-6 text-slate-700">{{ recordPreview }}</p>
                  </div>

                  <div
                    v-if="pendingConfirmationAction && confirmationCopy"
                    ref="confirmationPanelRef"
                    tabindex="-1"
                    class="rounded-[14px] border border-slate-200 bg-slate-50/80 px-4 py-4 outline-none"
                  >
                    <p class="text-base font-semibold text-slate-950">{{ confirmationCopy.title }}</p>
                    <p class="mt-2 text-sm leading-6 text-slate-600">{{ confirmationCopy.consequence }}</p>
                    <div class="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        :class="[
                          'rounded-[14px] px-4 py-2.5 text-sm font-semibold transition',
                          confirmationCopy.buttonClass,
                        ]"
                        @click="submitAreaAction(pendingConfirmationAction)"
                      >
                        {{ confirmationCopy.buttonLabel }}
                      </button>
                      <button
                        type="button"
                        class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        @click="pendingConfirmationAction = ''"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <button
                      type="button"
                      :class="[
                        'rounded-[14px] px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60',
                        activeAction.id === 'technical_reply'
                          ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]'
                          : activeAction.id === 'request_complement'
                            ? 'bg-[#b7791f] hover:bg-[#8f5d18]'
                            : 'bg-[#0f4c81] hover:bg-[#0c3f6a]',
                      ]"
                      :disabled="isSubmitting"
                      @click="handleActionClick(activeAction.id)"
                    >
                      {{ activeAction.submitLabel }}
                    </button>
                  </div>

                  <p
                    v-if="actionFeedback.message"
                    :class="[
                      'text-sm font-medium',
                      actionFeedback.type === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]',
                    ]"
                  >
                    {{ actionFeedback.message }}
                  </p>
                </div>
              </div>
            </template>
          </div>
        </section>

        <details class="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Historico do caso
          </summary>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4">
            <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-sm font-semibold text-slate-950">Historico recente</p>
              <ul class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <li v-for="item in detail.historySummary" :key="item" class="flex gap-2">
                  <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <div class="grid gap-3">
              <div
                v-for="item in detail.timeline.slice().reverse()"
                :key="item.id"
                class="rounded-[12px] border border-slate-200 bg-white px-4 py-3"
              >
                <div class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                  <p class="text-sm font-semibold text-slate-950">{{ item.title }}</p>
                  <span class="text-xs font-semibold tracking-[0.08em] text-slate-500">{{ item.atLabel }}</span>
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
              </div>
            </div>

            <div
              v-if="detail.attachments.length"
              class="rounded-[12px] border border-slate-200 bg-white px-4 py-3"
            >
              <p class="text-sm font-semibold text-slate-950">Anexos e evidencias</p>
              <ul class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <li v-for="attachment in detail.attachments" :key="attachment.id">
                  {{ attachment.name }}<span v-if="attachment.source"> · {{ attachment.source }}</span>
                </li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </section>
  </div>
</template>
