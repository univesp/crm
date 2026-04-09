import {
  areaCaseAssignmentSeeds,
  areaSubjectRuleSeeds,
  areaTeamCatalog,
  knowledgeSuggestionSeeds,
} from '../../mocks/areaGovernance'

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

function buildSubjectKey(themeKey = '', subsubjectKey = '') {
  return `${normalizeText(themeKey)}::${normalizeText(subsubjectKey)}`
}

function isCompletedBucket(bucket = '') {
  return normalizeText(bucket) === 'completed'
}

export function cloneAreaGovernanceSeeds() {
  return {
    areaSubjectRules: areaSubjectRuleSeeds.map((item) => ({ ...item, allowedAnalysts: [...item.allowedAnalysts] })),
    areaCaseAssignments: areaCaseAssignmentSeeds.map((item) => ({ ...item })),
    knowledgeSuggestions: knowledgeSuggestionSeeds.map((item) => ({ ...item })),
  }
}

export function getTeamMembersForArea(areaLabel = '') {
  return [...(areaTeamCatalog[areaLabel] || [])]
}

export function findAreaSubjectRule({ areaLabel = '', themeKey = '', subsubjectKey = '', rules = [] } = {}) {
  const normalizedArea = normalizeText(areaLabel)
  const normalizedTheme = normalizeText(themeKey)
  const normalizedSubsubject = normalizeText(subsubjectKey)

  return (
    rules.find(
      (rule) =>
        rule.isActive !== false &&
        normalizeText(rule.areaLabel) === normalizedArea &&
        normalizeText(rule.themeKey) === normalizedTheme &&
        normalizeText(rule.subsubjectKey) === normalizedSubsubject,
    ) ||
    rules.find(
      (rule) =>
        rule.isActive !== false &&
        normalizeText(rule.areaLabel) === normalizedArea &&
        normalizeText(rule.themeKey) === normalizedTheme &&
        !normalizeText(rule.subsubjectKey),
    ) ||
    null
  )
}

export function canViewerAccessAreaSubject(entry = {}, viewerContext = null, rules = []) {
  if (!viewerContext) {
    return true
  }

  if (viewerContext.profileKey === 'gestor_area') {
    return true
  }

  const areaLabel = entry.currentAreaLabel || entry.lastMileAreaLabel || entry.queue
  const rule = findAreaSubjectRule({
    areaLabel,
    themeKey: entry.themeKey,
    subsubjectKey: entry.subsubjectKey,
    rules,
  })

  const visibilityMode = rule?.visibilityMode || rule?.accessMode || 'team'
  const eligibleUsers = rule?.eligibleUsers || rule?.allowedAnalysts || []

  if (!rule || normalizeText(visibilityMode) === 'team') {
    return true
  }

  return eligibleUsers.some(
    (analystName) => normalizeText(analystName) === normalizeText(viewerContext.userName),
  )
}

export function findAreaAssignment(entry = {}, assignments = []) {
  const possibleAreas = [
    entry.currentAreaLabel,
    entry.lastMileAreaLabel,
    entry.queue,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value))

  return (
    [...assignments]
      .filter(
        (assignment) =>
          assignment.caseId === entry.id &&
          possibleAreas.includes(normalizeText(assignment.areaLabel)) &&
          assignment.statusCode !== 'completed',
      )
      .sort((left, right) => new Date(left.assignedAt || 0).getTime() - new Date(right.assignedAt || 0).getTime())
      .at(-1) ||
    [...assignments]
      .filter(
        (assignment) =>
          assignment.caseId === entry.id && possibleAreas.includes(normalizeText(assignment.areaLabel)),
      )
      .sort((left, right) => new Date(left.assignedAt || 0).getTime() - new Date(right.assignedAt || 0).getTime())
      .at(-1) ||
    null
  )
}

export function deriveAnalystOwnershipState(entry = {}, viewerContext = null, assignment = null, areaLogs = []) {
  if (!viewerContext || viewerContext.profileKey === 'gestor_area') {
    return 'team'
  }

  const assigneeName = normalizeText(assignment?.analystName)
  const viewerName = normalizeText(viewerContext.userName)
  const latestLog = [...areaLogs].at(-1) || null
  const hadComplementRequestByViewer = areaLogs.some(
    (log) =>
      normalizeText(log.actionType) === 'request_complement' &&
      normalizeText(log.actor) === viewerName,
  )

  if (!assigneeName) {
    return 'unassigned'
  }

  if (assigneeName === viewerName && hadComplementRequestByViewer && normalizeText(entry.areaBucket) === 'needs_review') {
    return 'returned_to_me'
  }

  if (assigneeName === viewerName) {
    return 'mine'
  }

  if (latestLog && normalizeText(latestLog.actionType) === 'request_complement') {
    return 'waiting_complement'
  }

  return 'assigned_other'
}

