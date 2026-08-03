import { expect, test } from '@playwright/test'

import { assertNoHorizontalOverflow, prepareProfile, SNAPSHOT_OPTS } from './helpers/faq-v3-visual-helpers.js'

async function mockRuntimeSettingsRoute(page) {
  let savedPayload = null
  let getRequestCount = 0
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
    getRequestCount += 1
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
  return {
    getSavedPayload: () => savedPayload,
    getLoadCount: () => getRequestCount,
  }
}

test('salva parametros institucionais com versao e motivo auditavel', async ({ page }) => {
  const { getSavedPayload, getLoadCount } = await mockRuntimeSettingsRoute(page)
  await prepareProfile(page, 'admin_central')

  await page.goto('/crm/admin/parametros')
  await expect(page.getByRole('heading', { name: 'Regras e prazos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
  await page.getByLabel('Justificativa da alteração').fill('Ajuste operacional homologado')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect.poll(() => getSavedPayload()).not.toBeNull()
  const savedPayload = getSavedPayload()
  expect(getLoadCount()).toBeGreaterThan(0)
  expect(savedPayload.version).toBe('version-1')
  expect(savedPayload.reason).toBe('Ajuste operacional homologado')
  expect(Array.isArray(savedPayload.parameters.criticalityLevels)).toBe(true)
  expect(Array.isArray(savedPayload.parameters.slaLevels)).toBe(true)
  await expect(page.getByText('Parametros salvos no Frappe com versao e auditoria.')).toBeVisible()
})

test('regras e prazos — layout unico sem overflow', async ({ page }) => {
  await mockRuntimeSettingsRoute(page)
  await prepareProfile(page, 'admin_central')
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/crm/admin/parametros')
  await expect(page.getByRole('heading', { name: 'Regras e prazos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Níveis oficiais' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Janelas oficiais' })).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await expect(page).toHaveScreenshot('admin-parametros-1440x900.png', {
    fullPage: true,
    ...SNAPSHOT_OPTS,
  })
})

test('calendario institucional abre em modal', async ({ page }) => {
  await mockRuntimeSettingsRoute(page)
  await prepareProfile(page, 'admin_central')
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/crm/admin/parametros')
  await page.getByRole('button', { name: 'Gerenciar calendário' }).click()
  const dialog = page.getByRole('dialog', { name: 'Calendário institucional' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveScreenshot('admin-parametros-calendario-modal.png', SNAPSHOT_OPTS)
})
