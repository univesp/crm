import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'

export function createSessionStore() {
  const url = String(process.env.GATEWAY_REDIS_URL || '').trim()
  if (!url) return { store: undefined, close: async () => {} }

  const client = createClient({
    url,
    socket: {
      connectTimeout: Number(process.env.GATEWAY_REDIS_CONNECT_TIMEOUT_MS || 10000),
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  })
  client.on('error', (error) => console.error('[SSO] Redis:', error.message))

  void client.connect().catch((error) => {
    console.error('[SSO] Redis connect failed:', error.message)
  })

  return {
    store: new RedisStore({ client, prefix: 'univesp:crm:session:' }),
    close: async () => {
      if (client.isOpen) await client.quit()
    },
  }
}
