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

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
    window.localStorage.setItem('univesp:faq-builder:library:v1', 'sentinela-nao-alterar')
  })
})

for (const viewport of VIEWPORTS) {
  test(`biblioteca: modal Criar fluxo legível em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava') })

    await page.goto('/crm/admin/faq')
    await expect(page.getByRole('heading', { name: 'Biblioteca de fluxos' })).toBeVisible()
    await page.getByRole('button', { name: 'Criar fluxo', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Criar fluxo' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Nome do fluxo')).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Tema' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Criar e abrir Editor' })).toBeVisible()

    const nameBox = await dialog.getByLabel('Nome do fluxo').boundingBox()
    const themeBox = await dialog.getByRole('combobox', { name: 'Tema' }).boundingBox()
    const submitBox = await dialog.getByRole('button', { name: 'Criar e abrir Editor' }).boundingBox()
    expect(nameBox).toBeTruthy()
    expect(themeBox).toBeTruthy()
    expect(submitBox).toBeTruthy()
    expect(themeBox.y).toBeGreaterThan(nameBox.y + nameBox.height * 0.5)
    expect(submitBox.y).toBeGreaterThan(themeBox.y + themeBox.height * 0.5)

    await expect(dialog).toHaveScreenshot(`criar-fluxo-modal-${viewport.name}.png`, {
      maxDiffPixelRatio: 0.02,
    })
  })
}

test('editor v3: telas principais sem colapso de layout', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('heading', { name: 'Acesso ao AVA' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-modo-simples.png', { fullPage: true, maxDiffPixelRatio: 0.02 })

  await page.getByRole('button', { name: 'Mostrar opções avançadas' }).click()
  await expect(page.getByRole('button', { name: 'OP', exact: true })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-modo-avancado.png', { fullPage: true, maxDiffPixelRatio: 0.02 })

  await page.getByRole('button', { name: 'Ver mapa' }).click()
  const mapDialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Fechar mapa' }) })
  await expect(mapDialog).toBeVisible()
  await expect(mapDialog).toHaveScreenshot('mapa-overlay.png', { maxDiffPixelRatio: 0.02 })
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Configurações do fluxo' }).click()
  const settingsDialog = page.getByRole('dialog', { name: 'Configurações do fluxo' })
  await expect(settingsDialog).toBeVisible()
  await expect(settingsDialog).toHaveScreenshot('configuracoes-fluxo.png', { maxDiffPixelRatio: 0.02 })
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Enviar para revisão', exact: true }).click()
  const submitDialog = page.getByRole('dialog', { name: 'Enviar para revisão' })
  await expect(submitDialog).toBeVisible()
  await expect(submitDialog).toHaveScreenshot('dialogo-envio.png', { maxDiffPixelRatio: 0.02 })
  await page.keyboard.press('Escape')
})

test('editor v3: vigência legível em somente leitura', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, {
    payload,
    lifecycleState: 'pending_approval',
    validFrom: '2026-08-01T08:00',
    validUntil: '2026-12-31T23:59',
  })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await page.getByRole('button', { name: 'Configurações do fluxo' }).click()
  const settingsDialog = page.getByRole('dialog', { name: 'Configurações do fluxo' })
  await expect(settingsDialog.getByLabel('Início da vigência')).toBeDisabled()
  await expect(settingsDialog.getByLabel('Fim da vigência')).toBeDisabled()
  await expect(settingsDialog).toHaveScreenshot('somente-leitura-configuracoes.png', {
    maxDiffPixelRatio: 0.02,
  })
})

test('biblioteca: lista e painel de grants legíveis', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, {
    payload,
    bundleList: sampleBundleList(),
    includeGrants: true,
  })

  await page.goto('/crm/admin/faq')
  await expect(page.getByRole('heading', { name: 'Biblioteca de fluxos' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Acesso ao AVA' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Matrícula e documentos' })).toBeVisible()
  await expect(page).toHaveScreenshot('biblioteca-lista-1440x900.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  })

  await page.getByText('Quem pode sugerir melhorias').click()
  const grantsForm = page.locator('.faq-grants__form')
  await expect(grantsForm).toBeVisible()
  const subjectBox = await grantsForm.getByLabel('Pessoa ou grupo').boundingBox()
  const profileBox = await grantsForm.getByLabel('Perfil').boundingBox()
  expect(subjectBox).toBeTruthy()
  expect(profileBox).toBeTruthy()
  expect(profileBox.y).toBeGreaterThan(subjectBox.y + subjectBox.height * 0.5)
  await expect(page.locator('.faq-grants')).toHaveScreenshot('biblioteca-grants-1440x900.png', {
    maxDiffPixelRatio: 0.02,
  })
})

test('biblioteca: modal Criar novo tema legível', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava'), bundleList: sampleBundleList() })

  await page.goto('/crm/admin/faq')
  await page.getByRole('button', { name: 'Criar novo tema', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Criar novo tema' })
  await expect(dialog).toBeVisible()
  const nameBox = await dialog.getByLabel('Nome do tema').boundingBox()
  const areaBox = await dialog.getByLabel('Nome da área').boundingBox()
  const ownerBox = await dialog.getByLabel('Responsável principal').boundingBox()
  expect(nameBox).toBeTruthy()
  expect(areaBox).toBeTruthy()
  expect(ownerBox).toBeTruthy()
  expect(areaBox.y).toBeGreaterThan(nameBox.y + nameBox.height * 0.5)
  expect(ownerBox.y).toBeGreaterThan(areaBox.y + areaBox.height * 0.5)
  await expect(dialog).toHaveScreenshot('criar-tema-modal-1440x900.png', {
    maxDiffPixelRatio: 0.02,
  })
})

test('editor v3: estado aguardando aprovação', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload, lifecycleState: 'pending_approval' })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByText('Aguardando aprovação', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aprovar conteúdo' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-estado-aguardando-aprovacao.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  })
})

test('editor v3: estado aprovado sem rascunho', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload, editorMode: 'approved' })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('heading', { name: 'A versão está aprovada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar versão aprovada' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-estado-aprovado.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  })
})

test('editor v3: estado publicado sem rascunho', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload, editorMode: 'published_only' })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Este fluxo não tem rascunho em edição' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar novo rascunho' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-estado-publicado.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
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
    editorMode = 'draft',
    bundleList = null,
    includeGrants = false,
  } = {},
) {
  let revision = 1
  if (includeGrants) {
    await mockAdminGrants(page)
  }
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
      return fulfill(route, bundleList ?? [])
    }
    if (path.endsWith('/bundles') && method === 'POST') {
      const body = request.postDataJSON()
      onCreate(body)
      return fulfill(
        route,
        buildBundleResponse(body.payload, body.title, revision, lifecycleState, validFrom, validUntil, 'draft'),
      )
    }
    if (path.endsWith(`/bundles/${bundleKey}/versions`)) {
      return fulfill(route, versionsForMode(editorMode, revision, lifecycleState, validFrom, validUntil))
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
        buildBundleResponse(payload, payload.metadata.title, revision, lifecycleState, validFrom, validUntil, editorMode),
        `"version-${revision}"`,
      )
    }
    return fulfill(route, {})
  })
}

async function mockAdminGrants(page) {
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
    if (path.endsWith('/profile-assignments')) return fulfill(route, [])
    return route.fallback()
  })
}

function sampleBundleList() {
  return [
    bundleListRow({
      bundle_key: 'acesso-ava',
      title: 'Acesso ao AVA',
      lifecycle_state: 'draft',
      published: true,
    }),
    bundleListRow({
      bundle_key: 'matricula-docs',
      title: 'Matrícula e documentos',
      lifecycle_state: 'pending_approval',
      published: false,
    }),
    bundleListRow({
      bundle_key: 'prova-presencial',
      title: 'Prova presencial',
      lifecycle_state: 'approved',
      published: true,
    }),
  ]
}

function bundleListRow({ bundle_key, title, lifecycle_state, published }) {
  return {
    bundle_key,
    title,
    theme_key: 'acesso-ava',
    audience_profile: 'student',
    audiences: ['student'],
    owner_email: 'gestor@univesp.br',
    status: 'active',
    published_version: published ? 'published-1' : '',
    draft_summary: {
      lifecycle_state,
      valid_from: '2026-08-01T08:00',
      valid_until: '2026-12-31T23:59',
    },
    published_summary: published
      ? {
          valid_from: '2026-08-01T08:00',
          valid_until: '2026-12-31T23:59',
        }
      : null,
    playbook_summary: { op: true, bpo: false, analyst: false },
    modified: '2026-07-01T10:00:00Z',
  }
}

function versionsForMode(editorMode, revision, lifecycleState, validFrom, validUntil) {
  if (editorMode === 'approved') {
    return [
      versionSummary(revision, 'approved', validFrom, validUntil),
      versionSummary(revision, 'published', validFrom, validUntil),
    ]
  }
  if (editorMode === 'published_only') {
    return [versionSummary(revision, 'published', validFrom, validUntil)]
  }
  return [versionSummary(revision, lifecycleState, validFrom, validUntil)]
}

function buildBundleResponse(
  payload,
  title,
  revision,
  lifecycleState = 'draft',
  validFrom = '',
  validUntil = '',
  editorMode = 'draft',
) {
  const base = {
    bundle_key: payload.bundle_key,
    title,
    theme_key: payload.theme_key,
    audience_profile: 'student',
    status: 'active',
    published_version: editorMode === 'published_only' || editorMode === 'approved' ? 'published-1' : '',
  }

  if (editorMode === 'approved') {
    return {
      ...base,
      draft_version: '',
      published: version(payload, revision, 'published', validFrom, validUntil),
    }
  }

  if (editorMode === 'published_only') {
    return {
      ...base,
      draft_version: '',
      published: version(payload, revision, 'published', validFrom, validUntil),
    }
  }

  return {
    ...base,
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
