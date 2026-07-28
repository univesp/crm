import { expect, test } from '@playwright/test'

test('biblioteca FAQ carrega e cria fluxo pela API institucional versionada', async ({ page }) => {
  let savedPayload = null
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
    window.localStorage.setItem('univesp:faq-builder:library:v1', 'sentinela-nao-alterar')
  })
  await page.route('**/api/app/v1/knowledge/library', async (route) => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      savedPayload = request.postDataJSON()
      return route.fulfill({
        status: 200,
        json: {
          data: {
            library: savedPayload.library,
            version: 'faq-version-2',
            updated_by: 'admin@univesp.br',
          },
          error: null,
          meta: {},
          request_id: 'faq-save',
        },
      })
    }
    return route.fulfill({
      status: 200,
      json: {
        data: { library: {}, version: 'faq-version-1', updated_by: '' },
        error: null,
        meta: {},
        request_id: 'faq-load',
      },
    })
  })

  await page.goto('/crm/admin/faq')
  await page.getByText('Criar novo fluxo', { exact: false }).click()
  await page.getByLabel('Nome do fluxo').fill('Fluxo institucional E2E')

  await page.getByRole('button', { name: 'Criar fluxo' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload.version).toBe('faq-version-1')
  expect(savedPayload.reason).toBe('Criacao de novo fluxo na biblioteca FAQ')
  expect(savedPayload.library.schemaVersion).toBe('faq-builder-library-v1')
  expect(savedPayload.library.bundles.some((bundle) => bundle.title === 'Fluxo institucional E2E')).toBe(true)
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('univesp:faq-builder:library:v1')),
    )
    .toBe('sentinela-nao-alterar')
})
