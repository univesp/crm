import { Router } from 'express'
import passport from 'passport'
import { randomBytes } from 'node:crypto'

import { classifyEmail, normalizeEmail, sanitizeNext } from '../lib/email.js'
import { acquireTokenByCode, getAuthCodeUrl } from '../lib/msal.js'
import { extractEmailFromSaml } from '../lib/saml.js'
import { signState, verifyState } from '../lib/state.js'

const router = Router()
const appBase = () => process.env.APP_BASE_URL || 'https://homolog-crm.univesp.br'

router.get('/start', (req, res) => {
  const email = normalizeEmail(req.query.email)
  const next = sanitizeNext(String(req.query.next || '/'))
  const flow = classifyEmail(email)
  if (flow === 'aluno') return redirectTo(res, '/api/sso/saml/start', { next })
  if (flow === 'admin' || flow === 'academico') {
    return redirectTo(res, '/api/sso/azure/start', { tenant: flow, next, email })
  }
  return redirectError(res, next, 'Use um e-mail institucional da UNIVESP.')
})

router.get('/azure/start', async (req, res) => {
  const email = normalizeEmail(req.query.email)
  const next = sanitizeNext(String(req.query.next || '/'))
  const tenant = String(req.query.tenant || '')
  if (!['admin', 'academico'].includes(tenant)) return redirectError(res, next, 'Tenant invalido.')
  if (email && classifyEmail(email) !== tenant) {
    return redirectError(res, next, 'E-mail nao corresponde ao fluxo selecionado.')
  }
  try {
    const nonce = randomBytes(24).toString('base64url')
    const state = signState({ flow: 'azure', tenant, next, email, nonce })
    return res.redirect(await getAuthCodeUrl(tenant, state, email, nonce))
  } catch (error) {
    return redirectError(res, next, errorMessage(error, 'Falha ao iniciar SSO Azure.'))
  }
})

router.get('/azure/callback', async (req, res) => {
  const code = String(req.query.code || '')
  const stateToken = String(req.query.state || '')
  if (!code || !stateToken) return redirectError(res, '/', 'Callback invalido do Azure AD.')

  let state
  try {
    state = verifyState(stateToken)
  } catch {
    return redirectError(res, '/', 'State expirado ou invalido.')
  }
  if (!['admin', 'academico'].includes(state.tenant)) {
    return redirectError(res, state.next, 'State com tenant invalido.')
  }

  try {
    const token = await acquireTokenByCode(state.tenant, code)
    const claims = token?.idTokenClaims || {}
    if (!state.nonce || claims.nonce !== state.nonce) {
      return redirectError(res, state.next, 'Nonce invalido no retorno do Azure AD.')
    }
    const email = normalizeEmail(claims.preferred_username || claims.email || claims.upn || state.email)
    if (!email || classifyEmail(email) !== state.tenant) {
      return redirectError(res, state.next, 'Conta autenticada em fluxo incorreto.')
    }
    await establishSession(req, sessionUser({
      email,
      displayName: claims.name,
      flow: state.tenant,
    }))
    return res.redirect(sanitizeNext(state.next || '/'))
  } catch (error) {
    return redirectError(res, state.next, errorMessage(error, 'Falha no callback Azure.'))
  }
})

router.get('/saml/start', (req, res, next) => {
  if (!process.env.SAML_IDP_CERT) return redirectError(res, '/', 'Fluxo SAML indisponivel.')
  const nextPath = sanitizeNext(String(req.query.next || '/'))
  passport.authenticate('univesp-saml', {
    session: false,
    additionalParams: { RelayState: signState({ flow: 'saml', next: nextPath }) },
  })(req, res, next)
})

router.post(
  '/saml/callback',
  passport.authenticate('univesp-saml', { session: false, failWithError: true }),
  async (req, res) => {
    try {
      const state = req.body?.RelayState ? verifyState(String(req.body.RelayState)) : {}
      const next = sanitizeNext(String(state.next || '/'))
      const profile = req.user || {}
      const email = normalizeEmail(extractEmailFromSaml(profile))
      if (classifyEmail(email) !== 'aluno') {
        return redirectError(res, next, 'Conta SAML invalida.')
      }
      await establishSession(req, sessionUser({
        email,
        displayName: profile.cn || profile.displayName,
        ra: profile.ra || profile.studentId,
        flow: 'aluno',
      }))
      return res.redirect(next)
    } catch (error) {
      return redirectError(res, '/', errorMessage(error, 'Falha no callback SAML.'))
    }
  },
  (error, _req, res, _next) => redirectError(res, '/', errorMessage(error, 'Falha na validacao SAML.')),
)

router.post('/logout', destroySession)
router.get('/logout', (req, res) => destroySession(req, res, true))
router.get('/health', (_req, res) => res.json({ status: 'ok' }))

function sessionUser({ email, displayName = '', ra = '', flow }) {
  return {
    id: email,
    email,
    displayName: String(displayName || ''),
    ra: String(ra || ''),
    flow,
    expiresAt: new Date(Date.now() + Number(process.env.COOKIE_MAX_AGE_MS || 28800000)).toISOString(),
  }
}

async function establishSession(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())))
  req.session.user = user
  await new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())))
}

function destroySession(req, res, redirect = false) {
  req.session.destroy(() => {
    res.clearCookie('crm_session', { domain: process.env.COOKIE_DOMAIN || undefined })
    if (redirect) return res.redirect('/')
    return res.status(204).send()
  })
}

function redirectTo(res, pathname, params) {
  const url = new URL(pathname, appBase())
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value)
  return res.redirect(url.toString())
}

function redirectError(res, next, message) {
  const url = new URL('/login', appBase())
  url.searchParams.set('error', message)
  if (next) url.searchParams.set('next', sanitizeNext(next))
  return res.redirect(url.toString())
}

function errorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback
}

export default router
