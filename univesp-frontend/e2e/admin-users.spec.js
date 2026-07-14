import { expect, test } from '@playwright/test'

const profileCatalog = [
  {
    key: 'op',
    label: 'OP',
    scope_key: 'queues',
    actions: ['view_ticket', 'reply_ticket', 'attach_ticket', 'transition_ticket'],
  },
  {
    key: 'admin_central',
    label: 'Admin central',
    scope_key: '',
    actions: ['view_ticket', 'manage_users', 'view_audit'],
  },
]

const user = {
  id: 'ana@univesp.br',
  email: 'ana@univesp.br',
  display_name: 'Ana Administradora',
  ra: '',
  profile_key: 'admin_central',
  active: true,
  scopes: {},
  actions: ['view_ticket', 'manage_users', 'view_audit'],
  version: '2026-07-14 10:00:00.000000',
  audit: [],
}

const accessRequest = {
  id: 'operador@univesp.br',
  email: 'operador@univesp.br',
  display_name: 'Operador Pendente',
  ra: '',
  identity_flow: 'admin',
  status: 'pending',
  attempt_count: 2,
  last_seen_at: '2026-07-14T10:00:00-03:00',
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('univesp.sso.devBypassProfile', 'admin_central')
  })
})

test('edita e desativa usuario com motivo auditavel', async ({ page }) => {
  let patchPayload = null
  await mockAdminApi(page, {
    onPatch(payload) {
      patchPayload = payload
    },
  })

  await page.goto('/crm/admin/permissoes')
  await expect(page.getByRole('heading', { name: 'Usuarios e autorizacoes' })).toBeVisible()
  await page.getByRole('button', { name: /Ana Administradora/ }).click()
  await page.getByLabel('Usuario ativo').uncheck()
  await page.getByPlaceholder('Obrigatorio para auditoria').fill('Desativacao solicitada pela gestao')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect.poll(() => patchPayload).not.toBeNull()
  expect(patchPayload.active).toBe(false)
  expect(patchPayload.version).toBe(user.version)
})

test('aprova solicitacao pendente com perfil e fila', async ({ page }) => {
  let approvalPayload = null
  await mockAdminApi(page, {
    onApprove(payload) {
      approvalPayload = payload
    },
  })

  await page.goto('/crm/admin/permissoes')
  await page.getByRole('button', { name: /Pendencias/ }).click()
  await page.getByRole('button', { name: /Operador Pendente/ }).click()
  await page.getByLabel('Perfil').selectOption('op')
  await page.getByText('Atendimento Geral', { exact: true }).locator('..').getByRole('checkbox').check()
  await page.getByLabel('Motivo da decisao').fill('Aprovado para operacao da fila geral')
  await page.getByRole('button', { name: 'Aprovar acesso' }).click()

  await expect.poll(() => approvalPayload).not.toBeNull()
  expect(approvalPayload.profile_key).toBe('op')
  expect(approvalPayload.scopes).toEqual({ queues: ['Atendimento Geral'] })
})

async function mockAdminApi(page, hooks = {}) {
  await page.route('**/api/app/v1/admin/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const body = request.postDataJSON?.() || {}
    let data = null
    let meta = {}

    if (path.endsWith('/admin/catalogs')) {
      data = {
        profiles: profileCatalog,
        queues: [{ value: 'Atendimento Geral', label: 'Atendimento Geral' }],
        polos: [],
        areas: [],
      }
    } else if (path.endsWith('/admin/users') && method === 'GET') {
      data = [user]
      meta = { page: 1, page_size: 25, total: 1 }
    } else if (path.endsWith('/admin/users/ana%40univesp.br') && method === 'GET') {
      data = user
    } else if (path.endsWith('/admin/users/ana%40univesp.br') && method === 'PATCH') {
      hooks.onPatch?.(body)
      data = { ...user, active: body.active }
    } else if (path.endsWith('/admin/access-requests') && method === 'GET') {
      data = [accessRequest]
      meta = { page: 1, page_size: 25, total: 1 }
    } else if (path.endsWith('/admin/access-requests/operador%40univesp.br/approve')) {
      hooks.onApprove?.(body)
      data = { ...user, email: accessRequest.email, display_name: accessRequest.display_name }
    } else if (path.endsWith('/admin/audit')) {
      data = []
      meta = { page: 1, page_size: 25, total: 0 }
    } else {
      return route.fulfill({ status: 404, json: { error: { message: `Mock ausente: ${method} ${path}` } } })
    }

    return route.fulfill({ status: 200, json: { data, error: null, meta, request_id: 'e2e-request' } })
  })
}
