import { mockAccessProfiles, MOCK_PROFILE_ALIASES, MOCK_SHELL_CATALOG } from '../../mocks/mockAccessProfiles'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))]
}

const profileCatalog = Object.fromEntries(mockAccessProfiles.map((profile) => [profile.key, profile]))

export function normalizeMockProfileKey(profileKey = '') {
  const normalized = normalizeText(profileKey)

  if (!normalized) {
    return ''
  }

  return MOCK_PROFILE_ALIASES[normalized] || normalized
}

export function getMockAccessProfiles() {
  return mockAccessProfiles.map((profile) => ({
    ...profile,
    shellLabel: MOCK_SHELL_CATALOG[profile.shellKey]?.label || profile.shellKey,
  }))
}

export function getMockShellCatalog() {
  return { ...MOCK_SHELL_CATALOG }
}

export function getMockProfileDefinition(profileKey = '') {
  return profileCatalog[normalizeMockProfileKey(profileKey)] || null
}

export function inferMockProfileKey(user) {
  const explicitProfile = normalizeMockProfileKey(user?.raw?.profileKey || '')

  if (explicitProfile && profileCatalog[explicitProfile]) {
    return explicitProfile
  }

  const normalizedEmail = normalizeText(user?.email || '')
  if (normalizedEmail) {
    const emailMatch = mockAccessProfiles.find((profile) => normalizeText(profile.email) === normalizedEmail)

    if (emailMatch) {
      return emailMatch.key
    }
  }

  const normalizedFlow = normalizeText(user?.flow || '')
  if (normalizedFlow === 'aluno') {
    return 'aluno'
  }

  if (normalizedFlow === 'academico') {
    return 'op'
  }

  return 'admin_central'
}

export function buildMockAccessContext(user) {
  const profileKey = inferMockProfileKey(user)
  const definition = getMockProfileDefinition(profileKey) || profileCatalog.aluno
  const shell = MOCK_SHELL_CATALOG[definition.shellKey] || MOCK_SHELL_CATALOG.student

  return {
    profileKey: definition.key,
    profileLabel: definition.label,
    roleLabel: definition.roleLabel,
    shellKey: definition.shellKey,
    shellLabel: shell.label,
    shellDescription: shell.description,
    defaultRoute: definition.defaultRoute,
    entryOrigin: definition.entryOrigin,
    currentPolo: definition.currentPolo,
    linkedPolos: [...definition.linkedPolos],
    visibleQueues: [...definition.visibleQueues],
    visibleAreas: [...definition.visibleAreas],
    allowedActions: [...definition.allowedActions],
    mockMode: true,
    aiEnabled: false,
    userName: user?.displayName || definition.displayName,
    userEmail: user?.email || definition.email,
    helper: definition.helper,
    isStudentShell: definition.shellKey === 'student',
    isOperationalShell: definition.shellKey === 'operational',
    isGovernanceShell: definition.shellKey === 'governance',
  }
}

export function canAccessRouteWithMockContext(routeMeta = {}, mockContext = null) {
  if (!mockContext) {
    return true
  }

  const allowedProfiles = Array.isArray(routeMeta.allowedProfiles) ? routeMeta.allowedProfiles : []
  if (allowedProfiles.length && !allowedProfiles.includes(mockContext.profileKey)) {
    return false
  }

  const requiredActions = Array.isArray(routeMeta.requiredActions) ? routeMeta.requiredActions : []
  if (requiredActions.length) {
    const actionSet = new Set(mockContext.allowedActions || [])

    for (const action of requiredActions) {
      if (!actionSet.has(action)) {
        return false
      }
    }
  }

  return true
}

export function buildShellPresentation(mockContext = null) {
  if (!mockContext) {
    return {
      label: 'Atendimento institucional',
      title: 'Central de Atendimento UNIVESP',
      description: 'Portal institucional com navegacao separada por perfil e escopo.',
    }
  }

  if (mockContext.isStudentShell) {
    return {
      label: 'Atendimento ao aluno',
      title: 'Atendimento do aluno',
      description: 'Orientacao oficial, solicitacao e acompanhamento no portal.',
    }
  }

  if (mockContext.isOperationalShell) {
    return {
      label: 'Shell operacional',
      title: 'Operacao de polos',
      description: 'Fila do OP, leitura do caso e acoes por polo ou multi-polo.',
    }
  }

  return {
    label: 'Shell administrativo',
    title: 'Administracao e governanca',
    description: 'Dashboard, regras, permissoes e publicacao sob a mesma governanca.',
  }
}

export function groupMockProfilesByShell(profiles = getMockAccessProfiles()) {
  const groups = new Map()

  for (const profile of profiles) {
    const shellKey = profile.shellKey || 'student'
    const shell = MOCK_SHELL_CATALOG[shellKey] || MOCK_SHELL_CATALOG.student

    if (!groups.has(shellKey)) {
      groups.set(shellKey, {
        shellKey,
        shellLabel: shell.label,
        shellDescription: shell.description,
        profiles: [],
      })
    }

    groups.get(shellKey).profiles.push(profile)
  }

  return [...groups.values()]
}

export function summarizeScopeForBar(mockContext = null) {
  if (!mockContext) {
    return {
      polos: [],
      queues: [],
      areas: [],
    }
  }

  return {
    polos: uniqueValues(mockContext.linkedPolos),
    queues: uniqueValues(mockContext.visibleQueues),
    areas: uniqueValues(mockContext.visibleAreas),
  }
}
