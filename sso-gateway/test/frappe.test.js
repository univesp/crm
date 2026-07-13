import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { afterEach, test } from 'node:test'

import { buildSignedContext, callFrappe, FrappeApiError } from '../src/lib/frappe.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const name of ['FRAPPE_API_KEY', 'FRAPPE_API_SECRET', 'UNIVESP_BFF_SHARED_SECRET']) {
    delete process.env[name]
  }
})

test('assina identidade sem expor o segredo', () => {
  process.env.UNIVESP_BFF_SHARED_SECRET = 'shared-test-secret'
  const headers = buildSignedContext(
    { email: 'Student@Example.edu', displayName: 'Student', ra: '123', flow: 'aluno' },
    'request-123',
    1700000000,
  )
  const expected = createHmac('sha256', 'shared-test-secret')
    .update(`1700000000.${headers['X-Univesp-User-Context']}`)
    .digest('hex')
  const payload = JSON.parse(Buffer.from(headers['X-Univesp-User-Context'], 'base64url'))

  assert.equal(headers['X-Univesp-Signature'], expected)
  assert.equal(headers['X-Request-ID'], 'request-123')
  assert.equal(payload.email, 'student@example.edu')
  assert.equal(payload.flow, 'aluno')
})

test('chama somente o metodo institucional com conta tecnica e contexto assinado', async () => {
  process.env.FRAPPE_API_KEY = 'gateway-key'
  process.env.FRAPPE_API_SECRET = 'gateway-secret'
  process.env.UNIVESP_BFF_SHARED_SECRET = 'shared-test-secret'
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /univesp_atendimento\.api\.v1\.tickets\.list_tickets/)
    assert.equal(options.headers.Authorization, 'token gateway-key:gateway-secret')
    assert.ok(options.headers['X-Univesp-Signature'])
    return new Response(JSON.stringify({ message: { data: [{ id: 'HD-TCK-1' }], error: null } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await callFrappe('tickets.list_tickets', {
    user: { email: 'student@example.edu', flow: 'aluno' },
    requestId: 'request-456',
  })
  assert.equal(result.data[0].id, 'HD-TCK-1')
})

test('falha fechada quando a credencial tecnica nao esta configurada', async () => {
  process.env.UNIVESP_BFF_SHARED_SECRET = 'shared-test-secret'
  await assert.rejects(
    () => callFrappe('tickets.list_tickets', { user: { email: 'student@example.edu' } }),
    (error) => error instanceof FrappeApiError && error.code === 'BFF_CONFIG_ERROR',
  )
})
