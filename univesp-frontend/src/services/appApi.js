const simulationStorageKey = 'univesp.activeSimulation'

export function getActiveSimulation() {
  try {
    const value = JSON.parse(sessionStorage.getItem(simulationStorageKey) || 'null')
    return value && typeof value === 'object' && value.id ? value : null
  } catch {
    return null
  }
}

export function setActiveSimulation(value) {
  if (!value?.id) {
    sessionStorage.removeItem(simulationStorageKey)
    return null
  }
  sessionStorage.setItem(simulationStorageKey, JSON.stringify(value))
  return value
}

export async function searchSimulationTargets(params = {}) {
  return appRequest(withQuery('/admin/simulation-targets', params), { skipSimulation: true })
}

export async function startSimulation(payload) {
  setActiveSimulation(null)
  const response = await appRequest('/admin/simulation-sessions', {
    method: 'POST',
    body: payload,
    skipSimulation: true,
  })
  setActiveSimulation(response.data)
  return response
}

export async function stopSimulation() {
  const active = getActiveSimulation()
  if (!active) return null
  const response = await appRequest(`/admin/simulation-sessions/${encodeURIComponent(active.id)}`, {
    method: 'DELETE',
  })
  setActiveSimulation(null)
  return response
}

export async function submitSimulationAction(actionType) {
  const active = getActiveSimulation()
  if (!active) throw new AppApiError('Nenhuma simulacao ativa.', { code: 'SIMULATION_REQUIRED' })
  return appRequest(
    `/admin/simulation-sessions/${encodeURIComponent(active.id)}/actions`,
    { method: 'POST', body: { action_type: actionType } },
  )
}
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

export async function listIdentityValidations(params = {}) {
  return appRequest(withQuery('/identity-validations', params))
}

export async function decideIdentityValidation(validationId, payload) {
  return appRequest(`/identity-validations/${encodeURIComponent(validationId)}/decision`, {
    method: 'POST',
    body: payload,
  })
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

export async function listTicketAudit(params = {}) {
  return appRequest(withQuery('/admin/ticket-audit', params))
}

export async function listPublishedFaq(params = {}) {
  return appRequest(withQuery('/knowledge/faq-published', params))
}

export async function revealPublicContact(ticketId, payload) {
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}/reveal-contact`, {
    method: 'POST',
    body: payload,
  })
}

export async function issuePublicDocumentDownload(ticketId, documentId, reason) {
  return appRequest(
    `/tickets/${encodeURIComponent(ticketId)}/documents/${encodeURIComponent(documentId)}/download-link`,
    { method: 'POST', body: { reason } },
  )
}

export async function listPublishedFaqRuntime(params = {}) {
  return appRequest(withQuery('/knowledge/v3/runtime', params))
}

export async function startFaqSession(payload) {
  return appRequest('/knowledge/v3/sessions', { method: 'POST', body: payload })
}

export async function getFaqSession(sessionId) {
  return appRequest(`/knowledge/v3/sessions/${encodeURIComponent(sessionId)}`)
}

export async function advanceFaqSession(sessionId, payload) {
  return appRequest(`/knowledge/v3/sessions/${encodeURIComponent(sessionId)}/advance`, {
    method: 'POST',
    body: payload,
  })
}

export async function recordFaqEvent(payload) {
  return appRequest('/knowledge/v3/events', { method: 'POST', body: payload })
}

export async function getRuntimeFlags() {
  return appRequest('/runtime/flags')
}

export async function getLegacyKnowledgeMetrics() {
  return appRequest('/knowledge/v3/metrics/legacy')
}

export async function previewKnowledgeRouting(payload) {
  return appRequest('/routing/preview', { method: 'POST', body: payload })
}

export async function recordCaseKnowledgeApplied(ticketId, payload = {}) {
  return appRequest(`/tickets/${encodeURIComponent(ticketId)}/knowledge-applied`, {
    method: 'POST',
    body: payload,
  })
}

export async function listKnowledgeV3Bundles(params = {}) {
  return appRequest(withQuery('/knowledge/v3/bundles', params))
}

export async function getKnowledgeV3Catalogs() {
  return appRequest('/knowledge/v3/catalogs')
}

export async function listKnowledgeV3Assets() {
  return appRequest('/knowledge/v3/assets')
}

export async function uploadKnowledgeV3Asset(file, metadata = {}) {
  const body = new FormData()
  body.append('files', file)
  Object.entries(metadata).forEach(([key, value]) => body.append(key, value || ''))
  return appRequest('/knowledge/v3/assets', { method: 'POST', body })
}

export async function previewKnowledgeV2Migration(payload = {}) {
  return appRequest('/knowledge/v3/migration/preview', { method: 'POST', body: payload })
}

export async function applyKnowledgeV2Migration(payload = {}) {
  return appRequest('/knowledge/v3/migration/apply', { method: 'POST', body: payload })
}

export async function listKnowledgeSuggestions(params = {}) {
  return appRequest(withQuery('/knowledge/v3/suggestions', params))
}

export async function createKnowledgeSuggestion(payload) {
  return appRequest('/knowledge/v3/suggestions', { method: 'POST', body: payload })
}

export async function startKnowledgeSuggestionReview(suggestionId) {
  return appRequest(`/knowledge/v3/suggestions/${encodeURIComponent(suggestionId)}/review`, {
    method: 'POST',
  })
}

export async function incorporateKnowledgeSuggestion(suggestionId, payload = {}) {
  return appRequest(`/knowledge/v3/suggestions/${encodeURIComponent(suggestionId)}/incorporate`, {
    method: 'POST',
    body: payload,
  })
}

export async function rejectKnowledgeSuggestion(suggestionId, payload) {
  return appRequest(`/knowledge/v3/suggestions/${encodeURIComponent(suggestionId)}/reject`, {
    method: 'POST',
    body: payload,
  })
}

export async function createKnowledgeV3Bundle(payload) {
  return appRequest('/knowledge/v3/bundles', { method: 'POST', body: payload })
}

export async function getKnowledgeV3Bundle(bundleKey) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}`)
}

