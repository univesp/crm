import { expect, test } from '@playwright/test'

import {
  defaultFinalOperational,
  mockAdminGrants,
  mockAppSupportRoutes,
} from './helpers/faq-v3-visual-helpers.js'

const catalogs = {
  themes: [
    {
      theme_key: 'acesso-ava',
      theme_label: 'Acesso ao AVA',
      owner_email: 'gestor@univesp.br',
    },
  ],
  routing_patterns: [
    {
      pattern_key: 'op_then_area',
      label: 'OP → Área/Analista',
      steps: ['op', 'area'],
      allowed_routing_keys: ['atendimento-geral', 'sra'],
    },
  ],
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
    window.localStorage.setItem('univesp:faq-builder:library:v1', 'sentinela-nao-alterar')
  })
})

test('biblioteca v3 cria fluxo sem usar localStorage institucional', async ({ page }) => {
  let createdPayload = null
  const payload = flowPayload('novo-fluxo')
  await mockKnowledgeV3(page, {
    payload,
    onCreate(value) {
      createdPayload = value
    },
  })

  await page.goto('/crm/admin/faq')
  await expect(page.getByRole('heading', { name: 'Biblioteca de fluxos' })).toBeVisible()
  await page.getByRole('button', { name: 'Criar fluxo', exact: true }).click()
  const createDialog = page.getByRole('dialog', { name: 'Criar fluxo' })
  await createDialog.getByLabel('Nome do fluxo').fill('Novo fluxo')
  await createDialog.getByRole('combobox', { name: 'Tema' }).selectOption('acesso-ava')
  await createDialog.getByRole('checkbox', { name: 'Portal do Aluno' }).check()
  await createDialog.getByRole('button', { name: 'Criar e abrir Editor' }).click()

  await expect.poll(() => createdPayload).not.toBeNull()
  expect(createdPayload.bundle_key).toBe('novo-fluxo')
  expect(createdPayload.payload.schema_version).toBe('3.0.0')
  expect(createdPayload.payload.graph.student_root_node_id).toBeTruthy()
  expect(createdPayload.payload.graph.public_root_node_id).toBeFalsy()
  await expect(page).toHaveURL(/admin\/faq-editor\/novo-fluxo/)
  await expect(page.getByRole('heading', { name: 'Novo fluxo' })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('univesp:faq-builder:library:v1')),
    )
    .toBe('sentinela-nao-alterar')
})

