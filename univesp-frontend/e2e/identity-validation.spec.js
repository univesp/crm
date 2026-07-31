import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
  })
})

test('Admin trata vínculo inconclusivo com justificativa auditável', async ({ page }) => {
  let decisionPayload = null
  await page.route('**/api/app/v1/identity-validations?**', (route) =>
    route.fulfill({
      status: 200,
      json: {
        data: [
          {
            name: 'VALIDATION-1',
            ticket: 'HD-1',
            protocol: 'PRT-2026-000001',
            person: 'Aluno sem acesso',
            email_masked: 'al***@univesp.br',
            phone_masked: '***-***-0000',
            outcome: 'inconclusive',
            state: 'pending',
            sla_due_at: '2026-07-28T12:00:00-03:00',
            overdue: true,
            academic_context: { ra: '***567', course: 'Engenharia', pole: 'Guarulhos' },
          },
        ],
        error: null,
      },
    }),
  )
  await page.route('**/api/app/v1/identity-validations/VALIDATION-1/decision', async (route) => {
    decisionPayload = route.request().postDataJSON()
    return route.fulfill({
      status: 200,
      json: { data: { id: 'VALIDATION-1', state: 'verified' }, error: null },
    })
  })

  await page.goto('/crm/admin/validacao-vinculo')
  await expect(page.getByRole('main').getByRole('heading', { name: 'Validação de vínculo', level: 2 })).toBeVisible()
  await expect(page.getByText('SLA vencido')).toBeVisible()
  await page
    .getByLabel('Justificativa da decisão')
    .fill('Vínculo confirmado por conferência institucional.')
  await page.getByRole('button', { name: 'Confirmar vínculo' }).click()

  await expect.poll(() => decisionPayload).not.toBeNull()
  expect(decisionPayload).toEqual({
    decision: 'verified',
    notes: 'Vínculo confirmado por conferência institucional.',
  })
})
