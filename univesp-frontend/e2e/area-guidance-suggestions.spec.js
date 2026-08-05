import { expect, test } from '@playwright/test'

test('analista consulta conteúdo publicado e registra sugestão pela API real', async ({ page }) => {
  let createdPayload = null
  await useProfile(page, 'analista_area')
  await page.route('**/api/app/v1/knowledge/v3/bundles**', async (route) => {
    const requestPath = new URL(route.request().url()).pathname
    if (requestPath.endsWith('/bundles')) {
      return fulfill(route, [{
        bundle_key: 'acesso-ava',
        title: 'Acesso ao AVA',
        theme_key: 'acesso-ava',
        audience_profile: 'student',
        status: 'active',
        published_version: 'published-1',
      }])
    }

    return fulfill(route, {
      bundle_key: 'acesso-ava',
      title: 'Acesso ao AVA',
      theme_key: 'acesso-ava',
      published_version: 'published-1',
      published: {
        version_id: 'published-1',
        lifecycle_state: 'published',
        payload: publishedPayload(),
      },
    })
  })
  await page.route('**/api/app/v1/knowledge/v3/suggestions**', async (route) => {
    if (route.request().method() === 'POST') {
      createdPayload = route.request().postDataJSON()
      return fulfill(route, suggestionResponse())
    }
    return fulfill(route, [])
  })

  await page.goto('/crm/area/orientacao')
  await expect(page.getByRole('button', { name: /Sugerir ajuste/i })).toBeVisible()
  await expect(page.getByText('Resposta publicada no AVA', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Sugerir ajuste/i }).click()
  await page.getByLabel('Titulo da sugestao').fill('Esclarecer o próximo passo')
  await page.getByLabel('Proposta de ajuste').fill('Inclua o caminho exato para recuperar a senha.')
  await page.getByLabel('Justificativa operacional').fill('A orientação atual gera dúvidas e retrabalho recorrente.')
  await page.getByRole('button', { name: 'Registrar sugestao' }).click()

  await expect.poll(() => createdPayload).not.toBeNull()
  expect(createdPayload.bundle_key).toBe('acesso-ava')
  expect(createdPayload.version_id).toBe('published-1')
  expect(createdPayload.audience_layer).toBe('analyst')
  expect(createdPayload.target_path).toEqual(['root', 'final'])
  expect(createdPayload.target_ref).toEqual({
    type: 'playbook_field',
    field: 'suggested_reply',
    node_id: 'final',
  })
  await expect(page.getByText(/Sugestao registrada/)).toBeVisible()
})

async function useProfile(page, profile) {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', value)
  }, profile)
}

function fulfill(route, data) {
  return route.fulfill({
    status: 200,
    json: { data, error: null, meta: {}, request_id: 'area-guidance-e2e' },
  })
}

function publishedPayload() {
  return {
    schema_version: '3.0.0',
    bundle_key: 'acesso-ava',
    theme_key: 'acesso-ava',
    metadata: { title: 'Acesso ao AVA' },
    graph: { student_root_node_id: 'root', public_root_node_id: null, internal_root_node_id: null },
    nodes: [
      {
        node_id: 'root',
        stable_key: 'root',
        node_kind: 'path',
        audiences: ['student'],
        display: { title: 'Início' },
      },
      {
        node_id: 'final',
        stable_key: 'final',
        node_kind: 'final',
        audiences: ['student'],
        display: { title: 'Resposta publicada no AVA' },
        content: {
          student: {
            blocks: [{ block_id: 'student-text', type: 'text', body: 'Use a recuperação de senha do portal.' }],
          },
        },
        playbooks: {
          analyst: { suggested_reply: 'Oriente a recuperação de senha pelo portal.' },
        },
        operational: { area_key: 'Suporte Academico Digital' },
      },
    ],
    edges: [{
      edge_id: 'root-final',
      parent_node_id: 'root',
      child_node_id: 'final',
      active: true,
      audiences: ['student'],
    }],
  }
}

function suggestionResponse() {
  return {
    suggestion_id: 'suggestion-1',
    bundle_key: 'acesso-ava',
    bundle_title: 'Acesso ao AVA',
    theme_key: 'acesso-ava',
    version_id: 'published-1',
    node_id: 'final',
    audience_layer: 'analyst',
    state: 'received',
    reason: 'Esclarecer o próximo passo: A orientação atual gera dúvidas.',
    proposed_value: 'Inclua o caminho exato para recuperar a senha.',
  }
}
