<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { buildAreaCaseSummaryBackendReadiness, buildAreaCaseSummaryPayload } from '@/contracts/areaCaseSummaryContract'
import { AREA_OPERATIONAL_SERVER_PARITY_NOTE, canRunAreaAction } from '@/contracts/areaOperationalContracts'
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
const concludeSafetyError = ref('')
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
const concludeNoPendingConfirmed = ref(false)
const activeSupportTab = ref('op_context')
const showFullTimeline = ref(false)

const SUPPORT_TAB_OPTIONS = Object.freeze([
  { id: 'op_context', label: 'Contexto OP' },
  { id: 'guidance', label: 'Orientacao' },
  { id: 'history', label: 'Historico' },
])

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
const caseId = computed(() => String(route.params.caseId || '').trim())
const detail = computed(() => studentSupportStore.areaCaseById(caseId.value, areaViewerContext.value))
const globalAreaDetail = computed(() => studentSupportStore.areaCaseById(caseId.value, null))
const globalOperatorDetail = computed(() => studentSupportStore.operatorCaseById(caseId.value, null))
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
const serverParityNote = AREA_OPERATIONAL_SERVER_PARITY_NOTE
const backendReadiness = buildAreaCaseSummaryBackendReadiness({ hasServerSummary: false })
const backendMinimalFieldEntries = computed(() => Object.entries(backendReadiness.minimalPayload || {}))

function buildActionAvailabilityState(detailValue) {
  if (!detailValue) {
    return { canAct: false, reason: 'Caso indisponivel no momento.' }
  }

  if (
    !isAreaManager.value &&
    detailValue.currentAssigneeLabel &&
    detailValue.currentAssigneeLabel !== 'Sem responsavel' &&
    normalizeText(detailValue.currentAssigneeLabel) !== normalizeText(auth.mockContext.userName)
  ) {
    return {
      canAct: false,
      reason: `Caso atribuido para ${detailValue.currentAssigneeLabel}. Solicite redistribuicao antes de atuar.`,
    }
  }

  const status = normalizeText(detailValue.status)

  if (status.includes('respondido pela area') || status.includes('concluido pela area') || status.includes('reencaminhado')) {
    return {
      canAct: false,
      reason: 'Tratativa principal ja encerrada. Caso somente para consulta.',
    }
  }

  if (status.includes('complementacao solicitada pela area')) {
    return {
      canAct: false,
      reason: 'Aguardando complemento do polo para nova analise.',
    }
  }

  return {
    canAct: true,
    reason: '',
  }
}

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

const managerCaseInterventionSummary = computed(() => {
  if (!isAreaManager.value || !detail.value) {
    return null
  }

  const alerts = []

  if (detail.value.currentAssigneeLabel === 'Sem responsavel') {
    alerts.push('Caso sem responsavel definido.')
  }

  if (detail.value.sortTokens?.slaMinutes < 0) {
    alerts.push('SLA vencido no momento.')
  } else if ((detail.value.sortTokens?.slaMinutes || 0) <= 120) {
    alerts.push('SLA em risco no curto prazo.')
  }

  if (detail.value.areaBucket === 'rerouted') {
    alerts.push('Caso em fluxo de excecao/reencaminhamento.')
  }

  if (detail.value.subjectScopeRule?.accessMode === 'restricted') {
    const analysts = detail.value.subjectScopeRule?.allowedAnalysts || []
    alerts.push(
      analysts.length
        ? `Assunto restrito para ${analysts.join(', ')}.`
        : 'Assunto restrito sem analista autorizado.',
    )
  }

  return {
    alerts,
    hasAlerts: Boolean(alerts.length),
  }
})

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function buildAreaQueueRoute(extraQuery = {}) {
  return {
    path: '/area/fila',
    query: {
      ...extraQuery,
    },
  }
}

const detailAccessState = computed(() => {
  if (detail.value) {
    return null
  }

  if (!caseId.value) {
    return {
      title: 'URL incompleta para abrir o caso',
      description: 'O identificador do protocolo nao foi informado corretamente na rota.',
      queueRoute: buildAreaQueueRoute(),
      scopeRoute: null,
      switchRoute: null,
    }
  }

  if (!globalOperatorDetail.value) {
    return {
      title: 'Protocolo nao encontrado',
      description: 'O caso informado nao existe na base carregada deste ambiente.',
      queueRoute: buildAreaQueueRoute(),
      scopeRoute: null,
      switchRoute: null,
    }
  }

  if (!globalAreaDetail.value) {
    return {
      title: 'Caso fora do fluxo da area',
      description: 'Este protocolo existe, mas nao esta no fluxo de atuacao da area neste momento.',
      queueRoute: buildAreaQueueRoute(),
      scopeRoute: null,
      switchRoute: null,
    }
  }

  const expectedArea = globalAreaDetail.value.currentAreaLabel || globalAreaDetail.value.lastMileAreaLabel || ''
  const requestedArea = String(route.query.area || '').trim()
  const canSwitchToExpectedArea = (auth.mockContext.linkedAreas || []).includes(expectedArea)
  const hasAreaMismatch =
    requestedArea && expectedArea && normalizeText(requestedArea) !== normalizeText(expectedArea)

  return {
    title: hasAreaMismatch ? 'Escopo de area inconsistente' : 'Sem acesso ao caso neste escopo',
    description: hasAreaMismatch
      ? `A URL aponta para ${requestedArea}, mas o caso esta em ${expectedArea}.`
      : 'Seu perfil atual nao tem visibilidade para este caso no recorte selecionado.',
    queueRoute: buildAreaQueueRoute(),
    scopeRoute: canSwitchToExpectedArea ? buildAreaQueueRoute({ areaFilter: expectedArea }) : null,
    switchRoute: canSwitchToExpectedArea
      ? {
          path: `/area/fila/${caseId.value}`,
          query: {
            area: expectedArea,
          },
        }
      : null,
  }
})

