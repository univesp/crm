import { expect, test } from '@playwright/test'

import {
  assertFieldsStacked,
  flowPayload,
  mockKnowledgeV3,
  prepareAdminFaqSession,
  sampleBundleList,
  SNAPSHOT_OPTS,
  VIEWPORTS_DESKTOP,
} from './helpers/faq-v3-visual-helpers.js'

test.beforeEach(async ({ page }) => prepareAdminFaqSession(page))

for (const viewport of VIEWPORTS_DESKTOP) {
  test(`biblioteca: modal Criar fluxo legível em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava') })

    await page.goto('/crm/admin/faq')
    await expect(page.getByRole('heading', { name: 'Biblioteca de fluxos' })).toBeVisible()
    await page.getByRole('button', { name: 'Criar fluxo', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Criar fluxo' })
    await expect(dialog).toBeVisible()
    await assertFieldsStacked(
      dialog.getByLabel('Nome do fluxo'),
      dialog.getByRole('combobox', { name: 'Tema' }),
    )
    await assertFieldsStacked(
      dialog.getByRole('combobox', { name: 'Tema' }),
      dialog.getByRole('button', { name: 'Criar e abrir Editor' }),
    )

    await expect(dialog).toHaveScreenshot(`criar-fluxo-modal-${viewport.name}.png`, SNAPSHOT_OPTS)
  })
}

test('editor v3: telas principais sem colapso de layout', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('heading', { name: 'Acesso ao AVA' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-modo-simples.png', { fullPage: true, ...SNAPSHOT_OPTS })

  await page.getByRole('button', { name: 'OP', exact: true }).click()
  await expect(page.getByLabel('Objetivo')).toBeVisible()
  await expect(page).toHaveScreenshot('editor-modo-avancado.png', { fullPage: true, ...SNAPSHOT_OPTS })

  await page.getByRole('button', { name: 'Mapa', exact: true }).click()
  const mapSection = page.locator('.faq-v3-map-workspace')
  await expect(mapSection.getByRole('heading', { name: 'Mapa do fluxo' })).toBeVisible()
  await expect(mapSection).toHaveScreenshot('mapa-modo-inline.png', SNAPSHOT_OPTS)
  await page.getByRole('button', { name: 'Etapas', exact: true }).click()

  await page.getByRole('button', { name: 'Configurações do assunto' }).click()
  const settingsDialog = page.getByRole('dialog', { name: 'Configurações do assunto' })
  await expect(settingsDialog).toBeVisible()
  await expect(settingsDialog).toHaveScreenshot('configuracoes-fluxo.png', SNAPSHOT_OPTS)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Enviar para revisão', exact: true }).click()
  const submitDialog = page.getByRole('dialog', { name: 'Enviar para revisão' })
  await expect(submitDialog).toBeVisible()
  await expect(submitDialog).toHaveScreenshot('dialogo-envio.png', SNAPSHOT_OPTS)
  await page.keyboard.press('Escape')
})

test('editor v3: vigência legível em somente leitura', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, {
    payload,
    lifecycleState: 'pending_approval',
    validFrom: '2026-08-01T08:00',
    validUntil: '2026-12-31T23:59',
  })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await page.getByRole('button', { name: 'Configurações do assunto' }).click()
  const settingsDialog = page.getByRole('dialog', { name: 'Configurações do assunto' })
  await expect(settingsDialog.getByLabel('Início da vigência')).toBeDisabled()
  await expect(settingsDialog.getByLabel('Fim da vigência')).toBeDisabled()
  await expect(settingsDialog).toHaveScreenshot('somente-leitura-configuracoes.png', SNAPSHOT_OPTS)
})

test('biblioteca: lista de fluxos legível', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, {
    payload,
    bundleList: sampleBundleList(),
  })

  await page.goto('/crm/admin/faq')
  await expect(page.getByRole('heading', { name: 'Biblioteca de fluxos' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Acesso ao AVA' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Matrícula e documentos' })).toBeVisible()
  await expect(page.getByText('Quem pode sugerir melhorias')).toHaveCount(0)
  await expect(page).toHaveScreenshot('biblioteca-lista-1440x900.png', { fullPage: true, ...SNAPSHOT_OPTS })
})

test('biblioteca: modal Criar novo tema legível', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava'), bundleList: sampleBundleList() })

  await page.goto('/crm/admin/faq')
  await page.getByRole('button', { name: 'Criar novo tema', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Criar novo tema' })
  await expect(dialog).toBeVisible()
  await assertFieldsStacked(dialog.getByLabel('Nome do tema'), dialog.getByLabel('Nome da área'))
  await assertFieldsStacked(dialog.getByLabel('Nome da área'), dialog.getByLabel('Responsável principal'))
  await expect(dialog).toHaveScreenshot('criar-tema-modal-1440x900.png', SNAPSHOT_OPTS)
})

test('editor v3: estado aguardando aprovação', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload, lifecycleState: 'pending_approval' })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByText('Aguardando aprovação', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aprovar conteúdo' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-estado-aguardando-aprovacao.png', { fullPage: true, ...SNAPSHOT_OPTS })
})

test('editor v3: estado aprovado sem rascunho', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload, editorMode: 'approved' })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('heading', { name: 'A versão está aprovada' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publicar versão aprovada' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-estado-aprovado.png', { fullPage: true, ...SNAPSHOT_OPTS })
})

test('editor v3: estado publicado sem rascunho', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const payload = flowPayload('acesso-ava')
  await mockKnowledgeV3(page, { payload, editorMode: 'published_only' })

  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Este fluxo não tem rascunho em edição' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar novo rascunho' })).toBeVisible()
  await expect(page).toHaveScreenshot('editor-estado-publicado.png', { fullPage: true, ...SNAPSHOT_OPTS })
})
