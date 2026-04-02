import { getMockAccessProfiles, normalizeMockProfileKey } from '@/services/mockContextRuntime'

const appBasePath = normalizeBasePath(
  import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_APP_BASE || '/',
)

const DEV_BYPASS_STORAGE_KEY = 'univesp.sso.devBypassProfile'
const SSO_STATE_STORAGE_KEY = 'univesp.sso.state'
const SSO_SESSION_KEY = 'univesp.sso.session'
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000

const devBypassConfig = {
  enabled: isTruthy(import.meta.env.VITE_SSO_DEV_BYPASS, false),
  email: String(import.meta.env.VITE_SSO_DEV_BYPASS_EMAIL || 'admin@univesp.br').trim(),
  name: String(import.meta.env.VITE_SSO_DEV_BYPASS_NAME || 'Administrador Local').trim(),
}

const DEV_BYPASS_PROFILE_CATALOG = Object.freeze(
  Object.fromEntries(
    getMockAccessProfiles().map((profile) => [
      profile.key,
      Object.freeze({
        key: profile.key,
        email: profile.email,
        displayName: profile.displayName,
        flow: profile.flow,
        route: profile.defaultRoute,
        label: profile.label,
        helper: profile.helper,
        shellKey: profile.shellKey,
      }),
    ]),
  ),
)

const defaultRoute = normalizeInternalRouteTarget(
  import.meta.env.VITE_DEFAULT_AUTH_ROUTE || '/',
  '/',
  appBasePath,
)

const azureConfigs = {
  admin: {
    clientId: String(
      import.meta.env.VITE_AZURE_ADMIN_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID || '',
    ).trim(),
    tenantId: String(
      import.meta.env.VITE_AZURE_ADMIN_TENANT_ID || import.meta.env.VITE_AZURE_TENANT_ID || '',
    ).trim(),
  },
  academico: {
    clientId: String(import.meta.env.VITE_AZURE_ACADEMICO_CLIENT_ID || '').trim(),
    tenantId: String(import.meta.env.VITE_AZURE_ACADEMICO_TENANT_ID || '').trim(),
  },
  redirectUri: String(import.meta.env.VITE_AZURE_REDIRECT_URI || `${getOrigin()}/login`).trim(),
  scopes: ['openid', 'profile', 'email'],
}

const runtimeConfig = {
  appBasePath,
  defaultRoute,
  sessionStorageKey: SSO_SESSION_KEY,
}

export class SsoApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'SsoApiError'
    this.status = details.status || 0
    this.url = details.url || ''
    this.payload = details.payload
  }
}

export function getSsoRuntimeConfig() {
  return {
    ...runtimeConfig,
    azure: {
      admin: { ...azureConfigs.admin },
      academico: { ...azureConfigs.academico },
      redirectUri: azureConfigs.redirectUri,
      scopes: [...azureConfigs.scopes],
    },
  }
}

export function getDefaultAuthenticatedRoute() {
  return runtimeConfig.defaultRoute
}

export function hasSsoDevBypass() {
  return devBypassConfig.enabled
}

export function isAzureConfigured() {
  return hasAzureConfig('admin') || hasAzureConfig('academico')
}

export function getDevBypassProfiles() {
  return Object.values(DEV_BYPASS_PROFILE_CATALOG).map((profile) => ({ ...profile }))
}

export function getSelectedDevBypassProfile() {
  if (!devBypassConfig.enabled) {
    return null
  }

  const storedKey = readStoredDevBypassProfileKey()
  if (storedKey && DEV_BYPASS_PROFILE_CATALOG[storedKey]) {
    return { ...DEV_BYPASS_PROFILE_CATALOG[storedKey] }
  }

  const fallbackProfile = resolveDevBypassProfileFromEmail(devBypassConfig.email)
  return fallbackProfile ? { ...fallbackProfile } : null
}

export function setSelectedDevBypassProfile(profileKey) {
  if (!devBypassConfig.enabled) {
    return null
  }

  const normalizedKey = normalizeMockProfileKey(profileKey)
  const profile = DEV_BYPASS_PROFILE_CATALOG[normalizedKey]
  if (!profile) {
    return null
  }

  writeStoredDevBypassProfileKey(profile.key)
  return { ...profile }
}

export function clearSelectedDevBypassProfile() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(DEV_BYPASS_STORAGE_KEY)
    window.localStorage.removeItem(DEV_BYPASS_STORAGE_KEY)
  } catch {
    // Ignore localStorage errors.
  }
}

export function classifyInstitutionalEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) {
    return null
  }

  if (normalized.endsWith('@aluno.univesp.br')) {
    return 'aluno'
  }

  if (normalized.endsWith('@univesp.br')) {
    return 'admin'
  }

  if (normalized.includes('.univesp.br')) {
    return 'academico'
  }

  return null
}

