import { expect, test } from '@playwright/test'

import {
  flowPayload,
  flowPayloadWithIssue,
  mockKnowledgeV3,
  prepareAdminFaqSession,
  SNAPSHOT_OPTS,
} from './helpers/faq-v3-visual-helpers.js'

test.beforeEach(async ({ page }) => prepareAdminFaqSession(page))

async function openMapMode(page) {
  await page.goto('/crm/admin/faq-editor/acesso-ava')
  await expect(page.getByRole('heading', { name: 'Acesso ao AVA' })).toBeVisible()
  await page.getByRole('button', { name: 'Mapa', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mapa do fluxo' })).toBeVisible()
}

async function getFlowTransform(page) {
  return page.locator('.faq-v3-flow-map__canvas .vue-flow__transformationpane').evaluate((el) => {
    const inline = el.getAttribute('style') || ''
    const computed = window.getComputedStyle(el).transform || ''
    return `${inline}|${computed}`
  })
}

test('modo mapa: alternar, editar bloco no drawer, dirty e pendências', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockKnowledgeV3(page, { payload: flowPayloadWithIssue('acesso-ava') })
  await openMapMode(page)

  await expect(page.getByRole('button', { name: 'Etapas', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.locator('.faq-v3-flow-node.is-final').click()
  await expect(page.getByLabel('Nome da etapa')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fechar painel' })).toBeVisible()

  const mapPane = page.locator('.faq-v3-map-workspace__map-pane')
  const drawer = page.locator('.faq-v3-map-workspace__drawer')
  const mapBox = await mapPane.boundingBox()
  const drawerBox = await drawer.boundingBox()
  expect(mapBox).not.toBeNull()
  expect(drawerBox).not.toBeNull()
  expect(mapBox.x + mapBox.width).toBeLessThanOrEqual(drawerBox.x + 2)

  await expect(page.locator('.faq-v3-map-workspace')).toHaveScreenshot(
    'mapa-drawer-editor.png',
    SNAPSHOT_OPTS,
  )

  await page.getByLabel('Nome da etapa').fill('Resposta final ajustada no mapa')
  await expect
    .poll(async () => page.getByRole('button', { name: 'Salvar rascunho' }).isEnabled())
    .toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Nome da etapa')).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mapa do fluxo' })).toBeVisible()

  await page.getByRole('button', { name: 'Etapas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Etapas do fluxo' })).toBeVisible()
  await expect(page.getByLabel('Nome da etapa')).toHaveValue('Resposta final ajustada no mapa')

  await page.getByRole('button', { name: 'Mapa', exact: true }).click()
  await page.getByRole('button', { name: 'Ver pendências' }).click()
  await expect(page.getByRole('dialog', { name: 'Pendências de validação' })).toBeVisible()
})

test('modo mapa: menu estrutural adiciona etapa abaixo da selecionada', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava') })
  await openMapMode(page)

  const rootNode = page.locator('.faq-v3-flow-node').first()
  await rootNode.getByRole('button', { name: 'Ações estruturais da etapa' }).click()
  await page.getByRole('menuitem', { name: 'Adicionar etapa abaixo' }).click()

  await expect(page.getByLabel('Nome da etapa')).toBeVisible()
  await expect(page.getByLabel('Nome da etapa')).toHaveValue(/Nova etapa/)
  await expect(page.locator('.faq-v3-flow-map__canvas .vue-flow__edge')).toHaveCount(2)
})

test('modo mapa: controles flutuantes funcionam', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava') })
  await openMapMode(page)

  const toolbar = page.getByRole('toolbar', { name: 'Controles do mapa' })
  await expect(toolbar).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ajustar à tela' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ampliar' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Reduzir' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Centralizar etapa selecionada' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Voltar à raiz' })).toBeEnabled()

  const transformBefore = await getFlowTransform(page)
  await page.getByRole('button', { name: 'Ampliar' }).click()
  await expect.poll(async () => getFlowTransform(page)).not.toBe(transformBefore)

  await page.getByRole('button', { name: 'Reduzir' }).click()
  await page.getByRole('button', { name: 'Ajustar à tela' }).click()
  await page.getByRole('button', { name: 'Voltar à raiz' }).click()
  await expect(page.locator('.faq-v3-flow-node.is-selected')).toBeVisible()
  await page.getByRole('button', { name: 'Centralizar etapa selecionada' }).click()
  await expect(page.locator('.faq-v3-flow-map__canvas .vue-flow__node')).toHaveCount(2)
})

test('modo mapa: conexões visíveis entre etapas existentes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava') })
  await openMapMode(page)

  await expect(page.locator('.faq-v3-flow-map__canvas .vue-flow__edge')).toHaveCount(1)
  const edgePath = page.locator('.faq-v3-flow-map__canvas .vue-flow__edge-path').first()
  await expect(edgePath).toHaveAttribute('d', /.+/)
})
