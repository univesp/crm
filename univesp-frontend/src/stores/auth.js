import { computed, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'

import {
  buildAzureLoginUrl,
  fetchCurrentSsoUser,
  getPublicAppPath,
  isAzureConfigured,
  logoutFromSso,
  normalizeInternalRouteTarget,
} from '@/services/ssoClient'
import { useJourneyStore } from '@/stores/journey'

export const useAuthStore = defineStore('auth', () => {
  const status = ref('idle')
  const user = ref(null)
  const errorMessage = ref('')
  const sessionLoaded = ref(false)

  const isLoading = computed(() => status.value === 'loading' || status.value === 'redirecting')
  const isAuthenticated = computed(() => status.value === 'authenticated' && !!user.value)
  const isAnonymous = computed(() => status.value === 'anonymous')
  const displayName = computed(() => user.value?.displayName || user.value?.email || '')
  const azureReady = computed(() => isAzureConfigured())

  async function loadSession({ force = false } = {}) {
    if (sessionLoaded.value && !force) {
      return user.value
    }

    status.value = 'loading'
    errorMessage.value = ''

    try {
      const currentUser = await fetchCurrentSsoUser()
      sessionLoaded.value = true

      if (!currentUser) {
        user.value = null
        status.value = 'anonymous'
        return null
      }

      user.value = currentUser
      status.value = 'authenticated'
      const activePinia = getActivePinia()
      if (activePinia) {
        useJourneyStore(activePinia).applyAuthenticatedUser(currentUser)
      }
      return currentUser
    } catch {
      sessionLoaded.value = true
      user.value = null
      status.value = 'anonymous'
      errorMessage.value = ''
      return null
    }
  }

  function clearError() {
    errorMessage.value = ''
  }

  function getLoginUrl(flow, redirectTo) {
    try {
      return buildAzureLoginUrl({ next: normalizeInternalRouteTarget(redirectTo), flow })
    } catch {
      return `${window.location.origin}/login`
    }
  }

  function getDirectAccessUrl(flow, redirectTo) {
    return getLoginUrl(flow, redirectTo)
  }

  async function redirectToLogin(redirectTo, flow = 'admin') {
    status.value = 'redirecting'
    errorMessage.value = ''

    try {
      const url = buildAzureLoginUrl({
        next: normalizeInternalRouteTarget(redirectTo),
        flow,
      })
      window.location.assign(url)
    } catch (err) {
      status.value = 'anonymous'
      errorMessage.value = err.message || 'Falha ao iniciar login SSO.'
    }
  }

  async function logout(redirectTo = '/login') {
    const targetRoute = normalizeInternalRouteTarget(redirectTo, '/login')
    status.value = 'loading'
    try {
      const result = logoutFromSso()
      // Se o logout ja redirecionou para o Azure, nao precisamos fazer nada
      if (result?.redirected) {
        return
      }
    } catch {
      // Continua para limpar estado local
    } finally {
      user.value = null
      sessionLoaded.value = false
      status.value = 'anonymous'
    }
    window.location.assign(getPublicAppPath(targetRoute))
  }

  return {
    status,
    user,
    errorMessage,
    sessionLoaded,
    isLoading,
    isAuthenticated,
    isAnonymous,
    displayName,
    azureReady,
    loadSession,
    clearError,
    getLoginUrl,
    getDirectAccessUrl,
    redirectToLogin,
    logout,
  }
})
