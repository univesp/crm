import { buildAdminDashboardView } from '@/services/adminDashboardRuntime'

function normalizeCaseId(value = '') {
  return String(value || '').trim()
}

export function filterAuditEntriesForCase(auditEntries = [], caseId = '') {
  const normalizedCaseId = normalizeCaseId(caseId)
  if (!normalizedCaseId) {
    return []
  }

  return (auditEntries || []).filter((entry) => normalizeCaseId(entry.caseId) === normalizedCaseId)
}

export function buildProtocolAuditTimeline({
  caseId = '',
  dashboardData = {},
  interactions = [],
} = {}) {
  const view = buildAdminDashboardView(dashboardData, {})
  const auditEntries = filterAuditEntriesForCase(view.auditEntries, caseId)

  const fromAudit = auditEntries.map((entry) => ({
    id: entry.id,
    kind: 'audit',
    title: entry.actionLabel || 'Movimentacao operacional',
    actor: entry.actor || 'Operador',
    description:
      entry.note ||
      `${entry.statusBefore} -> ${entry.statusAfter} · ${entry.queueBefore} -> ${entry.queueAfter}`,
    atLabel: entry.occurredAtLabel || 'Nao informado',
    occurredAt: entry.occurredAt || '',
    statusBefore: entry.statusBefore,
    statusAfter: entry.statusAfter,
    queueBefore: entry.queueBefore,
    queueAfter: entry.queueAfter,
    escalationReason: entry.escalationReason || '',
  }))

  const fromInteractions = (interactions || []).map((item, index) => ({
    id: item.id || `interaction-${index}`,
    kind: 'interaction',
    title: item.title || item.actor || 'Atualizacao',
    actor: item.actor || item.title || 'Atualizacao',
    description: item.description || item.message || item.text || 'Atualizacao registrada.',
    atLabel: item.atLabel || item.at || 'Nao informado',
    occurredAt: item.occurredAt || item.at || '',
  }))

  return [...fromAudit, ...fromInteractions].sort((left, right) => {
    const leftTime = Date.parse(left.occurredAt || '')
    const rightTime = Date.parse(right.occurredAt || '')

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return 0
    }

    if (Number.isNaN(leftTime)) {
      return 1
    }

    if (Number.isNaN(rightTime)) {
      return -1
    }

    return rightTime - leftTime
  })
}
