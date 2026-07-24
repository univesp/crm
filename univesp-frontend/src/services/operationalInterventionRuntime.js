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
    'Sem responsavel'
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
    normalizedOwner === 'nao atribuido' ||
    normalizedOwner === 'nao atribuído'
  const alreadyOwned = Boolean(normalizedUser) && normalizedOwner === normalizedUser

  return {
    title: 'Intervencao rapida via cockpit',
    description: alreadyOwned
      ? 'Voce ja e o responsavel deste caso. Continue a tratativa normalmente.'
      : isUnassigned
        ? 'Este caso ainda nao tem responsavel fixo. Assuma agora para acelerar a resposta.'
        : `Este caso esta com ${ownerLabel}. Voce pode assumir para destravar o SLA e registrar a intervencao.`,
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
      label: 'Abrir na operacao',
      route: {
        path: `/op/fila/${caseId}`,
        query: { intervene: '1', intent: 'assume' },
      },
    },
  ]

  if (detail.lastMileAreaLabel || detail.currentAreaLabel) {
    links.push({
      id: 'area',
      label: 'Abrir na area',
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