function withPeriod(value = '') {
  const text = String(value || '').trim()

  if (!text) {
    return ''
  }

  return /[.!?]$/.test(text) ? text : `${text}.`
}

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
      title: 'Acao sugerida: pedir complemento',
      description: 'Faltam evidencias essenciais para resposta final.',
      toneClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.4)] text-[#8a5200]',
    }
  }

  if (systemsToCheck.length > 0) {
    return {
      actionId: 'technical_reply',
      title: 'Acao sugerida: validar e responder',
      description: 'Ha base inicial. Valide sistemas e responda se nao houver impeditivo.',
      toneClass: 'border-[rgba(209,50,57,0.18)] bg-[rgba(253,236,237,0.35)] text-[var(--color-primary-dark)]',
    }
  }

  return {
    actionId: 'technical_reply',
    title: 'Acao sugerida: responder',
    description: 'Sem dependencia relevante de outra area. Resolva aqui.',
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
      requirementCode: 'documentos_evidencias',
      title: 'Ha base para responder?',
      toneClass: evidenceMissing
        ? 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.36)]'
        : 'border-[rgba(26,111,67,0.16)] bg-[rgba(220,252,231,0.25)]',
      statusLabel: evidenceMissing ? 'Pendente' : 'OK',
      isPending: evidenceMissing,
      helperText: requiredDocuments.length > 0
        ? evidenceMissing
          ? `Faltam: ${requiredDocuments.join(', ')}.`
          : 'Documentos obrigatorios recebidos.'
        : 'Sem pendencia de documento obrigatorio.',
    },
    {
      requirementCode: 'checagens_sistema',
      title: 'Ainda falta alguma checagem?',
      toneClass: systemsToCheck.length
        ? 'border-[rgba(8,115,145,0.16)] bg-[rgba(224,242,254,0.32)]'
        : 'border-slate-200 bg-white',
      statusLabel: systemsToCheck.length ? 'Pendente' : 'OK',
      isPending: Boolean(systemsToCheck.length),
      helperText: systemsToCheck.length
        ? `Consulte ${systemsToCheck.join(', ')} antes de responder.`
        : 'Sem checagem de sistema em aberto.',
    },
    {
      title: 'Depende mesmo de outra area?',
      toneClass: 'border-slate-200 bg-white',
      statusLabel: 'Excecao',
      helperText: 'Se sua area consegue resolver, responda ou peca complemento.',
    },
  ]
})

const decisionExamples = computed(() => [
  {
    title: 'Quando responder',
    description: 'Quando houver base suficiente e a area conseguir resolver o caso.',
  },
  {
    title: 'Quando pedir complemento',
    description: 'Quando faltar documento, evidencia ou validacao para fechar a resposta.',
  },
  {
    title: 'Quando concluir',
    description: 'Quando nao houver nova tratativa pendente para polo ou outra area.',
  },
  {
    title: 'Quando encaminhar excepcionalmente',
    description: 'Quando a area realmente nao puder resolver mesmo apos as checagens basicas.',
  },
])

const supportTabOptions = computed(() => SUPPORT_TAB_OPTIONS)

const missingRequirementLabels = Object.freeze({
  documentos_evidencias: 'Documentos/evidencias obrigatorios',
  checagens_sistema: 'Checagens de sistema pendentes',
  resposta_final_obrigatoria: 'Resposta final obrigatoria antes da conclusao',
  contexto_op_incompleto: 'Contexto do OP incompleto',
})

function mapMissingRequirementLabel(code = '') {
  return missingRequirementLabels[code] || code
}

function resolveActionLabel(actionId = '') {
  if (actionId === 'technical_reply') {
    return 'Responder ao aluno e ao OP'
  }

  if (actionId === 'request_complement') {
    return 'Solicitar complemento'
  }

  if (actionId === 'conclude') {
    return 'Concluir analise interna'
  }

  if (actionId === 'reassign') {
    return 'Encaminhar excepcionalmente'
  }

  return 'Analisar caso'
}

const caseSummaryPayload = computed(() =>
  buildAreaCaseSummaryPayload({
    detail: detail.value,
    detailAccessState: detailAccessState.value,
    decisionSuggestion: decisionSuggestion.value,
    preDecisionChecks: preDecisionChecks.value,
    concludeReadiness: concludeReadiness.value,
    actionAvailability: actionAvailability.value,
    actionAuthorization: actionAuthorization.value,
  }),
)

const decisionStatusPresentation = computed(() => {
  const status = caseSummaryPayload.value.decisionStatus

  if (status === 'scope_invalid') {
    return {
      label: 'Fora do escopo',
      helper: 'Revise area/escopo antes de atuar.',
      toneClass: 'border-[rgba(166,31,40,0.18)] bg-[rgba(253,236,237,0.62)] text-[var(--color-danger)]',
    }
  }

  if (status === 'read_only') {
    return {
      label: 'Apenas consulta',
      helper: actionAvailability.value.reason || 'Atuacao principal da area ja registrada.',
      toneClass: 'border-slate-200 bg-slate-100 text-slate-700',
    }
  }

  if (status === 'missing_requirements') {
    return {
      label: 'Faltam requisitos',
      helper: 'Resolva pendencias antes de finalizar a decisao.',
      toneClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.5)] text-[#8a5200]',
    }
  }

  if (status === 'ready_to_reply') {
    return {
      label: 'Caso apto para resposta',
      helper: 'Fluxo principal: responder aluno e OP.',
      toneClass: 'border-[rgba(26,111,67,0.18)] bg-[rgba(220,252,231,0.55)] text-[var(--color-success)]',
    }
  }

  if (status === 'ready_to_request_complement') {
    return {
      label: 'Apto para pedir complemento',
      helper: 'Ainda faltam subsidios para resposta final segura.',
      toneClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.5)] text-[#8a5200]',
    }
  }

  return {
    label: 'Caso em analise',
    helper: 'Revise o resumo e escolha a proxima acao.',
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
  }
})

