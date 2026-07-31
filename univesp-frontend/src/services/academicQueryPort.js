/** Stub frontend — consultas academicas (Fase D). */

import { appRequest } from '@/services/appApi'

export async function fetchStudentAcademicSummary(ra) {
  const normalized = String(ra || '').trim()
  if (!normalized) {
    return { status: 'unavailable', message: 'RA obrigatorio.' }
  }
  const response = await appRequest(`/students/${encodeURIComponent(normalized)}/academic-summary`)
  return response.data?.summary ?? response.data
}

export async function fetchCurrentDisciplines(ra) {
  const normalized = String(ra || '').trim()
  if (!normalized) {
    return []
  }
  const response = await appRequest(`/students/${encodeURIComponent(normalized)}/academic-summary`)
  return response.data?.disciplines ?? []
}
