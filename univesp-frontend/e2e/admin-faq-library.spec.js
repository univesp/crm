import { expect, test } from '@playwright/test'

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
  await page.getByLabel('Nome do fluxo').fill('Novo fluxo')
  await page.getByLabel('Chave estável').fill('novo-fluxo')
  await page.getByRole('button', { name: 'Criar e abrir Editor' }).click()

  await expect.poll(() => createdPayload).not.toBeNull()
  expect(createdPayload.bundle_key).toBe('novo-fluxo')
  expect(createdPayload.payload.schema_version).toBe('3.0.0')
  await expect(page).toHaveURL(/admin\/faq-editor\/novo-fluxo/)
  await expect(page.getByRole('heading', { name: 'Novo fluxo' })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('univesp:faq-builder:library:v1')),
    )
    .toBe('sentinela-nao-alterar')
})

test('editor v3 reúne conteúdo, playbook, prévia, vigência e aprovação', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Resposta final Resposta final', exact: true }).click()
  await page.getByRole('button', { name: 'Aluno', exact: true }).click()
  await page.getByLabel('Orientação').fill('Recupere sua senha pelo portal do aluno.')

  await page.getByRole('button', { name: 'OP', exact: true }).click()
  await page.getByLabel('Objetivo').fill('Restabelecer o acesso sem expor credenciais.')
  await page
    .getByLabel('Checklist, um item por linha')
    .fill('Confirmar e-mail institucional\nOrientar recuperação de senha')

  await page.getByRole('button', { name: 'BPO', exact: true }).click()
  await expect(page.getByText('Herdado do OP', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Documento', exact: true }).click()
  await page.getByLabel('Envio de documento pelo aluno').selectOption('optional')
  await page.getByText('Solicitar CPF', { exact: true }).click()
  await page
    .getByLabel('Finalidade objetiva do CPF')
    .fill('Confirmar a identidade antes de corrigir o cadastro de acesso.')

  await page.getByLabel('Início da vigência').fill('2026-08-01T08:00')
  await page.getByLabel('Fim da vigência').fill('2026-12-31T23:59')
  await page.getByPlaceholder('Explique o que mudou e por quê.').fill(
    'Atualiza orientação do aluno e playbook da operação.',
  )
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload.valid_from).toBe('2026-08-01T08:00')
  expect(savedPayload.payload.nodes.find((node) => node.node_id === 'final').playbooks.op.objective)
    .toBe('Restabelecer o acesso sem expor credenciais.')
  expect(savedPayload.payload.nodes.find((node) => node.node_id === 'final').intake_policy)
    .toMatchObject({
      requires_cpf: true,
      cpf_purpose: 'Confirmar a identidade antes de corrigir o cadastro de acesso.',
    })

  await page.getByRole('button', { name: 'Ver como a jornada funciona' }).click()
  await expect(page.getByRole('heading', { name: 'Prévia da jornada' })).toBeFocused()
  await expect(page.getByText('Nenhum bloqueio encontrado.')).toBeVisible()
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
  await page.getByRole('button', { name: 'Importar ou atualizar' }).click()
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
  await page.route('**/api/app/v1/admin/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/users')) {
      return fulfill(route, [
        {
          email: 'op.guara@univesp.br',
          display_name: 'OP Guarulhos',
          profile_key: 'op',
        },
      ])
    }
    if (path.endsWith('/access-groups')) return fulfill(route, [])
    if (path.endsWith('/permission-profiles')) {
      return fulfill(route, [
        {
          id: 'faq-contributor-op',
          label: 'OP que sugere melhorias',
          base_persona: 'op',
          capabilities: ['suggest_knowledge'],
        },
      ])
    }
    if (path.endsWith('/profile-assignments') && request.method() === 'GET') {
      return fulfill(route, [])
    }
    if (path.endsWith('/profile-assignments') && request.method() === 'POST') {
      grantPayload = request.postDataJSON()
      return fulfill(route, { id: 'grant-1' })
    }
    return route.fallback()
  })

  await page.goto('/crm/admin/faq')
  await page.getByText('Quem pode sugerir melhorias').click()
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

async function mockKnowledgeV3(page, { payload, onCreate = () => {}, onSave = () => {} }) {
  let revision = 1
  await page.route('**/api/app/v1/knowledge/v3/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const bundleKey = payload.bundle_key

    if (path.endsWith('/catalogs')) {
      return fulfill(route, catalogs)
    }
    if (path.endsWith('/bundles') && method === 'GET') {
      return fulfill(route, [])
    }
    if (path.endsWith('/bundles') && method === 'POST') {
      const body = request.postDataJSON()
      onCreate(body)
      return fulfill(route, bundleResponse(body.payload, body.title, revision))
    }
    if (path.endsWith(`/bundles/${bundleKey}/versions`)) {
      return fulfill(route, [versionSummary(revision)])
    }
    if (path.endsWith(`/bundles/${bundleKey}/draft`) && method === 'PATCH') {
      const body = request.postDataJSON()
      onSave(body)
      revision += 1
      payload = structuredClone(body.payload)
      return fulfill(route, version(payload, revision), `"version-${revision}"`)
    }
    if (path.endsWith(`/bundles/${bundleKey}`)) {
      return fulfill(route, bundleResponse(payload, payload.metadata.title, revision), `"version-${revision}"`)
    }
    return fulfill(route, {})
  })
}

function bundleResponse(payload, title, revision) {
  return {
    bundle_key: payload.bundle_key,
    title,
    theme_key: payload.theme_key,
    audience_profile: 'student',
    status: 'active',
    draft_version: 'version-1',
    published_version: '',
    draft: version(payload, revision),
  }
}

function version(payload, revision) {
  return {
    version_id: 'version-1',
    version_label: 'rascunho',
    revision,
    lifecycle_state: 'draft',
    change_summary: '',
    valid_from: '',
    valid_until: '',
    etag: `"version-${revision}"`,
    payload,
  }
}

function versionSummary(revision) {
  return {
    version_id: 'version-1',
    version_label: 'rascunho',
    revision,
    lifecycle_state: 'draft',
    change_summary: '',
    valid_from: '',
    valid_until: '',
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
        operational: { routing_override: null },
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
