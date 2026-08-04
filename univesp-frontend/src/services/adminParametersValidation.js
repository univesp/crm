export const CALENDAR_ENTRY_TYPES = [
  { value: 'holiday', label: 'Feriado' },
  { value: 'bridge', label: 'Ponte' },
  { value: 'recess', label: 'Recesso' },
]

export function getCalendarTypeLabel(type) {
  return CALENDAR_ENTRY_TYPES.find((item) => item.value === type)?.label || 'Feriado'
}

export function calendarEntryUsesRange(type) {
  return type === 'bridge' || type === 'recess'
}

export function findDuplicatePriority(levels, currentKey) {
  const current = levels.find((level) => level.key === currentKey)
  if (!current) return null

  const priority = Number(current.operationalPriority)
  if (!Number.isFinite(priority) || priority < 1) {
    return 'Informe uma prioridade valida (1 ou maior).'
  }

  const duplicate = levels.find(
    (level) => level.key !== currentKey && Number(level.operationalPriority) === priority,
  )
  if (duplicate) {
    return `Prioridade ${priority} ja esta em uso por "${duplicate.label}".`
  }

  return null
}

export function getSlaDurationMode(level) {
  if (Number(level?.businessDays) > 0) return 'businessDays'
  return 'hours'
}

export function getSlaDurationValue(level) {
  const mode = getSlaDurationMode(level)
  return mode === 'businessDays' ? Number(level.businessDays) : Number(level.hours)
}

export function setSlaDurationMode(level, mode) {
  if (!level || typeof level !== 'object') return

  if (mode === 'businessDays') {
    const hours = Number(level.hours)
    level.hours = null
    if (!Number(level.businessDays) && Number.isFinite(hours) && hours > 0) {
      level.businessDays = Math.max(1, Math.round(hours / 8))
    } else if (!Number(level.businessDays)) {
      level.businessDays = 1
    }
    return
  }

  const days = Number(level.businessDays)
  level.businessDays = null
  if (!Number(level.hours) && Number.isFinite(days) && days > 0) {
    level.hours = days * 8
  } else if (!Number(level.hours)) {
    level.hours = 24
  }
}

export function setSlaDurationValue(level, value) {
  if (!level || typeof level !== 'object') return
  const mode = getSlaDurationMode(level)
  const amount = Number(value)
  if (mode === 'businessDays') {
    level.businessDays = amount
    level.hours = null
    return
  }
  level.hours = amount
  level.businessDays = null
}

export function formatSlaDurationSummary(level) {
  const mode = getSlaDurationMode(level)
  const value = getSlaDurationValue(level)
  if (!Number.isFinite(value) || value <= 0) return 'Defina o prazo'

  if (mode === 'businessDays') {
    const hoursEquivalent = value * 8
    return `${value} dia(s) util(is) · equivale a cerca de ${hoursEquivalent}h corridas (8h/dia)`
  }

  const daysEquivalent = Math.round((value / 8) * 10) / 10
  return `${value} hora(s) · equivale a cerca de ${daysEquivalent} dia(s) comercial(is) de 8h`
}

export function findDuplicateSlaDuration(slaLevels, currentKey) {
  const current = slaLevels.find((level) => level.key === currentKey)
  if (!current) return null

  const mode = getSlaDurationMode(current)
  const value = getSlaDurationValue(current)
  if (!Number.isFinite(value) || value <= 0) {
    return 'Informe um prazo maior que zero.'
  }

  const duplicate = slaLevels.find((level) => {
    if (level.key === currentKey) return false
    return getSlaDurationMode(level) === mode && getSlaDurationValue(level) === value
  })

  if (duplicate) {
    const unit = mode === 'businessDays' ? 'dia(s) util(is)' : 'hora(s)'
    return `Ja existe prazo de ${value} ${unit} em "${duplicate.label}".`
  }

  return null
}

export function validateCriticalityLevel(levels, key) {
  return findDuplicatePriority(levels, key)
}

export function validateSlaLevel(slaLevels, key) {
  const priorityError = findDuplicatePriority(slaLevels, key)
  if (priorityError) return priorityError
  return findDuplicateSlaDuration(slaLevels, key)
}

export function groupCalendarEntriesByYearMonth(entries = []) {
  const sorted = [...entries].sort((left, right) =>
    String(left.date || '').localeCompare(String(right.date || '')),
  )
  const years = [...new Set(sorted.map((entry) => String(entry.date || '').slice(0, 4)).filter(Boolean))]
    .sort()

  const byYearMonth = {}
  for (const entry of sorted) {
    const year = String(entry.date || '').slice(0, 4)
    const month = String(entry.date || '').slice(5, 7)
    if (!year || !month) continue
    if (!byYearMonth[year]) byYearMonth[year] = {}
    if (!byYearMonth[year][month]) byYearMonth[year][month] = []
    byYearMonth[year][month].push(entry)
  }

  return { years, byYearMonth, sorted }
}

export function formatCalendarMonthLabel(month) {
  const date = new Date(`2026-${month}-01T12:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date)
}

export function formatCalendarEntryRange(entry) {
  const start = String(entry?.date || '').trim()
  const end = String(entry?.endDate || '').trim()
  if (!start) return 'Sem data'
  if (!end || end === start) return start.split('-').reverse().join('/')
  return `${start.split('-').reverse().join('/')} a ${end.split('-').reverse().join('/')}`
}