test('editor v3 reúne conteúdo, playbook, mapa, vigência e publicação', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  let savedPayload = null
  await mockKnowledgeV3(page, {
    payload,
    onSave(value) {
      savedPayload = value
    },
  })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('heading', { name: 'Acesso ao AVA' })).toBeVisible()
  await page.getByRole('button', { name: 'Configurações do assunto' }).click()
  await expect(page.getByText('Canais de disponibilidade', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Fechar' }).click()

  await page.getByRole('button', { name: 'Resposta final Resposta final', exact: true }).click()
  await page.getByRole('button', { name: 'Orientação', exact: true }).click()
  await page.getByLabel('Conteúdo', { exact: true }).fill('Recupere sua senha pelo portal do aluno.')
  await page.getByRole('button', { name: '+ Aviso' }).click()
  await page.getByLabel('Conteúdo', { exact: true }).last().fill('Nunca compartilhe sua senha.')
  await page.getByRole('button', { name: 'Mover item 2 para cima' }).click()

  await page.getByRole('button', { name: 'OP', exact: true }).click()
  await page.getByLabel('Objetivo').fill('Restabelecer o acesso sem expor credenciais.')
  await page
    .getByLabel('Checklist, um item por linha')
    .fill('Confirmar e-mail institucional\nOrientar recuperação de senha')

  await page.getByRole('button', { name: 'BPO', exact: true }).click()
  await expect(page.getByText('Herdado do OP', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Documentos e dados', exact: true }).click()
  await page.getByLabel('Envio de documento pelo aluno').selectOption('optional')
  await page.getByText('Solicitar CPF', { exact: true }).click()
  await page
    .getByLabel('Finalidade objetiva do CPF')
    .fill('Confirmar a identidade antes de corrigir o cadastro de acesso.')

  await page.getByRole('button', { name: 'Configurações do assunto' }).click()
  await page.getByLabel('Início da vigência').fill('2026-08-01T08:00')
  await page.getByLabel('Fim da vigência').fill('2026-12-31T23:59')
  await page.getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload.valid_from).toBe('2026-08-01T08:00')
  expect(savedPayload.payload.nodes.find((node) => node.node_id === 'final').playbooks.op.objective)
    .toBe('Restabelecer o acesso sem expor credenciais.')
  expect(
    savedPayload.payload.nodes.find((node) => node.node_id === 'final').content.student.blocks
      .map((block) => block.type),
  ).toEqual(['notice', 'text'])
  expect(savedPayload.payload.nodes.find((node) => node.node_id === 'final').intake_policy)
    .toMatchObject({
      requires_cpf: true,
      cpf_purpose: 'Confirmar a identidade antes de corrigir o cadastro de acesso.',
    })

  await page.getByRole('button', { name: 'Simular jornada' }).click()
  await expect(page.getByRole('heading', { name: 'Simular jornada' })).toBeVisible()
  await page.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByText('Nenhum bloqueio encontrado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeVisible()
})

test('diálogo de envio respeita mínimo de caracteres, Esc e preserva o resumo', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload })
  await page.goto('/crm/admin/faq-editor/acesso-ava')

  const submitTrigger = page.getByRole('button', { name: 'Enviar para revisão', exact: true })
  await submitTrigger.click()
  const dialog = page.getByRole('dialog', { name: 'Enviar para revisão' })
  await expect(dialog).toBeVisible()

  const confirmButton = dialog.getByRole('button', { name: 'Enviar para revisão', exact: true })
  await expect(confirmButton).toBeDisabled()

  const summaryField = dialog.getByLabel('Resumo das mudanças')
  await summaryField.fill('Resumo curto')
  await expect(confirmButton).toBeDisabled()

  const draftText = 'Resumo com mais de vinte caracteres para envio.'
  await summaryField.fill(draftText)
  await expect(confirmButton).toBeEnabled()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(submitTrigger).toBeFocused()

  await submitTrigger.click()
  await expect(dialog).toBeVisible()
  await expect(summaryField).toHaveValue(draftText)

  await dialog.getByRole('button', { name: 'Cancelar' }).last().click()
  await expect(dialog).toBeHidden()
})

test('pendência em camada avançada navega até o campo Objetivo', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  const finalNode = payload.nodes.find((node) => node.node_id === 'final')
  finalNode.playbooks.op.objective = ''
  await mockKnowledgeV3(page, { payload })
  await page.goto('/crm/admin/faq-editor/acesso-ava')

  await page.getByRole('button', { name: 'Ver pendências' }).click()
  await page
    .getByRole('button', { name: /Defina o objetivo do playbook OP em “Resposta final”/ })
    .click()

  await expect(page.getByRole('button', { name: 'Ocultar opções avançadas' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'OP', exact: true })).toHaveClass(/is-active/)
  await expect(page.locator('#faq-field-op-objective')).toBeFocused()
})

test('vigência permanece legível com campos desabilitados fora de rascunho', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, {
    payload,
    lifecycleState: 'pending_approval',
    validFrom: '2026-08-01T08:00',
    validUntil: '2026-12-31T23:59',
  })
  await page.goto('/crm/admin/faq-editor/acesso-ava')

  await page.getByRole('button', { name: 'Configurações do assunto' }).click()
  const validFrom = page.getByLabel('Início da vigência')
  const validUntil = page.getByLabel('Fim da vigência')
  await expect(validFrom).toBeVisible()
  await expect(validUntil).toBeVisible()
  await expect(validFrom).toBeDisabled()
  await expect(validUntil).toBeDisabled()
  await expect(validFrom).toHaveValue('2026-08-01T08:00')
  await expect(validUntil).toHaveValue('2026-12-31T23:59')
})

test('mapa do fluxo seleciona a etapa e a simulação percorre a jornada', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload })
  await page.goto('/crm/admin/faq-editor/acesso-ava')

  await page.getByRole('button', { name: 'Mapa', exact: true }).click()
  const mapSection = page.locator('.faq-v3-map-workspace')
  await expect(mapSection.getByRole('heading', { name: 'Mapa do fluxo' })).toBeVisible()
  await mapSection.locator('.faq-v3-flow-node').first().click()
  await expect(page.getByLabel('Nome da etapa')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fechar painel' })).toBeVisible()
  await page.getByRole('button', { name: 'Fechar painel' }).click()

  await page.getByRole('button', { name: 'Simular jornada' }).click()
  const simulator = page.getByRole('dialog', { name: 'Simular jornada' })
  await expect(simulator.getByRole('heading', { name: 'Simular jornada' })).toBeVisible()
  const choice = simulator.getByRole('button', { name: /Resposta final|Continuar/i }).first()
  if (await choice.isVisible()) {
    await choice.click()
  }
  await simulator.getByRole('button', { name: 'Reiniciar' }).click()
  await simulator.getByRole('button', { name: 'Fechar' }).click()
})

