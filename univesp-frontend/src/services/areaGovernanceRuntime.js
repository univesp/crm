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
  const ownerStateCode = normalizeText(entry.operationalOwnerStateCode || entry.ownershipStateCode || '')
  const ownerMissing =
    entry.hasOperationalOwner === false ||
    entry.hasOperationalOwnerError === true ||
    ['owner_missing', 'owner_invalid'].includes(ownerStateCode)

  if (ownerMissing) {
    return 'owner_missing'
  }

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

function toMinutesLeft(entry = {}) {
  return Number(entry.sortTokens?.slaMinutes || 0)
}

function toActivityHours(entry = {}, currentDate = new Date()) {
  const reference = entry.activityAt || entry.createdAt || null
  const timestamp = reference ? new Date(reference).getTime() : Number.NaN

  if (!Number.isFinite(timestamp)) {
    return 0
  }

  return Math.max(0, Math.round((currentDate.getTime() - timestamp) / (1000 * 60 * 60)))
}

function isSuggestionPending(item = {}) {
  return (
    normalizeText(item.status) === 'pending' ||
    normalizeText(item.statusCode) === 'pending review'
  )
}

function isAvailabilityActive(record = {}, currentDate = new Date()) {
  if (!record?.startsAt || !record?.endsAt) {
    return false
  }

  const start = new Date(record.startsAt).getTime()
  const end = new Date(record.endsAt).getTime()

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return false
  }

  const currentTimestamp = currentDate.getTime()
  return currentTimestamp >= start && currentTimestamp <= end
}

