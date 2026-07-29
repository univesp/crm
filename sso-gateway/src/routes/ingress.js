import { randomUUID, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'

import { callFrappe, FrappeApiError } from '../lib/frappe.js'

const router = Router()

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
)

router.post('/tickets', async (req, res) => {
  const requestId = requestIdFor(req)
  const secretError = verifyIngressSecret(req)
  if (secretError) {
    return sendError(res, 401, 'INGRESS_UNAUTHORIZED', secretError, requestId)
  }
  try {
    const result = await callFrappe('ingress.create_ticket', {
      user: {},
      requestId,
      body: { payload: JSON.stringify(req.body || {}) },
      headers: {
        'X-Univesp-Ingress-Secret': String(req.get('x-univesp-ingress-secret') || '').trim(),
      },
      httpMethod: 'POST',
    })
    res.setHeader('X-Request-ID', requestId)
    return res.status(201).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

router.post('/email-replies', async (req, res) => {
  const requestId = requestIdFor(req)
  const secretError = verifyIngressSecret(req)
  if (secretError) return sendError(res, 401, 'INGRESS_UNAUTHORIZED', secretError, requestId)
  try {
    const result = await callFrappe('ingress.receive_public_email_reply', {
      user: {},
      requestId,
      body: { payload: JSON.stringify(req.body || {}) },
      headers: {
        'X-Univesp-Ingress-Secret': String(req.get('x-univesp-ingress-secret') || '').trim(),
      },
      httpMethod: 'POST',
    })
    return res.status(200).json(normalizeEnvelope(result, requestId))
  } catch (error) {
    return handleError(res, error, requestId)
  }
})

function verifyIngressSecret(req) {
  const expected = String(process.env.UNIVESP_INGRESS_SHARED_SECRET || '').trim()
  if (!expected) {
    return process.env.NODE_ENV === 'production'
      ? 'UNIVESP_INGRESS_SHARED_SECRET nao configurado.'
      : null
  }
  const supplied = String(req.get('x-univesp-ingress-secret') || '').trim()
  if (!supplied) return 'Cabecalho X-Univesp-Ingress-Secret ausente.'
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return 'Segredo de ingress invalido.'
  }
  return null
}

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
