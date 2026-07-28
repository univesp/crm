import { reactive, ref, unref } from 'vue'
import { useRouter } from 'vue-router'

import {
  canSearchProtocol,
  resolveProtocolDetailRoute,
  searchProtocolByExactId,
} from '@/services/protocolSearchRuntime'

export function useProtocolSearch(profileKeyRef = null) {
  const router = useRouter()
  const query = ref('')
  const loading = ref(false)
  const error = ref('')

  async function submit() {
    const normalized = String(query.value || '').trim()
    if (!canSearchProtocol(normalized)) {
      error.value = 'Digite pelo menos 3 caracteres do numero do protocolo.'
      return false
    }

    loading.value = true
    error.value = ''

    const result = await searchProtocolByExactId(normalized)
    loading.value = false

    if (!result.ok) {
      error.value = result.error
      return false
    }

    const profileKey = unref(profileKeyRef) || ''
    const target = resolveProtocolDetailRoute(profileKey)(result.protocolId)
    await router.push(target)
    query.value = ''
    return true
  }

  return {
    query,
    loading,
    error,
    submit,
    canSubmit: () => canSearchProtocol(query.value),
  }
}

export function createProtocolFilterState(initial = {}) {
  return reactive({
    search: initial.search || '',
    student: initial.student || '',
    polo: initial.polo || '',
    theme: initial.theme || '',
    queue: initial.queue || '',
    criticality: initial.criticality || '',
    status: initial.status || '',
    dateFrom: initial.dateFrom || '',
    dateTo: initial.dateTo || '',
    page: initial.page || 1,
    pageSize: initial.pageSize || 25,
  })
}

export function buildProtocolListQuery(filters = {}) {
  const params = {
    page: filters.page,
    page_size: filters.pageSize,
  }

  if (filters.search) params.protocol = filters.search
  if (filters.student) params.student = filters.student
  if (filters.polo) params.polo = filters.polo
  if (filters.theme) params.theme = filters.theme
  if (filters.queue) params.queue = filters.queue
  if (filters.criticality) params.criticality = filters.criticality
  if (filters.status) params.status = filters.status
  if (filters.dateFrom) params.date_from = filters.dateFrom
  if (filters.dateTo) params.date_to = filters.dateTo

  return params
}
