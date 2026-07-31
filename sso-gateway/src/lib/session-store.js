import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'

export async function createSessionStore() {
  const url = String(process.env.GATEWAY_REDIS_URL || '').trim()
  if (!url) return { store: undefined, close: async () => {} }

  const client = createClient({ url })
  client.on('error', (error) => console.error('[SSO] Redis:', error.message))
  await client.connect()
  return {
    store: new RedisStore({ client, prefix: 'univesp:crm:session:' }),
    close: async () => {
      if (client.isOpen) await client.quit()
    },
  }
}
