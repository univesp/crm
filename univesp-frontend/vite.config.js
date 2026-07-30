import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayTarget = env.VITE_SSO_GATEWAY_PROXY_TARGET || ''
  const proxiedPaths = ['/api']
  const mockRuntimeEnabled = ['1', 'true', 'yes', 'on'].includes(
    String(env.VITE_ENABLE_MOCKS || '').trim().toLowerCase(),
  )
  const devBypassEnabled = ['1', 'true', 'yes', 'on'].includes(
    String(env.VITE_SSO_DEV_BYPASS || '').trim().toLowerCase(),
  )

  if (mode === 'production' && mockRuntimeEnabled) {
    throw new Error('VITE_ENABLE_MOCKS must be false for a production build.')
  }

  if (mode === 'production' && devBypassEnabled) {
    throw new Error('VITE_SSO_DEV_BYPASS must be false for a production build.')
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
    plugins: [
      vue(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
        },
        manifest: {
          name: 'UNIVESP Atendimento',
          short_name: 'UNIVESP',
          description: 'Portal de atendimento UNIVESP — shell offline para OP/BPO',
          start_url: '/crm/',
          display: 'standalone',
          background_color: '#0f172a',
          theme_color: '#1e40af',
          lang: 'pt-BR',
        },
      }),
    ],
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
