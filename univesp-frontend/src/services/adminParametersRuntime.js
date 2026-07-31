import { adminParametersDraft } from '../../mocks/adminParameters'
import { CRITICALITY_CATALOG, SLA_CATALOG, getCatalogKeys } from '@/services/faqCatalogs'

const RULE_TARGET_OPTIONS = [
  { value: 'theme', label: 'Tema' },
  { value: 'subtheme', label: 'Subtema' },
  { value: 'queue', label: 'Fila' },
]

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeText(value = '') {
  return String(value).trim().toLowerCase()
}

function titleCase(value = '') {
  const normalized = String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return 'Nao informado'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildDefaultCriticalityLevels() {
  return getCatalogKeys(CRITICALITY_CATALOG).map((key) => ({
    key,
    label: CRITICALITY_CATALOG[key].label,
    badgeLabel: CRITICALITY_CATALOG[key].label,
    backgroundColor: '#f2f4f5',
    textColor: '#101214',
    operationalPriority: CRITICALITY_CATALOG[key].rank,
    note: '',
  }))
}

function buildDefaultSlaLevels() {
  return getCatalogKeys(SLA_CATALOG).map((key, index) => ({
    key,
    label: SLA_CATALOG[key].label,
    badgeLabel: key,
    backgroundColor: '#e8f2fb',
    textColor: '#005f99',
    operationalPriority: index + 1,
    hours: SLA_CATALOG[key].hours ?? null,
    businessDays: SLA_CATALOG[key].businessDays ?? null,
    note: '',
  }))
}

function buildMap(items = []) {
  return Object.fromEntries(items.map((item) => [item.key, item]))
}

function buildLevelPreview(level) {
  return {
    ...level,
    style: {
      backgroundColor: level.backgroundColor,
      color: level.textColor,
    },
  }
}

function resolveCriticalityKey(value, levelsByKey) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return 'media'
  }

  const match = Object.keys(levelsByKey).find((key) => {
    return normalized === key || normalized === normalizeText(levelsByKey[key].label)
  })

  return match || 'media'
}

function resolveSlaKey(caseEntry, levelsByKey) {
  const candidates = [
    caseEntry.faqContext?.sla,
    caseEntry.sla,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate)

    if (!normalized) {
      continue
    }

    const exact = Object.keys(levelsByKey).find((key) => normalizeText(key) === normalized)

    if (exact) {
      return exact
    }

    const byLabel = Object.keys(levelsByKey).find(
      (key) => normalizeText(levelsByKey[key].label) === normalized,
    )

    if (byLabel) {
      return byLabel
    }
  }

  return '48h'
}

function buildTargetOptions(activeCases = []) {
  const themes = Array.from(
    new Set(activeCases.map((entry) => entry.themeKey || normalizeText(entry.theme)).filter(Boolean)),
  ).map((value) => ({
    value,
    label: titleCase(value),
  }))
  const subthemes = Array.from(
    new Set(
      activeCases
        .map((entry) => entry.subsubjectKey || normalizeText(entry.subsubject))
        .filter(Boolean),
    ),
  ).map((value) => ({
    value,
    label: titleCase(value),
  }))
  const queues = Array.from(new Set(activeCases.map((entry) => entry.queue).filter(Boolean))).map(
    (value) => ({
      value,
      label: value,
    }),
  )

  return {
    targetTypes: RULE_TARGET_OPTIONS,
    themes,
    subthemes,
    queues,
  }
}

function matchesRule(caseEntry, rule) {
  const targetValue = normalizeText(rule.targetValue)

  if (!rule.active || !rule.targetType || !targetValue) {
    return false
  }

  if (rule.targetType === 'theme') {
    return normalizeText(caseEntry.themeKey || caseEntry.theme) === targetValue
  }

  if (rule.targetType === 'subtheme') {
    return normalizeText(caseEntry.subsubjectKey || caseEntry.subsubject) === targetValue
  }

  if (rule.targetType === 'queue') {
    return normalizeText(caseEntry.queue) === targetValue
  }

  return false
}

function selectHighestCriticalityKey(keys, levelsByKey, fallbackKey) {
  return (
    [...keys].sort(
      (left, right) =>
        (levelsByKey[right]?.operationalPriority || 0) -
        (levelsByKey[left]?.operationalPriority || 0),
    )[0] || fallbackKey
  )
}

function slaDurationScore(level) {
  if (Number.isFinite(Number(level?.hours)) && Number(level.hours) > 0) {
    return Number(level.hours)
  }
  if (Number.isFinite(Number(level?.businessDays)) && Number(level.businessDays) > 0) {
    return Number(level.businessDays) * 8
  }
  return Number(level?.operationalPriority || 0) * 1000
}

function selectShortestSlaKey(keys, levelsByKey, fallbackKey) {
  return (
    [...keys].sort(
      (left, right) => slaDurationScore(levelsByKey[left]) - slaDurationScore(levelsByKey[right]),
    )[0] || fallbackKey
  )
}

