import { randomUUID } from 'node:crypto'
import { Router } from 'express'

import { callFrappe, FrappeApiError } from '../lib/frappe.js'

const router = Router()

router.use((req, res, next) => {
  if (!req.session?.user) return sendError(res, 401, 'SESSION_REQUIRED', 'Sessao expirada.')
  if (!isSameOrigin(req)) return sendError(res, 403, 'CSRF_REJECTED', 'Origem da solicitacao invalida.')
  next()
})

router.get('/tickets', forward('tickets.list_tickets', { query: true }))
router.post('/tickets', forward('tickets.create', { wrapPayload: true }))
router.get('/tickets/:ticketId', forward('tickets.get', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/messages', forward('tickets.add_message', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/attachments', forward('tickets.attach', { routeParams: { ticket_id: 'ticketId' }, rawBody: true }))
router.post('/tickets/:ticketId/assign', forward('tickets.assign', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/transition', forward('tickets.transition', { routeParams: { ticket_id: 'ticketId' } }))
router.get('/queues', forward('queues.list_queues'))
router.get('/knowledge/published', forward('knowledge.published', { query: true }))
router.get('/admin/users', forward('admin.list_users', { query: true }))
router.post('/admin/users', forward('admin.create_user', { wrapPayload: true }))
router.get('/admin/users/:email', forward('admin.get_user', { routeParams: { email: 'email' } }))
router.patch('/admin/users/:email', forward('admin.update_user', { routeParams: { email: 'email' }, wrapPayload: true }))
router.get('/admin/access-requests', forward('admin.list_access_requests', { query: true }))
router.post('/admin/access-requests/:requestId/approve', forward('admin.approve_access_request', {
  routeParams: { access_request_id: 'requestId' },
  wrapPayload: true,
}))
router.post('/admin/access-requests/:requestId/reject', forward('admin.reject_access_request', {
  routeParams: { access_request_id: 'requestId' },
  wrapPayload: true,
}))
router.get('/admin/catalogs', forward('admin.catalogs'))
router.get('/admin/audit', forward('admin.list_audit', { query: true }))

function forward(method, options = {}) {
  return async (req, res) => {
    const requestId = requestIdFor(req)
    try {
      const routeParams = Object.fromEntries(
        Object.entries(options.routeParams || {}).map(([target, source]) => [target, req.params[source]]),
      )
      const query = {
        ...(options.query ? req.query : {}),
        ...(req.method === 'GET' || options.rawBody ? routeParams : {}),
      }
      let body
      if (!options.rawBody) {
        body = { ...routeParams, ...(req.body || {}) }
        if (options.wrapPayload) body = { ...routeParams, payload: JSON.stringify(req.body || {}) }
      }
      const result = await callFrappe(method, {
        user: req.session.user,
        requestId,
        query,
        body: req.method === 'GET' ? undefined : body,
        rawBody: options.rawBody ? req : undefined,
        contentType: options.rawBody ? req.headers['content-type'] : undefined,
        httpMethod: req.method,
      })
      res.setHeader('X-Request-ID', requestId)
      res.status(200).json(normalizeEnvelope(result, requestId))
    } catch (error) {
      handleError(res, error, requestId)
    }
  }
}

function normalizeEnvelope(result, requestId) {
  if (result && typeof result === 'object' && 'data' in result && 'error' in result) {
    return { ...result, request_id: result.request_id || requestId }
  }
  return { data: result, error: null, meta: {}, request_id: requestId }
}

function isSameOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true
  const expected = String(process.env.APP_BASE_URL || '').trim()
  const origin = String(req.get('origin') || '').trim()
  if (!expected || process.env.NODE_ENV !== 'production') return true
  return origin === new URL(expected).origin
}

function requestIdFor(req) {
  const supplied = String(req.get('x-request-id') || '').trim()
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID()
}

function handleError(res, error, requestId) {
  const known = error instanceof FrappeApiError
  return sendError(
    res,
    known ? error.status : 500,
    known ? error.code : 'INTERNAL_ERROR',
    known ? error.message : 'Falha interna no Gateway.',
    requestId,
  )
}

function sendError(res, status, code, message, requestId = randomUUID()) {
  res.setHeader('X-Request-ID', requestId)
  return res.status(status).json({
    data: null,
    error: { code, message, user_message: message },
    meta: {},
    request_id: requestId,
  })
}

export default router
