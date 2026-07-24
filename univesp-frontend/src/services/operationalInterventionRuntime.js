function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function parseInterventionQuery(query = {}) {
  return {
    enabled: String(query.intervene || '') === '1',
    intent: String(query.intent || 'assume').trim() || 'assume',
  }
}

export function resolveOperationalOwnerLabel(detail = {}) {
  return (
    detail.currentAssigneeLabel ||
    detail.assignedOperator ||
    detail.assignedAnalystName ||
    'Sem responsável'
  )
}

export function buildInterventionContext({
  intervention = {},
  detail = {},
  currentUser = '',
} = {}) {
  if (!intervention?.enabled) {
    return null
  }

  const ownerLabel = resolveOperationalOwnerLabel(detail)
  const normalizedOwner = normalizeText(ownerLabel)
  const normalizedUser = normalizeText(currentUser)
  const isUnassigned =
    !ownerLabel ||
    normalizedOwner === 'sem responsavel' ||
    normalizedOwner === 'sem responsável' ||
    normalizedOwner === 'nao atribuido' ||
    normalizedOwner === 'não atribuído' ||
    normalizedOwner === 'nao atribuído'
  const alreadyOwned = Boolean(normalizedUser) && normalizedOwner === normalizedUser

  return {
    title: 'Intervenção rápida via cockpit',
    description: alreadyOwned
      ? 'Você já é o responsável deste caso. Continue a tratativa normalmente.'
      : isUnassigned
        ? 'Este caso ainda não tem responsável fixo. Assuma agora para acelerar a resposta.'
        : `Este caso está com ${ownerLabel}. Você pode assumir para destravar o SLA e registrar a intervenção.`,
    ownerLabel,
    alreadyOwned,
    canAssume: !alreadyOwned,
  }
}

export function buildAdminOperationalLinks(detail = {}) {
  if (!detail?.id) {
    return []
  }

  const caseId = detail.protocolNumber || detail.id
  const links = [
    {
      id: 'op',
      label: 'Abrir na operação',
      route: {
        path: `/op/fila/${caseId}`,
        query: { intervene: '1', intent: 'assume' },
      },
    },
  ]

  if (detail.lastMileAreaLabel || detail.currentAreaLabel) {
    links.push({
      id: 'area',
      label: 'Abrir na área',
      route: {
        path: `/area/fila/${caseId}`,
        query: {
          intervene: '1',
          intent: 'assume',
          ...(detail.lastMileAreaLabel || detail.currentAreaLabel
            ? { area: detail.lastMileAreaLabel || detail.currentAreaLabel }
            : {}),
        },
      },
    })
  }

  return links
}
