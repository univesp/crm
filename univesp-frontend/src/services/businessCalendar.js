const DEFAULT_WEEKLY_OFF = [0, 6]

function toDate(value) {
  if (value instanceof Date) {
    return new Date(value.getTime())
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data inicial invalida para calendario institucional.')
  }
  return parsed
}

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function expandEntryDates(entry) {
  const startKey = String(entry?.date || '').trim()
  if (!startKey) return []

  const endKey = String(entry?.endDate || entry?.date || '').trim() || startKey
  const start = new Date(`${startKey}T12:00:00`)
  const end = new Date(`${endKey}T12:00:00`)
  if (Number.isNaN(start.getTime())) return []
  if (Number.isNaN(end.getTime()) || end < start) return [startKey]

  const dates = []
  const cursor = new Date(start.getTime())
  while (cursor <= end) {
    dates.push(dateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function normalizeCalendar(calendar = {}) {
  const weeklyOff = Array.isArray(calendar.weeklyOff) && calendar.weeklyOff.length
    ? calendar.weeklyOff.map((item) => Number(item))
    : DEFAULT_WEEKLY_OFF
  const entries = Array.isArray(calendar.entries) ? calendar.entries : []
  const businessHours =
    calendar.businessHours &&
    typeof calendar.businessHours === 'object' &&
    calendar.businessHours.start &&
    calendar.businessHours.end
      ? {
          start: String(calendar.businessHours.start),
          end: String(calendar.businessHours.end),
        }
      : { start: '09:00', end: '18:00' }
  const byDate = new Map()

  for (const entry of entries) {
    const type = String(entry.type || 'holiday').trim() || 'holiday'
    const label = String(entry.label || entry.description || '').trim()
    for (const key of expandEntryDates(entry)) {
      byDate.set(key, { date: key, type, label })
    }
  }

  return { weeklyOff, businessHours, byDate }
}

export function isWeekend(date, calendar) {
  const normalized = normalizeCalendar(calendar)
  return normalized.weeklyOff.includes(toDate(date).getDay())
}

export function getCalendarEntry(date, calendar) {
  const normalized = normalizeCalendar(calendar)
  return normalized.byDate.get(dateKey(toDate(date))) || null
}

export function isBusinessDay(date, calendar) {
  const current = toDate(date)
  if (isWeekend(current, calendar)) {
    return false
  }
  return !getCalendarEntry(current, calendar)
}

export function addBusinessDays(startAt, businessDays, calendar) {
  const days = Number(businessDays)
  if (!Number.isFinite(days) || days < 0) {
    throw new Error('Quantidade de dias uteis invalida.')
  }

  const cursor = toDate(startAt)
  let remaining = Math.floor(days)

  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1)
    if (isBusinessDay(cursor, calendar)) {
      remaining -= 1
    }
  }

  return cursor
}

export function resolveDueAt(slaLevel, startAt, calendar) {
  if (!slaLevel || typeof slaLevel !== 'object') {
    return null
  }

  const start = toDate(startAt)

  if (Number.isFinite(Number(slaLevel.businessDays)) && Number(slaLevel.businessDays) > 0) {
    return addBusinessDays(start, Number(slaLevel.businessDays), calendar)
  }

  if (Number.isFinite(Number(slaLevel.hours)) && Number(slaLevel.hours) > 0) {
    return new Date(start.getTime() + Number(slaLevel.hours) * 60 * 60 * 1000)
  }

  return null
}

export function findSlaLevel(slaLevels = [], slaKey) {
  const normalized = String(slaKey || '').trim()
  if (!normalized) return null
  return slaLevels.find((level) => String(level.key || '').trim() === normalized) || null
}

export function formatDueLabel(dueAt, now = new Date()) {
  if (!dueAt) return 'SLA nao calculado'
  const due = toDate(dueAt)
  const diffMs = due.getTime() - toDate(now).getTime()
  if (diffMs < 0) {
    return 'Vencido'
  }
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000))
  if (diffHours <= 4) {
    return `${diffHours}h restantes`
  }
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
  return `${diffDays}d restantes`
}
