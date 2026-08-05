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
            visibilityMode: 'team',
            visibilityUsers: [],
            distributionMode: 'automatic',
            distributionUsers: [],
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
        { profile_id: 'analista@univesp.br', email: 'analista@univesp.br', display_name: 'Analista Um', profile_key: 'analista_area' },
        { profile_id: 'gestora@univesp.br', email: 'gestora@univesp.br', display_name: 'Gestora Area', profile_key: 'gestor_area' },
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

  await expect(page.locator('details').filter({ hasText: 'Como funciona a distribuição' })).toHaveJSProperty('open', false)
  await expect(page.locator('details').filter({ hasText: 'Disponibilidade da equipe' })).toHaveJSProperty('open', false)
  await expect(page.getByText('Matricula institucional', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Matricula institucional/ })).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: /Matricula institucional/ }).click()
  await expect(page.getByRole('button', { name: /Matricula institucional/ })).toHaveAttribute('aria-expanded', 'true')
  await page.getByLabel('Quem pode consultar').selectOption('restricted')
  await page.locator('label').filter({ hasText: 'Analista Um' }).getByRole('checkbox').check()
  await page.getByLabel('Quem recebe novos casos').selectOption('restricted')
  await expect(page.getByText('Pessoas que recebem', { exact: true })).toBeVisible()
  await page.locator('input[type="checkbox"]').nth(2).check()
  await page.getByRole('button', { name: 'Salvar regra' }).click()

  await expect.poll(() => savedPayload).not.toBeNull()
  expect(savedPayload.version).toBe('governance-v1')
  expect(savedPayload.reason).toContain('Matricula institucional')
  expect(savedPayload.rules[0].visibilityUsers).toContain('analista@univesp.br')
  expect(savedPayload.rules[0].distributionMode).toBe('restricted')
  expect(savedPayload.rules[0].distributionUsers).toContain('analista@univesp.br')
  await expect(page.getByText('Regra operacional atualizada para Matricula institucional.')).toBeVisible()
})

test('operação do gestor concentra indicadores e permite uma decisão por vez', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'gestor_area')
  })

  await page.goto('/crm/area/operacao')

  await expect(page.locator('h1.crm-page-title', { hasText: 'Operação da área' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver casos prioritários' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Backlog/ })).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: /Backlog/ }).click()
  await expect(page.getByRole('button', { name: /Backlog/ })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: /Vencidos/ }).click()
  await expect(page.getByRole('button', { name: /Backlog/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('button', { name: /Vencidos/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('region', { name: 'Vencidos' })).toBeVisible()
  const visibleText = await page.locator('main').innerText()
  expect(visibleText).not.toMatch(/owner|assignee|ownership/i)
})

test('menu do gestor não duplica visão geral', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'gestor_area')
  })

  await page.goto('/crm/area/operacao')

  await expect(page.getByRole('link', { name: 'Operação', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Visão geral', exact: true })).toHaveCount(0)
})

test('cockpit legado encaminha o gestor para Operação', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'gestor_area')
  })

  await page.goto('/crm/area/cockpit')

  await expect(page).toHaveURL(/\/crm\/area\/operacao$/)
  await expect(page.locator('h1.crm-page-title', { hasText: 'Operação da área' })).toBeVisible()
})

test('fila da área não expõe termos técnicos de atribuição', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'gestor_area')
  })

  await page.goto('/crm/area/fila')

  await expect(page.getByRole('heading', { name: 'Casos da área' })).toBeVisible()
  const visibleText = await page.locator('main').innerText()
  expect(visibleText).not.toMatch(/\b(owner|assignee|ownership)\b/i)
})
