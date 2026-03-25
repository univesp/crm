const envAuthHeader = buildEnvAuthHeader(
  import.meta.env.VITE_FRAPPE_AUTH_HEADER || '',
  import.meta.env.VITE_FRAPPE_API_KEY || '',
  import.meta.env.VITE_FRAPPE_API_SECRET || '',
)

const runtimeConfig = {
  baseUrl: normalizeBaseUrl(import.meta.env.VITE_FRAPPE_BASE_URL || ''),
  apiPrefix: normalizePath(import.meta.env.VITE_FRAPPE_API_PREFIX || '/api'),
  authMode: normalizeAuthMode(import.meta.env.VITE_FRAPPE_AUTH_MODE || 'session'),
  tokenStorageKey:
    import.meta.env.VITE_FRAPPE_TOKEN_STORAGE_KEY || 'univesp.frappe.authHeader',
}

export class FrappeApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'FrappeApiError'
    this.status = details.status || 0
    this.url = details.url || ''
    this.payload = details.payload
  }
}

export function getFrappeRuntimeConfig() {
  return { ...runtimeConfig }
}

export function hasRuntimeFrappeToken() {
  return Boolean(readStoredAuthHeader())
}

export function setRuntimeFrappeToken(authHeader, persistent = true) {
  const storage = getStorage(persistent)

  if (!storage) {
    return false
  }

  storage.setItem(runtimeConfig.tokenStorageKey, authHeader.trim())
  return true
}

export function clearRuntimeFrappeToken() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(runtimeConfig.tokenStorageKey)
  window.sessionStorage.removeItem(runtimeConfig.tokenStorageKey)
}

export async function getResource(doctype, name, params = {}) {
  const resourcePath = `${runtimeConfig.apiPrefix}/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
  return frappeRequest(withQuery(resourcePath, params))
}

export async function listResource(doctype, params = {}) {
  const resourcePath = `${runtimeConfig.apiPrefix}/resource/${encodeURIComponent(doctype)}`
  return frappeRequest(withQuery(resourcePath, params))
}

export async function createResource(doctype, payload) {
  const resourcePath = `${runtimeConfig.apiPrefix}/resource/${encodeURIComponent(doctype)}`
  return frappeRequest(resourcePath, {
    method: 'POST',
    body: payload,
  })
}

export async function updateResource(doctype, name, payload) {
  const resourcePath = `${runtimeConfig.apiPrefix}/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`
  return frappeRequest(resourcePath, {
    method: 'PUT',
    body: payload,
  })
}

export async function callFrappeMethod(methodPath, payload = {}, options = {}) {
  const normalizedPath = methodPath.startsWith('/api/')
    ? methodPath
    : `${runtimeConfig.apiPrefix}/method/${trimSlashes(methodPath)}`

  return frappeRequest(normalizedPath, {
    method: options.method || 'POST',
    body: payload,
  })
}

export async function frappeRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  const authHeader = runtimeConfig.authMode === 'token' ? readStoredAuthHeader() || envAuthHeader : ''
  if (authHeader) {
    headers.set('Authorization', authHeader)
  } else if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = readCookie('csrf_token')
    if (csrfToken) {
      headers.set('X-Frappe-CSRF-Token', csrfToken)
    }
  }

  const body = normalizeRequestBody(options.body, headers)
  const response = await fetch(resolveApiUrl(path), {
    method,
    body,
    headers,
    credentials: 'include',
    redirect: 'follow',
  })

  const payload = await parseResponsePayload(response)
  if (!response.ok) {
    throw new FrappeApiError(extractErrorMessage(payload, response.status), {
      status: response.status,
      url: response.url,
      payload,
    })
  }

  return payload
}

export function unwrapFrappePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload
  }

  if ('message' in payload) {
    return payload.message
  }

  if ('data' in payload) {
    return payload.data
  }

  return payload
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

function normalizeAuthMode(value) {
  return value === 'token' ? 'token' : 'session'
}

function buildEnvAuthHeader(authHeader, apiKey, apiSecret) {
  const directHeader = String(authHeader || '').trim()
  if (directHeader) {
    return directHeader
  }

  const normalizedKey = String(apiKey || '').trim()
  const normalizedSecret = String(apiSecret || '').trim()
  if (!normalizedKey || !normalizedSecret) {
    return ''
  }

  return `token ${normalizedKey}:${normalizedSecret}`
}

function trimSlashes(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function resolveApiUrl(path) {
  const normalizedPath = String(path || '').startsWith('http')
    ? String(path)
    : `${runtimeConfig.baseUrl}${normalizePath(path)}`

  return normalizedPath
}

function withQuery(path, params) {
  const url = resolveUrlObject(path)

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)))
      return
    }

    url.searchParams.set(key, String(value))
  })

  return url.toString()
}

function resolveUrlObject(path) {
  const resolvedUrl = resolveApiUrl(path)
  if (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
    return new URL(resolvedUrl)
  }

  if (typeof window !== 'undefined') {
    return new URL(resolvedUrl, window.location.origin)
  }

  return new URL(resolvedUrl, 'http://localhost')
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

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}

function extractErrorMessage(payload, status) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    const message = payload.exception || payload.exc || payload.message || payload._error_message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return `Frappe CRM respondeu com erro HTTP ${status}.`
}

function readStoredAuthHeader() {
  if (typeof window === 'undefined') {
    return ''
  }

  return (
    window.sessionStorage.getItem(runtimeConfig.tokenStorageKey) ||
    window.localStorage.getItem(runtimeConfig.tokenStorageKey) ||
    ''
  )
}

function readCookie(name) {
  if (typeof document === 'undefined') {
    return ''
  }

  const cookiePrefix = `${name}=`
  const cookieValue = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookiePrefix))

  if (!cookieValue) {
    return ''
  }

  return decodeURIComponent(cookieValue.slice(cookiePrefix.length))
}

function getStorage(persistent) {
  if (typeof window === 'undefined') {
    return null
  }

  return persistent ? window.localStorage : window.sessionStorage
}
