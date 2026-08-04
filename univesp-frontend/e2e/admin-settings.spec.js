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

test('salva nivel oficial com versao e auditoria', async ({ page }) => {
  const { getSavedPayload, getLoadCount } = await mockRuntimeSettingsRoute(page)
  await prepareProfile(page, 'admin_central')

  await page.goto('/crm/admin/parametros')
  await expect(page.getByRole('heading', { name: 'Níveis oficiais' })).toBeVisible()
  await page.getByRole('button', { name: 'Baixa' }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).first().click()

  await expect.poll(() => getSavedPayload()).not.toBeNull()
  const savedPayload = getSavedPayload()
  expect(getLoadCount()).toBeGreaterThan(0)
  expect(savedPayload.version).toBe('version-1')
  expect(savedPayload.reason).toContain('Nivel oficial')
  expect(Array.isArray(savedPayload.parameters.criticalityLevels)).toBe(true)
  expect(Array.isArray(savedPayload.parameters.slaLevels)).toBe(true)
  await expect(page.getByText('Salvo.')).toBeVisible()
})

test('regras e prazos — tres blocos expansiveis sem overflow', async ({ page }) => {
  await mockRuntimeSettingsRoute(page)
  await prepareProfile(page, 'admin_central')
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/crm/admin/parametros')
  await expect(page.getByRole('heading', { name: 'Níveis oficiais' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Janelas oficiais' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Calendário institucional' })).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await expect(page).toHaveScreenshot('admin-parametros-1440x900.png', {
    fullPage: true,
    ...SNAPSHOT_OPTS,
  })
})

test('calendario institucional abre inline na secao', async ({ page }) => {
  await mockRuntimeSettingsRoute(page)
  await prepareProfile(page, 'admin_central')
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/crm/admin/parametros')
  await page.getByRole('heading', { name: 'Calendário institucional' }).click()
  await expect(page.getByRole('button', { name: /Adicionar em/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar horario' })).toBeVisible()
  const calendarSection = page.locator('details').filter({ hasText: 'Calendário institucional' })
  await expect(calendarSection).toHaveScreenshot('admin-parametros-calendario-secao.png', SNAPSHOT_OPTS)
})
