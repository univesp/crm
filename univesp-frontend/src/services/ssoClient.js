const appBasePath = normalizeBasePath(
  import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_APP_BASE || '/',
)
const devBypassConfig = {
  enabled: isTruthy(import.meta.env.VITE_SSO_DEV_BYPASS, false),
  email: String(import.meta.env.VITE_SSO_DEV_BYPASS_EMAIL || 'admin@univesp.br').trim(),
  name: String(import.meta.env.VITE_SSO_DEV_BYPASS_NAME || 'Administrador Local').trim(),
}
const defaultRoute = normalizeInternalRouteTarget(
  import.meta.env.VITE_DEFAULT_AUTH_ROUTE || '/',
  '/',
  appBasePath,
)

const runtimeConfig = {
  ssoBaseUrl: normalizeBaseUrl(import.meta.env.VITE_SSO_BASE_URL || ''),
  sessionPath: normalizePath(import.meta.env.VITE_SSO_SESSION_PATH || '/api/me'),
  startPath: normalizePath(import.meta.env.VITE_SSO_START_PATH || '/api/sso/start'),
  azureStartPath: normalizePath(
    import.meta.env.VITE_SSO_AZURE_START_PATH || '/api/sso/azure/start',
  ),
  samlStartPath: normalizePath(import.meta.env.VITE_SSO_SAML_START_PATH || '/api/sso/saml/start'),
  logoutPath: normalizePath(import.meta.env.VITE_SSO_LOGOUT_PATH || '/api/sso/logout'),
  logoutMethod: normalizeHttpMethod(import.meta.env.VITE_SSO_LOGOUT_METHOD || 'POST'),
  appBasePath,
  defaultRoute,
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
  return { ...runtimeConfig }
}

export function getDefaultAuthenticatedRoute() {
  return runtimeConfig.defaultRoute
}

export function hasSsoDevBypass() {
  return devBypassConfig.enabled
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
    return 'SSO SAML aluno'
  }
  if (normalizedFlow === 'academico') {
    return 'SSO Azure AD academico'
  }
  if (normalizedFlow === 'admin') {
    return 'SSO Azure AD administrativo'
  }
  return 'SSO institucional ativo'
}

export function normalizeInternalRouteTarget(
  value,
  fallback = runtimeConfig?.defaultRoute || '/',
  basePath = runtimeConfig?.appBasePath || appBasePath,
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

export function buildSsoStartUrl({ email = '', next = runtimeConfig.defaultRoute } = {}) {
  return withQuery(runtimeConfig.startPath, {
    email: String(email || '').trim(),
    next: getPublicAppPath(next),
  })
}

export function buildAzureStartUrl({ tenant, next = runtimeConfig.defaultRoute } = {}) {
  return withQuery(runtimeConfig.azureStartPath, {
    tenant,
    next: getPublicAppPath(next),
  })
}

export function buildSamlStartUrl({ next = runtimeConfig.defaultRoute } = {}) {
  return withQuery(runtimeConfig.samlStartPath, {
    next: getPublicAppPath(next),
  })
}

export async function fetchCurrentSsoUser() {
  if (devBypassConfig.enabled) {
    return buildDevBypassUser()
  }

  const payload = await ssoRequest(runtimeConfig.sessionPath)
  if (!payload || !payload.authenticated || !payload.user) {
    return null
  }

  return normalizeSsoUser(payload.user)
}

export async function logoutFromSso(email = '') {
  if (devBypassConfig.enabled) {
    return { ok: true, email }
  }

  const method = runtimeConfig.logoutMethod
  if (method === 'GET') {
    return ssoRequest(withQuery(runtimeConfig.logoutPath, { email }), {
      method,
    })
  }

  return ssoRequest(runtimeConfig.logoutPath, {
    method,
    body: { email },
  })
}

async function ssoRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  const response = await fetch(resolveApiUrl(path), {
    method: options.method || 'GET',
    headers,
    body: normalizeRequestBody(options.body, headers),
    credentials: 'include',
    redirect: 'follow',
  })

  const payload = await parseResponsePayload(response)
  if (!response.ok) {
    throw new SsoApiError(extractErrorMessage(payload, response.status), {
      status: response.status,
      url: response.url,
      payload,
    })
  }

  return payload
}

function buildDevBypassUser() {
  const email = devBypassConfig.email || 'admin@univesp.br'
  return {
    id: email,
    email,
    displayName: devBypassConfig.name || email,
    flow: classifyInstitutionalEmail(email) || 'admin',
    raw: {
      source: 'sso-dev-bypass',
      email,
      displayName: devBypassConfig.name || email,
    },
  }
}

function normalizeSsoUser(rawUser) {
  if (typeof rawUser === 'string') {
    return {
      id: rawUser,
      email: rawUser,
      displayName: rawUser,
      flow: classifyInstitutionalEmail(rawUser),
      raw: rawUser,
    }
  }

  const email = extractUserField(rawUser, [
    'email',
    'mail',
    'userPrincipalName',
    'upn',
    'preferred_username',
  ])
  const displayName =
    extractUserField(rawUser, ['displayName', 'fullName', 'full_name', 'name', 'givenName']) ||
    email
  const id = extractUserField(rawUser, ['id', 'sub', 'name']) || email
  const flow =
    extractUserField(rawUser, ['flow', 'authFlow', 'tenant', 'auth_flow']) ||
    classifyInstitutionalEmail(email)

  return {
    id,
    email,
    displayName,
    flow,
    raw: rawUser,
  }
}

function extractUserField(source, candidates) {
  if (!source || typeof source !== 'object') {
    return ''
  }

  for (const key of candidates) {
    const value = source[key]
    if (Array.isArray(value) && value.length) {
      return String(value[0]).trim()
    }
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim()
    }
  }

  return ''
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function normalizePath(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return '/'
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function normalizeBasePath(value) {
  const normalized = normalizePath(value)
  if (normalized === '/') {
    return '/'
  }
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function trimTrailingSlash(value) {
  if (!value || value === '/') {
    return value
  }
  return value.replace(/\/+$/, '')
}

function normalizeHttpMethod(value) {
  return String(value || 'POST').trim().toUpperCase() === 'GET' ? 'GET' : 'POST'
}

function isTruthy(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function resolveApiUrl(path) {
  const normalizedPath = String(path || '')
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    return normalizedPath
  }

  const baseUrl = runtimeConfig.ssoBaseUrl || getOrigin()
  return new URL(normalizePath(normalizedPath), baseUrl).toString()
}

function withQuery(path, params = {}) {
  const url = new URL(resolveApiUrl(path))
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

function getOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost'
}

function normalizeRequestBody(body, headers) {
  if (body === undefined || body === null) {
    return undefined
  }

  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return body
  }

  if (typeof body === 'string') {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return body
  }

  headers.set('Content-Type', 'application/json')
  return JSON.stringify(body)
}

async function parseResponsePayload(response) {
  const rawBody = await response.text()
  if (!rawBody) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return rawBody
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}

function extractErrorMessage(payload, status) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim()
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }
  }

  if (status === 401 || status === 403) {
    return 'Sua sessao institucional expirou. Entre novamente com SSO.'
  }

  return 'Falha ao validar a sessao institucional.'
}
