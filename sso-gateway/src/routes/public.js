import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { callFrappe, FrappeApiError } from '../lib/frappe.js'

const router = Router()

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
)

router.get('/knowledge/faq-published', async (req, res) => {
  const requestId = requestIdFor(req)
  try {
    const result = await callFrappe('knowledge_runtime.published_runtime_public', {
      user: {},
      requestId,
      query: { faq_type: String(req.query.faq_type || 'publico') },
    })
    res.setHeader('X-Request-ID', requestId)
    return res.status(200).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.get('/runtime/flags', async (req, res) => {
  const requestId = requestIdFor(req)
  try {
    const result = await callFrappe('public.runtime_flags_public', {
      user: {},
      requestId,
    })
    res.setHeader('X-Request-ID', requestId)
    return res.status(200).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.get('/academic-catalogs', async (req, res) => {
  const requestId = requestIdFor(req)
  try {
    const result = await callFrappe('public.public_academic_catalogs', { user: {}, requestId })
    return res.status(200).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.post('/validate-link', async (req, res) => {
  const requestId = requestIdFor(req)
  try {
    const result = await callFrappe('public.validate_public_link', {
      user: {},
      requestId,
      body: { payload: JSON.stringify(req.body || {}) },
      httpMethod: 'POST',
    })
    return res.status(200).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.post('/tickets', async (req, res) => {
  const requestId = requestIdFor(req)
  try {
    const result = await callFrappe('public.create_public_ticket', {
      user: {},
      requestId,
      body: { payload: JSON.stringify(req.body || {}) },
      httpMethod: 'POST',
    })
    res.setHeader('X-Request-ID', requestId)
    return res.status(201).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.post('/tickets/:ticketId/documents', async (req, res) => {
  const requestId = requestIdFor(req)
  const maximum = Number(process.env.MAX_PUBLIC_DOCUMENT_BYTES || 10485760)
  if (Number(req.get('content-length') || 0) > maximum + 65536) {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Documento maior que 10 MiB.', requestId)
  }
  try {
    const result = await callFrappe('public.attach_public_document', {
      user: {},
      requestId,
      query: { ticket_id: req.params.ticketId },
      rawBody: req,
      contentType: req.headers['content-type'],
      headers: { 'X-Public-Upload-Token': String(req.get('x-public-upload-token') || '') },
      httpMethod: 'POST',
    })
    res.setHeader('X-Request-ID', requestId)
    return res.status(201).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.post('/tickets/:ticketId/finalize', async (req, res) => {
  const requestId = requestIdFor(req)
  try {
    const result = await callFrappe('public.finalize_public_ticket', {
      user: {},
      requestId,
      body: { ticket_id: req.params.ticketId },
      headers: { 'X-Public-Upload-Token': String(req.get('x-public-upload-token') || '') },
      httpMethod: 'POST',
    })
    res.setHeader('X-Request-ID', requestId)
    return res.status(200).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

function normalizeEnvelope(result, requestId) {
  if (result && typeof result === 'object' && 'data' in result && 'error' in result) {
    return { ...result, request_id: result.request_id || requestId }
  }
  return { data: result, error: null, meta: {}, request_id: requestId }
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