export function describeSsoFlow(flow, email = '') {
  const normalizedFlow = flow || classifyInstitutionalEmail(email)
  if (normalizedFlow === 'aluno') {
    return 'Acesso Unificado do aluno'
  }
  if (normalizedFlow === 'academico') {
    return 'Acesso institucional academico'
  }
  if (normalizedFlow === 'admin') {
    return 'Acesso institucional administrativo'
  }
  return 'Acesso institucional'
}

export function normalizeInternalRouteTarget(
  value,
  fallback = runtimeConfig.defaultRoute,
  basePath = runtimeConfig.appBasePath,
) {
  const candidate = String(value || '').trim()
  if (!candidate) {
    return fallback
  }

  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    try {
      const url = new URL(candidate)
      return normalizeInternalRouteTarget(`${url.pathname}${url.search}${url.hash}`, fallback)
    } catch {
      return fallback
    }
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback
  }

  const publicBase = trimTrailingSlash(basePath)
  if (publicBase && publicBase !== '/') {
    if (candidate === publicBase) {
      return '/'
    }
    if (candidate.startsWith(`${publicBase}/`)) {
      const stripped = candidate.slice(publicBase.length)
      return stripped.startsWith('/') ? stripped : `/${stripped}`
    }
  }

  return candidate
}

export function getPublicAppPath(value = runtimeConfig.defaultRoute) {
  const internalTarget = normalizeInternalRouteTarget(value, runtimeConfig.defaultRoute)
  const url = new URL(internalTarget, getOrigin())
  const publicBase = trimTrailingSlash(runtimeConfig.appBasePath)
  const pathname =
    publicBase && publicBase !== '/'
      ? url.pathname === '/'
        ? `${publicBase}/`
        : `${publicBase}${url.pathname}`
      : url.pathname

  return `${pathname}${url.search}${url.hash}`
}

export function buildAzureLoginUrl({ next = runtimeConfig.defaultRoute, flow = 'admin' } = {}) {
  const normalizedFlow = flow === 'academico' ? 'academico' : 'admin'
  const config = azureConfigs[normalizedFlow]

  if (!config?.clientId || !config?.tenantId) {
    throw new SsoApiError(`Azure AD nao configurado para o fluxo ${normalizedFlow}.`)
  }

  const state = JSON.stringify({
    next: normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute),
    nonce: generateNonce(),
    flow: normalizedFlow,
  })

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SSO_STATE_STORAGE_KEY, state)
  }

  const nonce = JSON.parse(state).nonce
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'id_token',
    redirect_uri: azureConfigs.redirectUri,
    scope: azureConfigs.scopes.join(' '),
    response_mode: 'fragment',
    state: btoa(state),
    nonce,
  })

  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`
}

export function buildAzureStartUrl({ flow = 'admin', next = runtimeConfig.defaultRoute } = {}) {
  return buildAzureLoginUrl({ next, flow })
}

export function buildSamlStartUrl({ next = runtimeConfig.defaultRoute } = {}) {
  const target = normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute)
  return `${getPublicAppPath('/login')}?redirect=${encodeURIComponent(target)}`
}

export function buildSsoStartUrl({
  email = '',
  flow = '',
  next = runtimeConfig.defaultRoute,
} = {}) {
  const resolvedFlow = flow || classifyInstitutionalEmail(email) || 'admin'

  if (resolvedFlow === 'aluno') {
    return buildSamlStartUrl({ next })
  }

  return buildAzureStartUrl({
    flow: resolvedFlow === 'academico' ? 'academico' : 'admin',
    next,
  })
}

export async function fetchCurrentSsoUser() {
  if (devBypassConfig.enabled) {
    return buildDevBypassUser()
  }

  const callbackResult = processAzureCallback()
  if (callbackResult?.user) {
    return callbackResult.user
  }

  return loadStoredSession()
}

export function logoutFromSso() {
  const sessionUser = loadStoredSession()
  clearStoredSession()

  const flow = sessionUser?.flow === 'academico' ? 'academico' : 'admin'
  const config = azureConfigs[flow]

  if (config?.clientId && config?.tenantId) {
    const logoutUrl = new URL(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/logout`,
    )
    logoutUrl.searchParams.set('post_logout_redirect_uri', `${getOrigin()}${getPublicAppPath('/login')}`)
    window.location.assign(logoutUrl.toString())
    return { ok: true, redirected: true }
  }

  return { ok: true, redirected: false }
}

