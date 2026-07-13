import 'dotenv/config'

import { createApp } from './app.js'
import { createSessionStore } from './lib/session-store.js'

const port = Number(process.env.PORT) || 4000
const sessions = await createSessionStore()
const server = createApp({ sessionStore: sessions.store }).listen(port, '127.0.0.1', () => {
  console.log(`[SSO] Gateway ativo em http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await sessions.close()
      process.exit(0)
    })
  })
}
