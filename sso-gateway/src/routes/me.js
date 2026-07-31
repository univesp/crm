import { randomUUID } from 'node:crypto'
import { Router } from 'express'

import { callFrappe, FrappeApiError } from '../lib/frappe.js'

const router = Router()

router.get('/', async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: { code: 'SESSION_REQUIRED', message: 'Nao autenticado.' } })
  }

  const requestId = randomUUID()
  try {
    const result = await callFrappe('session.get_context', {
      user: req.session.user,
      requestId,
    })
    const context = result?.data || result || {}
    res.setHeader('X-Request-ID', requestId)
    return res.json({ ...context, expires_at: req.session.user.expiresAt || null })
  } catch (error) {
    const known = error instanceof FrappeApiError
    res.setHeader('X-Request-ID', requestId)
    return res.status(known ? error.status : 500).json({
      error: {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Falha ao consultar o perfil institucional.',
      },
      request_id: requestId,
    })
  }
})

export default router
