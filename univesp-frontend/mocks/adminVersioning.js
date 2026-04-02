import faqAlunoBase from './faq-aluno.json'
import faqOpBase from './faq-op.json'
import { adminParametersDraft } from './adminParameters'
import { adminPermissionsDraft } from './adminPermissions'

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function findById(collection = [], key, value) {
  return collection.find((entry) => entry?.[key] === value) || null
}

function removeById(collection = [], key, value) {
  const index = collection.findIndex((entry) => entry?.[key] === value)

  if (index >= 0) {
    collection.splice(index, 1)
  }
}

function buildFaqDraftPayload() {
  const aluno = cloneJson(faqAlunoBase)
  const op = cloneJson(faqOpBase)

  const draftHighlight = {
    highlight_id: 'faq-aluno-highlight-006',
    faq_id: 'faq-aluno',
    target_type: 'tema',
    target_id: 'colacao',
    prioridade_dinamica: 86,
    janela_inicio: '2026-10-16',
    janela_fim: '2026-11-20',
    regra_de_calendario: 'periodo_entrega_diploma',
    destaque_home: true,
    ordem_dinamica: 1,
    badge_label: 'Diploma em destaque',
    ativo: true,
  }

  aluno.calendar_highlights.push(draftHighlight)

  const alunoPrazoNode = findById(aluno.nodes, 'id', 'faq-aluno-rematricula-perda-prazo')
  if (alunoPrazoNode) {
    alunoPrazoNode.fila_destino = 'sra'
    alunoPrazoNode.sla_padrao = '48h'
    alunoPrazoNode.criticidade_padrao = 'media'
  }

  const alunoProvasNode = findById(aluno.nodes, 'id', 'faq-aluno-provas-envio-atestado')
  if (alunoProvasNode) {
    alunoProvasNode.sla_padrao = '8h'
    alunoProvasNode.criticidade_padrao = 'alta'
    alunoProvasNode.resposta =
      'Envie o atestado legivel pelo portal dentro da janela vigente. Se ainda precisar de analise, o atendimento seguira para a fila responsavel.'
  }

  const opProvasNode = findById(op.nodes, 'id', 'faq-op-provas-validar-atestado')
  if (opProvasNode) {
    opProvasNode.sla_padrao = '4h'
    opProvasNode.criterio_de_escalonamento =
      'Escalar quando o atestado estiver valido e houver impacto academico imediato para a janela de prova.'
    opProvasNode.motivo_escalonamento_sugerido = 'segunda_chamada_prova'
  }

  const opAtividadesNode = findById(op.nodes, 'id', 'faq-op-atividades-validar-excecao')
  if (opAtividadesNode) {
    opAtividadesNode.fila_destino = 'suporte_academico_digital'
    opAtividadesNode.criticidade_padrao = 'alta'
  }

  return { aluno, op }
}

function buildFaqPublishedPayload() {
  const aluno = cloneJson(faqAlunoBase)
  const op = cloneJson(faqOpBase)

  const alunoPrazoNode = findById(aluno.nodes, 'id', 'faq-aluno-rematricula-perda-prazo')
  if (alunoPrazoNode) {
    alunoPrazoNode.fila_destino = 'op'
    alunoPrazoNode.sla_padrao = '72h'
    alunoPrazoNode.criticidade_padrao = 'baixa'
    alunoPrazoNode.resposta =
      'Verifique o calendario academico publicado. Caso a duvida continue, registre a solicitacao para avaliacao posterior.'
  }

  const alunoProvasNode = findById(aluno.nodes, 'id', 'faq-aluno-provas-envio-atestado')
  if (alunoProvasNode) {
    alunoProvasNode.sla_padrao = '24h'
    alunoProvasNode.criticidade_padrao = 'media'
  }

  const alunoProvasHighlight = findById(
    aluno.calendar_highlights,
    'highlight_id',
    'faq-aluno-highlight-002',
  )
  if (alunoProvasHighlight) {
    alunoProvasHighlight.prioridade_dinamica = 96
    alunoProvasHighlight.destaque_home = false
    alunoProvasHighlight.badge_label = 'Tema academico'
  }

  aluno.calendar_highlights.push({
    highlight_id: 'faq-aluno-highlight-legacy',
    faq_id: 'faq-aluno',
    target_type: 'tema',
    target_id: 'matricula',
    prioridade_dinamica: 74,
    janela_inicio: '2025-12-01',
    janela_fim: '2026-01-05',
    regra_de_calendario: 'periodo_pre_matricula',
    destaque_home: false,
    ordem_dinamica: 4,
    badge_label: 'Janela anterior',
    ativo: true,
  })

  const opRematriculaNode = findById(op.nodes, 'id', 'faq-op-rematricula-validar-perda-prazo')
  if (opRematriculaNode) {
    opRematriculaNode.fila_destino = 'op'
    opRematriculaNode.resposta_padrao_sugerida =
      'Seu caso sera verificado pelo polo conforme o calendario academico.'
    opRematriculaNode.motivo_escalonamento_sugerido = 'avaliacao_manual'
  }

  const opProvasNode = findById(op.nodes, 'id', 'faq-op-provas-validar-atestado')
  if (opProvasNode) {
    opProvasNode.sla_padrao = '24h'
    opProvasNode.criticidade_padrao = 'media'
    opProvasNode.criterio_de_escalonamento =
      'Escalar apenas quando houver decisao academica formal ou pendencia documental grave.'
  }

  const opProvasHighlight = findById(op.calendar_highlights, 'highlight_id', 'faq-op-highlight-002')
  if (opProvasHighlight) {
    opProvasHighlight.prioridade_dinamica = 98
    opProvasHighlight.badge_label = 'Fila monitorada'
  }

  op.calendar_highlights.push({
    highlight_id: 'faq-op-highlight-legacy',
    faq_id: 'faq-op',
    target_type: 'tema',
    target_id: 'matricula',
    prioridade_dinamica: 72,
    janela_inicio: '2025-12-01',
    janela_fim: '2026-01-05',
    regra_de_calendario: 'periodo_pre_matricula',
    destaque_home: false,
    ordem_dinamica: 4,
    badge_label: 'Janela operacional anterior',
    ativo: true,
  })

  return { aluno, op }
}

