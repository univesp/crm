import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_FRAPPE_PROXY_TARGET || ''
  const socketTarget = env.VITE_FRAPPE_SOCKETIO_TARGET || backendTarget
  const proxiedPaths = [
    '/api',
    '/login',
    '/logout',
    '/consume',
    '/oauth',
    '/assets',
    '/files',
  ]

  const proxy = backendTarget
    ? Object.fromEntries(
        proxiedPaths.map((proxyPath) => [
          proxyPath,
          {
            target: backendTarget,
            changeOrigin: true,
            secure: false,
          },
        ]),
      )
    : undefined

  if (proxy && socketTarget) {
    proxy['/socket.io'] = {
      target: socketTarget,
      changeOrigin: true,
      secure: false,
      ws: true,
    }
  }

  return {
    base: env.VITE_APP_BASE || '/',
    build: {
      assetsDir: env.VITE_ASSETS_DIR || 'univesp-assets',
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: env.VITE_DEV_HOST || '0.0.0.0',
      port: Number(env.VITE_DEV_PORT || 4176),
      strictPort: true,
      proxy,
    },
    preview: {
      host: env.VITE_PREVIEW_HOST || '0.0.0.0',
      port: Number(env.VITE_PREVIEW_PORT || 4177),
      strictPort: true,
    },
  }
})
