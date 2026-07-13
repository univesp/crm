import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyEmail, normalizeEmail, sanitizeNext } from '../src/lib/email.js'

test('classifica os fluxos institucionais sem atribuir perfil de autorizacao', () => {
  assert.equal(classifyEmail('ra@aluno.univesp.br'), 'aluno')
  assert.equal(classifyEmail('pessoa@univesp.br'), 'admin')
  assert.equal(classifyEmail('pessoa@academico.univesp.br'), 'academico')
  assert.equal(classifyEmail('pessoa@example.com'), null)
})

test('normaliza email e bloqueia redirecionamento externo', () => {
  assert.equal(normalizeEmail(' PESSOA@UNIVESP.BR '), 'pessoa@univesp.br')
  assert.equal(sanitizeNext('/aluno/protocolos'), '/aluno/protocolos')
  assert.equal(sanitizeNext('https://example.com'), '/')
  assert.equal(sanitizeNext('//example.com'), '/')
})