export function buildAreaSubjectGovernanceRows(entries = [], rules = [], areaLabel = '') {
  const areaEntries = entries.filter(
    (entry) => normalizeText(entry.currentAreaLabel || entry.lastMileAreaLabel || entry.queue) === normalizeText(areaLabel),
  )
  const ruleMap = new Map()

  for (const rule of rules.filter((item) => normalizeText(item.areaLabel) === normalizeText(areaLabel))) {
    ruleMap.set(buildSubjectKey(rule.themeKey, rule.subsubjectKey), rule)
  }

  for (const entry of areaEntries) {
    const subjectKey = buildSubjectKey(entry.themeKey, entry.subsubjectKey)
    if (!ruleMap.has(subjectKey)) {
      ruleMap.set(subjectKey, {
        id: `scope-${normalizeText(areaLabel)}-${entry.themeKey}-${entry.subsubjectKey}`,
        areaLabel,
        themeKey: entry.themeKey,
        subsubjectKey: entry.subsubjectKey,
        subjectLabel: `${entry.theme || titleCase(entry.themeKey)} / ${entry.subsubject || titleCase(entry.subsubjectKey)}`,
        accessMode: 'team',
        allowedAnalysts: [],
        visibilityMode: 'team',
        eligibleUsers: [],
        updatedBy: '',
        updatedAtLabel: '',
      })
    }
  }

  return [...ruleMap.values()]
    .map((rule) => {
      const subjectKey = buildSubjectKey(rule.themeKey, rule.subsubjectKey)
      const subjectEntries = areaEntries.filter(
        (entry) => buildSubjectKey(entry.themeKey, entry.subsubjectKey) === subjectKey,
      )

      return {
        ...rule,
        openCases: subjectEntries.filter((entry) => !isCompletedBucket(entry.areaBucket)).length,
        overdueCases: subjectEntries.filter((entry) => entry.sortTokens?.slaMinutes < 0).length,
        riskCases: subjectEntries.filter((entry) => entry.sortTokens?.slaMinutes >= 0 && entry.sortTokens?.slaMinutes <= 120).length,
      }
    })
    .sort((left, right) => {
      if (right.openCases !== left.openCases) {
        return right.openCases - left.openCases
      }

      return left.subjectLabel.localeCompare(right.subjectLabel, 'pt-BR')
    })
}

