import { buildAdminDashboardView } from '@/services/adminDashboardRuntime'

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function parseDate(value = '') {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildTicketAuditQuery(filters = {}) {
  const params = {
    page: filters.page || 1,
    page_size: filters.pageSize || 25,
  }

  if (filters.search) params.q = filters.search
  if (filters.protocol) params.protocol = filters.protocol
  if (filters.student) params.student = filters.student
  if (filters.polo) params.polo = filters.polo
  if (filters.theme) params.theme = filters.theme
  if (filters.queue) params.queue = filters.queue
  if (filters.actionType) params.action_type = filters.actionType
  if (filters.actor) params.actor = filters.actor
  if (filters.dateFrom) params.date_from = filters.dateFrom
  if (filters.dateTo) params.date_to = filters.dateTo

  return params
}

export function filterAuditEntriesLocally(entries = [], filters = {}) {
  const dateFrom = parseDate(filters.dateFrom)
  const dateTo = parseDate(filters.dateTo)
  const search = normalizeText(filters.search || filters.protocol || filters.student)

  return entries.filter((entry) => {
    if (search) {
      const haystack = [
        entry.caseId,
        entry.subject,
        entry.student,
        entry.polo,
        entry.theme,
        entry.actor,
        entry.actionLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(search)) {
        return false
      }
    }

    if (filters.polo && normalizeText(entry.polo) !== normalizeText(filters.polo)) {
      return false
    }

    if (filters.theme && normalizeText(entry.theme) !== normalizeText(filters.theme)) {
      return false
    }

    if (filters.queue && normalizeText(entry.queue) !== normalizeText(filters.queue)) {
      return false
    }

    if (filters.actionType && normalizeText(entry.actionType) !== normalizeText(filters.actionType)) {
      return false
    }

    if (filters.actor && normalizeText(entry.actor) !== normalizeText(filters.actor)) {
      return false
    }

    const occurredAt = parseDate(entry.occurredAt)
    if (dateFrom && occurredAt && occurredAt < dateFrom) {
      return false
    }

    if (dateTo && occurredAt) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      if (occurredAt > end) {
        return false
      }
    }

    return true
  })
}

export function paginateAuditEntries(entries = [], page = 1, pageSize = 25) {
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

export function buildMockAuditPage({ dashboardData = {}, filters = {}, page = 1, pageSize = 25 }) {
  const view = buildAdminDashboardView(dashboardData, filters)
  const filtered = filterAuditEntriesLocally(view.auditEntries || [], filters)
  return paginateAuditEntries(filtered, page, pageSize)
}

export function mapApiAuditRow(row = {}) {
  return {
    id: row.id || `${row.protocol || row.case_id}-${row.occurred_at || row.created_at}`,
    caseId: row.protocol || row.case_id || row.ticket_id || '',
    actor: row.actor || row.user_name || 'Operador',
    actionType: row.action_type || row.action || '',
    actionLabel: row.action_label || row.action || 'Acao operacional',
    occurredAt: row.occurred_at || row.created_at,
    occurredAtLabel: row.occurred_at_label || row.created_at_label || '',
    statusBefore: row.status_before || 'Nao informado',
    statusAfter: row.status_after || row.status || 'Nao informado',
    queueBefore: row.queue_before || 'Nao informado',
    queueAfter: row.queue_after || row.queue || 'Nao informado',
    subject: row.subject || `Caso ${row.protocol || row.case_id || ''}`,
    theme: row.theme || 'Nao informado',
    criticality: row.criticality || 'Media',
    student: row.student_name || row.student || 'Nao informado',
    polo: row.polo || 'Nao informado',
    note: row.note || '',
  }
}
