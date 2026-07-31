function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase()
}

const ACTION_CONTRACTS = Object.freeze({
  technical_reply: Object.freeze({
    requiredActions: ['transition_ticket'],
    serverChecks: ['profile', 'scope', 'action', 'case_state'],
  }),
  request_complement: Object.freeze({
    requiredActions: ['transition_ticket'],
    serverChecks: ['profile', 'scope', 'action', 'case_state'],
  }),
  conclude: Object.freeze({
    requiredActions: ['transition_ticket'],
    serverChecks: ['profile', 'scope', 'action', 'case_state', 'response_requirement'],
  }),
  reassign: Object.freeze({
    requiredActions: ['transition_ticket', 'manager_override_route'],
    serverChecks: ['profile', 'scope', 'action', 'case_state', 'routing_exception_policy'],
  }),
  assign_case: Object.freeze({
    requiredActions: ['assign_case'],
    serverChecks: ['profile', 'scope', 'action'],
  }),
})

export const AREA_OPERATIONAL_SERVER_PARITY_NOTE =
  'A API institucional revalida perfil, escopo, estado do caso e excecoes de roteamento no servidor.'

export function resolveAreaActionContract(actionType = '') {
  return ACTION_CONTRACTS[actionType] || null
}

export function canRunAreaAction({
  actionType = '',
  viewerContext = null,
  isManagerException = false,
} = {}) {
  const contract = resolveAreaActionContract(actionType)
  const allowedActionSet = new Set((viewerContext?.allowedActions || []).map((item) => normalizeText(item)))

  if (!contract) {
    return {
      allowed: false,
      reason: 'Acao nao mapeada no contrato operacional.',
      source: 'frontend_mock_only',
      requiredActions: [],
      serverChecks: [],
    }
  }

  const missingActions = contract.requiredActions.filter(
    (action) => !allowedActionSet.has(normalizeText(action)),
  )

  if (missingActions.length) {
    return {
      allowed: false,
      reason: `Seu perfil nao possui permissao para esta acao (${missingActions.join(', ')}).`,
      source: 'frontend_mock_only',
      requiredActions: [...contract.requiredActions],
      serverChecks: [...contract.serverChecks],
    }
  }

  if (actionType === 'reassign' && isManagerException && !allowedActionSet.has('manager_override_route')) {
    return {
      allowed: false,
      reason: 'Excecao gerencial exige permissao manager_override_route.',
      source: 'frontend_mock_only',
      requiredActions: [...contract.requiredActions, 'manager_override_route'],
      serverChecks: [...contract.serverChecks],
    }
  }

  return {
    allowed: true,
    reason: '',
    source: 'frontend_mock_only',
    requiredActions: [...contract.requiredActions],
    serverChecks: [...contract.serverChecks],
  }
}