function processAzureCallback() {
  if (typeof window === 'undefined') {
    return null
  }

  const hash = window.location.hash
  if (!hash || !hash.includes('id_token=')) {
    return null
  }

  const params = new URLSearchParams(hash.substring(1))
  const idToken = params.get('id_token')
  const stateParam = params.get('state')

  if (!idToken) {
    return null
  }

  const claims = decodeJwtPayload(idToken)
  if (!claims) {
    return null
  }

  let nextRoute = runtimeConfig.defaultRoute
  if (stateParam) {
    try {
      const stateData = JSON.parse(atob(stateParam))
      nextRoute = normalizeInternalRouteTarget(stateData.next, runtimeConfig.defaultRoute)
    } catch {
      nextRoute = runtimeConfig.defaultRoute
    }
  }

  const user = normalizeSsoUser({
    id: claims.oid || claims.sub || claims.email || claims.preferred_username,
    email: claims.email || claims.preferred_username || claims.upn || '',
    displayName: claims.name || claims.given_name || claims.email || '',
    firstName: claims.given_name || '',
    lastName: claims.family_name || '',
    flow: classifyInstitutionalEmail(claims.email || claims.preferred_username || claims.upn || ''),
    idToken,
    raw: claims,
  })

  saveSession(user)

  if (window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  return { user, nextRoute }
}

function buildDevBypassUser() {
  const selectedProfile = getSelectedDevBypassProfile()
  const email = selectedProfile?.email || devBypassConfig.email || 'admin@univesp.br'

  return normalizeSsoUser({
    id: email,
    email,
    displayName: selectedProfile?.displayName || devBypassConfig.name || email,
    flow: selectedProfile?.flow || classifyInstitutionalEmail(email) || 'admin',
    raw: {
      source: 'sso-dev-bypass',
      profileKey: selectedProfile?.key || '',
      email,
      displayName: selectedProfile?.displayName || devBypassConfig.name || email,
    },
  })
}

function resolveDevBypassProfileFromEmail(email = '') {
  const normalized = String(email || '').trim().toLowerCase()

  const catalogMatch = Object.values(DEV_BYPASS_PROFILE_CATALOG).find(
    (profile) => profile.email === normalized,
  )
  if (catalogMatch) {
    return catalogMatch
  }

  const flow = classifyInstitutionalEmail(normalized)
  if (flow === 'aluno') {
    return DEV_BYPASS_PROFILE_CATALOG.aluno || null
  }

  if (flow === 'academico') {
    return DEV_BYPASS_PROFILE_CATALOG.op || null
  }

  return DEV_BYPASS_PROFILE_CATALOG.admin_central || null
}

function normalizeSsoUser(rawUser) {
  if (!rawUser) {
    return null
  }

  if (typeof rawUser === 'string') {
    return {
      id: rawUser,
      email: rawUser,
      displayName: rawUser,
      flow: classifyInstitutionalEmail(rawUser),
      raw: rawUser,
    }
  }

  return {
    id: rawUser.id || rawUser.email || '',
    email: rawUser.email || '',
    displayName: rawUser.displayName || rawUser.email || '',
    firstName: rawUser.firstName || '',
    lastName: rawUser.lastName || '',
    flow: rawUser.flow || classifyInstitutionalEmail(rawUser.email),
    raw: rawUser.raw || rawUser,
  }
}

function saveSession(user) {
  if (typeof sessionStorage === 'undefined' || !user?.email) {
    return
  }

  const sessionData = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    flow: user.flow,
    savedAt: Date.now(),
  }

  sessionStorage.setItem(SSO_SESSION_KEY, JSON.stringify(sessionData))
}

function loadStoredSession() {
  if (typeof sessionStorage === 'undefined') {
    return null
  }

  const raw = sessionStorage.getItem(SSO_SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    const data = JSON.parse(raw)
    if (!data?.email) {
      clearStoredSession()
      return null
    }

    if (Date.now() - (data.savedAt || 0) > SESSION_MAX_AGE_MS) {
      clearStoredSession()
      return null
    }

    return normalizeSsoUser({
      id: data.id,
      email: data.email,
      displayName: data.displayName,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      flow: data.flow || classifyInstitutionalEmail(data.email),
      raw: data,
    })
  } catch {
    clearStoredSession()
    return null
  }
}

function clearStoredSession() {
  if (typeof sessionStorage === 'undefined') {
    return
  }

  sessionStorage.removeItem(SSO_SESSION_KEY)
  sessionStorage.removeItem(SSO_STATE_STORAGE_KEY)
}

function readStoredDevBypassProfileKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const sessionKey = String(window.sessionStorage.getItem(DEV_BYPASS_STORAGE_KEY) || '').trim()
    if (sessionKey) {
      return sessionKey
    }

    // Clear legacy persisted choices so a previous profile does not keep
    // overriding the current local review session unexpectedly.
    window.localStorage.removeItem(DEV_BYPASS_STORAGE_KEY)
    return ''
  } catch {
    return ''
  }
}

function writeStoredDevBypassProfileKey(profileKey) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(DEV_BYPASS_STORAGE_KEY, profileKey)
    window.localStorage.removeItem(DEV_BYPASS_STORAGE_KEY)
  } catch {
    // Ignore localStorage errors.
  }
}

function hasAzureConfig(flow) {
  const config = azureConfigs[flow]
  return Boolean(config?.clientId && config?.tenantId)
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function generateNonce() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('')
}

function normalizeBasePath(value) {
  const normalized = normalizePath(value)
  if (normalized === '/') {
    return '/'
  }
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function normalizePath(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return '/'
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function trimTrailingSlash(value) {
  if (!value || value === '/') {
    return value
  }
  return value.replace(/\/+$/, '')
}

function isTruthy(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function getOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost'
}
