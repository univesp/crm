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
  const explicitProfile = normalizeMockProfileKey(user?.profileKey || user?.raw?.profileKey || '')

  if (explicitProfile && profileCatalog[explicitProfile]) {
    return explicitProfile
  }

  return 'unassigned'
}

export function buildMockAccessContext(user) {
  const profileKey = inferMockProfileKey(user)
  const definition = getMockProfileDefinition(profileKey)

  if (!definition) {
    return {
      profileKey: 'unassigned',
      profileLabel: 'Perfil pendente',
      roleLabel: 'Sem perfil operacional',
      shellKey: 'governance',
      shellLabel: 'Acesso pendente',
      shellDescription: 'O acesso institucional existe, mas ainda nao possui perfil autorizado.',
      defaultRoute: '/acesso-pendente',
      entryOrigin: 'SSO institucional',
      currentPolo: '',
      currentArea: '',
      linkedPolos: [],
      linkedAreas: [],
      visibleQueues: [],
      visibleAreas: [],
      allowedActions: [],
      mockMode: false,
      aiEnabled: false,
      userName: user?.displayName || user?.email || '',
      userEmail: user?.email || '',
      helper: 'Solicite o vinculo de perfil e escopo ao administrador do atendimento.',
      isStudentShell: false,
      isOperationalShell: false,
      isGovernanceShell: true,
    }
  }

  const shell = MOCK_SHELL_CATALOG[definition.shellKey] || MOCK_SHELL_CATALOG.student
  const isGatewayContext = user?.raw?.source === 'sso-gateway'
  const linkedPolos = isGatewayContext ? user?.scopes?.polos || [] : definition.linkedPolos
  const linkedAreas = isGatewayContext
    ? user?.scopes?.areas || []
    : definition.linkedAreas || definition.visibleAreas || []
  const visibleQueues = isGatewayContext ? user?.scopes?.queues || [] : definition.visibleQueues
  const visibleAreas = isGatewayContext ? user?.scopes?.areas || [] : definition.visibleAreas
  const allowedActions = isGatewayContext ? user?.allowedActions || [] : definition.allowedActions

  return {
    profileKey: definition.key,
    profileLabel: definition.label,
    roleLabel: definition.roleLabel,
    shellKey: definition.shellKey,
    shellLabel: shell.label,
    shellDescription: shell.description,
    defaultRoute: definition.defaultRoute,
    entryOrigin: definition.entryOrigin,
    currentPolo: linkedPolos[0] || '',
    currentArea: linkedAreas[0] || '',
    linkedPolos: [...linkedPolos],
    linkedAreas: [...linkedAreas],
    visibleQueues: [...visibleQueues],
    visibleAreas: [...visibleAreas],
    allowedActions: [...allowedActions],
    mockMode: !isGatewayContext,
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
