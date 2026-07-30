import { expect, test } from '@playwright/test'

const dashboardTicket = {
  id: 'HD-DASH-1',
  protocol: 'UVSP-DASH-1',
  subject: 'Indicador institucional do dashboard',
  description: 'Registro vindo da API.',
  status: 'in_analysis',
  status_label: 'Em análise',
  priority: 'High',
  source: 'portal',
  queue: 'OP do polo - Guarulhos',
  area: '',
  student: { name: 'Aluno Dashboard', email: 'aluno@univesp.br', ra: '123456', polo: 'Guarulhos' },
  created_at: '2026-07-20T10:00:00-03:00',
  updated_at: '2026-07-20T10:05:00-03:00',
}

async function prepareAdmin(page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
  })
}

async function mockDashboardTickets(page, requests = []) {
  await page.route('**/api/app/v1/tickets/UVSP-DASH-1', (route) => route.fulfill({
    status: 200,
    json: { data: dashboardTicket, error: null, meta: {}, request_id: 'dashboard-detail' },
  }))
  await page.route('**/api/app/v1/tickets?**', async (route) => {
    requests.push(new URL(route.request().url()).searchParams)
    await route.fulfill({
      status: 200,
      json: {
        data: [dashboardTicket],
        error: null,
        meta: { page: 1, page_size: 100, total: 1 },
        request_id: 'dashboard-live',
      },
    })
  })
}

test('dashboard administrativo usa tickets institucionais e não cria overflow horizontal', async ({ page }) => {
  const requests = []
  await prepareAdmin(page)
  await mockDashboardTickets(page, requests)
  await page.setViewportSize({ width: 1211, height: 912 })
  await page.goto('/crm/admin/dashboard')

  await expect(page.getByText('Fonte institucional')).toBeVisible()
  await expect(page.getByText('1 de 1 tickets carregados')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Volume ativo 1 em tela' })).toBeVisible()
  await expect(page.getByText('Ações recomendadas', { exact: true })).toBeVisible()
  await expect(page.getByText('Saída após a FAQ', { exact: true })).toBeVisible()
  await page.getByText('Análise avançada e auditoria', { exact: true }).click()
  await expect(page.getByText('Indicador institucional do dashboard', { exact: true }).first()).toBeVisible()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].get('page_size')).toBe('100')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test('administrador busca e abre protocolo em modo somente leitura', async ({ page }) => {
  await prepareAdmin(page)
  await mockDashboardTickets(page)
  await page.goto('/crm/admin/dashboard')

  await page.getByLabel('Buscar protocolo').fill('UVSP-DASH-1')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()

  await expect.poll(() => new URL(page.url()).pathname).toBe('/crm/admin/protocolos/UVSP-DASH-1')
  await expect(page.getByRole('heading', { name: 'Consulta de protocolo' })).toBeVisible()
  await expect(page.getByText('UVSP-DASH-1')).toBeVisible()
  await expect(page.getByText('Aluno Dashboard', { exact: true })).toBeVisible()
  await expect(page.getByText('Em análise', { exact: true })).toBeVisible()
})

test('busca informa quando protocolo não existe ou está fora do escopo', async ({ page }) => {
  await prepareAdmin(page)
  await page.route('**/api/app/v1/tickets/UVSP-INEXISTENTE', (route) => route.fulfill({
    status: 404,
    json: { data: null, error: { code: 'not_found', message: 'Protocolo não encontrado ou fora do seu escopo.' }, meta: {}, request_id: 'not-found' },
  }))
  await page.route('**/api/app/v1/tickets?**', (route) => route.fulfill({
    status: 200,
    json: { data: [], error: null, meta: { page: 1, page_size: 100, total: 0 }, request_id: 'dashboard-empty' },
  }))
  await page.goto('/crm/admin/dashboard')

  await page.getByLabel('Buscar protocolo').fill('UVSP-INEXISTENTE')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText('Protocolo não encontrado')
  await expect.poll(() => new URL(page.url()).pathname).toBe('/crm/admin/dashboard')
})