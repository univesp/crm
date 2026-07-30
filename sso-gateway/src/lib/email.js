export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function classifyEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized.includes('@')) return null
  if (normalized.endsWith('@aluno.univesp.br')) return 'aluno'
  if (normalized.endsWith('@univesp.br')) return 'admin'
  if (normalized.includes('.univesp.br')) return 'academico'
  return null
}

export function sanitizeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
