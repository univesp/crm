import { ref } from 'vue'

import { AppApiError } from '@/services/appApi'

/** Evita exibir JSON cru ou mensagens tecnicas para o usuario final. */
export function friendlyError(err, fallback) {
  if (err instanceof AppApiError) {
    return err.message?.trim() || fallback
  }

  if (!(err instanceof Error)) {
    return fallback
  }

  const message = err.message.trim()
  if (!message) {
    return fallback
  }

  if (message.startsWith('{') || message.startsWith('[') || message.includes('"error":')) {
    return fallback
  }

  if (/^(GET|POST|PUT|PATCH|DELETE)\s/i.test(message) || message.includes('fetch failed')) {
    return fallback
  }

  return message
}

export function useAsyncAction() {
  const loading = ref(false)
  const error = ref('')
  const success = ref('')

  async function run(action, options = {}) {
    loading.value = true
    if (options.resetError !== false) {
      error.value = ''
    }
    if (options.resetSuccess !== false) {
      success.value = ''
    }

    try {
      const result = await action()
      if (options.successMessage) {
        success.value = options.successMessage
      }
      return result
    } catch (err) {
      error.value = friendlyError(
        err,
        options.errorFallback || 'Nao foi possivel concluir. Tente novamente.',
      )
      return undefined
    } finally {
      loading.value = false
    }
  }

  function reset() {
    loading.value = false
    error.value = ''
    success.value = ''
  }

  return {
    loading,
    error,
    success,
    run,
    reset,
    clearError: () => {
      error.value = ''
    },
    clearSuccess: () => {
      success.value = ''
    },
    setError: (message) => {
      error.value = message
    },
    setSuccess: (message) => {
      success.value = message
    },
  }
}
