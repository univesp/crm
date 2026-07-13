import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'

import { createApp } from '../src/app.js'

let server
let origin

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
