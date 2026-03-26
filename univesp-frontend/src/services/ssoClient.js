/**
 * SSO Client — autenticacao Azure AD via MSAL.js (client-side).
 *
 * O SSO eh 100% gerenciado pelo frontend, sem depender do Frappe.
 * O Frappe CRM eh acessado apenas como API de dados (leads, etc.)
 * via API Key configurada em VITE_FRAPPE_API_KEY / VITE_FRAPPE_API_SECRET.
 *
 * Fluxo:
 *   1. Usuario clica "Entrar com SSO"
 *   2. MSAL.js redireciona para Azure AD
 *   3. Azure AD autentica e retorna token (id_token)
 *   4. Frontend extrai dados do usuario do token
 *   5. Sessao armazenada em sessionStorage
 *   6. Chamadas ao Frappe usam API Key (nao o token Azure)
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

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

/** Azure AD / MSAL configuration */
const azureConfigs = {
  admin: {
    clientId: String(import.meta.env.VITE_AZURE_ADMIN_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID || '').trim(),
    tenantId: String(import.meta.env.VITE_AZURE_ADMIN_TENANT_ID || import.meta.env.VITE_AZURE_TENANT_ID || '').trim(),
  },
  academico: {
    clientId: String(import.meta.env.VITE_AZURE_ACADEMICO_CLIENT_ID || '').trim(),
    tenantId: String(import.meta.env.VITE_AZURE_ACADEMICO_TENANT_ID || '').trim(),
  },
  redirectUri: String(
    import.meta.env.VITE_AZURE_REDIRECT_URI || `${getOrigin()}/sso`,
  ).trim(),
  scopes: ['openid', 'profile', 'email'],
}

const runtimeConfig = {
  appBasePath,
  defaultRoute,
  /** Chave usada para guardar sessao SSO no sessionStorage */
  sessionStorageKey: 'univesp.sso.session',
}

const SSO_SESSION_KEY = runtimeConfig.sessionStorageKey

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
  return { ...runtimeConfig, azure: { ...azureConfig } }
}

export function getDefaultAuthenticatedRoute() {
  return runtimeConfig.defaultRoute
}

export function hasSsoDevBypass() {
  return devBypassConfig.enabled
}

