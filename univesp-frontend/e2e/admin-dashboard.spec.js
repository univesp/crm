import { expect, test } from '@playwright/test'

test('dashboard administrativo usa tickets institucionais paginados', async ({ page }) => {
  const requests = []
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
  })
  await page.route('**/api/app/v1/tickets?**', async (route) => {
    requests.push(new URL(route.request().url()).searchParams)
    await route.fulfill({
      status: 200,
      json: {
        data: [{
          id: 'HD-DASH-1',
          protocol: 'UVSP-DASH-1',
          subject: 'Indicador institucional do dashboard',
          description: 'Registro vindo da API.',
          status: 'in_analysis',
          status_label: 'Em analise',
          priority: 'High',
          source: 'portal',
          queue: 'OP do polo - Guarulhos',
          area: '',
          student: { name: 'Aluno Dashboard', email: 'aluno@univesp.br', polo: 'Guarulhos' },
          created_at: '2026-07-20T10:00:00-03:00',
          updated_at: '2026-07-20T10:05:00-03:00',
        }],
        error: null,
        meta: { page: 1, page_size: 100, total: 1 },
        request_id: 'dashboard-live',
      },
    })
  })

  await page.goto('/crm/admin/dashboard')

  await expect(page.getByText('Fonte institucional')).toBeVisible()
  await expect(page.getByText('1 de 1 tickets carregados')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Volume ativo 1 em tela' })).toBeVisible()
  await page.getByText('Analise avancada e auditoria', { exact: true }).click()
  await expect(page.getByText('Indicador institucional do dashboard', { exact: true }).first()).toBeVisible()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].get('page_size')).toBe('100')
})