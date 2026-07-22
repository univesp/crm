import { randomUUID } from 'node:crypto'

const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const HARD_TIMEOUT_MS = 60 * 60 * 1000
const MAX_SESSIONS = 5
const MAX_SANDBOX_ACTIONS = 100

export function createSimulation(req, approved = {}) {
  const now = Date.now()
  const id = randomUUID()
  const sessions = sessionMap(req)
  const entries = Object.entries(sessions)
    .filter(([, item]) => Number(item.hardExpiresAt || 0) > now)
    .sort(([, left], [, right]) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, MAX_SESSIONS - 1)

  req.session.crmSimulations = Object.fromEntries(entries)
  req.session.crmSimulations[id] = {
    id,
    actorEmail: String(req.session.user.email || '').trim().toLowerCase(),
    mode: allowed(approved.mode, ['generic', 'person'], 'generic'),
    persona: allowed(approved.persona, ['aluno', 'op'], 'aluno'),
    reasonCode: allowed(approved.reason_code, ['suporte', 'validacao', 'reclamacao', 'auditoria'], 'validacao'),
    targetInternalId: String(approved.target_internal_id || ''),
    targetReference: String(approved.target_reference || ''),
    scope: normalizeScope(approved.scope),
    capabilities: normalizeStrings(approved.capabilities),
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt: now + IDLE_TIMEOUT_MS,
    hardExpiresAt: now + HARD_TIMEOUT_MS,
    sandboxActions: [],
  }
  return publicSimulation(req.session.crmSimulations[id])
}

export function activeSimulation(req, suppliedId = '') {
  const id = String(suppliedId || req.get('x-simulation-session') || '').trim()
  if (!id) return null
  const simulation = sessionMap(req)[id]
  if (!simulation || simulation.actorEmail !== String(req.session?.user?.email || '').trim().toLowerCase()) {
    return { error: 'SIMULATION_SESSION_INVALID' }
  }

  const now = Date.now()
  if (now > Number(simulation.idleExpiresAt || 0) || now > Number(simulation.hardExpiresAt || 0)) {
    delete req.session.crmSimulations[id]
    return { error: 'SIMULATION_SESSION_EXPIRED' }
  }

  simulation.lastSeenAt = now
  simulation.idleExpiresAt = Math.min(now + IDLE_TIMEOUT_MS, simulation.hardExpiresAt)
  return simulation
}

export function endSimulation(req, id) {
  const simulation = activeSimulation(req, id)
  if (!simulation || simulation.error) return simulation
  delete req.session.crmSimulations[simulation.id]
  return publicSimulation(simulation)
}

export function recordSandboxAction(req, id, payload = {}) {
  const simulation = activeSimulation(req, id)
  if (!simulation || simulation.error) return simulation
  const actionType = allowed(payload.action_type, ['responder', 'anexar', 'publicar', 'alterar_status', 'abrir_protocolo'], '')
  if (!actionType) return { error: 'SIMULATION_ACTION_INVALID' }

  const action = {
    id: randomUUID(),
    action_type: actionType,
    created_at: new Date().toISOString(),
    result: 'descartado',
  }
  simulation.sandboxActions = [...(simulation.sandboxActions || []), action].slice(-MAX_SANDBOX_ACTIONS)
  return { simulation: publicSimulation(simulation), action }
}

export function frappeSimulationContext(simulation) {
  if (!simulation || simulation.error) return null
  return {
    id: simulation.id,
    actor_email: simulation.actorEmail,
    mode: simulation.mode,
    persona: simulation.persona,
    target_internal_id: simulation.targetInternalId,
    target_reference: simulation.targetReference,
    scope: simulation.scope,
    capabilities: simulation.capabilities,
    idle_expires_at: new Date(simulation.idleExpiresAt).toISOString(),
    hard_expires_at: new Date(simulation.hardExpiresAt).toISOString(),
  }
}

export function publicSimulation(simulation) {
  return {
    id: simulation.id,
    mode: simulation.mode,
    persona: simulation.persona,
    reason_code: simulation.reasonCode,
    target_reference: simulation.targetReference,
    scope: simulation.scope,
    capabilities: simulation.capabilities,
    started_at: new Date(simulation.createdAt).toISOString(),
    idle_expires_at: new Date(simulation.idleExpiresAt).toISOString(),
    hard_expires_at: new Date(simulation.hardExpiresAt).toISOString(),
    sandbox_action_count: simulation.sandboxActions?.length || 0,
  }
}

function sessionMap(req) {
  if (!req.session.crmSimulations || typeof req.session.crmSimulations !== 'object') {
    req.session.crmSimulations = {}
  }
  return req.session.crmSimulations
}

function allowed(value, choices, fallback) {
  const normalized = String(value || '').trim().toLowerCase()
  return choices.includes(normalized) ? normalized : fallback
}

function normalizeStrings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean))]
}

function normalizeScope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, item]) => [String(key).slice(0, 64), normalizeStrings(Array.isArray(item) ? item : [item]).slice(0, 50)]),
  )
}