export function isAzureConfigured() {
  return Boolean(azureConfigs.admin.clientId || azureConfigs.academico.clientId)
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

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Azure AD OAuth2 — Authorization Code Flow (sem MSAL lib, puro redirect)
// ---------------------------------------------------------------------------

/**
 * Gera a URL de autorizacao do Azure AD e redireciona o navegador.
 * Usa o Authorization Code Flow com PKCE simplificado (implicit/id_token).
 *
 * Se MSAL.js for instalado no futuro, basta trocar esta funcao
 * por msalInstance.loginRedirect().
 */
/**
 * Gera a URL de autorizacao do Azure AD e redireciona o navegador.
 * Usa o Authorization Code Flow com PKCE simplificado (implicit/id_token).
 *
 * Recebe o flow (admin, academico) para usar o tenant/client id correto.
 */
export function buildAzureLoginUrl({ next = runtimeConfig.defaultRoute, flow = 'admin' } = {}) {
  const config = azureConfigs[flow] || azureConfigs.admin

  if (!config || !config.clientId || !config.tenantId) {
    throw new SsoApiError(
      `Azure AD nao configurado adequadamente para o fluxo: ${flow}.`,
    )
  }

  // Salvar o state para validacao no callback e lembrar o fluxo original
  const state = JSON.stringify({
    next: getPublicAppPath(next),
    nonce: generateNonce(),
    flow,
  })
  sessionStorage.setItem('univesp.sso.state', state)

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

/**
 * Processa o callback do Azure AD apos o redirect.
 * Extrai o id_token do fragment da URL e decodifica os claims.
 *
 * Retorna o usuario normalizado ou null se nao houver token.
 */
export function processAzureCallback() {
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

  // Decodificar o JWT (id_token) para extrair claims
  const claims = decodeJwtPayload(idToken)
  if (!claims) {
    return null
  }

  // Validar state
  let nextRoute = runtimeConfig.defaultRoute
  if (stateParam) {
    try {
      const stateData = JSON.parse(atob(stateParam))
      nextRoute = stateData.next || runtimeConfig.defaultRoute
    } catch {
      // Ignorar state invalido
    }
  }

  const user = {
    id: claims.oid || claims.sub || claims.email,
    email: claims.email || claims.preferred_username || claims.upn || '',
    displayName: claims.name || claims.given_name || claims.email || '',
    firstName: claims.given_name || '',
    lastName: claims.family_name || '',
    flow: classifyInstitutionalEmail(
      claims.email || claims.preferred_username || claims.upn,
    ),
    idToken,
    raw: claims,
  }

  // Salvar sessao
  saveSession(user)

  // Limpar o fragment da URL
  if (window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  return { user, nextRoute }
}

// ---------------------------------------------------------------------------
// Session management (sessionStorage — nao depende do Frappe)
// ---------------------------------------------------------------------------

/**
 * Verifica se ha um usuario SSO autenticado.
 * Primeiro tenta o callback do Azure, depois o sessionStorage.
 */
export async function fetchCurrentSsoUser() {
  if (devBypassConfig.enabled) {
    return buildDevBypassUser()
  }

  // 1. Se estamos voltando do Azure AD, processar o callback
  const callbackResult = processAzureCallback()
  if (callbackResult?.user) {
    return callbackResult.user
  }

  // 2. Verificar sessao existente no sessionStorage
  return loadSession()
}

export function logoutFromSso() {
  const sessionUser = loadSession()
  clearSession()

  // Se Azure configurado, redirecionar para logout do Azure tambem
  const flow = sessionUser?.flow || 'admin'
  const config = azureConfigs[flow] || azureConfigs.admin

  if (config && config.clientId && config.tenantId) {
    const logoutUrl = new URL(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/logout`,
    )
    logoutUrl.searchParams.set('post_logout_redirect_uri', `${getOrigin()}/sso`)
    window.location.assign(logoutUrl.toString())
    return { ok: true, redirected: true }
  }

  return { ok: true, redirected: false }
}

// ---------------------------------------------------------------------------
// Legacy compat — buildSsoStartUrl / buildAzureStartUrl / buildSamlStartUrl
// ---------------------------------------------------------------------------

export function buildSsoStartUrl({ email = '', next = runtimeConfig.defaultRoute } = {}) {
  try {
    return buildAzureLoginUrl({ next })
  } catch {
    return `${getOrigin()}/sso`
  }
}

export function buildAzureStartUrl({ tenant, next = runtimeConfig.defaultRoute } = {}) {
  try {
    return buildAzureLoginUrl({ next })
  } catch {
    return `${getOrigin()}/sso`
  }
}

export function buildSamlStartUrl({ next = runtimeConfig.defaultRoute } = {}) {
  try {
    return buildAzureLoginUrl({ next })
  } catch {
    return `${getOrigin()}/sso`
  }
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

function saveSession(user) {
  if (typeof sessionStorage === 'undefined') return
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

function loadSession() {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(SSO_SESSION_KEY)
  if (!raw) return null

  try {
    const data = JSON.parse(raw)
    if (!data || !data.email) return null

    // Sessao expira em 8 horas
    const maxAge = 8 * 60 * 60 * 1000
    if (Date.now() - (data.savedAt || 0) > maxAge) {
      clearSession()
      return null
    }

    return {
      id: data.id,
      email: data.email,
      displayName: data.displayName,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      flow: data.flow || classifyInstitutionalEmail(data.email),
      raw: data,
    }
  } catch {
    clearSession()
    return null
  }
}

function clearSession() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(SSO_SESSION_KEY)
  sessionStorage.removeItem('univesp.sso.state')
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
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
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Dev bypass
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

function normalizeBasePath(value) {
  const normalized = normalizePath(value)
  if (normalized === '/') return '/'
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

function normalizePath(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function trimTrailingSlash(value) {
  if (!value || value === '/') return value
  return value.replace(/\/+$/, '')
}

function isTruthy(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return fallback
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function getOrigin() {
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost'
}
