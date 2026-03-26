import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

import App from '@/App.vue'
import '@/index.css'
import routes from '@/router'
import { getDefaultAuthenticatedRoute, normalizeInternalRouteTarget } from '@/services/ssoClient'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
const pinia = createPinia()
const routerBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_APP_BASE || '/'
const router = createRouter({
  history: createWebHistory(routerBase),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia)
  const requiresAuth = to.meta.requiresAuth === true
  const publicOnly = to.meta.publicOnly === true
  const fallbackRoute = getDefaultAuthenticatedRoute()

  if (publicOnly) {
    await auth.loadSession()
    if (auth.isAuthenticated) {
      const redirectTo = normalizeInternalRouteTarget(String(to.query.redirect || fallbackRoute))
      return redirectTo === '/sso' ? fallbackRoute : redirectTo
    }
    return true
  }

  if (!requiresAuth) {
    return true
  }

  await auth.loadSession()
  if (auth.isAuthenticated) {
    return true
  }

  return {
    name: 'login',
    query: {
      redirect: normalizeInternalRouteTarget(to.fullPath),
    },
  }
})

app.use(pinia)
app.use(router)
app.mount('#app')
