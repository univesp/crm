import 'dotenv/config'

import { createApp } from './app.js'
import { createSessionStore } from './lib/session-store.js'

const port = Number(process.env.PORT) || 4000
const host = process.env.HOST || '0.0.0.0'
const sessions = await createSessionStore()
const server = createApp({ sessionStore: sessions.store }).listen(port, host, () => {
  console.log(`[SSO] Gateway ativo em http://${host}:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await sessions.close()
      process.exit(0)
    })
  })
}
