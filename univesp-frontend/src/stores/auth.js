import { computed, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'

import { buildMockAccessContext } from '@/services/mockContextRuntime'
import {
  buildAzureStartUrl,
  buildSamlStartUrl,
  buildSsoStartUrl,
  clearSelectedDevBypassProfile,
  fetchCurrentSsoUser,
  getDevBypassProfiles,
  getPublicAppPath,
  getSelectedDevBypassProfile,
  hasSsoDevBypass,
  isAzureConfigured,
  logoutFromSso,
  normalizeInternalRouteTarget,
  setSelectedDevBypassProfile,
} from '@/services/ssoClient'
import { useJourneyStore } from '@/stores/journey'

export const useAuthStore = defineStore('auth', () => {
  const status = ref('idle')
  const user = ref(null)
  const errorMessage = ref('')
  const sessionLoaded = ref(false)
  const selectedOperationalPolo = ref('')
  const selectedOperationalArea = ref('')

  const isLoading = computed(() => status.value === 'loading' || status.value === 'redirecting')
  const isAuthenticated = computed(() => status.value === 'authenticated' && !!user.value)
  const isAnonymous = computed(() => status.value === 'anonymous')
  const displayName = computed(() => user.value?.displayName || user.value?.email || '')
  const azureReady = computed(() => isAzureConfigured())
  const hasLocalBypass = computed(() => hasSsoDevBypass())
  const localBypassProfiles = computed(() => getDevBypassProfiles())
  const selectedLocalBypassProfile = computed(() => getSelectedDevBypassProfile())
  const mockContext = computed(() => {
    const baseContext = buildMockAccessContext(user.value)

    if (
      baseContext.isOperationalShell &&
      selectedOperationalPolo.value &&
      baseContext.linkedPolos.includes(selectedOperationalPolo.value)
    ) {
      return {
        ...baseContext,
        currentPolo: selectedOperationalPolo.value,
      }
    }

    if (
      baseContext.isOperationalShell &&
      selectedOperationalArea.value &&
      baseContext.linkedAreas.includes(selectedOperationalArea.value)
    ) {
      return {
        ...baseContext,
        currentArea: selectedOperationalArea.value,
      }
    }

    return baseContext
  })
  const defaultAppRoute = computed(() => mockContext.value.defaultRoute || '/')

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
    } catch (error) {
      sessionLoaded.value = true
      user.value = null
      status.value = 'anonymous'
      errorMessage.value = error?.message || ''
      return null
    }
  }

  function clearError() {
    errorMessage.value = ''
  }

  function getLoginUrl(flow = '', redirectTo = '', email = '') {
    const targetRoute = normalizeInternalRouteTarget(redirectTo, defaultAppRoute.value)

    try {
      if (flow === 'aluno') {
        return buildSamlStartUrl({ next: targetRoute })
      }

      if (flow === 'admin' || flow === 'academico') {
        return buildAzureStartUrl({ flow, next: targetRoute })
      }

      return buildSsoStartUrl({
        email,
        flow,
        next: targetRoute,
      })
    } catch {
      return getPublicAppPath('/login')
    }
  }

  function getDirectAccessUrl(flow = '', redirectTo = '', email = '') {
    return getLoginUrl(flow, redirectTo, email)
  }

  async function redirectToLogin(redirectTo = '', flow = '', email = '') {
    status.value = 'redirecting'
    errorMessage.value = ''

    try {
      const url = getLoginUrl(flow, redirectTo, email)
      window.location.assign(url)
    } catch (error) {
      status.value = 'anonymous'
      errorMessage.value = error?.message || 'Falha ao iniciar o acesso institucional.'
    }
  }

  async function activateLocalBypassProfile(profileKey, redirectTo = '') {
    const profile = setSelectedDevBypassProfile(profileKey)
    if (!profile) {
      return null
    }

    await loadSession({ force: true })
    const targetRoute = normalizeInternalRouteTarget(redirectTo, profile.route || '/')
    window.location.assign(getPublicAppPath(targetRoute))
    return user.value
  }

  function clearLocalBypassProfile() {
    clearSelectedDevBypassProfile()
    user.value = null
    sessionLoaded.value = false
    status.value = 'anonymous'
    selectedOperationalPolo.value = ''
    selectedOperationalArea.value = ''
  }

  function setSelectedOperationalPolo(polo = '') {
    const baseContext = buildMockAccessContext(user.value)
    const normalized = String(polo || '').trim()

    if (!baseContext.isOperationalShell) {
      return
    }

    if (!normalized) {
      selectedOperationalPolo.value = ''
      return
    }

    if (baseContext.linkedPolos.includes(normalized)) {
      selectedOperationalPolo.value = normalized
    }
  }

  function setSelectedOperationalArea(area = '') {
    const baseContext = buildMockAccessContext(user.value)
    const normalized = String(area || '').trim()

    if (!baseContext.isOperationalShell) {
      return
    }

    if (!normalized) {
      selectedOperationalArea.value = ''
      return
    }

    if (baseContext.linkedAreas.includes(normalized)) {
      selectedOperationalArea.value = normalized
    }
  }

  async function logout(redirectTo = '/login') {
    const bypassRedirect = hasSsoDevBypass() ? '/acesso-local' : '/login'
    const targetRoute = normalizeInternalRouteTarget(redirectTo, bypassRedirect)

    status.value = 'loading'

    try {
      const result = logoutFromSso()
      if (result?.redirected) {
        return
      }
    } catch {
      // Continue to local cleanup.
    } finally {
      clearSelectedDevBypassProfile()
      user.value = null
      sessionLoaded.value = false
      status.value = 'anonymous'
      selectedOperationalPolo.value = ''
      selectedOperationalArea.value = ''
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
    hasLocalBypass,
    localBypassProfiles,
    selectedLocalBypassProfile,
    selectedOperationalPolo,
    selectedOperationalArea,
    mockContext,
    defaultAppRoute,
    loadSession,
    clearError,
    getLoginUrl,
    getDirectAccessUrl,
    redirectToLogin,
    activateLocalBypassProfile,
    clearLocalBypassProfile,
    setSelectedOperationalPolo,
    setSelectedOperationalArea,
    logout,
  }
})