const decisionQuickSummary = computed(() => {
  if (!detail.value) {
    return null
  }

  const validatedItems = (detail.value.handoffItems || [])
    .slice(0, 2)
    .map((item) => `${item.label}: ${item.value}`)
    .filter(Boolean)

  const missingRequirements = caseSummaryPayload.value.missingRequirements
  const normalizedMissingLabel = missingRequirements.length
    ? missingRequirements.map((item) => mapMissingRequirementLabel(item)).join(' · ')
    : 'Sem pendencias essenciais.'
  const normalizedValidatedLabel = validatedItems.length
    ? validatedItems.join(' · ')
    : 'Sem validacao registrada no handoff inicial.'
  const missingLabel = missingRequirements.length
    ? missingRequirements
      .map((item) => {
        if (item === 'documentos_evidencias') return 'Documentos/evidencias obrigatorios'
        if (item === 'checagens_sistema') return 'Checagens de sistema pendentes'
        if (item === 'resposta_final_obrigatoria') return 'Resposta final obrigatoria antes da conclusao'
        if (item === 'contexto_op_incompleto') return 'Contexto do OP incompleto'
        return item
      })
      .join(' · ')
    : 'Sem pendencias essenciais.'

  return {
    whyInArea: detail.value.contextFromOp || detail.value.pendingLabel || 'Contexto operacional nao informado.',
    validated: validatedItems.length
      ? validatedItems.join(' · ')
      : 'Sem validacao registrada no handoff inicial.',
    missingNow: missingLabel,
    normalizedMissingNow: normalizedMissingLabel,
    normalizedValidated: normalizedValidatedLabel,
    recommendedAction: resolveActionLabel(caseSummaryPayload.value.recommendedAction),
  }
})

const recommendedActionPanel = computed(() => {
  const actionId = caseSummaryPayload.value.recommendedAction || 'technical_reply'
  const missing = caseSummaryPayload.value.missingRequirements || []
  const hasBlockers = Boolean(missing.length) || !actionAvailability.value.canAct

  return {
    actionId,
    nextStep: resolveActionLabel(actionId),
    reason: decisionSuggestion.value?.description || decisionStatusPresentation.value.helper,
    pendingItems: missing.map((item) => mapMissingRequirementLabel(item)),
    blockers: !actionAvailability.value.canAct ? [actionAvailability.value.reason] : [],
    toneClass: hasBlockers
      ? 'border-[rgba(202,138,4,0.24)] bg-[rgba(254,243,199,0.45)] text-[#8a5200]'
      : 'border-[rgba(26,111,67,0.2)] bg-[rgba(220,252,231,0.45)] text-[var(--color-success)]',
  }
})

const decisionStateBadges = computed(() => {
  if (!detail.value) {
    return []
  }

  const badges = [
    {
      id: 'decision_status',
      label: decisionStatusPresentation.value.label,
      toneClass: decisionStatusPresentation.value.toneClass,
    },
  ]

  if (detail.value.currentAssigneeLabel === 'Sem responsavel') {
    badges.push({
      id: 'unassigned',
      label: 'Sem responsavel',
      toneClass: 'border-[rgba(202,138,4,0.24)] bg-[rgba(254,243,199,0.45)] text-[#8a5200]',
    })
  }

  if (!isAreaManager.value && analystOperationalState.value?.value === 'Atribuido a outro analista') {
    badges.push({
      id: 'assignment_conflict',
      label: 'Conflito de ownership',
      toneClass: 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.55)] text-[var(--color-danger)]',
    })
  }

  if (selectedAction.value === 'reassign') {
    badges.push({
      id: 'exception_flow',
      label: 'Excecao exige justificativa',
      toneClass: 'border-[rgba(8,115,145,0.2)] bg-[rgba(224,242,254,0.55)] text-[#0b6e8c]',
    })
  }

  if (!caseSummaryPayload.value.responseAllowed) {
    badges.push({
      id: 'response_blocked',
      label: 'Resposta bloqueada por permissao',
      toneClass: 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.55)] text-[var(--color-danger)]',
    })
  }

  if (!caseSummaryPayload.value.exceptionAllowed) {
    badges.push({
      id: 'exception_blocked',
      label: 'Excecao bloqueada por permissao',
      toneClass: 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.55)] text-[var(--color-danger)]',
    })
  }

  if (actionFeedback.value.type === 'error') {
    badges.push({
      id: 'sync_error',
      label: 'Erro de sincronizacao',
      toneClass: 'border-[rgba(166,31,40,0.2)] bg-[rgba(253,236,237,0.55)] text-[var(--color-danger)]',
    })
  }

  return badges
})

const complementaryContextWarning = computed(() => {
  if (!detail.value) {
    return ''
  }

  if (!detail.value.contextFromOp) {
    return 'Contexto recebido do OP esta incompleto. Use historico e trilha para reduzir risco de decisao.'
  }

  if (!detail.value.timeline?.length && !detail.value.historySummary?.length) {
    return 'Historico ainda sem eventos consolidados. Registre decisao com nota clara para manter rastreabilidade.'
  }

  return ''
})

const timelineItems = computed(() =>
  Array.isArray(detail.value?.timeline) ? detail.value.timeline.slice().reverse() : [],
)
const supportTabState = computed(() => {
  const contextState = detail.value?.contextLoadState || {}
  const hasGuidance = Boolean(detail.value?.analysisSections?.length)
  const hasHistory = Boolean(detail.value?.historySummary?.length || detail.value?.timeline?.length)

  return {
    op_context: {
      loading: Boolean(contextState.opContextLoading),
      error: String(contextState.opContextError || ''),
      emptyMessage: 'Sem contexto adicional do OP para este caso.',
      summary: detail.value?.contextFromOp ? 'Contexto inicial registrado.' : 'Contexto inicial incompleto.',
    },
    guidance: {
      loading: Boolean(contextState.guidanceLoading),
      error: String(contextState.guidanceError || ''),
      emptyMessage: 'Orientacao indisponivel para este assunto.',
      summary: hasGuidance ? 'Passos de orientacao disponiveis.' : 'Sem orientacao estruturada no momento.',
    },
    history: {
      loading: Boolean(contextState.historyLoading),
      error: String(contextState.historyError || ''),
      emptyMessage: 'Historico indisponivel para este protocolo.',
      summary: hasHistory ? 'Eventos recentes carregados.' : 'Sem eventos historicos.',
      lazyLoadHint: 'No backend real, eventos antigos serao carregados por paginacao.',
    },
  }
})
const activeSupportTabState = computed(() => supportTabState.value[activeSupportTab.value] || null)

