const apiBase = normalizeBasePath(import.meta.env.VITE_APP_API_BASE || '/api/app/v1')

export class AppApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'AppApiError'
    this.status = details.status || 0
    this.code = details.code || 'APP_API_ERROR'
    this.requestId = details.requestId || ''
    this.payload = details.payload
  }
}

export function isMockRuntimeEnabled() {
  return isTruthy(import.meta.env.VITE_ENABLE_MOCKS, false)
}

export async function createTicket(payload) {
  return appRequest('/tickets', { method: 'POST', body: payload })
}

export async function listTickets(params = {}) {
  return appRequest(withQuery('/tickets', params))
}

export async function getTicket(ticketId) {
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}`)
}

export async function addTicketMessage(ticketId, message) {
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    body: { message },
  })
}

export async function addTicketAttachments(ticketId, files = []) {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}/attachments`, {
    method: 'POST',
    body: formData,
  })
}

export async function assignTicket(ticketId, payload) {
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}/assign`, {
    method: 'POST',
    body: payload,
  })
}

export async function transitionTicket(ticketId, payload) {
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}/transition`, {
    method: 'POST',
    body: payload,
  })
}

export async function submitAreaTicketAction(ticketId, payload) {
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}/area-actions`, {
    method: 'POST',
    body: payload,
  })
}

export async function listAreaMembers(area) {
  return appRequest(`/areas/${encodeURIComponent(area)}/members`)
}

export async function getAreaGovernance(area) {
  return appRequest(`/areas/${encodeURIComponent(area)}/governance`)
}

export async function updateAreaGovernance(area, payload) {
  return appRequest(`/areas/${encodeURIComponent(area)}/governance`, {
    method: 'PATCH',
    body: { ...payload, area },
  })
}

export async function listQueues() {
  return appRequest('/queues')
}

export async function listPublishedKnowledge(params = {}) {
  return appRequest(withQuery('/knowledge/published', params))
}

export async function listAdminUsers(params = {}) {
  return appRequest(withQuery('/admin/users', params))
}

export async function getAdminUser(email) {
  return appRequest(`/admin/users/${encodeURIComponent(email)}`)
}

export async function createAdminUser(payload) {
  return appRequest('/admin/users', { method: 'POST', body: payload })
}

export async function updateAdminUser(email, payload) {
  return appRequest(`/admin/users/${encodeURIComponent(email)}`, { method: 'PATCH', body: payload })
}

export async function listAccessRequests(params = {}) {
  return appRequest(withQuery('/admin/access-requests', params))
}

export async function approveAccessRequest(requestId, payload) {
  return appRequest(`/admin/access-requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
    body: payload,
  })
}

export async function rejectAccessRequest(requestId, payload) {
  return appRequest(`/admin/access-requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    body: payload,
  })
}

export async function getAdminCatalogs() {
  return appRequest('/admin/catalogs')
}

export async function listAccessAudit(params = {}) {
  return appRequest(withQuery('/admin/audit', params))
}

export async function listPublishedFaq(params = {}) {
  return appRequest(withQuery('/knowledge/faq-published', params))
}

export async function getKnowledgeLibrary() {
  return appRequest('/knowledge/library')
}

export async function updateKnowledgeLibrary(payload) {
  return appRequest('/knowledge/library', { method: 'PATCH', body: payload })
}

export async function getRuntimeSettings() {
  return appRequest('/admin/runtime-settings')
}

export async function updateRuntimeSettings(payload) {
  return appRequest('/admin/runtime-settings', { method: 'PATCH', body: payload })
}

export async function appRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  headers.set('X-Requested-With', 'XMLHttpRequest')

  const body = normalizeRequestBody(options.body, headers)
  const response = await fetch(resolveApiPath(path), {
    method,
    body,
    headers,
    credentials: 'include',
    cache: method === 'GET' ? 'no-store' : 'default',
  })
  const payload = await parseResponsePayload(response)
  const requestId =
    response.headers.get('X-Request-ID') || payload?.request_id || payload?.meta?.request_id || ''

  if (!response.ok || payload?.error) {
    const error = payload?.error || {}
    throw new AppApiError(
      error.user_message || error.message || `A API respondeu com erro HTTP ${response.status}.`,
      {
        status: response.status,
        code: error.code || 'APP_API_ERROR',
        requestId,
        payload,
      },
    )
  }

  return {
    data: payload?.data ?? payload,
    meta: payload?.meta || {},
    requestId,
  }
}

function resolveApiPath(path) {
  const normalized = String(path || '').trim()
  if (/^https?:\/\//i.test(normalized)) {
    throw new AppApiError('A API do atendimento deve usar a mesma origem do portal.', {
      code: 'CROSS_ORIGIN_API_BLOCKED',
    })
  }
  return `${apiBase}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)))
      return
    }
    query.set(key, String(value))
  })
  const serialized = query.toString()
  return serialized ? `${path}?${serialized}` : path
}

function normalizeRequestBody(body, headers) {
  if (body === undefined || body === null) {
    return undefined
  }
  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return body
  }
  headers.set('Content-Type', 'application/json')
  return typeof body === 'string' ? body : JSON.stringify(body)
}

async function parseResponsePayload(response) {
  const rawBody = await response.text()
  if (!rawBody) {
    return null
  }
  try {
    return JSON.parse(rawBody)
  } catch {
    return {
      error: {
        code: 'INVALID_API_RESPONSE',
        message: 'A API devolveu uma resposta invalida.',
      },
    }
  }
}

function normalizeBasePath(value) {
  const normalized = String(value || '').trim() || '/api/app/v1'
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withLeadingSlash.replace(/\/+$/, '')
}

function isTruthy(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}
