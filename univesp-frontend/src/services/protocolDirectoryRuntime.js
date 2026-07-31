import { matchesLocalProtocolSearch } from '@/services/protocolSearchRuntime'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function parseDate(value = '') {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function entryDate(entry = {}) {
  return parseDate(entry.updatedAt || entry.createdAt)
}

export function buildProtocolFilterOptions(entries = []) {
  const unique = (values = []) =>
    Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
      String(left).localeCompare(String(right), 'pt-BR', { sensitivity: 'base' }),
    )

  return {
    polos: unique(entries.map((entry) => entry.polo || entry.studentData?.polo)),
    themes: unique(entries.map((entry) => entry.theme)),
    queues: unique(entries.map((entry) => entry.queue || entry.queueLabel)),
    criticalities: unique(entries.map((entry) => entry.criticality || entry.priorityLabel)),
    statuses: unique(entries.map((entry) => entry.status || entry.statusLabel)),
  }
}

export function filterProtocolEntries(entries = [], filters = {}) {
  const dateFrom = parseDate(filters.dateFrom)
  const dateTo = parseDate(filters.dateTo)

  return entries.filter((entry) => {
    if (!matchesLocalProtocolSearch(entry, filters.search || filters.student)) {
      return false
    }

    if (filters.polo && normalizeText(entry.polo || entry.studentData?.polo) !== normalizeText(filters.polo)) {
      return false
    }

    if (filters.theme && normalizeText(entry.theme) !== normalizeText(filters.theme)) {
      return false
    }

    if (
      filters.queue &&
      normalizeText(entry.queue || entry.queueLabel) !== normalizeText(filters.queue)
    ) {
      return false
    }

    if (
      filters.criticality &&
      normalizeText(entry.criticality || entry.priorityLabel) !== normalizeText(filters.criticality)
    ) {
      return false
    }

    if (
      filters.status &&
      normalizeText(entry.status || entry.statusLabel) !== normalizeText(filters.status)
    ) {
      return false
    }

    const updatedAt = entryDate(entry)
    if (dateFrom && updatedAt && updatedAt < dateFrom) {
      return false
    }

    if (dateTo && updatedAt) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      if (updatedAt > end) {
        return false
      }
    }

    return true
  })
}

export function paginateEntries(entries = [], page = 1, pageSize = 25) {
  const safePage = Math.max(1, Number(page) || 1)
  const safeSize = Math.max(1, Number(pageSize) || 25)
  const start = (safePage - 1) * safeSize
  return {
    items: entries.slice(start, start + safeSize),
    total: entries.length,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil(entries.length / safeSize)),
  }
}

export function mapTicketListRow(ticket = {}) {
  const student = ticket.student || {}
  return {
    id: ticket.protocol || ticket.id,
    protocolNumber: ticket.protocol || ticket.id,
    subject: ticket.subject || 'Atendimento sem assunto',
    student: student.name || 'Aluno nao informado',
    studentData: {
      nome: student.name || '',
      ra: student.ra || '',
      email: student.email || '',
      polo: student.polo || '',
    },
    polo: student.polo || 'Nao informado',
    theme: ticket.theme || ticket.subject_theme || 'Nao informado',
    queue: ticket.queue || '',
    queueLabel: ticket.queue || '',
    criticality: ticket.priority_label || ticket.priority || 'Media',
    priorityLabel: ticket.priority_label || ticket.priority || 'Media',
    status: ticket.status_label || ticket.status || 'Aberto',
    statusLabel: ticket.status_label || ticket.status || 'Aberto',
    sla: ticket.sla_label || ticket.sla || 'SLA nao calculado',
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at || ticket.created_at,
  }
}