const timelinePreviewLimit = 3
const visibleTimelineItems = computed(() =>
  showFullTimeline.value ? timelineItems.value : timelineItems.value.slice(0, timelinePreviewLimit),
)
const hasMoreTimelineItems = computed(() => timelineItems.value.length > visibleTimelineItems.value.length)
const hiddenTimelineCount = computed(() => Math.max(timelineItems.value.length - visibleTimelineItems.value.length, 0))

const actionOptions = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    {
      id: 'technical_reply',
      kind: 'primary',
      title: 'Responder aluno + OP',
      description: 'Saida principal quando ha base suficiente.',
      submitLabel: 'Enviar resposta',
      fieldLabel: 'Resposta final para aluno e OP',
      previewLabel: 'Resposta final que sera enviada ao aluno e ao OP',
      placeholder: 'Escreva a resposta final para aluno e OP.',
      toneClass:
        selectedAction.value === 'technical_reply'
          ? 'border-[rgba(209,50,57,0.22)] bg-[rgba(209,50,57,0.08)] text-[var(--color-primary-dark)] shadow-[0_10px_24px_rgba(166,31,40,0.08)]'
          : 'border-[rgba(209,50,57,0.16)] bg-white text-slate-700',
    },
    {
      id: 'request_complement',
      kind: 'secondary',
      title: 'Pedir complemento',
      description: 'Use quando faltar evidencia para responder com seguranca.',
      submitLabel: 'Enviar solicitacao',
      fieldLabel: 'Solicitacao para aluno e OP',
      previewLabel: 'Complementacao que sera enviada ao aluno e ao OP',
      placeholder: 'Descreva o que falta para retomar a analise.',
      toneClass:
        selectedAction.value === 'request_complement'
          ? 'border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.18)] text-[#9a5b00]'
          : 'border-slate-200 bg-white text-slate-700',
    },
    {
      id: 'conclude',
      kind: 'tertiary',
      title: 'Concluir analise interna',
      description: 'Use so sem pendencia para polo ou outra area.',
      submitLabel: 'Concluir analise interna',
      fieldLabel: 'Registro de conclusao interna',
      previewLabel: 'Resumo da conclusao interna',
      placeholder: 'Registre por que a analise pode ser concluida.',
      toneClass:
        selectedAction.value === 'conclude'
          ? 'border-slate-300 bg-slate-100 text-slate-900'
          : 'border-slate-200 bg-white text-slate-700',
    },
    {
      id: 'reassign',
      kind: 'exception',
      title: 'Encaminhar excepcionalmente para outra area',
      description: 'Use apenas quando a area nao puder resolver.',
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

const hasFinalResponseToStudent = computed(() =>
  (detail.value?.areaActionLogs || []).some((log) => log.actionType === 'technical_reply'),
)
const concludeReadiness = computed(() => {
  if (!detail.value) {
    return {
      required: false,
      canConclude: false,
      missingReason: '',
    }
  }

  if (hasFinalResponseToStudent.value) {
    return {
      required: true,
      canConclude: true,
      missingReason: '',
    }
  }

  return {
    required: true,
    canConclude: false,
    missingReason: 'Antes de concluir, envie uma resposta final para aluno e OP.',
  }
})
const actionAuthorization = computed(() => {
  const result = {}

  for (const option of actionOptions.value) {
    result[option.id] = canRunAreaAction({
      actionType: option.id,
      viewerContext: auth.mockContext,
      isManagerException: option.id === 'reassign' ? isManagerExceptionSelected.value : false,
    })
  }

  return result
})

const activeAction = computed(
  () => actionOptions.value.find((option) => option.id === selectedAction.value) || null,
)

const primaryActionOption = computed(() => actionOptions.value.find((option) => option.kind === 'primary') || null)
const secondaryActionOption = computed(() => actionOptions.value.find((option) => option.kind === 'secondary') || null)
const tertiaryActionOption = computed(() => actionOptions.value.find((option) => option.kind === 'tertiary') || null)
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

  if (actionType === 'conclude') {
    return `Analise interna concluida pela area sobre ${subjectLabel}, sem tratativa pendente para polo ou outra area.`
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
    concludeSafetyError.value = ''
    pendingConfirmationAction.value = ''
    concludeNoPendingConfirmed.value = false
    selectedAssignee.value = detail.value?.currentAssigneeLabel && detail.value.currentAssigneeLabel !== 'Sem responsavel'
      ? detail.value.currentAssigneeLabel
      : ''
    assignmentReason.value = ''
    assignmentError.value = ''
    assignmentFeedback.value = { type: '', message: '' }
    activeSupportTab.value = 'op_context'
    showFullTimeline.value = false
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
  concludeSafetyError.value = ''
  pendingConfirmationAction.value = ''
  clearFeedback()

  if (selectedAction.value !== 'reassign') {
    selectedDestinationArea.value = ''
    selectedReassignReason.value = ''
    reassignVerifiedContext.value = ''
  }

  if (selectedAction.value !== 'conclude') {
    concludeNoPendingConfirmed.value = false
  }
  if (selectedAction.value === 'conclude' && !concludeReadiness.value.canConclude) {
    concludeSafetyError.value = concludeReadiness.value.missingReason
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
  concludeNoPendingConfirmed.value = false
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

function actionPermissionReason(actionType = '') {
  const policy = actionAuthorization.value[actionType]
  return policy?.allowed ? '' : policy?.reason || 'Acao indisponivel para o perfil atual.'
}

const analystOperationalState = computed(() => {
  if (isAreaManager.value || !detail.value) {
    return null
  }

  const assignee = detail.value.currentAssigneeLabel || 'Sem responsavel'
  const normalizedAssignee = normalizeText(assignee)
  const currentUser = normalizeText(auth.mockContext.userName)

  if (assignee === 'Sem responsavel') {
    return {
      title: 'Voce pode atuar agora?',
      value: 'Sem responsavel',
      helper: 'Este caso ainda nao tem dono fixo na area.',
      toneClass: 'border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.4)] text-[#8a5200]',
    }
  }

  if (normalizedAssignee === currentUser) {
    return {
      title: 'Voce pode atuar agora?',
      value: 'Caso atribuido a voce',
      helper: 'Voce esta com ownership da tratativa neste momento.',
      toneClass: 'border-[rgba(26,111,67,0.18)] bg-[rgba(220,252,231,0.35)] text-[var(--color-success)]',
    }
  }

  return {
    title: 'Voce pode atuar agora?',
    value: 'Atribuido a outro analista',
    helper: `Ownership atual: ${assignee}.`,
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
  }
})

watch(
  [() => detail.value?.id, () => decisionSuggestion.value?.actionId, () => actionAvailability.value.canAct],
  ([caseId, suggestedAction, canAct]) => {
    if (!caseId || !canAct || !suggestedAction) {
      return
    }

    if (!selectedAction.value) {
      if (!actionPermissionReason(suggestedAction)) {
        selectedAction.value = suggestedAction
      }
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
  const permissionError = actionPermissionReason(actionType)
  if (permissionError) {
    actionFeedback.value = {
      type: 'error',
      message: permissionError,
    }
    return false
  }

  if (actionType === 'reassign') {
    if (!selectedReassignReason.value) {
      reassignReasonError.value = 'Selecione o motivo do encaminhamento excepcional.'
      return false
    }

    reassignReasonError.value = ''

    if (!reassignVerifiedContext.value.trim()) {
      reassignVerifiedError.value = 'Informe o que ja foi verificado nesta area.'
      focusNoteField()
      return false
    }

    reassignVerifiedError.value = ''

    if (!selectedDestinationArea.value) {
      destinationError.value = 'Selecione a area de destino.'
      return false
    }

    destinationError.value = ''
    noteError.value = ''
    concludeSafetyError.value = ''
    return true
  }

  if (!actionNote.value.trim()) {
    noteError.value = 'Preencha o registro desta acao antes de continuar.'
    focusNoteField()
    return false
  }

  noteError.value = ''

  if (actionType === 'conclude' && !concludeReadiness.value.canConclude) {
    concludeSafetyError.value = concludeReadiness.value.missingReason
    return false
  }

  if (actionType === 'conclude' && !concludeNoPendingConfirmed.value) {
    concludeSafetyError.value =
      'Confirme que nao ha tratativa pendente para polo ou outra area.'
    return false
  }

  concludeSafetyError.value = ''

  if (actionType === 'reassign' && !selectedDestinationArea.value) {
    destinationError.value = 'Selecione a area de destino.'
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
  const permissionError = actionPermissionReason(actionType)
  if (permissionError) {
    actionFeedback.value = {
      type: 'error',
      message: permissionError,
    }
    return
  }

  if (actionType === 'conclude' && !concludeReadiness.value.canConclude) {
    actionFeedback.value = {
      type: 'error',
      message: concludeReadiness.value.missingReason,
    }
    return
  }

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
      consequence: 'Aluno e OP receberao a resposta final.',
      buttonClass: 'bg-[var(--color-primary)] text-white',
      buttonLabel: 'Confirmar envio da resposta',
    }
  }

  if (pendingConfirmationAction.value === 'request_complement') {
    return {
      title: 'Confirmar pedido de complemento',
      consequence: 'Aluno e OP receberao esta solicitacao.',
      buttonClass: 'border border-[rgba(202,138,4,0.22)] bg-[rgba(254,243,199,0.82)] text-[#8a5200]',
      buttonLabel: 'Confirmar pedido de complemento',
    }
  }

  if (pendingConfirmationAction.value === 'reassign') {
    return {
      title: isManagerExceptionSelected.value ? 'Confirmar encaminhamento excepcional' : 'Confirmar encaminhamento excepcional',
      consequence: isManagerExceptionSelected.value
        ? `O caso saira do caminho padrao e seguira para ${selectedDestinationArea.value} com excecao gerencial.`
        : `O caso seguira para ${selectedDestinationArea.value} fora do fluxo preferencial.`,
      buttonClass: 'bg-[#0f4c81] text-white',
      buttonLabel: 'Confirmar encaminhamento excepcional',
    }
  }

  if (pendingConfirmationAction.value === 'conclude') {
    return {
      title: 'Confirmar conclusao interna',
      consequence: 'A analise sera encerrada internamente sem nova tratativa pendente.',
      buttonClass: 'border border-slate-300 bg-slate-100 text-slate-800',
      buttonLabel: 'Confirmar conclusao interna',
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
  let actionLog = null
  try {
    actionLog = studentSupportStore.registerAreaAction({
      caseId: detail.value.id,
      actionType,
      note: actionType === 'reassign' ? buildStructuredReassignNote() : actionNote.value,
      actorName: auth.mockContext.userName,
      nextArea: selectedDestinationArea.value,
      isManagerException: isManagerExceptionSelected.value,
    })
  } catch (error) {
    isSubmitting.value = false
    actionFeedback.value = {
      type: 'error',
      message: error?.message || 'Falha ao registrar a acao. Tente novamente.',
    }
    return
  }

  isSubmitting.value = false

  if (!actionLog) {
    actionFeedback.value = {
      type: 'error',
      message: 'Falha ao registrar a acao. Tente novamente.',
    }
    return
  }

  pendingConfirmationAction.value = ''
  actionFeedback.value = {
    type: 'success',
    message:
      actionType === 'technical_reply'
        ? 'Resposta enviada para aluno e OP.'
        : actionType === 'request_complement'
          ? 'Pedido de complemento enviado para aluno e OP.'
          : actionType === 'reassign'
            ? isManagerExceptionSelected.value
              ? `Caso encaminhado para ${actionLog.destinationLabel} com excecao gerencial.`
              : `Caso reencaminhado para ${actionLog.destinationLabel}.`
            : actionType === 'conclude'
              ? 'Analise interna concluida.'
              : 'Acao registrada com sucesso.',
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

  const assignmentPolicy = canRunAreaAction({
    actionType: 'assign_case',
    viewerContext: auth.mockContext,
  })

  if (!assignmentPolicy.allowed) {
    assignmentFeedback.value = {
      type: 'error',
      message: assignmentPolicy.reason,
    }
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
    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Erro de acesso ao caso</p>
    <h3 class="mt-3 text-2xl font-semibold text-slate-950">
      {{ detailAccessState?.title || 'Caso indisponivel no escopo atual' }}
    </h3>
    <p class="mt-3 text-sm leading-7 text-slate-600">
      {{ detailAccessState?.description || 'A URL nao corresponde ao escopo atual desta area.' }}
    </p>
    <div class="mt-5 flex flex-wrap gap-2">
      <RouterLink
        :to="detailAccessState?.queueRoute || '/area/fila'"
        class="rounded-[14px] bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Voltar para fila da area
      </RouterLink>
      <RouterLink
        v-if="detailAccessState?.switchRoute"
        :to="detailAccessState.switchRoute"
        class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Trocar para area correta
      </RouterLink>
      <RouterLink
        v-if="detailAccessState?.scopeRoute"
        :to="detailAccessState.scopeRoute"
        class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Abrir fila deste escopo
      </RouterLink>
    </div>
  </div>

  <div v-else class="grid gap-4">
    <section class="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
      <div class="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Estado atual do caso</p>
            <p class="mt-1 text-lg font-semibold text-slate-950">Detalhe da analise</p>
            <h2 class="mt-1 text-[1.35rem] font-semibold leading-tight text-slate-950">{{ detail.subject }}</h2>
          </div>
          <RouterLink
            to="/area/fila"
            class="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar para fila
          </RouterLink>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {{ detail.id }}
          </span>
          <button
            type="button"
            class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:text-[var(--color-primary)]"
            @click="openStudentCases"
          >
            {{ detail.studentData.nome || 'Aluno nao informado' }}
          </button>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            RA {{ detail.studentData.ra || 'nao informado' }}
          </span>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            Polo {{ detail.studentData.polo || 'nao informado' }}
          </span>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            Area {{ detail.currentAreaLabel || 'nao informada' }}
          </span>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {{ detail.areaStatusLabel }}
          </span>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            SLA {{ detail.sla || 'nao informado' }}
          </span>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            Responsavel: {{ detail.currentAssigneeLabel || 'Sem responsavel' }}
          </span>
        </div>
        <div :class="['mt-3 rounded-[12px] border px-4 py-3', decisionStatusPresentation.toneClass]">
          <p class="text-sm font-semibold">{{ decisionStatusPresentation.label }}</p>
          <p class="mt-1 text-sm leading-6">{{ decisionStatusPresentation.helper }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="badge in decisionStateBadges"
              :key="badge.id"
              :class="['rounded-full border px-3 py-1 text-xs font-semibold', badge.toneClass]"
            >
              {{ badge.label }}
            </span>
          </div>
          <p v-if="caseSummaryPayload.lastMeaningfulEvent?.title" class="mt-1 text-xs leading-6 text-slate-600">
            Ultimo evento relevante: {{ caseSummaryPayload.lastMeaningfulEvent.title }}
            <span v-if="caseSummaryPayload.lastMeaningfulEvent.atLabel"> · {{ caseSummaryPayload.lastMeaningfulEvent.atLabel }}</span>
          </p>
        </div>
      </div>

      <div class="grid gap-4 px-5 py-4">
        <section class="rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4">
          <h3 class="text-base font-semibold text-slate-950">Resumo para decidir</h3>
          <div class="mt-3 grid gap-3">
            <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Por que o caso chegou na area</p>
              <p class="mt-1 text-sm leading-6 text-slate-700">{{ decisionQuickSummary?.whyInArea }}</p>
            </div>
            <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Ja validado</p>
              <p class="mt-1 text-sm leading-6 text-slate-700">{{ decisionQuickSummary?.normalizedValidated || decisionQuickSummary?.validated }}</p>
            </div>
            <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">O que ainda falta</p>
              <p class="mt-1 text-sm leading-6 text-slate-700">{{ decisionQuickSummary?.normalizedMissingNow || decisionQuickSummary?.missingNow }}</p>
            </div>
            <div class="rounded-[12px] border border-[rgba(26,111,67,0.16)] bg-[rgba(220,252,231,0.3)] px-4 py-3">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Acao recomendada agora</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ decisionQuickSummary?.recommendedAction }}</p>
            </div>
          </div>
        </section>

        <section
          v-if="isAreaManager && managerCaseInterventionSummary"
          class="order-35 rounded-[14px] border border-slate-200 bg-white px-4 py-4"
        >
          <p class="text-sm font-semibold text-slate-950">Intervencao gerencial no caso</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Esta camada e para ownership, excecao e risco operacional. A decisao tecnica continua no fluxo principal da area.
          </p>

          <div class="mt-3 grid gap-2">
            <p
              v-for="item in managerCaseInterventionSummary.alerts"
              :key="item"
              class="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700"
            >
              {{ item }}
            </p>
            <p
              v-if="!managerCaseInterventionSummary.hasAlerts"
              class="rounded-[12px] border border-[rgba(26,111,67,0.16)] bg-[rgba(220,252,231,0.5)] px-3 py-2 text-xs leading-5 text-[var(--color-success)]"
            >
              Sem alerta forte neste caso. Mantenha apenas monitoramento de prazo e ownership.
            </p>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <RouterLink
              to="/area/fila"
              class="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Voltar para fila da area
            </RouterLink>
            <RouterLink
              to="/area/governanca"
              class="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ajustar regra/visibilidade
            </RouterLink>
          </div>
        </section>

        <section v-if="isAreaManager" class="order-40 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Leitura gerencial de distribuicao</h3>
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
          class="order-41 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70"
        >
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Intervencao de ownership</h3>
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

        <section class="order-30 rounded-[14px] border border-slate-200 bg-white px-4 py-4">
          <p class="text-sm font-semibold text-slate-950">Contexto complementar</p>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            Consulte somente o bloco necessario para decidir com seguranca.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="tab in supportTabOptions"
              :key="tab.id"
              type="button"
              :class="[
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                activeSupportTab === tab.id
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ]"
              @click="activeSupportTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
          <p v-if="activeSupportTabState?.summary" class="mt-3 text-xs font-medium text-slate-500">
            {{ activeSupportTabState.summary }}
          </p>
          <p
            v-if="complementaryContextWarning"
            class="mt-3 rounded-[12px] border border-[rgba(202,138,4,0.2)] bg-[rgba(254,243,199,0.45)] px-3 py-2 text-xs leading-6 text-[#8a5200]"
          >
            {{ complementaryContextWarning }}
          </p>
          <p
            v-if="activeSupportTabState?.loading"
            class="mt-3 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-6 text-slate-600"
          >
            Carregando contexto desta aba...
          </p>
          <p
            v-if="activeSupportTabState?.error"
            class="mt-3 rounded-[12px] border border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.58)] px-3 py-2 text-xs leading-6 text-[var(--color-danger)]"
          >
            {{ activeSupportTabState.error }}
          </p>
        </section>

        <details
          v-if="activeSupportTab === 'op_context' && !activeSupportTabState?.loading && !activeSupportTabState?.error && exchangeItems.length"
          :class="[
            'order-31 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70',
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
        <p
          v-if="activeSupportTab === 'op_context' && !activeSupportTabState?.loading && !activeSupportTabState?.error && !exchangeItems.length"
          class="order-31 rounded-[12px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-600"
        >
          {{ activeSupportTabState?.emptyMessage || 'Nao ha troca recente adicional registrada.' }}
        </p>

        <section
          v-if="activeSupportTab === 'guidance' && !activeSupportTabState?.loading && !activeSupportTabState?.error"
          class="order-32 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70"
        >
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Antes de decidir</h3>
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

            <div class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-sm font-semibold text-slate-950">Exemplos rapidos de decisao</p>
              <ul class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <li v-for="item in decisionExamples" :key="item.title" class="flex gap-2">
                  <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                  <span><strong>{{ item.title }}:</strong> {{ item.description }}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <details
          v-if="activeSupportTab === 'guidance' && !activeSupportTabState?.loading && !activeSupportTabState?.error && detail.analysisSections.length"
          class="order-33 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70"
        >
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
        <p
          v-if="activeSupportTab === 'guidance' && !activeSupportTabState?.loading && !activeSupportTabState?.error && !detail.analysisSections.length"
          class="order-33 rounded-[12px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-600"
        >
          {{ activeSupportTabState?.emptyMessage || 'Orientacao indisponivel para este assunto.' }}
        </p>

        <section class="order-20 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70">
          <div class="bg-slate-100/90 px-4 py-3">
            <h3 class="text-base font-semibold text-slate-950">Decisao da area</h3>
            <p class="mt-1 text-sm leading-6 text-slate-600">Escolha uma saida por vez. O formulario abaixo muda conforme a decisao selecionada.</p>
          </div>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4">
            <p class="rounded-[12px] border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
              {{ serverParityNote }}
            </p>
            <details class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
              <summary class="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Payload canonico esperado do backend
              </summary>
              <ul class="mt-3 grid gap-1 text-xs leading-5 text-slate-600">
                <li v-for="[field, type] in backendMinimalFieldEntries" :key="field">
                  <strong>{{ field }}:</strong> {{ type }}
                </li>
              </ul>
            </details>
            <div :class="['rounded-[12px] border px-4 py-3', recommendedActionPanel.toneClass]">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Acao recomendada agora</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">
                {{ recommendedActionPanel.nextStep || 'Analisar e decidir' }}
              </p>
              <p class="mt-1 text-sm leading-6">
                {{ recommendedActionPanel.reason }}
              </p>
              <ul v-if="recommendedActionPanel.pendingItems.length" class="mt-2 grid gap-1 text-xs leading-5">
                <li v-for="item in recommendedActionPanel.pendingItems" :key="`pending-${item}`" class="flex gap-2">
                  <span class="mt-[0.4rem] h-1.5 w-1.5 rounded-full bg-current"></span>
                  <span>Pendencia: {{ item }}</span>
                </li>
              </ul>
              <ul v-if="recommendedActionPanel.blockers.length" class="mt-2 grid gap-1 text-xs leading-5">
                <li v-for="item in recommendedActionPanel.blockers" :key="`block-${item}`" class="flex gap-2">
                  <span class="mt-[0.4rem] h-1.5 w-1.5 rounded-full bg-current"></span>
                  <span>Bloqueio: {{ item }}</span>
                </li>
              </ul>
            </div>
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
                        'rounded-[14px] border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55',
                        option.toneClass,
                      ]"
                      :disabled="Boolean(actionPermissionReason(option.id))"
                      @click="selectAction(option.id)"
                    >
                      <p class="text-sm font-semibold">{{ option.title }}</p>
                      <p class="mt-1 text-sm leading-6">{{ option.description }}</p>
                      <p v-if="actionPermissionReason(option.id)" class="mt-2 text-xs text-[var(--color-danger)]">
                        {{ actionPermissionReason(option.id) }}
                      </p>
                    </button>
                  </div>
                </div>

                <div v-if="tertiaryActionOption" class="rounded-[14px] border border-slate-200 bg-white px-4 py-4">
                  <p class="text-sm font-semibold text-slate-950">Fechamento interno (uso restrito)</p>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    Concluir analise interna nao e atalho. Use apenas quando nao houver nova tratativa pendente para polo ou outra area.
                  </p>
                  <p
                    v-if="!concludeReadiness.canConclude"
                    class="mt-2 rounded-[10px] border border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.58)] px-3 py-2 text-xs font-semibold text-[var(--color-danger)]"
                  >
                    {{ concludeReadiness.missingReason }}
                  </p>
                  <button
                    type="button"
                    :class="[
                      'mt-3 rounded-[14px] border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55',
                      tertiaryActionOption.toneClass,
                    ]"
                    :disabled="!concludeReadiness.canConclude || Boolean(actionPermissionReason(tertiaryActionOption.id))"
                    @click="selectAction(tertiaryActionOption.id)"
                  >
                    <p class="text-sm font-semibold">{{ tertiaryActionOption.title }}</p>
                    <p class="mt-1 text-sm leading-6">{{ tertiaryActionOption.description }}</p>
                    <p
                      v-if="actionPermissionReason(tertiaryActionOption.id)"
                      class="mt-2 text-xs text-[var(--color-danger)]"
                    >
                      {{ actionPermissionReason(tertiaryActionOption.id) }}
                    </p>
                  </button>
                </div>

                <details class="rounded-[14px] border border-[rgba(8,115,145,0.14)] bg-[rgba(241,245,249,0.78)] px-4 py-4">
                  <summary class="cursor-pointer list-none text-sm font-semibold text-slate-950">
                    Encaminhar excepcionalmente para outra area
                  </summary>
                  <p class="mt-2 text-sm leading-6 text-slate-600">
                    Nao e a saida normal. Use somente quando sua area realmente nao puder resolver.
                  </p>
                  <button
                    v-if="exceptionActionOption && detail.availableAreas.length"
                    type="button"
                    :class="[
                      'mt-3 rounded-[14px] border border-dashed px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55',
                      exceptionActionOption.toneClass,
                    ]"
                    :disabled="Boolean(actionPermissionReason(exceptionActionOption.id))"
                    @click="selectAction(exceptionActionOption.id)"
                  >
                    <p class="text-sm font-semibold">{{ exceptionActionOption.title }}</p>
                    <p class="mt-1 text-sm leading-6">{{ exceptionActionOption.description }}</p>
                    <p v-if="actionPermissionReason(exceptionActionOption.id)" class="mt-2 text-xs text-[var(--color-danger)]">
                      {{ actionPermissionReason(exceptionActionOption.id) }}
                    </p>
                  </button>
                  <p v-else class="mt-3 text-sm leading-6 text-slate-600">
                    Nao ha outra area sugerida para este caso no escopo atual.
                  </p>
                </details>
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

                    <label
                      v-if="activeAction.id === 'conclude'"
                      class="flex items-start gap-2 rounded-[12px] border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm leading-6 text-slate-700"
                    >
                      <input
                        v-model="concludeNoPendingConfirmed"
                        type="checkbox"
                        class="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--color-primary)]"
                      />
                      <span>Confirmo que nao existe nova tratativa pendente para polo ou outra area.</span>
                    </label>
                    <p
                      v-if="activeAction.id === 'conclude'"
                      :class="[
                        'rounded-[12px] border px-3 py-2 text-xs font-semibold',
                        concludeReadiness.canConclude
                          ? 'border-[rgba(26,111,67,0.16)] bg-[rgba(220,252,231,0.55)] text-[var(--color-success)]'
                          : 'border-[rgba(166,31,40,0.16)] bg-[rgba(253,236,237,0.58)] text-[var(--color-danger)]',
                      ]"
                    >
                      {{
                        concludeReadiness.canConclude
                          ? 'Resposta final ja registrada para aluno e OP.'
                          : concludeReadiness.missingReason
                      }}
                    </p>
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
                  <p v-if="concludeSafetyError" class="text-sm font-medium text-[var(--color-danger)]">{{ concludeSafetyError }}</p>
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
                            : activeAction.id === 'conclude'
                              ? 'bg-slate-800 hover:bg-slate-700'
                              : 'bg-[#0f4c81] hover:bg-[#0c3f6a]',
                      ]"
                      :disabled="
                        isSubmitting ||
                          Boolean(actionPermissionReason(activeAction.id)) ||
                          (activeAction.id === 'conclude' && !concludeReadiness.canConclude)
                      "
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

        <details
          v-if="activeSupportTab === 'history' && !activeSupportTabState?.loading && !activeSupportTabState?.error"
          class="order-34 overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50/70"
        >
          <summary class="cursor-pointer list-none bg-slate-100/90 px-4 py-3 text-base font-semibold text-slate-950">
            Historico do caso
          </summary>
          <div class="grid gap-4 border-t border-slate-200 px-4 py-4">
            <p class="text-xs font-medium text-slate-500">
              Mostrando {{ visibleTimelineItems.length }} de {{ timelineItems.length }} evento(s) do fluxo.
            </p>

            <div v-if="detail.historySummary.length" class="rounded-[12px] border border-slate-200 bg-white px-4 py-3">
              <p class="text-sm font-semibold text-slate-950">Historico recente</p>
              <ul class="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <li v-for="item in detail.historySummary" :key="item" class="flex gap-2">
                  <span class="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>

            <div v-if="timelineItems.length" class="grid gap-3">
              <div
                v-for="item in visibleTimelineItems"
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
            <p
              v-else
              class="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600"
            >
              {{ activeSupportTabState?.emptyMessage || 'Sem eventos historicos para este caso.' }}
            </p>
            <button
              v-if="hasMoreTimelineItems"
              type="button"
              class="w-fit rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="showFullTimeline = true"
            >
              Ver historico completo (mais {{ hiddenTimelineCount }} evento(s))
            </button>
            <button
              v-else-if="showFullTimeline && timelineItems.length > timelinePreviewLimit"
              type="button"
              class="w-fit rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              @click="showFullTimeline = false"
            >
              Voltar para historico resumido
            </button>
            <p class="text-xs leading-6 text-slate-500">
              {{ activeSupportTabState?.lazyLoadHint }}
            </p>

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

        <section
          v-if="analystOperationalState"
          :class="['order-50 rounded-[14px] border px-4 py-4', analystOperationalState.toneClass]"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.08em]">Apoio operacional</p>
          <p class="mt-2 text-sm font-semibold">{{ analystOperationalState.value }}</p>
          <p class="mt-1 text-sm leading-6">{{ analystOperationalState.helper }}</p>
        </section>
      </div>
    </section>
  </div>
</template>
