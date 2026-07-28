import { getMockAccessProfiles, normalizeMockProfileKey } from '@/services/mockContextRuntime'

const appBasePath = normalizeBasePath(
  import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_APP_BASE || '/',
)

const DEV_BYPASS_STORAGE_KEY = 'univesp.sso.devBypassProfile'

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
        linkedPolos: profile.linkedPolos || [],
        linkedAreas: profile.linkedAreas || profile.visibleAreas || [],
        visibleQueues: profile.visibleQueues || [],
        visibleAreas: profile.visibleAreas || [],
        allowedActions: profile.allowedActions || [],
      }),
    ]),
  ),
)

const defaultRoute = normalizeInternalRouteTarget(
  import.meta.env.VITE_DEFAULT_AUTH_ROUTE || '/',
  '/',
  appBasePath,
)

const runtimeConfig = Object.freeze({
  appBasePath,
  defaultRoute,
  sessionPath: normalizePath(import.meta.env.VITE_SSO_SESSION_PATH || '/api/me'),
  startPath: normalizePath(import.meta.env.VITE_SSO_START_PATH || '/api/sso/start'),
  azureStartPath: normalizePath(
    import.meta.env.VITE_SSO_AZURE_START_PATH || '/api/sso/azure/start',
  ),
  samlStartPath: normalizePath(
    import.meta.env.VITE_SSO_SAML_START_PATH || '/api/sso/saml/start',
  ),
  logoutPath: normalizePath(import.meta.env.VITE_SSO_LOGOUT_PATH || '/api/sso/logout'),
  logoutMethod: String(import.meta.env.VITE_SSO_LOGOUT_METHOD || 'POST').toUpperCase(),
})

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
  return { ...runtimeConfig }
}

export function getDefaultAuthenticatedRoute() {
  return runtimeConfig.defaultRoute
}

export function hasSsoDevBypass() {
  return devBypassConfig.enabled
}

export function hasHomologProfilePreview() {
  return isTruthy(import.meta.env.VITE_HOMOLOG_PROFILE_PREVIEW, false)
}

export function canUseProfilePreviewPicker() {
  return hasSsoDevBypass() || hasHomologProfilePreview()
}

export function readStoredProfilePreviewKey() {
  return readStoredDevBypassProfileKey()
}

export function isAzureConfigured() {
  return Boolean(runtimeConfig.azureStartPath)
}

export function getDevBypassProfiles() {
  return Object.values(DEV_BYPASS_PROFILE_CATALOG).map((profile) => ({ ...profile }))
}

export function getSelectedDevBypassProfile() {
  if (!canUseProfilePreviewPicker()) {
    return null
  }

  const storedKey = readStoredDevBypassProfileKey()
  if (storedKey && DEV_BYPASS_PROFILE_CATALOG[storedKey]) {
    return { ...DEV_BYPASS_PROFILE_CATALOG[storedKey] }
  }

  return null
}

export function setSelectedDevBypassProfile(profileKey) {
  if (!canUseProfilePreviewPicker()) {
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
    // Storage can be unavailable in hardened browser modes.
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

export function buildAzureLoginUrl(options = {}) {
  return buildAzureStartUrl(options)
}

export function buildAzureStartUrl({ flow = 'admin', next = runtimeConfig.defaultRoute } = {}) {
  return withQuery(runtimeConfig.azureStartPath, {
    tenant: flow === 'academico' ? 'academico' : 'admin',
    flow: flow === 'academico' ? 'academico' : 'admin',
    next: normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute),
  })
}

export function buildSamlStartUrl({ next = runtimeConfig.defaultRoute } = {}) {
  return withQuery(runtimeConfig.samlStartPath, {
    next: normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute),
  })
}

export function buildSsoStartUrl({
  email = '',
  flow = '',
  next = runtimeConfig.defaultRoute,
} = {}) {
  return withQuery(runtimeConfig.startPath, {
    email: String(email || '').trim(),
    flow: flow || classifyInstitutionalEmail(email) || '',
    next: normalizeInternalRouteTarget(next, runtimeConfig.defaultRoute),
  })
}

