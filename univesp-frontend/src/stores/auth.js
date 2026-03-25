import { computed, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'

import {
  buildAzureStartUrl,
  buildSamlStartUrl,
  buildSsoStartUrl,
  fetchCurrentSsoUser,
  getPublicAppPath,
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

  function getLoginUrl(redirectTo, email = '') {
    return buildSsoStartUrl({
      email,
      next: normalizeInternalRouteTarget(redirectTo),
    })
  }

  function getDirectAccessUrl(flow, redirectTo) {
    const next = normalizeInternalRouteTarget(redirectTo)
    if (flow === 'admin' || flow === 'academico') {
      return buildAzureStartUrl({ tenant: flow, next })
    }
    return buildSamlStartUrl({ next })
  }

  async function redirectToLogin(redirectTo, email = '') {
    status.value = 'redirecting'
    window.location.assign(getLoginUrl(redirectTo, email))
  }

  async function logout(redirectTo = '/login') {
    const targetRoute = normalizeInternalRouteTarget(redirectTo, '/login')
    status.value = 'loading'
    try {
      await logoutFromSso(user.value?.email || '')
    } catch {
      // The frontend should still return to the login screen even if the gateway logout fails.
    } finally {
      user.value = null
      sessionLoaded.value = false
      status.value = 'anonymous'
      window.location.assign(getPublicAppPath(targetRoute))
    }
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
    loadSession,
    clearError,
    getLoginUrl,
    getDirectAccessUrl,
    redirectToLogin,
    logout,
  }
})
