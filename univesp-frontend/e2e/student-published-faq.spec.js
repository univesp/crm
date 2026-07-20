import { expect, test } from '@playwright/test'

const publishedPackage = {
  schema_version: '2.0.0',
  faq_id: 'faq-aluno-institucional',
  tipo_faq: 'aluno',
  metadata: { title: 'FAQ institucional publicada' },
  versioning: { publication_status: 'published', published_version: 'v2' },
  publication: {},
  nodes: [
    {
      id: 'tema-institucional',
      tipo_faq: 'aluno',
      perfil: 'aluno',
      node_kind: 'theme',
      tema: 'institucional',
      subtema: 'geral',
      titulo_exibido: 'Tema vindo do Frappe',
      pergunta_exibida: 'Qual orientacao institucional voce procura?',
      resposta: '',
      acao: 'ir_para_subniveis',
      abre_atendimento: false,
      fila_destino: 'sra',
      criticidade_padrao: 'media',
      sla_padrao: '48h',
      ativo: true,
      ordem: 1,
      publication_status: 'published',
    },
    {
      id: 'resposta-institucional',
      tipo_faq: 'aluno',
      perfil: 'aluno',
      node_kind: 'answer',
      tema: 'institucional',
      subtema: 'orientacao',
      titulo_exibido: 'Resposta publicada no Frappe',
      pergunta_exibida: 'Deseja ler a orientacao?',
      resposta: 'Conteudo oficial publicado e vigente.',
      acao: 'encerrar',
      abre_atendimento: false,
      fila_destino: 'sra',
      criticidade_padrao: 'media',
      sla_padrao: '48h',
      ativo: true,
      ordem: 1,
      publication_status: 'published',
    },
  ],
  links: [{
    link_id: 'link-institucional',
    parent_node_id: 'tema-institucional',
    child_node_id: 'resposta-institucional',
    ordem: 1,
    ativo: true,
  }],
}

test('jornada do aluno consome somente FAQ publicada pelo Frappe em modo live', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'aluno')
  })
  await page.route('**/api/app/v1/knowledge/faq-published?**', async (route) => {
    const faqType = new URL(route.request().url()).searchParams.get('faq_type')
    await route.fulfill({
      status: 200,
      json: {
        data: faqType === 'aluno'
          ? [{ bundle_id: 'bundle:aluno:institucional', priority: 100, display_rank: 1, package: publishedPackage }]
          : [],
        error: null,
        meta: { faq_type: faqType, version: 'faq-version-2' },
        request_id: `faq-published-${faqType}`,
      },
    })
  })

  await page.goto('/crm/aluno/duvida')

  await expect(page.getByText('Tema vindo do Frappe', { exact: true })).toBeVisible()
  await expect(page.getByText('Matricula e rematricula', { exact: true })).toHaveCount(0)
  await page.getByText('Tema vindo do Frappe', { exact: true }).click()
  await expect(page.getByText('Resposta publicada no Frappe', { exact: true })).toBeVisible()
})