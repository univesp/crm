import { expect, test } from '@playwright/test'

const tickets = [
  {
    id: 'HD-9001',
    protocol: 'UVSP-20260720-9001',
    subject: 'Atendimento real carregado para o OP',
    description: 'Solicitacao criada pela API institucional.',
    status: 'in_analysis',
    status_label: 'Em analise',
    priority: 'High',
    source: 'portal',
    queue: 'OP do polo - Guarulhos',
    area: '',
    student: {
      email: 'aluno@aluno.univesp.br',
      name: 'Aluno Integrado',
      ra: '24009001',
      polo: 'Guarulhos',
      course: 'Engenharia',
    },
    created_at: '2026-07-20T10:00:00-03:00',
    updated_at: '2026-07-20T10:05:00-03:00',
  },
  {
    id: 'HD-9002',
    protocol: 'UVSP-20260720-9002',
    subject: 'Atendimento real escalado para area',
    description: 'Caso aguardando analise interna.',
    status: 'waiting_internal',
    status_label: 'Em atendimento interno',
    priority: 'Urgent',
    source: 'portal',
    queue: 'Suporte Academico Digital',
    area: 'Suporte Academico Digital',
    student: {
      email: 'outro@aluno.univesp.br',
      name: 'Outro Aluno',
      ra: '24009002',
      polo: 'Campinas',
      course: 'Letras',
    },
    created_at: '2026-07-20T09:00:00-03:00',
    updated_at: '2026-07-20T09:30:00-03:00',
  },
]

test('fila OP usa somente tickets live e nao injeta seeds', async ({ page }) => {
  await selectBypassProfile(page, 'op')
  await mockTickets(page)

  await page.goto('/crm/op/fila')

  await expect(page.getByText('Atendimento real carregado para o OP', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Rematricula para o proximo semestre', { exact: true })).toHaveCount(0)
})

test('fila da area usa ticket live no escopo da area', async ({ page }) => {
  await selectBypassProfile(page, 'analista_area')
  await mockTickets(page)

  await page.goto('/crm/area/fila')

  await expect(page.getByText('Atendimento real escalado para area', { exact: true })).toBeVisible()
  await expect(page.getByText('Prazo encerrado da atividade avaliativa', { exact: true })).toHaveCount(0)
})

test('resposta do OP usa transicao institucional e nao grava somente no store', async ({ page }) => {
  const transitions = []
  await selectBypassProfile(page, 'op')
  await mockTicketDetail(page, tickets[0], transitions)

  await page.goto('/crm/op/fila/UVSP-20260720-9001')
  await expect(page.getByText('Atendimento real carregado para o OP', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Responder ao aluno/ }).click()
  await page.getByLabel('Resposta ao aluno').fill('Orientacao institucional confirmada.')
  await page.getByRole('button', { name: 'Registrar resposta ao aluno' }).click()
  await page.getByRole('button', { name: 'Confirmar resposta ao aluno' }).click()

  await expect.poll(() => transitions.length).toBe(1)
  expect(transitions[0]).toEqual({
    status: 'resolved',
    message: 'Orientacao institucional confirmada.',
  })
})

test('resposta da area usa acao institucional e nao persiste somente no store', async ({ page }) => {
  const areaActions = []
  await selectBypassProfile(page, 'analista_area')
  await mockAreaTicketDetail(page, tickets[1], areaActions)

  await page.goto('/crm/area/fila/UVSP-20260720-9002')
  await expect(page.getByText('Atendimento real escalado para area', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Responder aluno \+ OP/ }).click()
  await page.getByLabel('Resposta final para aluno e OP').fill('Parecer tecnico institucional registrado.')
  await page.getByRole('button', { name: 'Enviar resposta' }).click()
  await page.getByRole('button', { name: 'Confirmar envio da resposta' }).click()

  await expect.poll(() => areaActions.length).toBe(1)
  expect(areaActions[0]).toEqual({
    action_type: 'technical_reply',
    note: 'Parecer tecnico institucional registrado.',
    destination_area: '',
  })
})

async function mockAreaTicketDetail(page, ticket, areaActions) {
  await page.route('**/api/app/v1/tickets/**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST' && request.url().endsWith('/area-actions')) {
      const body = request.postDataJSON?.() || {}
      areaActions.push(body)
      return route.fulfill({
        status: 200,
        json: {
          data: {
            ...ticket,
            status: 'in_analysis',
            status_label: 'Em analise',
            area: '',
            timeline: [],
            attachments: [],
          },
          error: null,
          meta: {},
          request_id: 'e2e-live-area-action',
        },
      })
    }
    return route.fulfill({
      status: 200,
      json: {
        data: { ...ticket, timeline: [], attachments: [] },
        error: null,
        meta: {},
        request_id: 'e2e-live-area-detail',
      },
    })
  })
}
async function mockTicketDetail(page, ticket, transitions) {
  await page.route('**/api/app/v1/tickets/**', async (route) => {
    const request = route.request()
    const body = request.postDataJSON?.() || {}
    if (request.method() === 'POST' && request.url().endsWith('/transition')) {
      transitions.push(body)
      return route.fulfill({
        status: 200,
        json: {
          data: { ...ticket, status: body.status, status_label: 'Resolvido' },
          error: null,
          meta: {},
          request_id: 'e2e-live-transition',
        },
      })
    }
    return route.fulfill({
      status: 200,
      json: {
        data: { ...ticket, timeline: [], attachments: [] },
        error: null,
        meta: {},
        request_id: 'e2e-live-detail',
      },
    })
  })
}

async function selectBypassProfile(page, profile) {
  await page.addInitScript((value) => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', value)
  }, profile)
}

async function mockTickets(page) {
  await page.route('**/api/app/v1/tickets?**', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: tickets,
        error: null,
        meta: { page: 1, page_size: 100, total: tickets.length },
        request_id: 'e2e-live-tickets',
      },
    })
  })
}