test('editor envia mídia institucional e preserva o asset no rascunho', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  let savedPayload = null
  let assetUploadReceived = false
  await mockKnowledgeV3(page, {
    payload,
    onSave(value) {
      savedPayload = value
    },
  })
  await page.route('**/api/app/v1/runtime/flags', (route) =>
    route.fulfill({
      status: 200,
      json: { data: { knowledge_media_upload: true }, error: null },
    }),
  )
  await page.route('**/api/app/v1/knowledge/v3/assets', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    assetUploadReceived = route.request().headers()['content-type']?.includes('multipart/form-data')
    return route.fulfill({
      status: 201,
      json: {
        data: {
          asset_id: 'asset-imagem-1',
          type: 'image',
          url: 'https://cdn.univesp.br/faq/acesso.png',
          alt: 'Tela de recuperação de acesso',
        },
        error: null,
      },
    })
  })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await page.getByRole('button', { name: 'Resposta final Resposta final', exact: true }).click()
  await page.getByRole('button', { name: 'Orientação', exact: true }).click()
  await page.getByRole('button', { name: 'Excluir item 1' }).click()
  await page.getByRole('button', { name: '+ Imagem' }).click()
  await page.getByLabel('Texto alternativo').fill('Tela de recuperação de acesso')
  await page.getByLabel('Enviar mídia institucional').setInputFiles({
    name: 'acesso.png',
    mimeType: 'image/png',
    buffer: Buffer.from('\x89PNG\r\n\x1a\nimagem'),
  })
  await expect(page.getByText('Mídia institucional enviada e vinculada ao bloco.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(assetUploadReceived).toBe(true)
  expect(savedPayload.payload.nodes[1].content.student.blocks[0]).toMatchObject({
    asset_id: 'asset-imagem-1',
    type: 'image',
    url: 'https://cdn.univesp.br/faq/acesso.png',
    alt: 'Tela de recuperação de acesso',
  })
})

test('barra de adição de conteúdo e simulador renderizam tipos avançados', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  payload.metadata.audience_profile = 'mixed'
  const finalNode = payload.nodes.find((node) => node.node_id === 'final')
  finalNode.content.student.blocks = [
    {
      block_id: 'img-1',
      type: 'image',
      url: 'https://cdn.univesp.br/faq/acesso.png',
      alt: 'Tela de login',
    },
    {
      block_id: 'video-1',
      type: 'video',
      url: 'https://cdn.univesp.br/faq/tutorial.mp4',
      captions_url: 'https://cdn.univesp.br/faq/tutorial.vtt',
      transcript: 'Passo a passo de recuperação.',
    },
  ]
  await mockKnowledgeV3(page, { payload })
  await page.goto('/crm/admin/faq-editor/acesso-ava')

  await page.getByRole('button', { name: 'Resposta final Resposta final', exact: true }).click()
  await page.getByRole('button', { name: 'Orientação', exact: true }).click()

  await expect(page.getByRole('group', { name: 'Adicionar conteúdo' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Texto' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Link' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Imagem' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Vídeo' })).toBeVisible()
  await expect(page.getByText('Imagem', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Vídeo', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Público externo', exact: true }).click()
  await page.getByText('Personalizar texto para o público externo', { exact: true }).click()
  await page.getByRole('button', { name: '+ Vídeo' }).click()
  await expect(page.getByLabel('Endereço HTTPS').last()).toBeVisible()
  await expect(page.getByLabel('URL da legenda').last()).toBeVisible()
  await expect(page.getByLabel('Transcrição').last()).toBeVisible()

  await page.getByRole('button', { name: 'Simular jornada' }).click()
  const simulator = page.getByRole('dialog', { name: 'Simular jornada' })
  await simulator.getByRole('button', { name: /Resposta final|Continuar/i }).first().click()
  await expect(simulator.locator('img[alt="Tela de login"]')).toBeVisible()
  await expect(simulator.locator('video')).toBeVisible()
  await expect(simulator.getByText('Passo a passo de recuperação.')).toBeVisible()
  await simulator.getByRole('button', { name: 'Fechar' }).click()
})

