import { expect } from '@playwright/test'

export const FAQ_CATALOGS = {
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

/** Viewports desktop usados na rodada 1. */
export const VIEWPORTS_DESKTOP = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
]

/** Rodada 2 — mobile e simulação de zoom 200% (metade da largura efetiva). */
export const VIEWPORTS_ACCESSIBILITY = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'zoom-200-sim', width: 720, height: 450 },
]

export const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.02 }

export const DEFAULT_RUNTIME_PARAMETERS = {
  parameters: {
    criticalityLevels: [{ key: 'media', label: 'Média' }],
    slaLevels: [{ key: '48h', label: '48 horas', badgeLabel: '48h' }],
  },
}

export const DEFAULT_ADMIN_CATALOGS = {
  areas: [{ key: 'sra', label: 'Secretaria de Registro Acadêmico' }],
  profiles: [],
  queues: [],
  polos: [],
}

export function defaultFinalOperational() {
  return {
    routing_override: null,
    area_key: 'sra',
    criticidade: 'media',
    sla_policy_key: '48h',
    routing_chain: ['op', 'area'],
  }
}

export async function mockAppSupportRoutes(page) {
  await page.route(/\/api\/app\/v1\/admin\//, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/\/+$/, '')
    const method = request.method()
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/admin/access-groups') && method === 'GET') {
      return fulfill(route, [])
    }
    if (path.endsWith('/admin/runtime-settings') && method === 'GET') {
      return fulfill(route, DEFAULT_RUNTIME_PARAMETERS)
    }
    if (path.endsWith('/admin/catalogs') && method === 'GET') {
      return fulfill(route, DEFAULT_ADMIN_CATALOGS)
    }
    return fulfill(route, {})
  })
  await page.route('**/api/app/v1/runtime/flags', async (route) => {
    return fulfill(route, { knowledge_media_upload: false })
  })
}

export async function prepareAdminFaqSession(page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
    window.localStorage.setItem('univesp:faq-builder:library:v1', 'sentinela-nao-alterar')
  })
}

export async function prepareProfile(page, profileKey) {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', value)
  }, profileKey)
}

/** Garante que campos não colapsaram verticalmente (regressão de container query). */
export async function assertFieldsStacked(firstLocator, secondLocator) {
  const firstBox = await firstLocator.boundingBox()
  const secondBox = await secondLocator.boundingBox()
  expect(firstBox).toBeTruthy()
  expect(secondBox).toBeTruthy()
  expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height * 0.5)
}

export async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth > root.clientWidth + 1
  })
  expect(overflow).toBe(false)
}

export async function mockKnowledgeV3(
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
    versionHistory = false,
  } = {},
) {
  let revision = 1
  if (includeGrants) {
    await mockAdminGrants(page)
  }
  await mockAppSupportRoutes(page)
  await page.route('**/api/app/v1/knowledge/v3/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const bundleKey = payload.bundle_key

    if (path.endsWith('/catalogs')) {
      return fulfill(route, FAQ_CATALOGS)
    }
    if (path.endsWith('/themes') && method === 'POST') {
      const body = request.postDataJSON()
      FAQ_CATALOGS.themes.push({
        theme_key: body.theme_key || 'novo-tema',
        theme_label: body.theme_label || body.name || 'Novo tema',
        owner_email: body.owner_email || 'gestor@univesp.br',
      })
      return fulfill(route, FAQ_CATALOGS.themes.at(-1))
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
      return fulfill(
        route,
        versionsForMode(editorMode, revision, lifecycleState, validFrom, validUntil, versionHistory),
      )
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

export async function mockAdminGrants(page, { onGrantPost = null } = {}) {
  await page.route(/\/api\/app\/v1\/admin\//, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/\/+$/, '')
    const method = request.method()
    if (method === 'OPTIONS') {
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/admin/users') && method === 'GET') {
      return fulfill(route, [
        {
          email: 'op.guara@univesp.br',
          display_name: 'OP Guarulhos',
          profile_key: 'op',
        },
      ])
    }
    if (path.endsWith('/admin/access-groups') && method === 'GET') {
      return fulfill(route, [])
    }
    if (path.endsWith('/admin/permission-profiles') && method === 'GET') {
      return fulfill(route, [
        {
          id: 'faq-contributor-op',
          label: 'OP que sugere melhorias',
          base_persona: 'op',
          capabilities: ['suggest_knowledge'],
        },
      ])
    }
    if (path.endsWith('/admin/profile-assignments') && method === 'POST') {
      const body = request.postDataJSON()
      onGrantPost?.(body)
      return fulfill(route, { id: 'grant-1', ...body })
    }
    if (path.endsWith('/admin/profile-assignments') && method === 'GET') {
      return fulfill(route, [])
    }
    if (path.endsWith('/admin/catalogs') && method === 'GET') {
      return fulfill(route, { profiles: [], queues: [], polos: [], areas: [] })
    }
    if (path.endsWith('/admin/access-requests') && method === 'GET') {
      return fulfill(route, [])
    }
    return fulfill(route, {})
  })
}

export function sampleBundleList() {
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

function versionsForMode(editorMode, revision, lifecycleState, validFrom, validUntil, versionHistory) {
  if (versionHistory) {
    return [
      versionSummary(3, 'draft', validFrom, validUntil),
      versionSummary(2, 'pending_approval', validFrom, validUntil),
      versionSummary(1, 'published', validFrom, validUntil),
    ]
  }
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

function version(payload, revision, lifecycleState = 'draft', validFrom = '', validUntil = '', changeSummary = '') {
  return {
    version_id: 'version-1',
    version_label: 'rascunho',
    revision,
    lifecycle_state: lifecycleState,
    change_summary:
      changeSummary ||
      'Resumo editorial com mais de vinte caracteres para publicação direta.',
    valid_from: validFrom,
    valid_until: validUntil,
    etag: `"version-${revision}"`,
    payload,
  }
}

function versionSummary(revision, lifecycleState = 'draft', validFrom = '', validUntil = '') {
  return {
    version_id: `version-${revision}`,
    version_label: lifecycleState,
    revision,
    lifecycle_state: lifecycleState,
    change_summary: 'Alteração de exemplo para histórico.',
    valid_from: validFrom,
    valid_until: validUntil,
    etag: `"version-${revision}"`,
  }
}

export function flowPayload(bundleKey) {
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
            suggested_reply: 'Oriente a recuperação de senha pelo portal.',
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

export function flowPayloadWithIssue(bundleKey = 'acesso-ava') {
  const payload = flowPayload(bundleKey)
  const finalNode = payload.nodes.find((node) => node.node_id === 'final')
  finalNode.playbooks.op.objective = ''
  return payload
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
