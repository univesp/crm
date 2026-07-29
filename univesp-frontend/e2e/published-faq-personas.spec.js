import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/public/v1/academic-catalogs', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: {
          courses: [{ key: 'Engenharia', label: 'Engenharia' }],
          poles: [{ key: 'guarulhos', label: 'Guarulhos' }],
        },
        error: null,
      },
    }),
  )
})

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
        node_kind: 'leaf',
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
  await page.route('**/api/app/v1/knowledge/v3/runtime?**', async (route) => {
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
  publicPackage.schema_version = '3.0.0-runtime'
  let ticketPayload = null
  const sessionId = '22222222-2222-4222-8222-222222222222'
  const sessionCalls = []
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
        meta: { faq_type: 'publico', version: 'library-v3', runtime_schema: '3.0.0' },
      },
    })
  })
  await page.route('**/api/public/v1/knowledge/v3/sessions', async (route) => {
    sessionCalls.push('start')
    await route.fulfill({
      status: 201,
      json: {
        data: {
          faq_session_id: sessionId,
          bundle_key: 'bundle:publico:live',
          bundle_version_id: 'v3.0',
          persona: 'public',
          path: ['public-live-root'],
        },
        error: null,
      },
    })
  })
  await page.route(
    `**/api/public/v1/knowledge/v3/sessions/${sessionId}/advance`,
    async (route) => {
      sessionCalls.push('advance')
      await route.fulfill({
        status: 200,
        json: {
          data: {
            faq_session_id: sessionId,
            bundle_key: 'bundle:publico:live',
            bundle_version_id: 'v3.0',
            persona: 'public',
            path: ['public-live-root', 'public-live-answer'],
          },
          error: null,
        },
      })
    },
  )
  await page.route('**/api/public/v1/knowledge/v3/events', async (route) => {
    sessionCalls.push(`event:${route.request().postDataJSON().event_name}`)
    await route.fulfill({ status: 200, json: { data: { recorded: true }, error: null } })
  })
  await page.route('**/api/public/v1/runtime/flags', async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: { faq_public_anonymous: true, faq_public_documents: false }, error: null },
    })
  })
  await page.route('**/api/public/v1/intakes', async (route) => {
    ticketPayload = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        data: {
          intake_id: 'INTAKE-1',
          state: 'ready',
          upload_token: 'public-token',
        },
        error: null,
        meta: {},
      },
    })
  })
  await page.route('**/api/public/v1/intakes/INTAKE-1/finalize', async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: { id: 'HD-TICKET-1', protocol: 'PRT-2026-000001' }, error: null },
    })
  })

  await page.goto('/crm/publico')
  await page.getByRole('button', { name: 'Orientação pública publicada' }).click()
  await page.getByRole('button', { name: 'Resposta pública vigente' }).click()
  await page.getByRole('button', { name: 'Não, abrir atendimento' }).click()
  await page.getByLabel('Nome completo').fill('Pessoa de Teste')
  await page.getByLabel('E-mail').fill('pessoa.teste@example.com')
  await page.getByLabel('Celular').fill('11999990000')
  await page.getByLabel('O que aconteceu?').fill('Preciso de orientação adicional.')
  await page.getByText('Autorizo o uso destes dados').click()
  await page.getByLabel('Assunto').fill('Acesso ao portal')
  await page.getByRole('button', { name: 'Abrir protocolo' }).click()

  await expect.poll(() => ticketPayload).not.toBeNull()
  expect(ticketPayload.queue).toBeUndefined()
  expect(ticketPayload.faq_session_id).toBe(sessionId)
  expect(ticketPayload.knowledge).toEqual({
    bundle_id: 'bundle:publico:live',
    bundle_version_id: 'v3.0',
    node_id: 'public-live-answer',
    path: ['public-live-root', 'public-live-answer'],
  })
  expect(sessionCalls).toEqual([
    'start',
    'advance',
    'event:faq.node_viewed',
    'event:faq.ticket_open_started',
  ])
})

test('público renderiza blocos editoriais acessíveis na ordem publicada', async ({ page }) => {
  const publicPackage = publishedPackage(
    'publico',
    'media-live',
    'Orientações com mídia',
    'Como recuperar o acesso',
  )
  publicPackage.nodes[1].content_blocks = [
    { block_id: 'aviso-1', type: 'notice', body: 'Nunca compartilhe sua senha.' },
    {
      block_id: 'imagem-1',
      type: 'image',
      url: 'https://cdn.univesp.br/faq/acesso.png',
      alt: 'Tela de recuperação de acesso',
    },
    {
      block_id: 'video-1',
      type: 'video',
      url: 'https://cdn.univesp.br/faq/acesso.mp4',
      captions_url: 'https://cdn.univesp.br/faq/acesso.vtt',
      transcript: 'Abra o portal e selecione a opção de recuperação.',
    },
  ]
  await page.route('**/api/public/v1/knowledge/faq-published?**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [{ bundle_id: 'media-live', bundle_version_id: 'v3.2', package: publicPackage }],
        error: null,
      },
    }),
  )
  await page.route('**/api/public/v1/runtime/flags', (route) =>
    route.fulfill({
      status: 200,
      json: { data: { faq_public_anonymous: true, faq_public_documents: false }, error: null },
    }),
  )

  await page.goto('/crm/publico')
  await page.getByRole('button', { name: 'Orientações com mídia' }).click()
  await page.getByRole('button', { name: 'Como recuperar o acesso' }).click()

  await expect(page.getByRole('note')).toHaveText('Nunca compartilhe sua senha.')
  await expect(page.getByRole('img', { name: 'Tela de recuperação de acesso' })).toBeVisible()
  await expect(page.getByText('Transcrição do vídeo')).toBeVisible()
  await page.getByText('Transcrição do vídeo').click()
  await expect(page.getByText('Abra o portal e selecione a opção de recuperação.')).toBeVisible()
})

