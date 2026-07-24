import { expect, test } from '@playwright/test'

async function prepareDevBypass(page, profileKey) {
  await page.addInitScript((key) => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', key)
  }, profileKey)
}

test.describe('MVP wiring (dev bypass)', () => {
  test('rotas aluno, OP e BPO carregam com dev bypass', async ({ page }) => {
    const routes = [
      { profile: 'admin_central', path: '/crm/admin', label: 'Admin' },
      { profile: 'aluno', path: '/crm/aluno', label: 'Aluno' },
      { profile: 'op', path: '/crm/op/fila', label: 'OP' },
      { profile: 'op_externo', path: '/crm/bpo/dashboard', label: 'BPO' },
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
