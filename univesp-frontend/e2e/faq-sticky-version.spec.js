import { expect, test } from '@playwright/test'

const v3RuntimePackage = {
  schema_version: '3.0.0-runtime',
  faq_id: 'acesso-ava',
  tipo_faq: 'aluno',
  metadata: { title: 'Acesso ao AVA' },
  versioning: {
    publication_status: 'published',
    bundle_version_id: 'version-v3',
  },
  nodes: [
    {
      id: 'acesso-root',
      node_kind: 'theme',
      perfil: 'aluno',
      titulo_exibido: 'Acesso ao AVA',
      pergunta_exibida: 'Qual problema você encontrou?',
      acao: 'ir_para_subniveis',
      fila_destino: 'nao_aplicavel',
      criticidade_padrao: 'media',
      sla_padrao: '48h',
      ativo: true,
      ordem: 1,
      publication_status: 'published',
    },
    {
      id: 'acesso-final',
      node_kind: 'leaf',
      perfil: 'aluno',
      titulo_exibido: 'Recuperar minha senha',
      resposta: 'Use a recuperação de senha do portal.',
      acao: 'abrir_atendimento',
      fila_destino: 'nao_aplicavel',
      criticidade_padrao: 'media',
      sla_padrao: '48h',
      ativo: true,
      ordem: 1,
      publication_status: 'published',
    },
  ],
  links: [
    {
      link_id: 'acesso-link',
      parent_node_id: 'acesso-root',
      child_node_id: 'acesso-final',
      ordem: 1,
      ativo: true,
    },
  ],
}

test('jornada v3 fixa versão e envia caminho contínuo ao backend', async ({ page }) => {
  let startPayload = null
  let advancePayload = null
  const recordedEvents = []
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'aluno')
  })
  await page.route('**/api/app/v1/knowledge/v3/runtime?**', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: [
          {
            bundle_id: 'acesso-ava',
            bundle_version_id: 'version-v3',
            package: v3RuntimePackage,
          },
        ],
        error: null,
        meta: { runtime_schema: '3.0.0', persona: 'student' },
      },
    })
  })
  await page.route('**/api/app/v1/knowledge/v3/sessions', async (route) => {
    startPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      json: {
        data: {
          faq_session_id: '11111111-1111-4111-8111-111111111111',
          bundle_key: 'acesso-ava',
          bundle_version_id: 'version-v3',
          persona: 'student',
          path: ['acesso-root'],
          expires_at: '2026-07-29 00:00:00',
        },
        error: null,
        meta: {},
      },
    })
  })
  await page.route('**/api/app/v1/knowledge/v3/sessions/*/advance', async (route) => {
    advancePayload = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      json: {
        data: {
          faq_session_id: '11111111-1111-4111-8111-111111111111',
          bundle_key: 'acesso-ava',
          bundle_version_id: 'version-v3',
          persona: 'student',
          path: advancePayload.path,
          expires_at: '2026-07-29 00:00:00',
        },
        error: null,
        meta: {},
      },
    })
  })
  await page.route('**/api/app/v1/knowledge/v3/events', async (route) => {
    recordedEvents.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      json: { data: { event_id: recordedEvents.at(-1).event_id }, error: null, meta: {} },
    })
  })

  await page.goto('/crm/aluno/duvida')
  await page.getByText('Acesso ao AVA', { exact: true }).click()
  await page.getByText('Recuperar minha senha', { exact: true }).click()

  await expect(page.getByText('Use a recuperação de senha do portal.', { exact: true })).toBeVisible()
  expect(startPayload).toMatchObject({
    bundle_key: 'acesso-ava',
    bundle_version_id: 'version-v3',
    persona: 'student',
  })
  expect(advancePayload.path).toEqual(['acesso-root', 'acesso-final'])
  expect(recordedEvents.some((event) => event.event_name === 'faq.node_viewed')).toBeTruthy()
})