function buildParametersDraftPayload() {
  const payload = cloneJson(adminParametersDraft)

  payload.applicationRules.push({
    id: 'rule-subtheme-diploma',
    active: true,
    targetType: 'subtheme',
    targetValue: 'prazo_de_emissao',
    criticalityKey: 'media',
    slaKey: '24h',
    note: 'Diploma e certificado passam a ter leitura mais proxima da gestao academica.',
  })

  return payload
}

function buildParametersPublishedPayload() {
  const payload = cloneJson(adminParametersDraft)

  const highLevel = findById(payload.criticalityLevels, 'key', 'alta')
  if (highLevel) {
    highLevel.badgeLabel = 'Elevada'
    highLevel.operationalPriority = 2
  }

  const shortSlaLevel = findById(payload.slaLevels, 'key', '8h')
  if (shortSlaLevel) {
    shortSlaLevel.label = '12 horas'
    shortSlaLevel.badgeLabel = '12h'
    shortSlaLevel.hours = 12
    shortSlaLevel.operationalPriority = 3
  }

  removeById(payload.applicationRules, 'id', 'rule-theme-estagio')
  payload.applicationRules.push({
    id: 'rule-queue-financeiro',
    active: true,
    targetType: 'queue',
    targetValue: 'Financeiro',
    criticalityKey: 'media',
    slaKey: '72h',
    note: 'Fila financeira seguia janela mais longa na versao publicada anterior.',
  })

  const proofRule = findById(payload.applicationRules, 'id', 'rule-theme-provas')
  if (proofRule) {
    proofRule.criticalityKey = 'media'
    proofRule.slaKey = '48h'
  }

  return payload
}

function buildPermissionsDraftPayload() {
  return cloneJson({
    profiles: adminPermissionsDraft.profiles,
    areas: adminPermissionsDraft.areas,
    matrix: adminPermissionsDraft.matrix,
  })
}

function buildPermissionsPublishedPayload() {
  const payload = cloneJson({
    profiles: adminPermissionsDraft.profiles,
    areas: adminPermissionsDraft.areas,
    matrix: adminPermissionsDraft.matrix,
  })

  const opPolicy = findById(payload.matrix, 'id', 'perm-op-guarulhos')
  if (opPolicy) {
    opPolicy.scopeType = 'fila'
    opPolicy.scopeValues = ['OP do polo - Guarulhos']
    opPolicy.allowedActions.request_info = false
  }

  const adminCentralPolicy = findById(payload.matrix, 'id', 'perm-admin-central')
  if (adminCentralPolicy) {
    adminCentralPolicy.allowedActions.publish_version = false
    adminCentralPolicy.note =
      'Admin central ainda sem publicacao direta na versao publicada anterior.'
  }

  removeById(payload.matrix, 'id', 'perm-gestor-polos')
  payload.matrix.push({
    id: 'perm-analista-financeiro',
    profileKey: 'analista_area',
    scopeType: 'area',
    scopeValues: ['financeiro'],
    allowedActions: {
      view_case: true,
      reply: true,
      request_info: false,
      escalate: false,
      reassign: false,
      edit_faq: false,
      edit_parameters: false,
      publish_version: false,
      view_audit: false,
    },
    note: 'Regra anterior focada na area financeira sem governanca multi-polo.',
  })

  return payload
}

