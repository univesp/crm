import { expect, test } from '@playwright/test'

test('gestor carrega e persiste regra de area pela API institucional', async ({ page }) => {
  let savedPayload = null
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'gestor_area')
  })
  await page.route('**/api/app/v1/areas/*/governance', async (route) => {
    const requestedArea = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-2))
    if (route.request().method() === 'PATCH') {
      savedPayload = route.request().postDataJSON()
      return route.fulfill({
        status: 200,
        json: {
          data: { ...savedPayload, version: 'governance-v2', updated_by: 'gestora@univesp.br' },
          error: null,
          meta: {},
          request_id: 'governance-save',
        },
      })
    }
    return route.fulfill({
      status: 200,
      json: {
        data: {
          area: requestedArea,
          rules: [{
            id: 'scope-suporte-matricula-geral',
            areaLabel: requestedArea,
            themeKey: 'matricula',
            subsubjectKey: 'geral',
            subjectLabel: 'Matricula institucional',
            accessMode: 'team',
            allowedAnalysts: [],
            isActive: true,
            updatedBy: 'Gestora Area',
          }],
          availability: [],
          version: 'governance-v1',
        },
        error: null,
        meta: {},
        request_id: 'governance-load',
      },
    })
  })
  await page.route('**/api/app/v1/areas/*/members', (route) => route.fulfill({
    status: 200,
    json: {
      data: [
        { email: 'analista@univesp.br', display_name: 'Analista Um', profile_key: 'analista_area' },
        { email: 'gestora@univesp.br', display_name: 'Gestora Area', profile_key: 'gestor_area' },
      ],
      error: null,
      meta: {},
      request_id: 'members-load',
    },
  }))
  await page.route('**/api/app/v1/tickets?**', (route) => route.fulfill({
    status: 200,
    json: { data: [], error: null, meta: { page: 1, page_size: 100, total: 0 }, request_id: 'tickets-empty' },
  }))

  await page.goto('/crm/area/governanca')

  await expect(page.getByText('Matricula institucional', { exact: true })).toBeVisible()
  await page.getByLabel('Regra de visibilidade').selectOption('restricted')
  await page.locator('label').filter({ hasText: 'Analista Um' }).getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Salvar regra' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload.version).toBe('governance-v1')
  expect(savedPayload.reason).toContain('Matricula institucional')
  expect(savedPayload.rules[0].allowedAnalysts).toContain('Analista Um')
  await expect(page.getByText('Regra de escopo atualizada para Matricula institucional.')).toBeVisible()
})

test('home do gestor destaca a próxima decisão sem expor jargão técnico', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'gestor_area')
  })

  await page.goto('/crm/area/operacao')

  await expect(page.getByText('Priorize risco, gargalo e necessidade de intervenção antes de abrir caso a caso.')).toBeVisible()
  await expect(page.getByText('Corrigir responsáveis temáticos', { exact: true })).toBeVisible()
  const visibleText = await page.locator('main').innerText()
  expect(visibleText).not.toMatch(/owner/i)
})

test('fila da área não expõe termos técnicos de atribuição', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'gestor_area')
  })

  await page.goto('/crm/area/fila')

  const visibleText = await page.locator('main').innerText()
  expect(visibleText).not.toMatch(/\b(owner|assignee|ownership)\b/i)
})
