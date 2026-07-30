import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { createApp } from '../src/app.js'

let server
let origin
const nativeFetch = globalThis.fetch

before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.SESSION_SECRET = 'session-test-secret'
  server = createApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

test('protege sessao e nao encaminha chamada anonima ao Frappe', async () => {
  const response = await fetch(`${origin}/api/app/v1/tickets`)
  const payload = await response.json()
  assert.equal(response.status, 401)
  assert.equal(payload.error.code, 'SESSION_REQUIRED')
})

test('protege dashboard e biblioteca FAQ contra sessao anonima', async () => {
  for (const [path, options] of [
    ['/api/app/v1/knowledge/library', {}],
    ['/api/app/v1/knowledge/library', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }],
    ['/api/app/v1/knowledge/v3/bundles', {}],
    ['/api/app/v1/knowledge/v3/bundles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }],
    ['/api/app/v1/knowledge/v3/migration/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }],
    ['/api/app/v1/knowledge/v3/migration/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }],
    ['/api/app/v1/knowledge/v3/suggestions', {}],
    ['/api/app/v1/knowledge/v3/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }],
    ['/api/app/v1/knowledge/v3/assets', {}],
    ['/api/app/v1/knowledge/v3/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'asset',
    }],
    ['/api/app/v1/admin/profile-assignments', {}],
    ['/api/app/v1/routing/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }],
    ['/api/app/v1/tickets/UVSP-TESTE/knowledge-applied', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }],
    ['/api/app/v1/knowledge/v3/bundles/acesso-ava/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"version-1"' },
      body: '{}',
    }],
    ['/api/app/v1/admin/runtime-settings', {}],
    ['/api/app/v1/areas/Secretaria%20Academica/governance', {}],
  ]) {
    const response = await fetch(`${origin}${path}`, options)
    const payload = await response.json()
    assert.equal(response.status, 401)
    assert.equal(payload.error.code, 'SESSION_REQUIRED')
  }
})

test('health check permanece independente do Frappe', async () => {
  const response = await fetch(`${origin}/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('responde JSON consistente para corpo invalido', async () => {
  const response = await fetch(`${origin}/api/app/v1/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })
  const payload = await response.json()
  assert.equal(response.status, 400)
  assert.equal(payload.error.code, 'INVALID_JSON')
  assert.ok(payload.request_id)
})

test('responde 413 para JSON acima do limite do gateway', async () => {
  const response = await fetch(`${origin}/api/app/v1/knowledge/library`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'x'.repeat(3 * 1024 * 1024) }),
  })
  const payload = await response.json()
  assert.equal(response.status, 413)
  assert.equal(payload.error.code, 'PAYLOAD_TOO_LARGE')
})

test('bloqueia corpo acima do limite antes do Frappe', async () => {
  process.env.MAX_UPLOAD_BYTES = '1'
  try {
    const response = await fetch(`${origin}/api/app/v1/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'xx',
    })
    const payload = await response.json()
    assert.equal(response.status, 413)
    assert.equal(payload.error.code, 'PAYLOAD_TOO_LARGE')
  } finally {
    delete process.env.MAX_UPLOAD_BYTES
  }
})

test('sessao FAQ publica usa binding HttpOnly e o reaplica no intake', async () => {
  const forwarded = []
  Object.assign(process.env, {
    FRAPPE_ORIGIN: 'https://frappe.invalid',
    FRAPPE_API_KEY: 'gateway-key',
    FRAPPE_API_SECRET: 'gateway-secret',
    UNIVESP_BFF_SHARED_SECRET: 'shared-test-secret',
    UNIVESP_EDGE_SHARED_SECRET: 'a'.repeat(64),
  })
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith(origin)) return nativeFetch(url, options)
    const body = JSON.parse(String(options.body || '{}'))
    forwarded.push({ url: String(url), body })
    const isSession = String(url).includes('start_public_session')
    return new Response(
      JSON.stringify({
        message: {
          data: isSession
            ? {
                faq_session_id: body.payload
                  ? JSON.parse(body.payload).faq_session_id
                  : 'unexpected',
                bundle_key: 'acesso-ava',
                bundle_version_id: 'acesso-ava-homolog-v1',
                persona: 'public',
                path: ['acesso-ava-root'],
              }
            : { intake_id: 'INTAKE-HTTP-1', state: 'ready', upload_token: 'opaque' },
          error: null,
          meta: {},
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const started = await nativeFetch(`${origin}/api/public/v1/knowledge/v3/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundle_key: 'acesso-ava',
        bundle_version_id: 'acesso-ava-homolog-v1',
      }),
    })
    assert.equal(started.status, 201)
    const cookie = started.headers.get('set-cookie')
    assert.match(cookie, /faq_public_binding=/)
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Path=\/api\/public\/v1/i)
    const session = (await started.json()).data

    const intake = await nativeFetch(`${origin}/api/public/v1/intakes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie.split(';', 1)[0] },
      body: JSON.stringify({
        faq_session_id: session.faq_session_id,
        visitor: { nome: 'Visitante' },
      }),
    })
    assert.equal(intake.status, 201)
    const sessionPayload = JSON.parse(forwarded[0].body.payload)
    const intakePayload = JSON.parse(forwarded[1].body.payload)
    assert.match(sessionPayload.faq_session_id, /^[0-9a-f-]{36}$/)
    assert.match(sessionPayload.binding_hash, /^[0-9a-f]{64}$/)
    assert.equal(intakePayload.binding_hash, sessionPayload.binding_hash)
    assert.equal(intakePayload.faq_session_id, session.faq_session_id)
    assert.ok(!cookie.includes(sessionPayload.binding_hash))
  } finally {
    globalThis.fetch = nativeFetch
    for (const name of [
      'FRAPPE_ORIGIN',
      'FRAPPE_API_KEY',
      'FRAPPE_API_SECRET',
      'UNIVESP_BFF_SHARED_SECRET',
      'UNIVESP_EDGE_SHARED_SECRET',
    ]) {
      delete process.env[name]
    }
  }
})
