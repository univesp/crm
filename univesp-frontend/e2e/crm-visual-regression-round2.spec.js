/**
 * Rodada 2 — regressão visual fora do FAQ v3.
 *
 * Status: scaffold. Ative cada teste removendo test.fixme e adicionando mocks
 * conforme o spec funcional correspondente em e2e/.
 *
 * Roadmap completo: e2e/VISUAL_REGRESSION_ROADMAP.md
 */
import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  prepareProfile,
  SNAPSHOT_OPTS,
} from './helpers/faq-v3-visual-helpers.js'

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

async function mockDashboardTickets(page) {
  await page.route('**/api/app/v1/tickets/UVSP-DASH-1', (route) =>
    route.fulfill({
      status: 200,
      json: { data: dashboardTicket, error: null, meta: {}, request_id: 'dashboard-detail' },
    }),
  )
  await page.route('**/api/app/v1/tickets?**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [dashboardTicket],
        error: null,
        meta: { page: 1, page_size: 100, total: 1 },
        request_id: 'dashboard-live',
      },
    }),
  )
}

test.describe('CRM admin — rodada 2', () => {
  test('dashboard administrativo sem overflow', async ({ page }) => {
    await prepareProfile(page, 'admin_central')
    await mockDashboardTickets(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/crm/admin/dashboard')
    await expect(page.getByText('Fonte institucional')).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await expect(page).toHaveScreenshot('admin-dashboard-1440x900.png', {
      fullPage: true,
      ...SNAPSHOT_OPTS,
    })
  })

  test.fixme('admin usuários — lista e formulários', async ({ page }) => {
    await prepareProfile(page, 'admin_central')
    await page.goto('/crm/admin/users')
    // TODO: mock **/api/app/v1/admin/users — ver admin-users.spec.js
    await expect(page).toHaveScreenshot('admin-users-1440x900.png', { fullPage: true, ...SNAPSHOT_OPTS })
  })

  test.fixme('admin configurações — painéis principais', async ({ page }) => {
    await prepareProfile(page, 'admin_central')
    await page.goto('/crm/admin/settings')
    // TODO: ver admin-settings.spec.js
    await expect(page).toHaveScreenshot('admin-settings-1440x900.png', { fullPage: true, ...SNAPSHOT_OPTS })
  })
})

test.describe('CRM operacional — rodada 2', () => {
  test.fixme('cockpit operacional OP', async ({ page }) => {
    await prepareProfile(page, 'op')
    await page.goto('/crm/operational/cockpit')
    // TODO: ver operational-live.spec.js
    await expect(page).toHaveScreenshot('operational-cockpit-1440x900.png', { fullPage: true, ...SNAPSHOT_OPTS })
  })
})

test.describe('CRM personas — FAQ publicada', () => {
  test.fixme('aluno — fluxo publicado', async ({ page }) => {
    await prepareProfile(page, 'aluno')
    await page.goto('/crm/aluno/faq')
    // TODO: ver student-published-faq.spec.js
    await expect(page).toHaveScreenshot('student-faq-1440x900.png', { fullPage: true, ...SNAPSHOT_OPTS })
  })

  test.fixme('OP — FAQ publicada e documento opcional', async ({ page }) => {
    await prepareProfile(page, 'op')
    await page.goto('/crm/operational/faq')
    // TODO: ver published-faq-personas.spec.js
    await expect(page).toHaveScreenshot('op-faq-1440x900.png', { fullPage: true, ...SNAPSHOT_OPTS })
  })
})

test.describe('CRM colaboração editorial', () => {
  test.fixme('analista — sugestões de melhoria', async ({ page }) => {
    await prepareProfile(page, 'analista_area')
    await page.goto('/crm/area/mudancas')
    // TODO: ver knowledge-collaboration.spec.js
    await expect(page).toHaveScreenshot('area-sugestoes-1440x900.png', { fullPage: true, ...SNAPSHOT_OPTS })
  })
})
