import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_SSO_GATEWAY_PROXY_TARGET || ''
  const proxiedPaths = ['/api']
  const mockRuntimeEnabled = ['1', 'true', 'yes', 'on'].includes(
    String(env.VITE_ENABLE_MOCKS || '').trim().toLowerCase(),
  )

  if (mode === 'production' && mockRuntimeEnabled) {
    throw new Error('VITE_ENABLE_MOCKS must be false for a production build.')
  }

  const proxy = gatewayTarget
    ? Object.fromEntries(
        proxiedPaths.map((proxyPath) => [
          proxyPath,
          {
            target: gatewayTarget,
            changeOrigin: true,
            secure: false,
          },
        ]),
      )
    : undefined

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
