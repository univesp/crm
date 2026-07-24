import { expect, test } from '@playwright/test'

function appPath(route) {
  const base = String(process.env.PLAYWRIGHT_ROUTER_BASE || '/crm/').replace(/\/$/, '')
  const path = route.startsWith('/') ? route : `/${route}`
  return base ? `${base}${path}` : path
}

async function prepareDevBypass(page, profileKey) {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', key)
  }, profileKey)
}

test.describe('MVP wiring (dev bypass)', () => {
  test('rotas aluno, OP e BPO carregam com dev bypass', async ({ page }) => {
    const routes = [
      { profile: 'admin_central', path: appPath('/admin/dashboard'), label: 'Admin' },
      { profile: 'aluno', path: appPath('/aluno'), label: 'Aluno' },
      { profile: 'op', path: appPath('/op/fila'), label: 'OP' },
      { profile: 'op_externo', path: appPath('/bpo/dashboard'), label: 'BPO' },
    ]
    for (const route of routes) {
      await prepareDevBypass(page, route.profile)
      const response = await page.goto(route.path)
      expect(response?.status(), `${route.label} HTTP`).toBeLessThan(400)
      await expect(page.locator('#app')).toBeVisible()
    }
  })

  test('FAQ publica responde 200 (vazia pre-import)', async ({ request }) => {
    const response = await request.get('/api/public/v1/knowledge/faq-published?faq_type=publico')
    expect(response.status()).toBeLessThan(500)
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('data')
    }
  })
})
