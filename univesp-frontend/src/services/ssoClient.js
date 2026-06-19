import { getMockAccessProfiles, normalizeMockProfileKey } from '@/services/mockContextRuntime'

const appBasePath = normalizeBasePath(
  import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_APP_BASE || '/',
)

const DEV_BYPASS_STORAGE_KEY = 'univesp.sso.devBypassProfile'
const SSO_STATE_STORAGE_KEY = 'univesp.sso.state'
const SSO_SESSION_KEY = 'univesp.sso.session'

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
  ssoBaseUrl: normalizeBaseUrl(import.meta.env.VITE_SSO_BASE_URL || ''),
  sessionPath: normalizePath(import.meta.env.VITE_SSO_SESSION_PATH || '/api/me'),
  startPath: normalizePath(import.meta.env.VITE_SSO_START_PATH || '/api/sso/start'),
  azureStartPath: normalizePath(import.meta.env.VITE_SSO_AZURE_START_PATH || '/api/sso/azure/start'),
  samlStartPath: normalizePath(import.meta.env.VITE_SSO_SAML_START_PATH || '/api/sso/saml/start'),
  logoutPath: normalizePath(import.meta.env.VITE_SSO_LOGOUT_PATH || '/api/sso/logout'),
  logoutMethod: String(import.meta.env.VITE_SSO_LOGOUT_METHOD || 'POST').trim().toUpperCase(),
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

  return buildSsoUrl(runtimeConfig.azureStartPath, {
    tenant: normalizedFlow,
    next: normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute),
  })
}

export function buildAzureStartUrl({ flow = 'admin', next = runtimeConfig.defaultRoute } = {}) {
  return buildAzureLoginUrl({ next, flow })
}

export function buildSamlStartUrl({ next = runtimeConfig.defaultRoute } = {}) {
  return buildSsoUrl(runtimeConfig.samlStartPath, {
    next: normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute),
  })
}

export function buildSsoStartUrl({
  email = '',
  flow = '',
  next = runtimeConfig.defaultRoute,
} = {}) {
  return buildSsoUrl(runtimeConfig.startPath, {
    email,
    flow,
    next: normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute),
  })
}

export async function fetchCurrentSsoUser() {
  if (devBypassConfig.enabled) {
    return buildDevBypassUser()
  }

  const response = await fetch(resolveSsoUrl(runtimeConfig.sessionPath), {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (response.status === 204 || response.status === 401 || response.status === 403) {
    clearStoredSession()
    return null
  }

  const payload = await parseSsoResponse(response)
  if (!response.ok) {
    throw new SsoApiError(extractSsoErrorMessage(payload, response.status), {
      status: response.status,
      url: response.url,
      payload,
    })
  }

  const user = normalizeSsoUser(unwrapSsoUserPayload(payload))
  if (user?.email) {
    saveSession(user)
  }

  return user
}

export async function logoutFromSso() {
  clearStoredSession()

  const response = await fetch(resolveSsoUrl(runtimeConfig.logoutPath), {
    method: runtimeConfig.logoutMethod,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })

  if (response.status === 204) {
    return { ok: true, redirected: false }
  }

  const payload = await parseSsoResponse(response)
  const redirectTo = payload?.redirectTo || payload?.redirect_to || payload?.message?.redirectTo
  if (redirectTo && typeof window !== 'undefined') {
    window.location.assign(redirectTo)
    return { ok: true, redirected: true }
  }

  return { ok: response.ok, redirected: false }
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
    displayName: rawUser.displayName || rawUser.full_name || rawUser.name || rawUser.email || '',
    firstName: rawUser.firstName || rawUser.first_name || '',
    lastName: rawUser.lastName || rawUser.last_name || '',
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

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function resolveSsoUrl(path) {
  const normalizedPath = normalizePath(path)
  if (runtimeConfig.ssoBaseUrl) {
    return `${runtimeConfig.ssoBaseUrl}${normalizedPath}`
  }

  if (typeof window !== 'undefined') {
    return new URL(normalizedPath, window.location.origin).toString()
  }

  return normalizedPath
}

function buildSsoUrl(path, params = {}) {
  const url = new URL(resolveSsoUrl(path), getOrigin())

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

async function parseSsoResponse(response) {
  const rawBody = await response.text()
  if (!rawBody) {
    return null
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}

function unwrapSsoUserPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  return payload.user || payload.data || payload.message || payload
}

function extractSsoErrorMessage(payload, status) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    const message = payload.message || payload.error || payload._error_message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return `Gateway SSO respondeu com erro HTTP ${status}.`
}

function getOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost'
}
