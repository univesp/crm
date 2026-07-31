import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import ingressRouter from '../src/routes/ingress.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.UNIVESP_INGRESS_SHARED_SECRET
  delete process.env.NODE_ENV
})

test('ingress rejeita sem segredo quando configurado', async () => {
  process.env.UNIVESP_INGRESS_SHARED_SECRET = 'ingress-test-secret'
  process.env.NODE_ENV = 'production'
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called')
  }

  const handler = ingressRouter.stack.find((layer) => layer.route?.path === '/tickets')?.route
  assert.ok(handler)
  const postHandler = handler.stack.find((layer) => layer.method === 'post')?.handle
  assert.ok(postHandler)

  const req = { get: (name) => (name === 'x-request-id' ? 'req-ingress-1' : ''), body: {} }
  const res = createMockRes()
  await postHandler(req, res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error.code, 'INGRESS_UNAUTHORIZED')
})

function createMockRes() {
  const res = { statusCode: 0, headers: {}, body: null }
  res.setHeader = (key, value) => {
    res.headers[key] = value
  }
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    res.body = payload
    return res
  }
  return res
}
