import { getTicket } from '@/services/appApi'

const MIN_QUERY_LENGTH = 3

export function canSearchProtocol(query = '') {
  return String(query || '').trim().length >= MIN_QUERY_LENGTH
}

export function resolveProtocolDetailRoute(profileKey = '') {
  if (['analista_area', 'gestor_area'].includes(profileKey)) {
    return (protocolId) => ({
      name: 'area-case-detail',
      params: { caseId: protocolId },
    })
  }

  if (['op', 'gestor_polos'].includes(profileKey)) {
    return (protocolId) => ({
      name: 'operator-case-detail',
      params: { caseId: protocolId },
    })
  }

  return (protocolId) => ({
    name: 'admin-protocol-detail',
    params: { protocolId },
  })
}

export async function searchProtocolByExactId(query = '') {
  const normalized = String(query || '').trim()
  if (!canSearchProtocol(normalized)) {
    return {
      ok: false,
      error: 'Digite pelo menos 3 caracteres do numero do protocolo.',
    }
  }

  try {
    const response = await getTicket(normalized)
    const ticket = response.data || {}
    const protocolId = ticket.protocol || ticket.id || normalized
    return {
      ok: true,
      protocolId,
      ticket,
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Protocolo nao encontrado.',
    }
  }
}

export function matchesLocalProtocolSearch(entry = {}, query = '') {
  const normalized = String(query || '').trim().toLowerCase()
  if (!normalized) {
    return true
  }

  const haystack = [
    entry.id,
    entry.protocolNumber,
    entry.subject,
    entry.student,
    entry.studentData?.nome,
    entry.studentData?.ra,
    entry.studentData?.email,
    entry.polo,
    entry.studentData?.polo,
    entry.theme,
    entry.subsubject,
    entry.queue,
    entry.queueLabel,
    entry.status,
    entry.statusLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(normalized)
}
