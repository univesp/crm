import { expect, test } from '@playwright/test'

test('salva parametros institucionais com versao e motivo auditavel', async ({ page }) => {
  let savedPayload = null
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
  })
  await page.route('**/api/app/v1/admin/runtime-settings', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      savedPayload = request.postDataJSON()
      return route.fulfill({
        status: 200,
        json: {
          data: {
            parameters: savedPayload.parameters,
            version: 'version-2',
            updated_by: 'admin@univesp.br',
          },
          error: null,
          meta: {},
          request_id: 'settings-save',
        },
      })
    }
    return route.fulfill({
      status: 200,
      json: {
        data: { parameters: {}, version: 'version-1', updated_by: '' },
        error: null,
        meta: {},
        request_id: 'settings-load',
      },
    })
  })

  await page.goto('/crm/admin/parametros')
  await expect(page.getByRole('button', { name: 'Padrões oficiais' })).toBeVisible()
  await page.getByLabel('Justificativa da alteração').fill('Ajuste operacional homologado')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload.version).toBe('version-1')
  expect(savedPayload.reason).toBe('Ajuste operacional homologado')
  expect(Array.isArray(savedPayload.parameters.criticalityLevels)).toBe(true)
  expect(Array.isArray(savedPayload.parameters.slaLevels)).toBe(true)
  expect(Array.isArray(savedPayload.parameters.applicationRules)).toBe(true)
  await expect(page.getByText('Parametros salvos no Frappe com versao e auditoria.')).toBeVisible()
})
