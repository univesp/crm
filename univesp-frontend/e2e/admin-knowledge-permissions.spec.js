import { expect, test } from '@playwright/test'

import {
  flowPayload,
  mockAdminGrants,
  mockKnowledgeV3,
  prepareAdminFaqSession,
  prepareProfile,
  SNAPSHOT_OPTS,
} from './helpers/faq-v3-visual-helpers.js'

test.beforeEach(async ({ page }) => prepareAdminFaqSession(page))

test('deep link abre aba Conhecimento com tema pré-selecionado', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload })
  await mockAdminGrants(page)

  await page.goto('/crm/admin/permissoes?tab=knowledge&context=faq-suggestions&theme=acesso-ava')
  await expect(page.getByRole('heading', { name: 'Conhecimento e FAQ' })).toBeVisible()
  await expect(page.getByLabel('Filtrar por tema')).toHaveValue('acesso-ava')
  await expect(page.getByText('Carregando permissões…')).toBeHidden()
  await page.getByRole('button', { name: 'Conceder acesso de sugestão' }).click()
  await expect(page.getByRole('button', { name: 'Conceder permissão' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Acesso ao AVA' })).toBeChecked()
  await expect(page).toHaveScreenshot('admin-conhecimento-permissoes-compacto.png', {
    ...SNAPSHOT_OPTS,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  })
})

test('editor: permissões unificadas — admin publica; gestor edita sem publicar', async ({ page }) => {
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload })

  await prepareProfile(page, 'admin_central')
  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeVisible()

  await prepareProfile(page, 'gestor_area')
  await page.goto('/crm/area/faq/acesso-ava')
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0)
})