test('importação v3 mostra diff e preserva etapa ausente após decisão explícita', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  let savedPayload = null
  await mockKnowledgeV3(page, {
    payload,
    onSave(value) {
      savedPayload = value
    },
  })
  const imported = structuredClone(payload)
  imported.nodes = [
    imported.nodes[0],
    {
      ...structuredClone(imported.nodes[1]),
      node_id: 'nova-final',
      stable_key: 'nova-final',
      display: { title: 'Nova resposta importada' },
      content: {
        student: {
          blocks: [{ block_id: 'nova-final-texto', type: 'text', body: 'Conteúdo atualizado.' }],
          outcome_key: 'open_ticket',
        },
        public: null,
      },
    },
  ]
  imported.edges = [
    {
      edge_id: 'root-nova-final',
      parent_node_id: 'root',
      child_node_id: 'nova-final',
      order: 1,
      active: true,
      audiences: ['student'],
    },
  ]

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await page.getByRole('button', { name: 'Mais ações' }).click()
  await page.getByRole('menuitem', { name: 'Importar ou atualizar' }).click()
  await page.getByLabel('Arquivo para comparar').setInputFiles({
    name: 'acesso-ava-v3.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  })

  await expect(page.getByText('Nova resposta importada', { exact: true })).toBeVisible()
  await expect(page.getByText('Ausente na planilha', { exact: true })).toBeVisible()
  await page.getByLabel('Resolver etapa ausente').selectOption('keep')
  await page.getByRole('button', { name: 'Aplicar ao rascunho' }).click()
  await expect(page.getByText('Importação aplicada ao rascunho. Revise e salve para persistir.')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload.payload.nodes.map((node) => node.stable_key)).toEqual(
    expect.arrayContaining(['root', 'final', 'nova-final']),
  )
  expect(savedPayload.payload.nodes.find((node) => node.stable_key === 'final').import_status)
    .toBeUndefined()
})

test('Admin concede sugestão a OP com tema e validade explícitos', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  let grantPayload = null
  await mockKnowledgeV3(page, { payload })
  await mockAdminGrants(page, {
    onGrantPost(value) {
      grantPayload = value
    },
  })

  await page.goto('/crm/admin/permissoes?tab=knowledge&context=faq-suggestions')
  await expect(page.getByRole('heading', { name: 'Conhecimento e FAQ' })).toBeVisible()
  await expect(page.getByText('Carregando permissões…')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Conceder permissão' })).toBeVisible()
  await page.getByLabel('Pessoa ou grupo').selectOption('op.guara@univesp.br')
  await page.getByRole('checkbox', { name: 'Acesso ao AVA' }).check()
  await page.getByLabel('Válido até').fill('2026-12-31T23:59')
  await page.getByLabel('Justificativa').fill('Piloto controlado do tema acesso ao AVA.')
  await page.getByRole('button', { name: 'Conceder permissão' }).click()

  await expect.poll(() => grantPayload).not.toBeNull()
  expect(grantPayload).toMatchObject({
    subject_type: 'person',
    subject_id: 'op.guara@univesp.br',
    permission_profile: 'faq-contributor-op',
    scopes: { knowledge_themes: ['acesso-ava'] },
    valid_until: '2026-12-31T23:59',
  })
})

async function mockKnowledgeV3(
  page,
  {
    payload,
    onCreate = () => {},
    onSave = () => {},
    lifecycleState = 'draft',
    validFrom = '',
    validUntil = '',
  } = {},
) {
  let revision = 1
  await mockAppSupportRoutes(page)
  await page.route('**/api/app/v1/knowledge/v3/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const bundleKey = payload.bundle_key

    if (path.endsWith('/catalogs')) {
      return fulfill(route, catalogs)
    }
    if (path.endsWith('/themes') && method === 'POST') {
      const body = request.postDataJSON()
      catalogs.themes.push({
        theme_key: body.theme_key || 'novo-tema',
        theme_label: body.theme_label || body.name || 'Novo tema',
        owner_email: body.owner_email || 'gestor@univesp.br',
      })
      return fulfill(route, catalogs.themes.at(-1))
    }
    if (path.endsWith('/bundles') && method === 'GET') {
      return fulfill(route, [])
    }
    if (path.endsWith('/bundles') && method === 'POST') {
      const body = request.postDataJSON()
      onCreate(body)
      return fulfill(route, bundleResponse(body.payload, body.title, revision, lifecycleState, validFrom, validUntil))
    }
    if (path.endsWith(`/bundles/${bundleKey}/versions`)) {
      return fulfill(route, [versionSummary(revision, lifecycleState, validFrom, validUntil)])
    }
    if (path.endsWith(`/bundles/${bundleKey}/draft`) && method === 'PATCH') {
      const body = request.postDataJSON()
      onSave(body)
      revision += 1
      payload = structuredClone(body.payload)
      return fulfill(route, version(payload, revision, lifecycleState, validFrom, validUntil), `"version-${revision}"`)
    }
    if (path.endsWith(`/bundles/${bundleKey}`)) {
      return fulfill(
        route,
        bundleResponse(payload, payload.metadata.title, revision, lifecycleState, validFrom, validUntil),
        `"version-${revision}"`,
      )
    }
    return fulfill(route, {})
  })
}

