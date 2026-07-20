import cookieParser from 'cookie-parser'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import passport from 'passport'
import { randomUUID } from 'node:crypto'

import { createSamlStrategy } from './lib/saml.js'
import appRouter from './routes/app.js'
import meRouter from './routes/me.js'
import ssoRouter from './routes/sso.js'

export function createApp({ sessionStore } = {}) {
  validateRuntimeConfig()
  const app = express()
  app.set('trust proxy', 'loopback')

  if (process.env.SAML_IDP_CERT) passport.use('univesp-saml', createSamlStrategy())
  passport.serializeUser((user, done) => done(null, user))
  passport.deserializeUser((user, done) => done(null, user))

  app.use(cookieParser())
  app.use(express.urlencoded({ extended: false }))
  app.use(express.json({ limit: process.env.MAX_JSON_BODY || '3mb' }))
  app.use(
    session({
      name: 'crm_session',
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'development-only-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: Number(process.env.COOKIE_MAX_AGE_MS) || 28800000,
      },
    }),
  )

  app.use(passport.initialize())
  app.use(passport.session())
  app.use('/api/sso', requestLimit(60), ssoRouter)
  app.use('/api/me', meRouter)
  app.use('/api/app/v1', requestLimit(300), enforceBodySize, appRouter)
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use((error, _req, res, _next) => {
    const requestId = randomUUID()
    const invalidJson = error?.type === 'entity.parse.failed'
    const bodyTooLarge = error?.type === 'entity.too.large'
    const status = bodyTooLarge ? 413 : invalidJson ? 400 : 500
    res.setHeader('X-Request-ID', requestId)
    res.status(status).json({
      data: null,
      error: {
        code: bodyTooLarge ? 'PAYLOAD_TOO_LARGE' : invalidJson ? 'INVALID_JSON' : 'INTERNAL_ERROR',
        message: bodyTooLarge
          ? 'Corpo JSON maior que o limite permitido.'
          : invalidJson
            ? 'Corpo JSON invalido.'
            : 'Falha interna no Gateway.',
      },
      meta: {},
      request_id: requestId,
    })
  })
  return app
}

function requestLimit(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      const requestId = randomUUID()
      res.setHeader('X-Request-ID', requestId)
      res.status(429).json({
        data: null,
        error: { code: 'RATE_LIMITED', message: 'Muitas solicitacoes. Tente novamente em instantes.' },
        meta: {},
        request_id: requestId,
      })
    },
  })
}

function enforceBodySize(req, res, next) {
  const maximum = Number(process.env.MAX_UPLOAD_BYTES || 52428800)
  const length = Number(req.get('content-length') || 0)
  if (!Number.isFinite(length) || length <= maximum) return next()
  const requestId = randomUUID()
  res.setHeader('X-Request-ID', requestId)
  return res.status(413).json({
    data: null,
    error: { code: 'PAYLOAD_TOO_LARGE', message: 'Arquivo maior que o limite permitido.' },
    meta: {},
    request_id: requestId,
  })
}

function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== 'production') return
  for (const name of [
    'SESSION_SECRET',
    'JWT_SECRET',
    'GATEWAY_REDIS_URL',
    'APP_BASE_URL',
    'FRAPPE_API_KEY',
    'FRAPPE_API_SECRET',
    'UNIVESP_BFF_SHARED_SECRET',
    'AZURE_REDIRECT_URI',
    'AZURE_ADMIN_CLIENT_ID',
    'AZURE_ADMIN_TENANT_ID',
    'AZURE_ADMIN_CLIENT_SECRET',
    'AZURE_ACADEMICO_CLIENT_ID',
    'AZURE_ACADEMICO_TENANT_ID',
    'AZURE_ACADEMICO_CLIENT_SECRET',
    'SAML_IDP_SSO_URL',
    'SAML_IDP_CERT',
    'SAML_ACS_URL',
    'SAML_ENTITY_ID',
  ]) {
    if (!String(process.env[name] || '').trim()) throw new Error(`${name} obrigatorio em producao.`)
  }
}
