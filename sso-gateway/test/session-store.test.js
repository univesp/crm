import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { createSessionStore } from '../src/lib/session-store.js'

const originalRedisUrl = process.env.GATEWAY_REDIS_URL

after(() => {
  if (originalRedisUrl === undefined) delete process.env.GATEWAY_REDIS_URL
  else process.env.GATEWAY_REDIS_URL = originalRedisUrl
})

test('createSessionStore retorna imediatamente sem bloquear startup', () => {
  delete process.env.GATEWAY_REDIS_URL

  const startedAt = Date.now()
  const sessions = createSessionStore()
  const elapsedMs = Date.now() - startedAt

  assert.equal(sessions.store, undefined)
  assert.ok(typeof sessions.close === 'function')
  assert.ok(elapsedMs < 50, `createSessionStore bloqueou por ${elapsedMs}ms`)
})
