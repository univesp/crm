import { randomUUID } from 'node:crypto'
import { Router } from 'express'

import { callFrappe, FrappeApiError } from '../lib/frappe.js'
import {
  activeSimulation,
  createSimulation,
  endSimulation,
  frappeSimulationContext,
  recordSandboxAction,
} from '../lib/simulation.js'

const router = Router()

router.use((req, res, next) => {
  if (!req.session?.user) return sendError(res, 401, 'SESSION_REQUIRED', 'Sessao expirada.')
  if (!isSameOrigin(req)) return sendError(res, 403, 'CSRF_REJECTED', 'Origem da solicitacao invalida.')
  next()
})
router.use((req, res, next) => {
  const simulationRequest =
    req.path.startsWith('/admin/simulation-') ||
    req.path.startsWith('/admin/simulation-sessions') ||
    Boolean(req.get('x-simulation-session'))
  if (simulationRequest && !featureEnabled('ENABLE_PRODUCTION_SIMULATOR')) {
    return sendError(res, 404, 'SIMULATION_DISABLED', 'Simulacao indisponivel neste ambiente.')
  }

  const customAccessRequest =
    req.path.startsWith('/admin/permission-profiles') ||
    req.path.startsWith('/admin/access-groups') ||
    req.path.startsWith('/admin/profile-assignments')
  if (customAccessRequest && !featureEnabled('ENABLE_CUSTOM_PERMISSION_PROFILES')) {
    return sendError(res, 404, 'CUSTOM_ACCESS_DISABLED', 'Perfis personalizados indisponiveis.')
  }
  return next()
})
router.use((req, res, next) => {
  const suppliedId = String(req.get('x-simulation-session') || '').trim()
  if (!suppliedId) return next()

  const simulation = activeSimulation(req, suppliedId)
  if (simulation?.error) {
    const expired = simulation.error === 'SIMULATION_SESSION_EXPIRED'
    return sendError(
      res,
      expired ? 410 : 401,
      simulation.error,
      expired ? 'A simulacao expirou. Inicie uma nova visualizacao.' : 'Sessao de simulacao invalida.',
    )
  }

  req.simulation = simulation
  const sandboxAction = req.method === 'POST' && /^\/admin\/simulation-sessions\/[^/]+\/actions$/.test(req.path)
  const endingSession = req.method === 'DELETE' && /^\/admin\/simulation-sessions\/[^/]+$/.test(req.path)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sandboxAction && !endingSession) {
    return sendError(
      res,
      409,
      'SIMULATION_REAL_WRITE_BLOCKED',
      'Modo de simulacao ativo: nenhuma alteracao foi enviada ao ambiente real.',
    )
  }
  return next()
})

router.get('/health', forward('settings.health'))
router.get('/admin/permission-profiles', forward('admin.list_permission_profiles', { query: true }))
router.post('/admin/permission-profiles', forward('admin.create_permission_profile', { wrapPayload: true }))
router.patch('/admin/permission-profiles/:profileId', forward('admin.update_permission_profile', {
  routeParams: { profile_id: 'profileId' },
  wrapPayload: true,
}))
router.get('/admin/access-groups', forward('admin.list_access_groups', { query: true }))
router.post('/admin/access-groups', forward('admin.create_access_group', { wrapPayload: true }))
router.patch('/admin/access-groups/:groupId', forward('admin.update_access_group', {
  routeParams: { group_id: 'groupId' },
  wrapPayload: true,
}))
router.post('/admin/profile-assignments', forward('admin.create_profile_assignment', { wrapPayload: true }))
router.delete('/admin/profile-assignments/:assignmentId', forward('admin.delete_profile_assignment', {
  routeParams: { assignment_id: 'assignmentId' },
}))
router.get('/admin/simulation-targets', forward('admin.list_simulation_targets', { query: true }))
router.get('/admin/simulation-audit', forward('admin.list_simulation_audit', { query: true }))

router.post('/admin/simulation-sessions', async (req, res) => {
  const requestId = requestIdFor(req)
  try {
    const authorization = await callFrappe('admin.authorize_simulation_session', {
      user: req.session.user,
      requestId,
      body: { payload: JSON.stringify(req.body || {}) },
      httpMethod: 'POST',
    })
    const approved = authorization?.data || authorization || {}
    const simulation = createSimulation(req, approved)
    await saveSession(req)
    res.setHeader('X-Request-ID', requestId)
    return res.status(201).json(normalizeEnvelope(simulation, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.delete('/admin/simulation-sessions/:id', async (req, res) => {
  const requestId = requestIdFor(req)
  const ended = endSimulation(req, req.params.id)
  if (ended?.error) return sendError(res, 404, ended.error, 'Sessao de simulacao nao encontrada.', requestId)
  await saveSession(req)
  return res.status(200).json(normalizeEnvelope(ended, requestId))
})

router.post('/admin/simulation-sessions/:id/actions', async (req, res) => {
  const requestId = requestIdFor(req)
  const result = recordSandboxAction(req, req.params.id, req.body || {})
  if (result?.error) {
    return sendError(res, 422, result.error, 'Acao nao permitida no sandbox de simulacao.', requestId)
  }
  await saveSession(req)
  return res.status(201).json(normalizeEnvelope(result, requestId))
})

router.get('/tickets', forward('tickets.list_tickets', { query: true }))
router.post('/tickets', forward('tickets.create', { wrapPayload: true }))
router.get('/tickets/:ticketId', forward('tickets.get', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/messages', forward('tickets.add_message', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/attachments', forward('tickets.attach', { routeParams: { ticket_id: 'ticketId' }, rawBody: true }))
router.post('/tickets/:ticketId/assign', forward('tickets.assign', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/transition', forward('tickets.transition', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/escalate', forward('tickets.escalate_to_internal', { routeParams: { ticket_id: 'ticketId' } }))
router.post('/tickets/:ticketId/area-actions', forward('tickets.area_action', { routeParams: { ticket_id: 'ticketId' } }))
router.get('/queues', forward('queues.list_queues'))
router.get('/areas/:area/members', forward('queues.list_area_members', { routeParams: { area: 'area' } }))
router.get('/areas/:area/governance', forward('governance.get_area_state', { routeParams: { area: 'area' } }))
router.patch('/areas/:area/governance', forward('governance.update_area_state', { routeParams: { area: 'area' }, wrapPayload: true }))
router.get('/knowledge/published', forward('knowledge.published', { query: true }))
router.get('/knowledge/faq-published', forward('knowledge.published_faq', { query: true }))
router.post('/students/validate', forward('students.validate', { wrapPayload: true }))
router.get('/students/:ra/academic-summary', forward('students.academic_summary', {
  routeParams: { ra: 'ra' },
  query: true,
}))
router.get('/knowledge/library', forward('knowledge.get_library'))
router.patch('/knowledge/library', forward('knowledge.update_library', { wrapPayload: true }))
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
router.get('/admin/runtime-settings', forward('settings.get_settings'))
router.patch('/admin/runtime-settings', forward('settings.update_settings', { wrapPayload: true }))

async function saveSession(req) {
  await new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())))
}
function featureEnabled(name) {
  const value = String(process.env[name] || '').trim().toLowerCase()
  if (value) return value === 'true'
  return process.env.NODE_ENV !== 'production'
}
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
        simulation: frappeSimulationContext(req.simulation),
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
