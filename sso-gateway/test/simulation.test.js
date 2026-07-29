import assert from 'node:assert/strict'
import test from 'node:test'

import { activeSimulation, createSimulation, endSimulation, recordSandboxAction } from '../src/lib/simulation.js'

function request() {
  return {
    session: { user: { email: 'admin@univesp.br' } },
    get: () => '',
  }
}

test('simulation is bound to the authenticated actor and exposes no target identifier', () => {
  const req = request()
  const created = createSimulation(req, {
    mode: 'person',
    persona: 'aluno',
    reason_code: 'reclamacao',
    target_internal_id: 'sensitive@univesp.br',
    target_reference: 'USR-42',
  })
  assert.equal(created.target_reference, 'USR-42')
  assert.equal('target_internal_id' in created, false)
  req.session.user.email = 'other@univesp.br'
  assert.equal(activeSimulation(req, created.id).error, 'SIMULATION_SESSION_INVALID')
})

test('sandbox actions are discarded and do not retain submitted content', () => {
  const req = request()
  const created = createSimulation(req, { persona: 'op' })
  const result = recordSandboxAction(req, created.id, {
    action_type: 'responder',
    message: 'conteudo que nao deve ser persistido',
  })
  assert.equal(result.action.result, 'descartado')
  assert.equal('message' in result.action, false)
  assert.equal(result.simulation.sandbox_action_count, 1)
})

test('ending a simulation invalidates its opaque identifier', () => {
  const req = request()
  const created = createSimulation(req, {})
  assert.equal(endSimulation(req, created.id).id, created.id)
  assert.equal(activeSimulation(req, created.id).error, 'SIMULATION_SESSION_INVALID')
})