export async function listKnowledgeV3Versions(bundleKey, params = {}) {
  return appRequest(
    withQuery(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}/versions`, params),
  )
}

export async function saveKnowledgeV3Draft(bundleKey, payload, etag) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}/draft`, {
    method: 'PATCH',
    headers: etag ? { 'If-Match': etag } : {},
    body: payload,
  })
}

export async function forkKnowledgeV3Draft(bundleKey) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}/fork`, {
    method: 'POST',
  })
}

export async function submitKnowledgeV3Approval(bundleKey, payload, etag) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}/submit`, {
    method: 'POST',
    headers: etag ? { 'If-Match': etag } : {},
    body: payload,
  })
}

export async function approveKnowledgeV3Bundle(bundleKey) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}/approve`, {
    method: 'POST',
  })
}

export async function publishKnowledgeV3Version(versionId, payload = {}) {
  return appRequest(`/knowledge/v3/versions/${encodeURIComponent(versionId)}/publish`, {
    method: 'POST',
    body: payload,
  })
}

export async function archiveKnowledgeV3Bundle(bundleKey) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}/archive`, {
    method: 'POST',
  })
}

export async function unarchiveKnowledgeV3Bundle(bundleKey) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}/unarchive`, {
    method: 'POST',
  })
}

export async function deleteKnowledgeV3Bundle(bundleKey) {
  return appRequest(`/knowledge/v3/bundles/${encodeURIComponent(bundleKey)}`, {
    method: 'DELETE',
  })
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

export async function getSystemHealth() {
  return appRequest('/health')
}

export async function listPermissionProfiles() {
  return appRequest('/admin/permission-profiles')
}

export async function createPermissionProfile(payload) {
  return appRequest('/admin/permission-profiles', { method: 'POST', body: payload })
}

export async function updatePermissionProfile(profileId, payload) {
  return appRequest(`/admin/permission-profiles/${encodeURIComponent(profileId)}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function listAccessGroups() {
  return appRequest('/admin/access-groups')
}

export async function createAccessGroup(payload) {
  return appRequest('/admin/access-groups', { method: 'POST', body: payload })
}

export async function updateAccessGroup(groupId, payload) {
  return appRequest(`/admin/access-groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function createProfileAssignment(payload) {
  return appRequest('/admin/profile-assignments', { method: 'POST', body: payload })
}

export async function listProfileAssignments(params = {}) {
  return appRequest(withQuery('/admin/profile-assignments', params))
}

export async function revokeProfileAssignment(assignmentId) {
  return appRequest(`/admin/profile-assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
  })
}