export const adminVersioningSeed = {
  currentActor: {
    id: 'admin-central-001',
    name: 'Patricia Oliveira',
    role: 'admin_central',
  },
  domains: {
    faq: {
      key: 'faq',
      label: 'FAQ e playbooks',
      description: 'FAQ publica do aluno e playbooks operacionais do OP no mesmo eixo canonico.',
      draft: {
        version: 'faq-2026.03-draft.4',
        status: 'draft',
        updatedAt: '25/03/2026 10:20',
        updatedBy: 'Patricia Oliveira',
        summary: 'Ajustes em provas, rematricula e novos highlights de diploma.',
        payload: buildFaqDraftPayload(),
      },
      published: {
        version: 'faq-2026.02',
        status: 'published',
        updatedAt: '10/03/2026 09:00',
        updatedBy: 'Comite Central',
        summary: 'Versao anterior com highlights e fluxos de prova mais conservadores.',
        payload: buildFaqPublishedPayload(),
      },
      approval: {
        status: 'pending',
        approvedAt: '',
        approvedBy: '',
        approvedRole: '',
      },
    },
    parameters: {
      key: 'parameters',
      label: 'Parametros de SLA e criticidade',
      description: 'Catalogos operacionais e regras de aplicacao por tema, subtema e fila.',
      draft: {
        version: 'param-2026.03-draft.2',
        status: 'draft',
        updatedAt: '25/03/2026 11:05',
        updatedBy: 'Patricia Oliveira',
        summary: 'Inclui regra para diploma e eleva criticidade de temas academicos sensiveis.',
        payload: buildParametersDraftPayload(),
      },
      published: {
        version: 'param-2026.02',
        status: 'published',
        updatedAt: '11/03/2026 15:40',
        updatedBy: 'Comite Central',
        summary: 'Versao anterior com SLA de 12h e regra legada da fila financeira.',
        payload: buildParametersPublishedPayload(),
      },
      approval: {
        status: 'approved',
        approvedAt: '24/03/2026 17:10',
        approvedBy: 'Camila Rocha',
        approvedRole: 'admin_central',
      },
    },
    permissions: {
      key: 'permissions',
      label: 'Permissoes e visibilidade',
      description: 'Matriz de acesso por perfil, fila e area com leitura de governanca.',
      draft: {
        version: 'perm-2026.03-draft.1',
        status: 'draft',
        updatedAt: '25/03/2026 15:20',
        updatedBy: 'Patricia Oliveira',
        summary: 'Amplia escopo do OP e libera publicacao para a governanca central.',
        payload: buildPermissionsDraftPayload(),
      },
      published: {
        version: 'perm-2026.02',
        status: 'published',
        updatedAt: '12/03/2026 16:15',
        updatedBy: 'Comite Central',
        summary: 'Versao anterior ainda sem gestor de polos e com escopo reduzido para a operacao.',
        payload: buildPermissionsPublishedPayload(),
      },
      approval: {
        status: 'pending',
        approvedAt: '',
        approvedBy: '',
        approvedRole: '',
      },
    },
  },
  publicationEvents: [
    {
      id: 'version-event-001',
      actionType: 'publish',
      actorName: 'Camila Rocha',
      actorRole: 'admin_central',
      domainKey: 'faq',
      domainLabel: 'FAQ e playbooks',
      changedAt: '2026-03-10T09:00:00-03:00',
      changedAtLabel: '10/03/2026 09:00',
      previousVersion: 'faq-2026.01',
      nextVersion: 'faq-2026.02',
      summary: 'Publicou a base canonica de FAQ com highlights de provas e matricula.',
    },
    {
      id: 'version-event-002',
      actionType: 'publish',
      actorName: 'Camila Rocha',
      actorRole: 'admin_central',
      domainKey: 'parameters',
      domainLabel: 'Parametros de SLA e criticidade',
      changedAt: '2026-03-11T15:40:00-03:00',
      changedAtLabel: '11/03/2026 15:40',
      previousVersion: 'param-2026.01',
      nextVersion: 'param-2026.02',
      summary: 'Publicou catalogos operacionais e regras iniciais de tema, subtema e fila.',
    },
    {
      id: 'version-event-003',
      actionType: 'publish',
      actorName: 'Camila Rocha',
      actorRole: 'admin_central',
      domainKey: 'permissions',
      domainLabel: 'Permissoes e visibilidade',
      changedAt: '2026-03-12T16:15:00-03:00',
      changedAtLabel: '12/03/2026 16:15',
      previousVersion: 'perm-2026.01',
      nextVersion: 'perm-2026.02',
      summary: 'Publicou a primeira matriz administrativa de acesso por fila e area.',
    },
  ],
}