test('fluxo público pede CPF por finalidade e envia documento opcional', async ({ page }) => {
  const publicPackage = publishedPackage(
    'publico',
    'login-live',
    'Problemas de acesso',
    'Não consigo entrar',
  )
  publicPackage.nodes[1].document_policy = { mode: 'optional' }
  publicPackage.nodes[1].intake_policy = {
    requires_cpf: true,
    cpf_purpose: 'Confirmar identidade para corrigir o cadastro.',
    requires_ra: true,
    requires_course: false,
    requires_polo: false,
  }
  let uploadToken = ''
  const submissionOrder = []
  await page.route('**/api/public/v1/knowledge/faq-published?**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [{ bundle_id: 'login-live', bundle_version_id: 'v3.1', package: publicPackage }],
        error: null,
      },
    }),
  )
  await page.route('**/api/public/v1/runtime/flags', (route) =>
    route.fulfill({
      status: 200,
      json: { data: { faq_public_anonymous: true, faq_public_documents: true }, error: null },
    }),
  )
  await page.route('**/api/public/v1/intakes', (route) => {
    submissionOrder.push('intake')
    return route.fulfill({
      status: 201,
      json: {
        data: { intake_id: 'INTAKE-DOC-1', state: 'ready', upload_token: 'token-doc' },
        error: null,
      },
    })
  })
  await page.route('**/api/public/v1/intakes/INTAKE-DOC-1/documents', (route) => {
    submissionOrder.push('document-clean')
    uploadToken = route.request().headers()['x-public-upload-token']
    return route.fulfill({
      status: 201,
      json: { data: { id: 'DOC-1', file_name: 'evidencia.pdf', status: 'clean' }, error: null },
    })
  })
  await page.route('**/api/public/v1/intakes/INTAKE-DOC-1/finalize', (route) => {
    submissionOrder.push('ticket-created')
    return route.fulfill({
      status: 200,
      json: { data: { id: 'HD-DOC-1', protocol: 'PRT-2026-000002' }, error: null },
    })
  })

  await page.goto('/crm/publico')
  await page.getByRole('button', { name: 'Problemas de acesso' }).click()
  await page.getByRole('button', { name: 'Não consigo entrar' }).click()
  await page.getByRole('button', { name: 'Não, abrir atendimento' }).click()
  await expect(page.getByLabel('CPF')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'RA', exact: true })).toBeVisible()
  await page.getByLabel('Nome completo').fill('Aluno sem acesso')
  await page.getByLabel('E-mail').fill('aluno@example.com')
  await page.getByLabel('Celular').fill('11999990000')
  await page.getByLabel('CPF').fill('12345678909')
  await page.getByRole('textbox', { name: 'RA', exact: true }).fill('1234567')
  await page.getByLabel('O que aconteceu?').fill('A recuperação de senha não envia o link.')
  await page.getByLabel('Documento opcional').setInputFiles({
    name: 'evidencia.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 teste'),
  })
  await page.getByText('Autorizo o uso destes dados').click()
  await page.getByRole('button', { name: 'Abrir protocolo' }).click()

  await expect(page.getByRole('heading', { name: 'Protocolo registrado' })).toBeVisible()
  expect(uploadToken).toBe('token-doc')
  expect(submissionOrder).toEqual(['intake', 'document-clean', 'ticket-created'])
})

test('documento obrigatório bloqueia envio antes de criar protocolo', async ({ page }) => {
  const publicPackage = publishedPackage(
    'publico',
    'required-live',
    'Envio de comprovante',
    'Anexar comprovante',
  )
  publicPackage.nodes[1].document_policy = { mode: 'required' }
  let ticketCreated = false
  await page.route('**/api/public/v1/knowledge/faq-published?**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [{ bundle_id: 'required-live', bundle_version_id: 'v3.1', package: publicPackage }],
        error: null,
      },
    }),
  )
  await page.route('**/api/public/v1/runtime/flags', (route) =>
    route.fulfill({
      status: 200,
      json: { data: { faq_public_anonymous: true, faq_public_documents: true }, error: null },
    }),
  )
  await page.route('**/api/public/v1/intakes', (route) => {
    ticketCreated = true
    return route.abort()
  })

  await page.goto('/crm/publico')
  await page.getByRole('button', { name: 'Envio de comprovante' }).click()
  await page.getByRole('button', { name: 'Anexar comprovante' }).click()
  await page.getByRole('button', { name: 'Não, abrir atendimento' }).click()
  await page.getByLabel('Nome completo').fill('Visitante')
  await page.getByLabel('E-mail').fill('visitante@example.com')
  await page.getByLabel('Celular').fill('11999990000')
  await page.getByLabel('O que aconteceu?').fill('Preciso encaminhar o comprovante.')
  await page.getByText('Autorizo o uso destes dados').click()
  await page.getByRole('button', { name: 'Abrir protocolo' }).click()

  await expect(page.getByRole('alert')).toContainText('exige um documento')
  expect(ticketCreated).toBe(false)
})
