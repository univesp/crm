import { expect, test } from '@playwright/test'

import {
  assertFieldsStacked,
  assertNoHorizontalOverflow,
  flowPayload,
  flowPayloadWithIssue,
  mockKnowledgeV3,
  prepareAdminFaqSession,
  SNAPSHOT_OPTS,
  VIEWPORTS_ACCESSIBILITY,
} from './helpers/faq-v3-visual-helpers.js'

test.beforeEach(async ({ page }) => prepareAdminFaqSession(page))

test.describe('FAQ v3 editor — diálogos secundários', () => {
  test('histórico, playbook, simulação, pendências, publicação e importação', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    const payload = flowPayload('acesso-ava')
    await mockKnowledgeV3(page, { payload, versionHistory: true })

    await page.goto('/crm/admin/faq-editor/acesso-ava')
    await expect(page.getByRole('heading', { name: 'Acesso ao AVA' })).toBeVisible()

    await page.getByRole('button', { name: 'Resposta final Resposta final', exact: true }).click()

    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Histórico de versões' }).click()
    const historyDialog = page.getByRole('dialog', { name: 'Histórico de versões' })
    await expect(historyDialog).toBeVisible()
    await expect(historyDialog).toHaveScreenshot('historico-versoes.png', SNAPSHOT_OPTS)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Ver playbook' }).click()
    const playbookDialog = page.getByRole('dialog', { name: 'Playbook da etapa' })
    await expect(playbookDialog).toBeVisible()
    await expect(playbookDialog).toHaveScreenshot('playbook-etapa.png', SNAPSHOT_OPTS)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Simular jornada' }).click()
    const simulator = page.getByRole('dialog', { name: 'Simular jornada' })
    await expect(simulator).toBeVisible()
    await expect(simulator).toHaveScreenshot('simular-jornada.png', SNAPSHOT_OPTS)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    const publishDialog = page.getByRole('dialog', { name: 'Confirmar publicação' })
    await expect(publishDialog).toBeVisible()
    await expect(publishDialog).toHaveScreenshot('confirmar-publicacao.png', SNAPSHOT_OPTS)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Importar ou atualizar' }).click()
    const importPanel = page.getByRole('heading', { name: 'Importar e comparar' })
    await expect(importPanel).toBeVisible()
    await expect(page.locator('.faq-import')).toHaveScreenshot('importar-vazio.png', SNAPSHOT_OPTS)
  })

  test('painel de pendências legível', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockKnowledgeV3(page, { payload: flowPayloadWithIssue('acesso-ava') })

    await page.goto('/crm/admin/faq-editor/acesso-ava')
    await page.getByRole('button', { name: 'Ver pendências' }).click()
    const issuesDialog = page.getByRole('dialog', { name: 'Pendências de validação' })
    await expect(issuesDialog).toBeVisible()
    await expect(issuesDialog).toHaveScreenshot('pendencias-validacao.png', SNAPSHOT_OPTS)
  })

  test('importação com diff legível', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const payload = flowPayload('acesso-ava')
    await mockKnowledgeV3(page, { payload })

    const imported = structuredClone(payload)
    imported.nodes = [
      imported.nodes[0],
      {
        ...structuredClone(imported.nodes[1]),
        node_id: 'nova-final',
        stable_key: 'nova-final',
        display: { title: 'Nova resposta importada' },
        content: {
          student: {
            blocks: [{ block_id: 'nova-final-texto', type: 'text', body: 'Conteúdo atualizado.' }],
            outcome_key: 'open_ticket',
          },
          public: null,
        },
      },
    ]
    imported.edges = [
      {
        edge_id: 'root-nova-final',
        parent_node_id: 'root',
        child_node_id: 'nova-final',
        order: 1,
        active: true,
        audiences: ['student'],
      },
    ]

    await page.goto('/crm/admin/faq-editor/acesso-ava')
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Importar ou atualizar' }).click()
    await page.getByLabel('Arquivo para comparar').setInputFiles({
      name: 'acesso-ava-v3.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(imported)),
    })

    await expect(page.getByText('Nova resposta importada', { exact: true })).toBeVisible()
    await expect(page.locator('.faq-import')).toHaveScreenshot('importar-com-diff.png', SNAPSHOT_OPTS)
  })
})

test.describe('FAQ v3 — viewports acessibilidade', () => {
  for (const viewport of VIEWPORTS_ACCESSIBILITY) {
    test(`modal Criar fluxo legível em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava') })

      await page.goto('/crm/admin/faq')
      await page.getByRole('button', { name: 'Criar fluxo', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Criar fluxo' })
      await expect(dialog).toBeVisible()
      await assertFieldsStacked(
        dialog.getByLabel('Nome do fluxo'),
        dialog.getByRole('combobox', { name: 'Tema' }),
      )
      await assertNoHorizontalOverflow(page)
      await expect(dialog).toHaveScreenshot(`criar-fluxo-modal-${viewport.name}.png`, SNAPSHOT_OPTS)
    })
  }

  test('editor rascunho sem overflow horizontal em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockKnowledgeV3(page, { payload: flowPayload('acesso-ava') })

    await page.goto('/crm/admin/faq-editor/acesso-ava')
    await expect(page.getByRole('heading', { name: 'Acesso ao AVA' })).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await expect(page).toHaveScreenshot('editor-mobile-375.png', { fullPage: true, ...SNAPSHOT_OPTS })
  })
})