function buildCaseImpact(caseEntry, rules, criticalityByKey, slaByKey) {
  const matchedRules = rules.filter((rule) => matchesRule(caseEntry, rule))
  const baselineCriticalityKey = resolveCriticalityKey(
    caseEntry.faqContext?.criticality || caseEntry.criticality,
    criticalityByKey,
  )
  const baselineSlaKey = resolveSlaKey(caseEntry, slaByKey)
  const projectedCriticalityKey = selectHighestCriticalityKey(
    matchedRules.map((rule) => rule.criticalityKey).filter(Boolean),
    criticalityByKey,
    baselineCriticalityKey,
  )
  const projectedSlaKey = selectShortestSlaKey(
    matchedRules.map((rule) => rule.slaKey).filter(Boolean),
    slaByKey,
    baselineSlaKey,
  )
  const baselineCriticality = buildLevelPreview(criticalityByKey[baselineCriticalityKey])
  const projectedCriticality = buildLevelPreview(criticalityByKey[projectedCriticalityKey])
  const baselineSla = buildLevelPreview(slaByKey[baselineSlaKey])
  const projectedSla = buildLevelPreview(slaByKey[projectedSlaKey])
  const highPriorityThreshold = criticalityByKey.alta?.operationalPriority || 3
  const becomesHighCriticality =
    projectedCriticality.operationalPriority >= highPriorityThreshold
  const getsShorterSla = slaDurationScore(projectedSla) < slaDurationScore(baselineSla)

  return {
    ...caseEntry,
    baselineCriticality,
    projectedCriticality,
    baselineSla,
    projectedSla,
    becomesHighCriticality,
    getsShorterSla,
    changedCriticality: projectedCriticality.key !== baselineCriticality.key,
    changedSla: projectedSla.key !== baselineSla.key,
    matchedRules: matchedRules.map((rule) => ({
      ...rule,
      targetLabel:
        rule.targetType === 'queue' ? rule.targetValue : titleCase(rule.targetValue),
    })),
  }
}

function buildQueueImpact(caseImpacts = []) {
  const queueMap = new Map()

  for (const caseImpact of caseImpacts) {
    if (!queueMap.has(caseImpact.queue)) {
      queueMap.set(caseImpact.queue, {
        queue: caseImpact.queue,
        impactedCases: 0,
        highCriticalityCases: 0,
        shorterSlaCases: 0,
        themes: {},
      })
    }

    const queueEntry = queueMap.get(caseImpact.queue)
    queueEntry.impactedCases += 1
    queueEntry.highCriticalityCases += caseImpact.becomesHighCriticality ? 1 : 0
    queueEntry.shorterSlaCases += caseImpact.getsShorterSla ? 1 : 0
    queueEntry.themes[caseImpact.theme] = (queueEntry.themes[caseImpact.theme] || 0) + 1
  }

  return [...queueMap.values()]
    .map((entry) => ({
      ...entry,
      dominantTheme:
        Object.entries(entry.themes).sort((left, right) => right[1] - left[1])[0]?.[0] ||
        'Nao informado',
    }))
    .sort((left, right) => {
      return (
        right.highCriticalityCases - left.highCriticalityCases ||
        right.shorterSlaCases - left.shorterSlaCases ||
        right.impactedCases - left.impactedCases
      )
    })
}

function buildMetrics(caseImpacts = [], queueImpact = [], rules = []) {
  return [
    {
      label: 'Regras ativas',
      value: rules.filter((rule) => rule.active).length,
      hint: 'Regras mockadas aplicadas por tema, subtema ou fila.',
    },
    {
      label: 'Casos com alta criticidade',
      value: caseImpacts.filter((item) => item.becomesHighCriticality).length,
      hint: 'Casos que ficariam em alta ou critica com os parametros atuais.',
    },
    {
      label: 'Casos com SLA mais curto',
      value: caseImpacts.filter((item) => item.getsShorterSla).length,
      hint: 'Casos cujo SLA projetado fica mais agressivo que o baseline.',
    },
    {
      label: 'Filas afetadas',
      value: queueImpact.filter((entry) => entry.impactedCases > 0).length,
      hint: 'Filas com ao menos um caso impactado pelas regras de governanca.',
    },
  ]
}

export function cloneAdminParametersDraft() {
  return cloneJson(adminParametersDraft)
}

export function findParameterLevel(levels = [], key) {
  return levels.find((level) => level.key === key) || null
}

export function findApplicationRule(rules = [], ruleId) {
  return rules.find((rule) => rule.id === ruleId) || null
}

export function buildAdminParametersRuntime({ dashboardData, draft }) {
  const activeCases = dashboardData?.activeCases || []
  const criticalityLevels = (draft?.criticalityLevels?.length
    ? draft.criticalityLevels
    : buildDefaultCriticalityLevels()
  ).map(buildLevelPreview)
  const slaLevels = (draft?.slaLevels?.length ? draft.slaLevels : buildDefaultSlaLevels()).map(
    buildLevelPreview,
  )
  const rules = draft?.applicationRules || []
  const criticalityByKey = buildMap(criticalityLevels)
  const slaByKey = buildMap(slaLevels)
  const caseImpacts = activeCases.map((caseEntry) =>
    buildCaseImpact(caseEntry, rules, criticalityByKey, slaByKey),
  )
  const queueImpact = buildQueueImpact(caseImpacts)

  return {
    criticalityLevels,
    slaLevels,
    rules,
    caseImpacts,
    queueImpact,
    targetOptions: buildTargetOptions(activeCases),
    metrics: buildMetrics(caseImpacts, queueImpact, rules),
    highCriticalityCases: caseImpacts.filter((item) => item.becomesHighCriticality),
    shorterSlaCases: caseImpacts.filter((item) => item.getsShorterSla),
  }
}
