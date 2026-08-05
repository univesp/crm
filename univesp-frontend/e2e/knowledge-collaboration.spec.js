import { expect, test } from '@playwright/test'

test('Analista consulta sugestões próprias sem editar nem incorporar rascunho', async ({ page }) => {
  await useProfile(page, 'analista_area')
  await page.route('**/api/app/v1/knowledge/v3/suggestions**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      return fulfill(route, [suggestion({ state: 'received' })])
    }
    return fulfill(route, {})
  })

  await page.goto('/crm/area/mudancas')
  await expect(page.getByRole('heading', { name: 'Sugestões de melhoria' })).toBeVisible()
  await expect(page.getByText('A resposta atual é pouco objetiva.')).toBeVisible()
  await expect(page.getByText('Resposta publicada', { exact: true })).toBeVisible()
  await expect(page.getByText('Resposta proposta', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar análise' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Incorporar ao rascunho' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Recusar' })).toHaveCount(0)
})

test('Gestor aprova mas não pode publicar a versão aprovada', async ({ page }) => {
  let lifecycle = 'pending_approval'
  await mockEditor(page, () => lifecycle, () => {
    lifecycle = 'approved'
  })
  await useProfile(page, 'gestor_area')
  await page.goto('/crm/area/faq/acesso-ava')
  await expect(page.getByRole('button', { name: 'Aprovar conteúdo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar versão aprovada' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Aprovar conteúdo' }).click()
  await expect(page.getByText('aguarda publicação pelo Admin')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar versão aprovada' })).toHaveCount(0)
})

test('Admin publica uma versão que já foi aprovada pelo Gestor', async ({ page }) => {
  await useProfile(page, 'admin_central')
  await mockEditor(page, () => 'approved', () => {})
  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('button', { name: 'Publicar versão aprovada' })).toBeVisible()
})

test('Admin define área, mas não pessoa específica para receber o caso', async ({ page }) => {
  await useProfile(page, 'admin_central')
  await mockEditor(page, () => 'draft', () => {})
  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByText('Distribuição do caso', { exact: true })).toBeVisible()
  await expect(page.getByText(/Quem recebe novos casos é definido pelo gestor/)).toBeVisible()
  await expect(page.getByText(/Pessoa específica/)).toHaveCount(0)
})

async function useProfile(page, profile) {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', value)
  }, profile)
}

async function mockEditor(page, lifecycle, approve) {
  const payload = flowPayload()
  await page.route('**/api/app/v1/knowledge/v3/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/catalogs')) {
      return fulfill(route, {
        themes: [{ theme_key: 'acesso-ava', theme_label: 'Acesso ao AVA' }],
        routing_patterns: [
          {
            pattern_key: 'op_then_area',
            label: 'OP → Área',
            steps: ['op', 'area'],
            allowed_routing_keys: ['atendimento-geral'],
          },
        ],
      })
    }
    if (path.endsWith('/versions')) {
      return fulfill(route, [version(lifecycle(), false)])
    }
    if (path.endsWith('/approve') && request.method() === 'POST') {
      approve()
      return fulfill(route, version('approved', false))
    }
    if (path.endsWith('/bundles/acesso-ava')) {
      const state = lifecycle()
      return fulfill(route, {
        bundle_key: 'acesso-ava',
        title: 'Acesso ao AVA',
        theme_key: 'acesso-ava',
        audience_profile: 'student',
        status: 'active',
        draft_version: state === 'pending_approval' ? 'draft-1' : '',
        published_version: 'published-1',
        draft: state === 'pending_approval' ? version(state, true, payload) : undefined,
        published: version('published', true, payload),
      })
    }
    return fulfill(route, {})
  })
}

function suggestion({ state }) {
  return {
    suggestion_id: 'suggestion-1',
    bundle_key: 'acesso-ava',
    bundle_title: 'Acesso ao AVA',
    theme_key: 'acesso-ava',
    version_id: 'published-1',
    node_id: 'final',
    audience_layer: 'op',
    target_path: ['root', 'final'],
    target_ref: { type: 'playbook_field', node_id: 'final', field: 'suggested_reply' },
    current_value: 'Resposta publicada',
    proposed_value: 'Resposta proposta',
    reason: 'A resposta atual é pouco objetiva.',
    author_email: 'op@univesp.br',
    state,
    reviewer_email: state === 'received' ? '' : 'analista.area@univesp.br',
    sla_due_at: '2026-08-01T12:00:00',
    sla_overdue: false,
  }
}

function version(lifecycleState, includePayload = false, payload = null) {
  return {
    version_id: lifecycleState === 'published' ? 'published-1' : 'draft-1',
    version_label: lifecycleState,
    revision: 1,
    lifecycle_state: lifecycleState,
    change_summary: 'Mudança revisada para aprovação.',
    etag: '"draft-1-1"',
    ...(includePayload ? { payload } : {}),
  }
}

function flowPayload() {
  return {
    schema_version: '3.0.0',
    bundle_key: 'acesso-ava',
    theme_key: 'acesso-ava',
    metadata: {
      title: 'Acesso ao AVA',
      audience_profile: 'student',
      operational_owner: { owner_type: 'queue', owner_key: 'atendimento-geral' },
      criticidade_default_key: 'media',
      sla_policy_key: '48h',
    },
    graph: { student_root_node_id: 'root', public_root_node_id: null, internal_root_node_id: null },
    routing_policy: { pattern_key: 'op_then_area', bpo_enabled: false, institutional_exceptions: [] },
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
          student: { blocks: [{ block_id: 'text', type: 'text', body: 'Resposta.' }] },
          public: null,
        },
        playbooks: {
          op: {
            objective: 'Resolver',
            checklist: [],
            systems: [],
            documents_to_request: [],
            suggested_reply: 'Resposta publicada',
            allowed_actions: [],
            escalation_criteria: '',
            escalation_reason_template: '',
            possible_outcomes: [],
          },
          bpo: null,
          analyst: null,
        },
        operational: { routing_override: 'atendimento-geral' },
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

function fulfill(route, data) {
  return route.fulfill({
    status: 200,
    json: { data, error: null, meta: {}, request_id: 'collaboration-e2e' },
  })
}
