import { adminParametersDraft } from '../../mocks/adminParameters'
import { cloneAdminParametersDraft } from '@/services/adminParametersRuntime'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function titleCase(value = '') {
  const normalized = String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return 'Não informado'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function resolveDraftParameters(draft = null) {
  if (draft?.criticalityLevels?.length && draft?.slaLevels?.length) {
    return draft
  }
  return cloneAdminParametersDraft()
}

function matchesThemeOrSubtheme(rule, themeKey, subthemeKey) {
  if (!rule?.active) {
    return false
  }

  const target = normalizeText(rule.targetValue)
  if (!target) {
    return false
  }

  if (rule.targetType === 'theme') {
    return normalizeText(themeKey) === target
  }

  if (rule.targetType === 'subtheme') {
    return normalizeText(subthemeKey) === target
  }

  return false
}

export function resolveFaqNodeThemeKeys(node = {}) {
  const themeKey = normalizeText(node.tema || node.theme || '')
  const subthemeKey = normalizeText(node.subtema || node.subtheme || '')
  return { themeKey, subthemeKey }
}

export function shouldShowFaqVigentRule(node = {}) {
  return Boolean(node?.show_vigent_rule || node?.showVigentRule)
}

export function buildFaqVigentRuleSummary(node = {}, draft = null) {
  if (!shouldShowFaqVigentRule(node)) {
    return null
  }

  const parameters = resolveDraftParameters(draft)
  const { themeKey, subthemeKey } = resolveFaqNodeThemeKeys(node)
  if (!themeKey && !subthemeKey) {
    return null
  }

  const rules = (parameters.applicationRules || []).filter((rule) =>
    matchesThemeOrSubtheme(rule, themeKey, subthemeKey),
  )

  if (!rules.length) {
    return {
      title: 'Prazo e regra vigente',
      message: 'Nenhuma regra central cadastrada para este tema/subtema no momento.',
      criticalityLabel: '',
      slaLabel: '',
      references: [],
    }
  }

  const criticalityByKey = Object.fromEntries(
    (parameters.criticalityLevels || []).map((level) => [level.key, level]),
  )
  const slaByKey = Object.fromEntries((parameters.slaLevels || []).map((level) => [level.key, level]))

  const projectedCriticality = rules
    .map((rule) => criticalityByKey[rule.criticalityKey])
    .filter(Boolean)
    .sort((left, right) => (right.operationalPriority || 0) - (left.operationalPriority || 0))[0]

  const projectedSla = rules
    .map((rule) => slaByKey[rule.slaKey])
    .filter(Boolean)
    .sort((left, right) => (right.operationalPriority || 0) - (left.operationalPriority || 0))[0]

  return {
    title: 'Prazo e regra vigente',
    message:
      'Estes prazos seguem a governança central do CRM. Eles podem mudar sem alterar o texto desta FAQ.',
    criticalityLabel: projectedCriticality?.label || '',
    slaLabel: projectedSla?.label || '',
    references: rules.map((rule) => ({
      id: rule.id,
      targetType: rule.targetType,
      targetLabel:
        rule.targetType === 'queue' ? rule.targetValue : titleCase(rule.targetValue),
      note: rule.note || '',
    })),
  }
}

export function buildFaqVigentRuleFromRuntimeSettings(node = {}, runtimeSettings = {}) {
  const draft = runtimeSettings?.parameters || adminParametersDraft
  return buildFaqVigentRuleSummary(node, draft)
}