export function buildAreaKnowledgeRows(entries = [], suggestions = [], areaLabel = '') {
  const suggestionMap = new Map()

  for (const suggestion of suggestions.filter((item) => normalizeText(item.areaLabel) === normalizeText(areaLabel))) {
    suggestionMap.set(buildSubjectKey(suggestion.themeKey, suggestion.subsubjectKey), suggestionMap.get(buildSubjectKey(suggestion.themeKey, suggestion.subsubjectKey)) || [])
    suggestionMap.get(buildSubjectKey(suggestion.themeKey, suggestion.subsubjectKey)).push(suggestion)
  }

  const subjectKeys = new Set(
    entries
      .filter((entry) => normalizeText(entry.currentAreaLabel || entry.lastMileAreaLabel || entry.queue) === normalizeText(areaLabel))
      .map((entry) => buildSubjectKey(entry.themeKey, entry.subsubjectKey)),
  )

  for (const suggestion of suggestions.filter((item) => normalizeText(item.areaLabel) === normalizeText(areaLabel))) {
    subjectKeys.add(buildSubjectKey(suggestion.themeKey, suggestion.subsubjectKey))
  }

  return [...subjectKeys]
    .map((subjectKey) => {
      const [themeKey, subsubjectKey] = subjectKey.split('::')
      const match = entries.find((entry) => buildSubjectKey(entry.themeKey, entry.subsubjectKey) === subjectKey)
      const relatedSuggestions = suggestionMap.get(subjectKey) || []

      return {
        themeKey,
        subsubjectKey,
        subjectLabel:
          relatedSuggestions[0]?.subjectLabel ||
          `${match?.theme || titleCase(themeKey)} / ${match?.subsubject || titleCase(subsubjectKey)}`,
        suggestions: relatedSuggestions.sort(
          (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
        ),
      }
    })
    .sort((left, right) => left.subjectLabel.localeCompare(right.subjectLabel, 'pt-BR'))
}

export function buildAreaManagerOverview({
  entries = [],
  assignments = [],
  suggestions = [],
  rules = [],
  viewerContext = null,
} = {}) {
  const areaLabel = viewerContext?.currentArea || ''
  const areaEntries = entries.filter(
    (entry) => normalizeText(entry.currentAreaLabel || entry.lastMileAreaLabel || entry.queue) === normalizeText(areaLabel),
  )
  const activeEntries = areaEntries.filter((entry) => !isCompletedBucket(entry.areaBucket))
  const teamMembers = getTeamMembersForArea(areaLabel)
  const assignmentMap = new Map(activeEntries.map((entry) => [entry.id, findAreaAssignment(entry, assignments)]))
  const overdueEntries = activeEntries.filter((entry) => entry.sortTokens?.slaMinutes < 0)
  const riskEntries = activeEntries.filter(
    (entry) => entry.sortTokens?.slaMinutes >= 0 && entry.sortTokens?.slaMinutes <= 120,
  )
  const unassignedEntries = activeEntries.filter((entry) => !assignmentMap.get(entry.id)?.analystName)
  const waitingComplementEntries = activeEntries.filter((entry) => normalizeText(entry.areaBucket) === 'waiting_complement')
  const reroutedEntries = areaEntries.filter((entry) => normalizeText(entry.areaBucket) === 'rerouted')

  const loadByAnalyst = teamMembers
    .map((analystName) => {
      const analystEntries = activeEntries.filter(
        (entry) => normalizeText(assignmentMap.get(entry.id)?.analystName) === normalizeText(analystName),
      )

      return {
        analystName,
        activeCases: analystEntries.length,
        overdueCases: analystEntries.filter((entry) => entry.sortTokens?.slaMinutes < 0).length,
        riskCases: analystEntries.filter(
          (entry) => entry.sortTokens?.slaMinutes >= 0 && entry.sortTokens?.slaMinutes <= 120,
        ).length,
        waitingComplementCases: analystEntries.filter(
          (entry) => normalizeText(entry.areaBucket) === 'waiting_complement',
        ).length,
      }
    })
    .sort((left, right) => right.activeCases - left.activeCases || left.analystName.localeCompare(right.analystName, 'pt-BR'))

  const maxLoad = loadByAnalyst[0]?.activeCases || 0
  const minLoad = loadByAnalyst.at(-1)?.activeCases || 0
  const leastLoaded = loadByAnalyst.filter((item) => item.activeCases === minLoad).map((item) => item.analystName)

  const subjectBottlenecks = buildAreaSubjectGovernanceRows(areaEntries, rules, areaLabel)
    .filter((row) => row.openCases)
    .slice(0, 5)

  const repeatedComplementSubjects = buildAreaSubjectGovernanceRows(waitingComplementEntries, rules, areaLabel)
    .filter((row) => row.openCases > 1)
    .slice(0, 3)

  const redistributionSuggestions = []

  if (unassignedEntries.length && leastLoaded.length) {
    redistributionSuggestions.push({
      id: 'unassigned-cases',
      tone: 'danger',
      title: `${unassignedEntries.length} caso(s) sem responsavel`,
      description: `Distribuir primeiro para ${leastLoaded.join(', ')} ou assumir excepcionalmente no gestor.`,
    })
  }

  if (maxLoad - minLoad >= 3 && loadByAnalyst.length > 1) {
    redistributionSuggestions.push({
      id: 'load-imbalance',
      tone: 'warning',
      title: 'Carga desigual entre analistas',
      description: `${loadByAnalyst[0].analystName} esta com ${maxLoad} casos ativos e ${leastLoaded.join(', ')} com ${minLoad}. Vale redistribuir parte do backlog.`,
    })
  }

  if (overdueEntries.length) {
    redistributionSuggestions.push({
      id: 'overdue-cases',
      tone: 'danger',
      title: `${overdueEntries.length} caso(s) vencido(s)`,
      description: 'Priorize reasignacao ou assuncao gerencial nos casos vencidos desta area.',
    })
  }

  if (repeatedComplementSubjects.length) {
    redistributionSuggestions.push({
      id: 'complement-bottleneck',
      tone: 'info',
      title: 'Complementacoes recorrentes por assunto',
      description: `Ha recorrencia de devolucao em ${repeatedComplementSubjects.map((item) => item.subjectLabel).join(', ')}.`,
    })
  }

  const pendingSuggestions = suggestions.filter(
    (item) =>
      normalizeText(item.areaLabel) === normalizeText(areaLabel) &&
      normalizeText(item.status) === 'pending',
  )

  return {
    areaLabel,
    summary: [
      {
        id: 'backlog',
        label: 'Backlog da area',
        value: activeEntries.length,
        helper: 'Casos ativos no escopo atual.',
      },
      {
        id: 'unassigned',
        label: 'Sem responsavel',
        value: unassignedEntries.length,
        helper: 'Casos ainda sem dono definido.',
      },
      {
        id: 'overdue',
        label: 'Vencidos',
        value: overdueEntries.length,
        helper: 'Casos fora do prazo de resposta.',
      },
      {
        id: 'risk',
        label: 'Em risco',
        value: riskEntries.length,
        helper: 'Casos que vencem em breve.',
      },
    ],
    health: {
      waitingComplement: waitingComplementEntries.length,
      rerouted: reroutedEntries.length,
      pendingSuggestions: pendingSuggestions.length,
      overloadGap: maxLoad - minLoad,
    },
    loadByAnalyst,
    subjectBottlenecks,
    redistributionSuggestions,
    attentionCases: [...overdueEntries, ...riskEntries.filter((entry) => !overdueEntries.some((item) => item.id === entry.id))]
      .slice(0, 6),
    pendingKnowledgeSuggestions: pendingSuggestions.slice(0, 4),
  }
}