export async function listSimulationAudit(params = {}) {
  return appRequest(withQuery('/admin/simulation-audit', params))
}

export async function validateStudent(payload) {
  return appRequest('/students/validate', { method: 'POST', body: payload })
}

const publicApiBase = normalizeBasePath(import.meta.env.VITE_PUBLIC_API_BASE || '/api/public/v1')

export async function listPublicFaq(params = {}) {
  return publicRequest(withQuery('/knowledge/faq-published', { faq_type: 'publico', ...params }))
}

export async function getPublicRuntimeFlags() {
  return publicRequest('/runtime/flags')
}

export async function startPublicFaqSession(payload) {
  return publicRequest('/knowledge/v3/sessions', { method: 'POST', body: payload })
}

export async function getPublicFaqSession(sessionId) {
  return publicRequest(`/knowledge/v3/sessions/${encodeURIComponent(sessionId)}`)
}

export async function advancePublicFaqSession(sessionId, payload) {
  return publicRequest(`/knowledge/v3/sessions/${encodeURIComponent(sessionId)}/advance`, {
    method: 'POST',
    body: payload,
  })
}

export async function recordPublicFaqEvent(payload) {
  return publicRequest('/knowledge/v3/events', { method: 'POST', body: payload })
}

export async function getPublicAcademicCatalogs() {
  return publicRequest('/academic-catalogs')
}

export async function validatePublicLink(payload) {
  return publicRequest('/validate-link', { method: 'POST', body: payload })
}

export async function createPublicTicket(payload) {
  return publicRequest('/tickets', { method: 'POST', body: payload })
}

export async function createPublicIntake(payload) {
  return publicRequest('/intakes', { method: 'POST', body: payload })
}

export async function uploadPublicIntakeDocument(intakeId, uploadToken, file) {
  const body = new FormData()
  body.append('files', file)
  return publicRequest(`/intakes/${encodeURIComponent(intakeId)}/documents`, {
    method: 'POST',
    body,
    headers: { 'X-Public-Upload-Token': uploadToken },
  })
}

export async function getPublicIntakeStatus(intakeId, uploadToken) {
  return publicRequest(`/intakes/${encodeURIComponent(intakeId)}`, {
    headers: { 'X-Public-Upload-Token': uploadToken },
  })
}

export async function finalizePublicIntake(intakeId, uploadToken) {
  return publicRequest(`/intakes/${encodeURIComponent(intakeId)}/finalize`, {
    method: 'POST',
    body: {},
    headers: { 'X-Public-Upload-Token': uploadToken },
  })
}

export async function uploadPublicDocument(ticketId, uploadToken, file) {
  const body = new FormData()
  body.append('files', file)
  return publicRequest(`/tickets/${encodeURIComponent(ticketId)}/documents`, {
    method: 'POST',
    body,
    headers: { 'X-Public-Upload-Token': uploadToken },
  })
}

export async function finalizePublicTicket(ticketId, uploadToken) {
  return publicRequest(`/tickets/${encodeURIComponent(ticketId)}/finalize`, {
    method: 'POST',
    body: {},
    headers: { 'X-Public-Upload-Token': uploadToken },
  })
}

async function publicRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  headers.set('X-Requested-With', 'XMLHttpRequest')
  const body = normalizeRequestBody(options.body, headers)
  const normalized = String(path || '').trim()
  const url = `${publicApiBase}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
  const response = await fetch(url, {
    method,
    body,
    headers,
    credentials: 'include',
    cache: 'no-store',
  })
  const payload = await parseResponsePayload(response)
  const requestId =
    response.headers.get('X-Request-ID') || payload?.request_id || payload?.meta?.request_id || ''
  if (!response.ok || payload?.error) {
    const error = payload?.error || {}
    throw new AppApiError(
      error.user_message || error.message || `A API publica respondeu com erro HTTP ${response.status}.`,
      { status: response.status, code: error.code || 'PUBLIC_API_ERROR', requestId, payload },
    )
  }
  return { data: payload?.data ?? payload, meta: payload?.meta || {}, requestId }
}

export async function appRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  headers.set('X-Requested-With', 'XMLHttpRequest')

  const simulation = options.skipSimulation ? null : getActiveSimulation()
  if (simulation?.id) headers.set('X-Simulation-Session', simulation.id)
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
