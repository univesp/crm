/**
 * Permissões de conhecimento/FAQ — catálogo único consumido pelo editor e por Pessoas e acessos.
 */

export const KNOWLEDGE_ACTION_CATALOG = Object.freeze({
  suggest_knowledge: Object.freeze({
    key: 'suggest_knowledge',
    label: 'Sugerir melhorias',
    description: 'Abrir sugestões de conteúdo nos temas concedidos.',
    governance: true,
  }),
  view_knowledge_history: Object.freeze({
    key: 'view_knowledge_history',
    label: 'Ver histórico',
    description: 'Consultar versões e trilha editorial.',
    governance: false,
  }),
  edit_knowledge_draft: Object.freeze({
    key: 'edit_knowledge_draft',
    label: 'Editar rascunho',
    description: 'Alterar conteúdo em rascunho.',
    governance: true,
  }),
  submit_knowledge_approval: Object.freeze({
    key: 'submit_knowledge_approval',
    label: 'Enviar para aprovação',
    description: 'Submeter rascunho ao fluxo de revisão.',
    governance: true,
  }),
  approve_knowledge: Object.freeze({
    key: 'approve_knowledge',
    label: 'Aprovar conteúdo',
    description: 'Aprovar rascunho pendente.',
    governance: true,
  }),
  publish_knowledge_version: Object.freeze({
    key: 'publish_knowledge_version',
    label: 'Publicar versão',
    description: 'Publicar conteúdo aprovado ou rascunho válido (admin).',
    governance: true,
  }),
})

export const KNOWLEDGE_ACTION_KEYS = Object.freeze(Object.keys(KNOWLEDGE_ACTION_CATALOG))

export function knowledgeActionsFromProfile(allowedActions = []) {
  const actionSet = new Set(allowedActions || [])
  return KNOWLEDGE_ACTION_KEYS.filter((key) => actionSet.has(key))
}

export function isContributorProfile(profile) {
  return (
    profile?.capabilities?.includes('suggest_knowledge') &&
    ['op', 'op_externo'].includes(profile?.base_persona)
  )
}

export function filterContributorAssignments(assignments = [], profiles = []) {
  const profileIds = new Set(
    profiles.filter(isContributorProfile).map((profile) => profile.id),
  )
  return assignments.filter(
    (assignment) => assignment.active !== false && profileIds.has(assignment.permission_profile),
  )
}

export function assignmentsForTheme(assignments = [], themeKey = '') {
  if (!themeKey) return assignments
  return assignments.filter((assignment) =>
    (assignment.scopes?.knowledge_themes || []).includes(themeKey),
  )
}

export function hasActiveSuggestionGrant({ assignments = [], profiles = [], themeKey = '' } = {}) {
  const contributors = filterContributorAssignments(assignments, profiles)
  if (!themeKey) return contributors.length > 0
  return assignmentsForTheme(contributors, themeKey).length > 0
}

/**
 * Permissões efetivas do editor FAQ para o usuário atual.
 */
export function buildKnowledgeEditorPermissions({
  allowedActions = [],
  lifecycleState = 'draft',
  hasDraft = false,
  hasApprovedVersion = false,
  isAdminCentral = false,
  blockersCount = 0,
} = {}) {
  const actions = new Set(allowedActions || [])
  const isDraft = lifecycleState === 'draft' && hasDraft
  const isPending = lifecycleState === 'pending_approval'

  return {
    allowedActions: actions,
    canEditDraft: isDraft && actions.has('edit_knowledge_draft'),
    canSubmitReview: isDraft && actions.has('submit_knowledge_approval'),
    canApprove: isPending && actions.has('approve_knowledge'),
    canPublish:
      isAdminCentral &&
      isDraft &&
      actions.has('publish_knowledge_version') &&
      blockersCount === 0,
    canPublishApproved:
      isAdminCentral && hasApprovedVersion && actions.has('publish_knowledge_version'),
    canSuggest: actions.has('suggest_knowledge'),
    canViewHistory: actions.has('view_knowledge_history'),
  }
}

export function buildPermissionsPageLink({ themeKey = '', context = 'faq-suggestions' } = {}) {
  return {
    name: 'admin-permissions',
    query: {
      tab: 'knowledge',
      ...(context ? { context } : {}),
      ...(themeKey ? { theme: themeKey } : {}),
    },
  }
}
