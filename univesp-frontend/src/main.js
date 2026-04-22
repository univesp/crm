import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

import App from '@/App.vue'
import '@/index.css'
import routes from '@/router'
import { canAccessRouteWithMockContext } from '@/services/mockContextRuntime'
import { getDefaultAuthenticatedRoute, normalizeInternalRouteTarget } from '@/services/ssoClient'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
const pinia = createPinia()
const routerBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_APP_BASE || '/'
const router = createRouter({
  history: createWebHistory(routerBase),
  routes,
})
const CHUNK_RELOAD_GUARD_KEY = 'univesp-router-chunk-reload'

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)
  const requiresAuth = to.meta.requiresAuth === true
  const publicOnly = to.meta.publicOnly === true
  const fallbackRoute = auth.defaultAppRoute || getDefaultAuthenticatedRoute()
  const localAccessRedirect = {
    name: 'local-access',
    query: {
      redirect: normalizeInternalRouteTarget(to.fullPath),
    },
  }

  if (publicOnly) {
    if (to.name === 'login' && auth.hasLocalBypass) {
      return localAccessRedirect
    }

    await auth.loadSession()
    if (auth.isAuthenticated) {
      const redirectTo = normalizeInternalRouteTarget(String(to.query.redirect || fallbackRoute))
      return redirectTo === '/login' ? fallbackRoute : redirectTo
    }
    return true
  }

  if (!requiresAuth) {
    return true
  }

  await auth.loadSession()
  if (auth.isAuthenticated) {
    if (to.path === '/') {
      return auth.defaultAppRoute
    }

    if (!canAccessRouteWithMockContext(to.meta || {}, auth.mockContext)) {
      return auth.defaultAppRoute
    }

    return true
  }

  if (auth.hasLocalBypass) {
    return localAccessRedirect
  }

  return {
    name: 'login',
    query: {
      redirect: normalizeInternalRouteTarget(to.fullPath),
    },
  }
})

router.afterEach(() => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage?.removeItem(CHUNK_RELOAD_GUARD_KEY)
})

router.onError((error, to) => {
  if (typeof window === 'undefined') {
    return
  }

  const message = String(error?.message || '')
  const isChunkLoadError =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.toLowerCase().includes('dynamically imported')

  if (!isChunkLoadError) {
    console.error(error)
    return
  }

  if (window.sessionStorage?.getItem(CHUNK_RELOAD_GUARD_KEY) === '1') {
    window.sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY)
    console.error(error)
    const recoveryHref = router.resolve({ name: 'local-access' }).href
    window.location.assign(recoveryHref)
    return
  }

  window.sessionStorage?.setItem(CHUNK_RELOAD_GUARD_KEY, '1')
  window.location.assign(to.fullPath)
})

app.use(pinia)
app.use(router)
app.mount('#app')