function bundleResponse(payload, title, revision, lifecycleState = 'draft', validFrom = '', validUntil = '') {
  return {
    bundle_key: payload.bundle_key,
    title,
    theme_key: payload.theme_key,
    audience_profile: 'student',
    status: 'active',
    draft_version: 'version-1',
    published_version: '',
    draft: version(payload, revision, lifecycleState, validFrom, validUntil),
  }
}

function version(payload, revision, lifecycleState = 'draft', validFrom = '', validUntil = '') {
  return {
    version_id: 'version-1',
    version_label: 'rascunho',
    revision,
    lifecycle_state: lifecycleState,
    change_summary: '',
    valid_from: validFrom,
    valid_until: validUntil,
    etag: `"version-${revision}"`,
    payload,
  }
}

function versionSummary(revision, lifecycleState = 'draft', validFrom = '', validUntil = '') {
  return {
    version_id: 'version-1',
    version_label: 'rascunho',
    revision,
    lifecycle_state: lifecycleState,
    change_summary: '',
    valid_from: validFrom,
    valid_until: validUntil,
    etag: `"version-${revision}"`,
  }
}

function flowPayload(bundleKey) {
  return {
    schema_version: '3.0.0',
    bundle_key: bundleKey,
    theme_key: 'acesso-ava',
    metadata: {
      title: bundleKey === 'acesso-ava' ? 'Acesso ao AVA' : 'Novo fluxo',
      audience_profile: 'student',
      operational_owner: {
        owner_type: 'queue',
        owner_key: 'atendimento-geral',
      },
      criticidade_default_key: 'media',
      sla_policy_key: '48h',
    },
    graph: {
      student_root_node_id: 'root',
      public_root_node_id: null,
      internal_root_node_id: null,
    },
    routing_policy: {
      pattern_key: 'op_then_area',
      bpo_enabled: false,
      institutional_exceptions: ['provas', 'critica'],
    },
    nodes: [
      {
        node_id: 'root',
        stable_key: 'root',
        node_kind: 'path',
        audiences: ['student'],
        display: { title: 'Início' },
        content: { student: { blocks: [] }, public: null },
        playbooks: { op: null, bpo: null, analyst: null },
        operational: { routing_override: null },
        document_policy: null,
        media_refs: [],
      },
      {
        node_id: 'final',
        stable_key: 'final',
        node_kind: 'final',
        audiences: ['student'],
        display: { title: 'Resposta final' },
        content: {
          student: {
            blocks: [{ block_id: 'texto-final', type: 'text', body: 'Orientação atual.' }],
            outcome_key: 'open_ticket',
          },
          public: null,
        },
        playbooks: {
          op: {
            objective: 'Resolver acesso',
            checklist: ['Confirmar e-mail'],
            systems: [],
            documents_to_request: [],
            suggested_reply: '',
            allowed_actions: [],
            escalation_criteria: '',
            escalation_reason_template: '',
            possible_outcomes: [],
          },
          bpo: null,
          analyst: null,
        },
        operational: defaultFinalOperational(),
        document_policy: { mode: 'disabled' },
        media_refs: [],
      },
    ],
    edges: [
      {
        edge_id: 'root-final',
        parent_node_id: 'root',
        child_node_id: 'final',
        order: 1,
        active: true,
        audiences: ['student'],
      },
    ],
  }
}

function fulfill(route, data, etag = '') {
  return route.fulfill({
    status: 200,
    headers: etag ? { ETag: etag } : {},
    json: {
      data,
      error: null,
      meta: etag ? { etag } : {},
      request_id: 'faq-v3-e2e',
    },
  })
}
