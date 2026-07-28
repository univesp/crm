import { expect, test } from '@playwright/test'

function publishedPackage(faqType, prefix, rootTitle, answerTitle) {
  return {
    schema_version: '2.0.0',
    faq_id: `faq-${faqType}-institucional`,
    tipo_faq: faqType,
    metadata: { title: rootTitle },
    versioning: {
      publication_status: 'published',
      bundle_version_id: 'v3.0',
      published_version: 'v3.0',
    },
    nodes: [
      {
        id: `${prefix}-root`,
        node_kind: 'theme',
        perfil: faqType,
        titulo_exibido: rootTitle,
        pergunta_exibida: 'Escolha uma orientação.',
        acao: 'ir_para_subniveis',
        fila_destino: 'atendimento-geral',
        criticidade_padrao: 'media',
        sla_padrao: '48h',
        ativo: true,
        ordem: 1,
        publication_status: 'published',
      },
      {
        id: `${prefix}-answer`,
        node_kind: 'answer',
        perfil: faqType,
        titulo_exibido: answerTitle,
        resposta: 'Conteúdo oficial publicado.',
        acao: 'abrir_atendimento',
        fila_destino: 'atendimento-geral',
        criticidade_padrao: 'media',
        sla_padrao: '48h',
        ativo: true,
        ordem: 1,
        publication_status: 'published',
      },
    ],
    links: [
      {
        link_id: `${prefix}-link`,
        parent_node_id: `${prefix}-root`,
        child_node_id: `${prefix}-answer`,
        ordem: 1,
        ativo: true,
      },
    ],
  }
}

test('OP consome somente o bundle operacional publicado', async ({ page }) => {
  const opPackage = publishedPackage(
    'op',
    'op-live',
    'Playbook operacional publicado',
    'Procedimento vigente do OP',
  )
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'op')
  })
  await page.route('**/api/app/v1/knowledge/faq-published?**', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: [
          {
            bundle_id: 'bundle:op:live',
            bundle_version_id: 'v3.0',
            package: opPackage,
          },
        ],
        error: null,
        meta: { faq_type: 'op', version: 'library-v3' },
      },
    })
  })

  await page.goto('/crm/op/playbook')
  await expect(page.getByText('Playbook operacional publicado', { exact: true })).toBeVisible()
  await expect(page.getByText('Matricula e rematricula', { exact: true })).toHaveCount(0)
})

test('público consome API real e envia lineage sem escolher fila', async ({ page }) => {
  const publicPackage = publishedPackage(
    'publico',
    'public-live',
    'Orientação pública publicada',
    'Resposta pública vigente',
  )
  let ticketPayload = null
  await page.route('**/api/public/v1/knowledge/faq-published?**', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: [
          {
            bundle_id: 'bundle:publico:live',
            bundle_version_id: 'v3.0',
            package: publicPackage,
          },
        ],
        error: null,
        meta: { faq_type: 'publico', version: 'library-v3' },
      },
    })
  })
  await page.route('**/api/public/v1/tickets', async (route) => {
    ticketPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      json: {
        data: { id: 'HD-TICKET-1', protocol: 'PRT-2026-000001', status: 'open' },
        error: null,
        meta: {},
      },
    })
  })

  await page.goto('/crm/publico')
  await page.getByLabel('Nome completo').fill('Pessoa de Teste')
  await page.getByLabel('CPF').fill('12345678909')
  await page.getByLabel('E-mail').fill('pessoa.teste@example.com')
  await page.getByText('Autorizo o uso dos dados').click()
  await page.getByRole('button', { name: 'Continuar para FAQ' }).click()
  await page.getByRole('button', { name: 'Orientação pública publicada' }).click()
  await page.getByRole('button', { name: 'Resposta pública vigente' }).click()
  await page.getByLabel('Assunto').fill('Acesso ao portal')
  await page.getByLabel('Descricao').fill('Preciso de orientação adicional.')
  await page.getByRole('button', { name: 'Abrir protocolo' }).click()

  await expect.poll(() => ticketPayload).not.toBeNull()
  expect(ticketPayload.queue).toBeUndefined()
  expect(ticketPayload.knowledge).toEqual({
    bundle_id: 'bundle:publico:live',
    bundle_version_id: 'v3.0',
    node_id: 'public-live-answer',
  })
})
