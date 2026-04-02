import { QUEUE_DESTINATION_CATALOG } from '@/services/faqCatalogs'

export const TRIAGEM_CENTRAL_LABEL = 'Triagem Central'

const CENTRAL_EXCEPTION_THEMES = new Set(['provas', 'atividades_avaliativas'])

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
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

export function buildPoloQueueLabel(polo = '') {
  const normalizedPolo = String(polo || '').trim()
  return normalizedPolo ? `OP do polo - ${normalizedPolo}` : 'OP do polo - Nao informado'
}

export function resolveLastMileAreaLabel(queueDestination = '') {
  const catalogEntry = QUEUE_DESTINATION_CATALOG[queueDestination]

  if (catalogEntry?.label) {
    return titleCase(catalogEntry.label)
  }

  return titleCase(queueDestination)
}

export function buildCaseRoutingContext({
  studentPolo = '',
  theme = '',
  subtheme = '',
  queueDestination = '',
  targetAreaLabel = '',
  criticality = '',
  entryOrigin = 'Acesso Unificado',
} = {}) {
  const normalizedTheme = normalizeText(theme)
  const normalizedSubtheme = normalizeText(subtheme)
  const normalizedCriticality = normalizeText(criticality)
  const resolvedAreaLabel = targetAreaLabel || resolveLastMileAreaLabel(queueDestination)
  const exceptionToCentral =
    CENTRAL_EXCEPTION_THEMES.has(normalizedTheme) || normalizedCriticality === 'critica'
  const currentQueueLabel = exceptionToCentral
    ? TRIAGEM_CENTRAL_LABEL
    : buildPoloQueueLabel(studentPolo)
  const exceptionReason = exceptionToCentral
    ? `Tema ${titleCase(theme)}${normalizedSubtheme ? ` / ${titleCase(subtheme)}` : ''} tratado como excecao do MVP.`
    : ''
  const assignmentRuleLabel = exceptionToCentral
    ? `${exceptionReason} A entrada segue para ${TRIAGEM_CENTRAL_LABEL} antes de qualquer encaminhamento para ${resolvedAreaLabel}.`
    : `Aluno do polo ${studentPolo || 'Nao informado'} segue primeiro para ${currentQueueLabel}. Se o OP nao resolver, o caso pode escalar para ${resolvedAreaLabel}.`

  return {
    entryOrigin,
    studentPolo: studentPolo || 'Nao informado',
    currentQueueLabel,
    targetAreaLabel: resolvedAreaLabel,
    exceptionToCentral,
    exceptionReason,
    assignmentRuleLabel,
  }
}

export function isCaseVisibleForMockContext(caseEntry, mockContext = null) {
  if (!mockContext) {
    return true
  }

  if (mockContext.isStudentShell) {
    return false
  }

  const queueSet = new Set(mockContext.visibleQueues || [])
  const areaSet = new Set(mockContext.visibleAreas || [])
  const poloSet = new Set(mockContext.linkedPolos || [])
  const routing = caseEntry.routing || {}

  if (mockContext.isOperationalShell) {
    const visibleForOperationalScope =
      queueSet.has(caseEntry.queue) ||
      queueSet.has(routing.currentQueueLabel) ||
      poloSet.has(caseEntry.polo)

    if (!visibleForOperationalScope) {
      return false
    }

    if (mockContext.profileKey === 'op') {
      return (
        normalizeText(caseEntry.assignedOperator) === normalizeText(mockContext.userName) &&
        normalizeText(caseEntry.escalationState) !== normalizeText('Escalado')
      )
    }

    return true
  }

  return (
    queueSet.has(caseEntry.queue) ||
    queueSet.has(routing.currentQueueLabel) ||
    areaSet.has(caseEntry.lastMileAreaLabel) ||
    areaSet.has(routing.targetAreaLabel)
  )
}

export function filterCasesForMockContext(entries = [], mockContext = null) {
  return entries.filter((entry) => isCaseVisibleForMockContext(entry, mockContext))
}