export async function fetchCurrentSsoUser() {
  const response = await fetch(runtimeConfig.sessionPath, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = await parseResponsePayload(response)

  if (response.status === 401 || response.status === 403) {
    if (devBypassConfig.enabled && readStoredDevBypassProfileKey()) {
      return buildDevBypassUser()
    }
    return null
  }
  if (!response.ok) {
    throw new SsoApiError(extractErrorMessage(payload, response.status), {
      status: response.status,
      url: response.url,
      payload,
    })
  }

  const session = unwrapEnvelope(payload)
  if (!session || session.authenticated === false) {
    if (devBypassConfig.enabled && readStoredDevBypassProfileKey()) {
      return buildDevBypassUser()
    }
    return null
  }

  return normalizeGatewayUser(session)
}

export async function logoutFromSso() {
  if (devBypassConfig.enabled) {
    clearSelectedDevBypassProfile()
    return { ok: true, redirected: false }
  }

  const response = await fetch(runtimeConfig.logoutPath, {
    method: runtimeConfig.logoutMethod,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  const payload = await parseResponsePayload(response)

  if (!response.ok && response.status !== 401) {
    throw new SsoApiError(extractErrorMessage(payload, response.status), {
      status: response.status,
      url: response.url,
      payload,
    })
  }

  const result = unwrapEnvelope(payload) || {}
  const redirectUrl = String(result.redirect_url || result.redirectUrl || '').trim()
  if (redirectUrl && typeof window !== 'undefined') {
    window.location.assign(redirectUrl)
    return { ok: true, redirected: true }
  }

  return { ok: true, redirected: false }
}

export function normalizeGatewayUser(session) {
  const rawUser = session.user && typeof session.user === 'object' ? session.user : session
  const profile = session.profile ?? rawUser.profile ?? null
  const profileKey = normalizeMockProfileKey(
    typeof profile === 'string'
      ? profile
      : profile?.key || profile?.profile_key || rawUser.profile_key || rawUser.profileKey || '',
  )
  const scopes = normalizeScopes(session.scopes || profile?.scopes || rawUser.scopes)
  const allowedActions = normalizeStringList(
    session.actions || session.permissions || profile?.actions || rawUser.actions,
  )
  const email = String(rawUser.email || rawUser.mail || '').trim().toLowerCase()
  const access = session.access && typeof session.access === 'object' ? session.access : {}

  if (!email) {
    throw new SsoApiError('A sessao institucional nao informou o email do usuario.')
  }

  return {
    id: rawUser.id || rawUser.sub || rawUser.oid || email,
    email,
    displayName: rawUser.display_name || rawUser.displayName || rawUser.name || email,
    firstName: rawUser.first_name || rawUser.firstName || '',
    lastName: rawUser.last_name || rawUser.lastName || '',
    ra: rawUser.ra || rawUser.student_id || '',
    flow: rawUser.flow || session.flow || classifyInstitutionalEmail(email),
    profileKey,
    scopes,
    allowedActions,
    expiresAt: session.expires_at || session.expiresAt || null,
    raw: {
      source: 'sso-gateway',
      profileKey,
      accessStatus: String(access.status || (profileKey ? 'active' : 'pending')).toLowerCase(),
      accessRequestId: access.request_id || '',
    },
  }
}

function buildDevBypassUser() {
  const selectedProfile = getSelectedDevBypassProfile()
  if (!selectedProfile) {
    return null
  }

  const email = selectedProfile.email || devBypassConfig.email || 'admin@univesp.br'

  return {
    id: email,
    email,
    displayName: selectedProfile?.displayName || devBypassConfig.name || email,
    firstName: '',
    lastName: '',
    ra: '',
    flow: selectedProfile?.flow || classifyInstitutionalEmail(email) || 'admin',
    profileKey: selectedProfile?.key || '',
    scopes: {
      polos: [...(selectedProfile?.linkedPolos || [])],
      areas: [...(selectedProfile?.linkedAreas || [])],
      queues: [...(selectedProfile?.visibleQueues || [])],
    },
    allowedActions: [...(selectedProfile?.allowedActions || [])],
    raw: {
      source: 'sso-dev-bypass',
      profileKey: selectedProfile?.key || '',
    },
  }
}

function normalizeScopes(scopes) {
  if (!scopes || typeof scopes !== 'object' || Array.isArray(scopes)) {
    return { polos: [], areas: [], queues: [], courses: [] }
  }
  return {
    polos: normalizeStringList(scopes.polos || scopes.polo),
    areas: normalizeStringList(scopes.areas || scopes.area),
    queues: normalizeStringList(scopes.queues || scopes.filas || scopes.queue),
    courses: normalizeStringList(scopes.courses || scopes.cursos || scopes.course),
  }
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
  }
  const normalized = String(value || '').trim()
  return normalized ? [normalized] : []
}

function resolveDevBypassProfileFromEmail(email = '') {
  const normalized = String(email || '').trim().toLowerCase()
  return (
    Object.values(DEV_BYPASS_PROFILE_CATALOG).find(
      (profile) => profile.email === normalized,
    ) || null
  )
}

function readStoredDevBypassProfileKey() {
  if (typeof window === 'undefined') {
    return ''
  }
  try {
    return String(window.sessionStorage.getItem(DEV_BYPASS_STORAGE_KEY) || '').trim()
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
    // Storage can be unavailable in hardened browser modes.
  }
}

function withQuery(path, params = {}) {
  const url = new URL(path, getOrigin())
  Object.entries(params).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim()
    if (normalized) {
      url.searchParams.set(key, normalized)
    }
  })
  return `${url.pathname}${url.search}`
}

async function parseResponsePayload(response) {
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

function unwrapEnvelope(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload
  }
  if ('data' in payload) {
    return payload.data
  }
  if ('message' in payload && typeof payload.message === 'object') {
    return payload.message
  }
  return payload
}

function extractErrorMessage(payload, status) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }
  if (payload && typeof payload === 'object') {
    const error = payload.error
    const message =
      (typeof error === 'object' && (error.message || error.user_message)) ||
      payload.message ||
      payload._error_message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }
  return `O gateway de autenticacao respondeu com erro HTTP ${status}.`
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