export function buildAreaManagerOverview({
  entries = [],
  assignments = [],
  suggestions = [],
  rules = [],
  userAvailability = [],
  viewerContext = null,
  currentDate = new Date(),
} = {}) {
  const areaLabel = viewerContext?.currentArea || ''
  const areaEntries = entries.filter(
    (entry) => normalizeText(entry.currentAreaLabel || entry.lastMileAreaLabel || entry.queue) === normalizeText(areaLabel),
  )
  const activeEntries = areaEntries.filter((entry) => !isCompletedBucket(entry.areaBucket))
  const teamMembers = getTeamMembersForArea(areaLabel)
  const assignmentMap = new Map(activeEntries.map((entry) => [entry.id, findAreaAssignment(entry, assignments)]))
  const overdueEntries = activeEntries.filter((entry) => toMinutesLeft(entry) < 0)
  const riskEntries = activeEntries.filter((entry) => toMinutesLeft(entry) >= 0 && toMinutesLeft(entry) <= 120)
  const unassignedEntries = activeEntries.filter((entry) => !(assignmentMap.get(entry.id)?.analystName || '').trim())
  const waitingComplementEntries = activeEntries.filter((entry) => normalizeText(entry.areaBucket) === 'waiting_complement')
  const reroutedEntries = activeEntries.filter((entry) => normalizeText(entry.areaBucket) === 'rerouted')
  const stalledEntries = waitingComplementEntries.filter((entry) => toActivityHours(entry, currentDate) >= 48)
  const ownerMissingEntries = activeEntries.filter(
    (entry) =>
      entry.hasOperationalOwnerError ||
      entry.hasOperationalOwner === false ||
      ['owner_missing', 'owner_invalid'].includes(normalizeText(entry.operationalOwnerStateCode)),
  )

  const loadByAnalyst = teamMembers
    .map((analystName) => {
      const analystEntries = activeEntries.filter(
        (entry) => normalizeText(assignmentMap.get(entry.id)?.analystName) === normalizeText(analystName),
      )

      return {
        analystName,
        activeCases: analystEntries.length,
        overdueCases: analystEntries.filter((entry) => toMinutesLeft(entry) < 0).length,
        riskCases: analystEntries.filter((entry) => toMinutesLeft(entry) >= 0 && toMinutesLeft(entry) <= 120).length,
        waitingComplementCases: analystEntries.filter(
          (entry) => normalizeText(entry.areaBucket) === 'waiting_complement',
        ).length,
      }
    })
    .sort((left, right) => right.activeCases - left.activeCases || left.analystName.localeCompare(right.analystName, 'pt-BR'))

  const maxLoad = loadByAnalyst[0]?.activeCases || 0
  const minLoad = loadByAnalyst.at(-1)?.activeCases || 0
  const loadGap = maxLoad - minLoad
  const leastLoaded = loadByAnalyst.filter((item) => item.activeCases === minLoad).map((item) => item.analystName)

  const subjectRows = buildAreaSubjectGovernanceRows(areaEntries, rules, areaLabel)
  const subjectBottlenecks = subjectRows.filter((row) => row.openCases).slice(0, 5)
  const repeatedComplementSubjects = buildAreaSubjectGovernanceRows(waitingComplementEntries, rules, areaLabel)
    .filter((row) => row.openCases > 1)
    .slice(0, 3)

  const pendingSuggestions = suggestions.filter(
    (item) =>
      normalizeText(item.areaLabel) === normalizeText(areaLabel) &&
      isSuggestionPending(item),
  )

  const activeAvailability = userAvailability.filter((record) => {
    const recordArea = normalizeText(record.areaLabel || '')
    const areaMatch = !recordArea || recordArea === normalizeText(areaLabel)
    const analystMatch = teamMembers.some(
      (member) => normalizeText(member) === normalizeText(record.userName),
    )
    return areaMatch && analystMatch && isAvailabilityActive(record, currentDate)
  })

  const unavailableAnalysts = Array.from(
    new Set(
      activeAvailability
        .filter((record) => normalizeText(record.statusCode) === 'unavailable')
        .map((record) => record.userName),
    ),
  )
  const reducedCapacityAnalysts = Array.from(
    new Set(
      activeAvailability
        .filter((record) => normalizeText(record.statusCode) === 'reduced_capacity')
        .map((record) => record.userName),
    ),
  )

  const restrictedCriticalSubjects = subjectRows
    .filter((row) => normalizeText(row.accessMode) === 'restricted' && row.openCases > 0 && (row.allowedAnalysts || []).length <= 1)
    .slice(0, 3)

  const redistributionSuggestions = []

  if (unassignedEntries.length && leastLoaded.length) {
    redistributionSuggestions.push({
      id: 'unassigned-cases',
      tone: 'danger',
      title: `${unassignedEntries.length} caso(s) sem responsavel`,
      description: `Distribuir primeiro para ${leastLoaded.join(', ')} ou assumir excepcionalmente no gestor.`,
      routeQuery: { owner: 'Sem responsavel', bucket: 'all' },
      priority: 'critical',
    })
  }

  if (ownerMissingEntries.length) {
    redistributionSuggestions.push({
      id: 'owner-structural-gap',
      tone: 'danger',
      title: `${ownerMissingEntries.length} caso(s) sem owner operacional`,
      description:
        'Falha estrutural de ownership detectada. Revisar bundle/nos de origem e reprocessar roteamento.',
      routeQuery: { bucket: 'all', scopeState: 'owner_missing', owner: 'todos' },
      priority: 'critical',
    })
  }

  if (loadGap >= 3 && loadByAnalyst.length > 1) {
    redistributionSuggestions.push({
      id: 'load-imbalance',
      tone: 'warning',
      title: 'Carga desigual entre analistas',
      description: `${loadByAnalyst[0].analystName} esta com ${maxLoad} casos ativos e ${leastLoaded.join(', ')} com ${minLoad}. Vale redistribuir parte do backlog.`,
      routeQuery: { bucket: 'all', owner: 'todos', sortField: 'owner' },
      priority: 'high',
    })
  }

  if (overdueEntries.length) {
    redistributionSuggestions.push({
      id: 'overdue-cases',
      tone: 'danger',
      title: `${overdueEntries.length} caso(s) vencido(s)`,
      description: 'Priorize reatribuicao ou assuncao gerencial nos casos vencidos desta area.',
      routeQuery: { bucket: 'needs_review', status: 'Precisa de analise', sortField: 'sla', sortDirection: 'asc' },
      priority: 'critical',
    })
  }

  if (stalledEntries.length) {
    redistributionSuggestions.push({
      id: 'stalled-cases',
      tone: 'warning',
      title: `${stalledEntries.length} caso(s) parado(s) aguardando complemento`,
      description: 'Revise dependencias com o polo e force retomada para evitar reabertura de SLA.',
      routeQuery: { bucket: 'waiting_complement', sortField: 'sla', sortDirection: 'asc' },
      priority: 'high',
    })
  }

  if (repeatedComplementSubjects.length) {
    redistributionSuggestions.push({
      id: 'complement-bottleneck',
      tone: 'info',
      title: 'Complementacoes recorrentes por assunto',
      description: `Ha recorrencia de devolucao em ${repeatedComplementSubjects.map((item) => item.subjectLabel).join(', ')}.`,
      routeQuery: { bucket: 'waiting_complement', sortField: 'subject' },
      priority: 'medium',
    })
  }

  const operationalQuestions = [
    {
      id: 'risk-now',
      question: 'Onde esta o risco agora?',
      value: overdueEntries.length + riskEntries.length,
      headline: overdueEntries.length
        ? `${overdueEntries.length} vencido(s) exigem acao imediata`
        : riskEntries.length
          ? `${riskEntries.length} caso(s) em risco de SLA`
          : 'Sem risco forte no momento',
      helper: 'Combine vencidos e em risco para priorizar a intervencao.',
      tone: overdueEntries.length ? 'danger' : riskEntries.length ? 'warning' : 'stable',
      routeQuery: { bucket: 'needs_review', sortField: 'sla', sortDirection: 'asc' },
    },
    {
      id: 'gargalo-now',
      question: 'Onde esta o gargalo agora?',
      value: subjectBottlenecks[0]?.openCases || 0,
      headline: subjectBottlenecks[0]
        ? `${subjectBottlenecks[0].subjectLabel} concentra ${subjectBottlenecks[0].openCases} caso(s)`
        : 'Sem gargalo de assunto no recorte atual',
      helper: 'Assunto com maior concentracao de backlog na area.',
      tone: subjectBottlenecks[0]?.overdueCases ? 'warning' : 'info',
      routeQuery: subjectBottlenecks[0]
        ? { subject: subjectBottlenecks[0].subjectLabel, bucket: 'all', sortField: 'sla', sortDirection: 'asc' }
        : { bucket: 'all' },
    },
    {
      id: 'intervention-now',
      question: 'Onde preciso intervir agora?',
      value: ownerMissingEntries.length + unassignedEntries.length + stalledEntries.length,
      headline:
        ownerMissingEntries.length || unassignedEntries.length || stalledEntries.length
          ? `${ownerMissingEntries.length} sem owner, ${unassignedEntries.length} sem assignee e ${stalledEntries.length} parado(s)`
          : 'Sem intervencao obrigatoria imediata',
      helper: 'Ownership vazio e casos travados devem ser tratados antes da fila crescer.',
      tone:
        ownerMissingEntries.length || unassignedEntries.length
          ? 'danger'
          : stalledEntries.length
            ? 'warning'
            : 'stable',
      routeQuery: ownerMissingEntries.length || unassignedEntries.length
        ? ownerMissingEntries.length
          ? { bucket: 'all', scopeState: 'owner_missing', owner: 'todos' }
          : { owner: 'Sem responsavel', bucket: 'all' }
        : { bucket: 'waiting_complement', sortField: 'sla', sortDirection: 'asc' },
    },
    {
      id: 'rules-impact-now',
      question: 'Quais regras impactam a operacao?',
      value: restrictedCriticalSubjects.length + pendingSuggestions.length + unavailableAnalysts.length,
      headline:
        restrictedCriticalSubjects.length
          ? `${restrictedCriticalSubjects.length} assunto(s) restrito(s) com alto impacto`
          : pendingSuggestions.length
            ? `${pendingSuggestions.length} mudanca(s) pendente(s) de conhecimento`
            : 'Sem impacto forte de regra no momento',
      helper: 'Conecte disponibilidade, escopo e mudancas pendentes com a saude da fila.',
      tone:
        ownerMissingEntries.length
          ? 'danger'
          : restrictedCriticalSubjects.length
            ? 'warning'
            : pendingSuggestions.length
              ? 'info'
              : 'stable',
      routeQuery: restrictedCriticalSubjects.length ? { bucket: 'all' } : { bucket: 'all' },
    },
  ]

  const ruleImpactHints = [
    ...(ownerMissingEntries.length
      ? [
          {
            id: 'owner-structural-gaps',
            tone: 'danger',
            title: 'Fluxo gerando caso sem owner operacional',
            description: `${ownerMissingEntries.length} caso(s) com ownership estrutural ausente/invalido no runtime.`,
          },
        ]
      : []),
    ...(restrictedCriticalSubjects.length
      ? [
          {
            id: 'restricted-subject-pressure',
            tone: 'warning',
            title: 'Escopo restrito pode gerar gargalo',
            description: `Assuntos com alta pressao e pouca cobertura: ${restrictedCriticalSubjects.map((row) => row.subjectLabel).join(', ')}.`,
          },
        ]
      : []),
    ...(unavailableAnalysts.length
      ? [
          {
            id: 'unavailable-analysts',
            tone: 'warning',
            title: 'Indisponibilidade ativa no time',
            description: `${unavailableAnalysts.join(', ')} fora da distribuicao. Reavalie ownership e visibilidade de assuntos restritos.`,
          },
        ]
      : []),
    ...(reducedCapacityAnalysts.length
      ? [
          {
            id: 'reduced-capacity-analysts',
            tone: 'info',
            title: 'Capacidade reduzida em vigor',
            description: `${reducedCapacityAnalysts.join(', ')} recebendo menos carga. Ajuste expectativas de prazo e reatribuicao.`,
          },
        ]
      : []),
  ]

  return {
    areaLabel,
    kpis: {
      backlogTotal: activeEntries.length,
      overdue: overdueEntries.length,
      atRisk: riskEntries.length,
      unassigned: unassignedEntries.length,
      ownerMissing: ownerMissingEntries.length,
      distributionImbalance: loadGap,
      casesBySubject: subjectBottlenecks.map((item) => ({
        subjectLabel: item.subjectLabel,
        openCases: item.openCases,
      })),
      exceptionCount: reroutedEntries.length,
      pendingKnowledgeChanges: pendingSuggestions.length,
      stalledCases: stalledEntries.length,
    },
    operationalQuestions,
    summary: [
      {
        id: 'backlog',
        label: 'Backlog da area',
        value: activeEntries.length,
        helper: 'Casos ativos no escopo atual.',
      },
      {
        id: 'owner_missing',
        label: 'Sem owner operacional',
        value: ownerMissingEntries.length,
        helper: 'Erro estrutural de ownership no fluxo.',
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
      overloadGap: loadGap,
    },
    loadByAnalyst,
    subjectBottlenecks,
    redistributionSuggestions,
    interventionQueue: redistributionSuggestions,
    ruleImpactHints,
    attentionCases: [...overdueEntries, ...riskEntries.filter((entry) => !overdueEntries.some((item) => item.id === entry.id))]
      .slice(0, 6),
    pendingKnowledgeSuggestions: pendingSuggestions.slice(0, 4),
  }
}
