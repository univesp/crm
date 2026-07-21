import assert from 'node:assert/strict'
import process from 'node:process'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'

const root = process.cwd()

function createBrowserMock(initialState = null) {
  let state = initialState

  const localStorage = {
    getItem(key) {
      return key === 'univesp-student-support' ? state : null
    },
    setItem(key, value) {
      if (key === 'univesp-student-support') {
        state = String(value)
      }
    },
    removeItem(key) {
      if (key === 'univesp-student-support') {
        state = null
      }
    },
    clear() {
      state = null
    },
  }

  globalThis.window = {
    localStorage,
    location: {
      assign() {},
    },
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.localStorage = localStorage

  return {
    readState() {
      return state
    },
    writeState(nextState) {
      state = nextState == null ? null : String(nextState)
    },
    clear() {
      state = null
    },
  }
}

const server = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  define: {
    'import.meta.env.VITE_ENABLE_MOCKS': JSON.stringify('true'),
  },
  server: {
    middlewareMode: true,
  },
})

const loadModule = (modulePath) => server.ssrLoadModule(modulePath)

const foundationRuntime = await loadModule('/src/services/canonicalFoundationRuntime.js')
const faqBuilderRuntime = await loadModule('/src/services/faqBuilderHybridRuntime.js')
const faqJsonImportRuntime = await loadModule('/src/services/faqJsonImport.js')
const distributionEngine = await loadModule('/src/services/distributionEngine.js')
const areaGovernanceRuntime = await loadModule('/src/services/areaGovernanceRuntime.js')
const areaQueueRuntime = await loadModule('/src/services/areaQueueRuntime.js')
const ownershipContract = await loadModule('/src/contracts/operationalOwnershipContract.js')
const ownershipBackendContract = await loadModule('/src/contracts/operationalOwnershipBackendContract.js')
const ownershipRuntime = await loadModule('/src/services/operationalOwnershipRuntime.js')
const ownershipReferencesRuntime = await loadModule('/src/services/operationalOwnershipReferences.js')
const ownershipServerRuntime = await loadModule('/src/services/operationalOwnershipServerRuntime.js')
const studentSupportModule = await loadModule('/src/stores/studentSupport.js')
const mockContextModule = await loadModule('/src/services/mockContextRuntime.js')
const authModule = await loadModule('/src/stores/auth.js')
const appApiModule = await loadModule('/src/services/appApi.js')
const ssoClientModule = await loadModule('/src/services/ssoClient.js')
const adminFaqLibraryModule = await loadModule('/src/pages/admin/AdminFaqLibraryPage.vue')
const adminFaqFlowModule = await loadModule('/src/pages/admin/AdminFaqPage.vue')
const adminFaqEditorModule = await loadModule('/src/pages/admin/AdminFaqEditorPage.vue')
const areaCaseDetailModule = await loadModule('/src/pages/area/AreaCaseDetailPage.vue')
const operatorCaseDetailModule = await loadModule('/src/pages/operator/OperatorCaseDetailPage.vue')
const appRoutesModule = await loadModule('/src/router.js')

const {
  CASE_ASSIGNMENT_STATUSES,
  KNOWLEDGE_BUNDLE_VERSION_STATUSES,
  cloneCanonicalFoundationSeeds,
  buildInitialKnowledgeUsageRecords,
  findKnowledgeDefinitionBySubject,
  getActiveKnowledgeBundleVersionId,
  buildSubsubjectCode,
  buildSubjectCode,
} = foundationRuntime
const {
  buildFaqBuilderPortalExportPayload,
  buildFaqBuilderDiff,
  buildFaqBuilderGraphSafe,
  cloneFaqBuilderPackage,
  createFaqBuilderWorkspace,
  dryRunFaqBuilderImport,
  publishFaqBuilderWorkspace,
  resolveFaqBuilderNodeEffectiveOwner,
  setFaqBuilderBundleOperationalOwner,
  setFaqBuilderNodeOwnership,
  validateFaqBuilderPortalExport,
  validateFaqBuilderBundle,
} = faqBuilderRuntime
const { buildProcedureCaptureBundle, normalizeImportedPayload } = faqJsonImportRuntime
const { buildDistributionDecision, resolveEligibleUsers } = distributionEngine
const { canViewerAccessAreaSubject } = areaGovernanceRuntime
const { resolveAreaQueueBucket, filterAreaQueueEntries } = areaQueueRuntime
const { validateOperationalOwnershipEnvelope } = ownershipContract
const {
  OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS,
  mapOwnershipIssueToBackendErrorCode,
} = ownershipBackendContract
const { normalizeOperationalOwnerSnapshot } = ownershipRuntime
const { buildOperationalOwnershipReferenceCatalog } = ownershipReferencesRuntime
const {
  auditLegacyOwnershipRecords,
  validateOperationalOwnershipForServer,
  validateBundleOwnershipCoverageForServer,
} = ownershipServerRuntime
const { useStudentSupportStore } = studentSupportModule
const { buildMockAccessContext, canAccessRouteWithMockContext } = mockContextModule
const { listAdminUsers, updateAdminUser } = appApiModule
const { normalizeGatewayUser } = ssoClientModule
const { useAuthStore } = authModule
const AdminFaqLibraryPage = adminFaqLibraryModule.default
const AdminFaqPage = adminFaqFlowModule.default
const AdminFaqEditorPage = adminFaqEditorModule.default
const AreaCaseDetailPage = areaCaseDetailModule.default
const OperatorCaseDetailPage = operatorCaseDetailModule.default
const appRoutes = appRoutesModule.default || []

function getMockContext(profileKey) {
  return buildMockAccessContext({
    displayName:
      profileKey === 'analista_area'
        ? 'Camila Nunes'
        : profileKey === 'gestor_area'
          ? 'Rafael Martins'
          : profileKey === 'gestor_polos'
            ? 'Henrique Ramos'
            : 'Juliana Prado',
    raw: { profileKey },
  })
}

function createFreshStore(storage, { reset = true } = {}) {
  if (reset) {
    storage.clear()
  }

  const pinia = createPinia()
  setActivePinia(pinia)
  return useStudentSupportStore(pinia)
}

async function renderAreaCaseDetailCase({ caseId, profileKey = 'gestor_area', areaLabel = '' }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const studentSupportStore = useStudentSupportStore(pinia)
  const authStore = useAuthStore(pinia)

  authStore.status = 'authenticated'
  authStore.user = {
    displayName: profileKey === 'gestor_area' ? 'Rafael Martins' : 'Camila Nunes',
    raw: { profileKey },
  }

  if (areaLabel) {
    authStore.setSelectedOperationalArea(areaLabel)
  }

  const router = createRouter({
    history: createMemoryHistory('/crm/'),
    routes: [
      {
        path: '/area/orientacao',
        component: { template: '<div>orientacao</div>' },
      },
      {
        path: '/area/fila',
        component: { template: '<div>fila</div>' },
      },
      {
        path: '/area/governanca',
        component: { template: '<div>governanca</div>' },
      },
      {
        path: '/area/fila/:caseId',
        component: AreaCaseDetailPage,
      },
    ],
  })

  const app = createSSRApp(AreaCaseDetailPage)
  app.use(pinia)
  app.use(router)

  await router.push({
    path: `/area/fila/${caseId}`,
    query: areaLabel ? { area: areaLabel } : {},
  })
  await router.isReady()

  const html = await renderToString(app)

  return {
    html,
    detail: studentSupportStore.areaCaseById(caseId, authStore.mockContext),
  }
}

async function renderOperatorCaseDetailCase({ caseId, profileKey = 'op', poloLabel = '' }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const studentSupportStore = useStudentSupportStore(pinia)
  const authStore = useAuthStore(pinia)

  authStore.status = 'authenticated'
  authStore.user = {
    displayName: profileKey === 'gestor_polos' ? 'Henrique Ramos' : 'Juliana Prado',
    raw: { profileKey },
  }

  if (poloLabel) {
    authStore.setSelectedOperationalPolo(poloLabel)
  }

  const router = createRouter({
    history: createMemoryHistory('/crm/'),
    routes: [
      {
        path: '/op/fila',
        component: { template: '<div>fila</div>' },
      },
      {
        path: '/op/orientacao',
        component: { template: '<div>orientacao</div>' },
      },
      {
        path: '/op/playbook',
        component: { template: '<div>playbook</div>' },
      },
      {
        path: '/op/fila/:caseId',
        component: OperatorCaseDetailPage,
      },
    ],
  })

  const app = createSSRApp(OperatorCaseDetailPage)
  app.use(pinia)
  app.use(router)

  await router.push({
    path: `/op/fila/${caseId}`,
    query: poloLabel ? { polo: poloLabel } : {},
  })
  await router.isReady()

  const html = await renderToString(app)

  return {
    html,
    detail: studentSupportStore.operatorCaseById(caseId, authStore.mockContext),
  }
}

async function renderAdminFaqLibrary() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore(pinia)

  authStore.status = 'authenticated'
  authStore.user = {
    displayName: 'Patricia Oliveira',
    raw: { profileKey: 'admin_central' },
  }

  const router = createRouter({
    history: createMemoryHistory('/crm/'),
    routes: [
      {
        path: '/admin/faq',
        component: AdminFaqLibraryPage,
      },
    ],
  })

  const app = createSSRApp(AdminFaqLibraryPage)
  app.use(pinia)
  app.use(router)

  await router.push('/admin/faq')
  await router.isReady()

  return renderToString(app)
}

async function renderAdminFaqFlow(flowPath = '/admin/faq/bundle:op:estagio') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore(pinia)

  authStore.status = 'authenticated'
  authStore.user = {
    displayName: 'Patricia Oliveira',
    raw: { profileKey: 'admin_central' },
  }

  const router = createRouter({
    history: createMemoryHistory('/crm/'),
    routes: [
      {
        path: '/admin/faq/:bundleId',
        component: AdminFaqPage,
      },
    ],
  })

  const app = createSSRApp(AdminFaqPage)
  app.use(pinia)
  app.use(router)

  await router.push(flowPath)
  await router.isReady()

  return renderToString(app)
}

async function renderAdminFaqEditor(editorPath = '/admin/faq-editor/bundle:op:estagio?fullscreen=1&safe=1') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const authStore = useAuthStore(pinia)

  authStore.status = 'authenticated'
  authStore.user = {
    displayName: 'Patricia Oliveira',
    raw: { profileKey: 'admin_central' },
  }

  const router = createRouter({
    history: createMemoryHistory('/crm/'),
    routes: [
      {
        path: '/admin/faq-editor/:bundleId',
        component: AdminFaqEditorPage,
      },
      {
        path: '/admin/faq/:bundleId/editor',
        component: AdminFaqEditorPage,
      },
      {
        path: '/admin/faq',
        component: { template: '<div>faq-library</div>' },
      },
    ],
  })

  const app = createSSRApp(AdminFaqEditorPage)
  app.use(pinia)
  app.use(router)

  await router.push(editorPath)
  await router.isReady()

  return renderToString(app)
}

const tests = []

function test(name, fn) {
  tests.push({ name, fn })
}

const now = new Date('2026-04-08T10:00:00-03:00')

test('rota de gestao de usuarios exige manage_users e admin possui a acao', () => {
  const route = appRoutes.find((entry) => entry.name === 'admin-permissions')
  const context = getMockContext('admin_central')

  assert.deepEqual(route.meta.requiredActions, ['manage_users'])
  assert.equal(canAccessRouteWithMockContext(route.meta, context), true)
})

test('cliente administrativo usa mesma origem, PATCH e preserva conflito 409', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' })
    if (String(url).includes('conflict%40univesp.br')) {
      return new Response(
        JSON.stringify({ error: { code: 'CONFLICT', message: 'Registro alterado.' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ data: [], error: null, meta: { total: 0 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await listAdminUsers({ search: 'ana' })
    await assert.rejects(
      () => updateAdminUser('conflict@univesp.br', { version: 'old', reason: 'Teste' }),
      (error) => error.status === 409 && error.code === 'CONFLICT',
    )
    assert.match(calls[0].url, /^\/api\/app\/v1\/admin\/users\?search=ana$/)
    assert.equal(calls[1].method, 'PATCH')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('sessao sem perfil permanece autenticada com estado pendente', () => {
  const user = normalizeGatewayUser({
    user: { email: 'pending@univesp.br', display_name: 'Pending' },
    profile: null,
    scopes: {},
    actions: [],
    access: { status: 'pending', request_id: 'pending@univesp.br' },
  })
  assert.equal(user.email, 'pending@univesp.br')
  assert.equal(user.profileKey, '')
  assert.equal(user.raw.accessStatus, 'pending')
  assert.equal(buildMockAccessContext(user).defaultRoute, '/acesso-pendente')
})

test('rota do editor FAQ resolve corretamente sem cair na visao resumida', async () => {
  const router = createRouter({
    history: createMemoryHistory('/crm/'),
    routes: appRoutes,
  })

  const resolved = router.resolve('/admin/faq-editor/bundle%3Aop%3Aestagio?fullscreen=1&safe=1')
  assert.equal(resolved.name, 'admin-faq-builder')
  assert.equal(resolved.meta?.layout, 'auth')

  const resolvedRaw = router.resolve('/admin/faq-editor/bundle:op:estagio?fullscreen=1&safe=1')
  assert.equal(resolvedRaw.name, 'admin-faq-builder')
  assert.equal(resolvedRaw.meta?.layout, 'auth')

  const legacyResolved = router.resolve('/admin/faq/bundle:op:estagio/editor?fullscreen=1&safe=1')
  assert.ok(legacyResolved.matched.length >= 1)
  assert.ok(
    legacyResolved.name === 'admin-faq-builder' ||
      legacyResolved.matched.some((record) => record.path === '/admin/faq/:bundleId/editor'),
  )

  const malformedEditorResolved = router.resolve(
    '/admin/faq-editor/bundle%3Aop%3Aestagio/editor?fullscreen=1&safe=1',
  )
  assert.ok(malformedEditorResolved.matched.length >= 1)

  await router.push('/admin/faq/bundle:op:estagio/editor?fullscreen=1&safe=1')
  assert.equal(router.currentRoute.value.name, 'admin-faq-builder')
  assert.ok(String(router.currentRoute.value.path || '').startsWith('/admin/faq-editor/'))
  assert.equal(router.currentRoute.value.meta?.layout, 'auth')

  await router.push('/admin/faq-editor/bundle%3Aop%3Aestagio/editor?fullscreen=1&safe=1')
  assert.equal(router.currentRoute.value.name, 'admin-faq-builder')
  assert.ok(String(router.currentRoute.value.path || '').startsWith('/admin/faq-editor/'))
  assert.equal(router.currentRoute.value.meta?.layout, 'auth')
})

test('visualizacao do fluxo FAQ renderiza conexoes no modo resumido', async () => {
  const html = await renderAdminFaqFlow('/admin/faq/bundle:op:estagio')
  assert.match(html, /faq-flow-arrow/)
  assert.match(html, /<line/)
  assert.match(html, /marker-end="url\(#faq-flow-arrow\)"/)
  assert.match(html, /conexao\(oes\)/)
})

test('editor FAQ abre em rota canonica com safe/fullscreen sem cair em tela indisponivel', async () => {
  const html = await renderAdminFaqEditor(
    '/admin/faq-editor/bundle%3Aop%3Aestagio?fullscreen=1&safe=1&reload=1',
  )
  assert.match(html, /faq-editor-page/)
  assert.match(html, /Voltar para visao do fluxo/)
  assert.match(html, /Estabilidade do builder/)
  assert.doesNotMatch(html, /Tela indisponivel/)
})

test('editor FAQ abre em rota legada sem travar navegacao', async () => {
  const html = await renderAdminFaqEditor('/admin/faq/bundle:op:estagio/editor?fullscreen=1&safe=1')
  assert.match(html, /faq-editor-page/)
  assert.match(html, /Voltar para visao do fluxo/)
  assert.doesNotMatch(html, /Tela indisponivel/)
})

test('distribuicao ignora assignments completed na carga ativa', async () => {
  const foundation = cloneCanonicalFoundationSeeds()
  const decision = buildDistributionDecision({
    caseProtocol: {
      id: 'CASE-NEW-001',
      currentAreaLabel: 'Suporte Academico Digital',
      lastMileAreaLabel: 'Suporte Academico Digital',
      themeKey: 'provas',
      subsubjectKey: 'envio_de_atestado',
      statusCode: 'waiting_area',
      slaDeadlineAt: '2026-04-08T14:00:00-03:00',
    },
    operationalAreas: foundation.operationalAreas,
    areaSubjectEligibility: [],
    userAvailability: [],
    caseAssignments: [
      {
        caseId: 'CASE-OLD-001',
        areaLabel: 'Suporte Academico Digital',
        analystName: 'Camila Nunes',
        statusCode: CASE_ASSIGNMENT_STATUSES.COMPLETED,
        assignedAt: '2026-04-08T08:00:00-03:00',
      },
    ],
    caseProtocols: [
      {
        id: 'CASE-OLD-001',
        statusCode: 'waiting_area',
        currentAreaLabel: 'Suporte Academico Digital',
        slaDeadlineAt: '2026-04-08T16:00:00-03:00',
        slaState: 'on_track',
      },
    ],
    currentDate: now,
  })

  assert.equal(decision.analystName, 'Camila Nunes')
})

test('distribuicao respeita indisponibilidade global sem areaLabel', async () => {
  const foundation = cloneCanonicalFoundationSeeds()
  const decision = buildDistributionDecision({
    caseProtocol: {
      id: 'CASE-NEW-002',
      currentAreaLabel: 'Suporte Academico Digital',
      lastMileAreaLabel: 'Suporte Academico Digital',
      themeKey: 'provas',
      subsubjectKey: 'envio_de_atestado',
      statusCode: 'waiting_area',
      slaDeadlineAt: '2026-04-08T14:00:00-03:00',
    },
    operationalAreas: foundation.operationalAreas,
    areaSubjectEligibility: [],
    userAvailability: [
      {
        id: 'availability-global-camila',
        userName: 'Camila Nunes',
        areaLabel: '',
        statusCode: 'unavailable',
        capacityFactor: 0,
        startsAt: '2026-04-08T00:00:00-03:00',
        endsAt: '2026-04-08T23:59:59-03:00',
      },
    ],
    caseAssignments: [],
    caseProtocols: [],
    currentDate: now,
  })

  assert.notEqual(decision.analystName, 'Camila Nunes')
  assert.ok(decision.scoreSummary.unavailableUsers.includes('Camila Nunes'))
})

test('regra de elegibilidade inativa nao restringe distribuicao', async () => {
  const foundation = cloneCanonicalFoundationSeeds()
  const eligibility = resolveEligibleUsers({
    areaLabel: 'Suporte Academico Digital',
    themeKey: 'provas',
    subsubjectKey: 'envio_de_atestado',
    operationalAreas: foundation.operationalAreas,
    areaSubjectEligibility: [
      {
        id: 'rule-inactive',
        areaLabel: 'Suporte Academico Digital',
        subjectCode: buildSubjectCode('provas'),
        subsubjectCode: buildSubsubjectCode('provas', 'envio_de_atestado'),
        visibilityMode: 'restricted',
        eligibleUsers: ['Camila Nunes'],
        isActive: false,
      },
    ],
  })

  assert.deepEqual(eligibility.eligibleUsers, ['Camila Nunes', 'Leandro Farias', 'Sofia Teles'])
})

test('snapshot operacional usa conteudo operacional e nao replica guidance do aluno', async () => {
  const definition = findKnowledgeDefinitionBySubject('provas', 'envio_de_atestado')
  const usages = buildInitialKnowledgeUsageRecords({
    caseId: 'CASE-KNOWLEDGE-001',
    themeKey: 'provas',
    subsubjectKey: 'envio_de_atestado',
    actorName: 'Operacao',
    actorRole: 'op',
    usedAt: now.toISOString(),
  })
  const operationalUsage = usages.find((record) => record.bundleType === 'orientacao_operacional')

  assert.ok(operationalUsage)
  assert.equal(
    operationalUsage.displayedResponseSnapshot,
    definition.operatorNode.operatorGuidance || definition.operatorNode.responseText || '',
  )
  assert.equal(operationalUsage.operatorGuidanceSnapshot, operationalUsage.displayedResponseSnapshot)
  assert.equal(operationalUsage.studentGuidanceSnapshot, '')
})

test('validacao do builder bloqueia publicacao quando no final nao tem owner efetivo', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  setFaqBuilderBundleOperationalOwner(bundle, {
    ownerType: 'queue',
    queueKey: 'nao_aplicavel',
  })

  const firstFinal = bundle.nodes.find((node) => node.node_kind === 'leaf')
  assert.ok(firstFinal)
  setFaqBuilderNodeOwnership(bundle, firstFinal.id, {
    inherit: false,
    ownerType: 'queue',
    owner_queue: 'nao_aplicavel',
  })

  const validation = validateFaqBuilderBundle(bundle)
  assert.equal(validation.hasBlockingPublishError, true)
  assert.ok(validation.errors.some((issue) => issue.code === 'bundle_without_default_owner'))
  assert.ok(validation.errors.some((issue) => issue.code === 'final_without_effective_owner'))
})

test('exportacao portal aceita acao principal vazia e aplica fallback de versao', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const result = await buildFaqBuilderPortalExportPayload(bundle, {
    sourceBundleId: 'bundle:aluno:matricula-2026',
    process: 'Matricula 2026',
    audience: ['candidato'],
    version: '',
    currentDate: new Date(2026, 4, 15, 14, 30),
  })

  assert.equal(result.ok, true)
  assert.equal('primaryAction' in result.payload, false)
  assert.equal(result.payload.version, 'draft-20260515-1430')
  assert.deepEqual(result.payload.audience, ['candidato'])
})

test('exportacao portal exige acao principal completa quando parcialmente preenchida', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const missingRoute = validateFaqBuilderPortalExport(bundle, {
    process: 'Matricula 2026',
    audience: ['candidato'],
    primaryAction: { label: 'Verificar situacao', route: '' },
  })
  const missingLabel = validateFaqBuilderPortalExport(bundle, {
    process: 'Matricula 2026',
    audience: ['candidato'],
    primaryAction: { label: '', route: '/verificar-situacao' },
  })

  assert.equal(missingRoute.ok, false)
  assert.ok(missingRoute.errors.some((issue) => issue.code === 'missing_primary_action_route'))
  assert.equal(missingLabel.ok, false)
  assert.ok(missingLabel.errors.some((issue) => issue.code === 'missing_primary_action_label'))
})

test('exportacao portal aceita acao principal valida e bloqueia rotas externas ou internas do CRM', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const valid = await buildFaqBuilderPortalExportPayload(bundle, {
    sourceBundleId: 'bundle:aluno:matricula-2026',
    process: 'Matricula 2026',
    audience: ['candidato'],
    primaryAction: { label: 'Verificar situacao', route: '/verificar-situacao' },
  })
  const external = validateFaqBuilderPortalExport(bundle, {
    process: 'Matricula 2026',
    audience: ['candidato'],
    primaryAction: { label: 'Site externo', route: 'https://univesp.br' },
  })
  const internal = validateFaqBuilderPortalExport(bundle, {
    process: 'Matricula 2026',
    audience: ['candidato'],
    primaryAction: { label: 'Admin', route: '/admin/faq' },
  })

  assert.equal(valid.ok, true)
  assert.deepEqual(valid.payload.primaryAction, {
    label: 'Verificar situacao',
    route: '/verificar-situacao',
  })
  assert.equal(external.ok, false)
  assert.ok(external.errors.some((issue) => issue.code === 'invalid_primary_action_route'))
  assert.equal(internal.ok, false)
  assert.ok(internal.errors.some((issue) => issue.code === 'invalid_primary_action_route'))
})

test('exportacao portal valida audiences permitidas e processo obrigatorio', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  for (const audience of [['candidato'], ['op'], ['candidato', 'op']]) {
    const valid = validateFaqBuilderPortalExport(bundle, {
      process: 'Matricula 2026',
      audience,
    })
    assert.equal(valid.ok, true)
  }
  const emptyAudience = validateFaqBuilderPortalExport(bundle, {
    process: 'Matricula 2026',
    audience: [],
  })
  const emptyProcess = validateFaqBuilderPortalExport(bundle, {
    process: '',
    audience: ['candidato'],
  })

  assert.equal(emptyAudience.ok, false)
  assert.ok(emptyAudience.errors.some((issue) => issue.code === 'invalid_audience'))
  assert.equal(emptyProcess.ok, false)
  assert.ok(emptyProcess.errors.some((issue) => issue.code === 'missing_process'))
})

test('exportacao portal nao vaza campos internos do builder', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const result = await buildFaqBuilderPortalExportPayload(bundle, {
    sourceBundleId: 'bundle:aluno:matricula-2026',
    process: 'Matricula 2026',
    audience: ['candidato'],
  })
  const serialized = JSON.stringify(result.payload)

  assert.equal(result.ok, true)
  for (const forbidden of [
    'operational_owner',
    'workflow',
    'publication_window',
    'canvas_snapshot',
    'lock',
    'audit',
    'upsert_faq_bundle',
    'draftBundle',
    'publishedBundle',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `Campo interno exportado: ${forbidden}`)
  }
})

test('override invalido de owner no no bloqueia publicacao', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const finalNode = bundle.nodes.find((node) => node.node_kind === 'leaf')
  assert.ok(finalNode)

  setFaqBuilderNodeOwnership(bundle, finalNode.id, {
    inherit: false,
    ownerType: 'queue',
    queueKey: 'nao_aplicavel',
  })

  const validation = validateFaqBuilderBundle(bundle)
  assert.equal(validation.hasBlockingPublishError, true)
  assert.ok(validation.errors.some((issue) => issue.code === 'invalid_owner_override'))
})

test('validacao do builder nao muta o bundle de entrada por padrao', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const finalNode = bundle.nodes.find((node) => node.node_kind === 'leaf')
  assert.ok(finalNode)

  delete finalNode.ownership
  delete finalNode.owner_inherit
  delete finalNode.owner_type
  delete finalNode.owner_queue
  delete finalNode.owner_area
  delete finalNode.owner_role

  const snapshotBefore = JSON.stringify(finalNode)
  const validation = validateFaqBuilderBundle(bundle)
  const snapshotAfter = JSON.stringify(finalNode)

  assert.ok(validation.errors.length >= 0)
  assert.equal(snapshotAfter, snapshotBefore)
})

test('validacao do builder resiste a bundle com entradas invalidas sem travar', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  bundle.nodes = [
    ...(Array.isArray(bundle.nodes) ? bundle.nodes.slice(0, 1) : []),
    null,
    undefined,
    { id: '', node_kind: 'leaf', titulo_exibido: '' },
  ]
  bundle.links = [
    ...(Array.isArray(bundle.links) ? bundle.links.slice(0, 1) : []),
    null,
    { parent_node_id: 'x', child_node_id: '', ativo: true },
    {},
  ]

  const validation = validateFaqBuilderBundle(bundle)
  assert.ok(validation)
  assert.ok(Array.isArray(validation.errors))
  assert.ok(
    validation.errors.some((issue) =>
      ['invalid_node_entry', 'missing_node_id', 'invalid_link_entry'].includes(issue.code),
    ),
  )
})

test('graph safe gera ids de edge fallback e nao quebra com snapshot ruim', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  if (Array.isArray(bundle.links) && bundle.links[0]) {
    delete bundle.links[0].link_id
  }

  const graph = buildFaqBuilderGraphSafe(
    bundle,
    {
      nodePositions: null,
      edges: [{ id: '', source: '', target: '' }],
    },
    validateFaqBuilderBundle(bundle),
  )

  assert.ok(graph?.graph)
  assert.ok(Array.isArray(graph.graph.edges))
  assert.ok(
    graph.graph.edges.every(
      (edge) =>
        typeof edge.id === 'string' &&
        edge.id.length > 0 &&
        typeof edge.source === 'string' &&
        edge.source.length > 0 &&
        typeof edge.target === 'string' &&
        edge.target.length > 0,
    ),
  )
})

test('diff do builder ignora entradas invalidas sem estourar runtime', async () => {
  const draftBundle = cloneFaqBuilderPackage('aluno')
  const publishedBundle = cloneFaqBuilderPackage('aluno')
  draftBundle.nodes = [...(draftBundle.nodes || []), null, undefined]
  publishedBundle.links = [...(publishedBundle.links || []), null, {}]

  const diff = buildFaqBuilderDiff({ draftBundle, publishedBundle })
  assert.ok(diff?.summary)
  assert.equal(typeof diff.summary.createdNodes, 'number')
})

test('resolucao de ownership do no nao quebra com bundle legado parcialmente corrompido', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const firstNodeId = bundle.nodes?.find((node) => node?.id)?.id || ''
  assert.ok(firstNodeId)

  bundle.nodes = [
    undefined,
    null,
    ...(Array.isArray(bundle.nodes) ? bundle.nodes : []),
    { random: true },
  ]

  const resolvedOwner = resolveFaqBuilderNodeEffectiveOwner(bundle, firstNodeId)
  assert.ok(resolvedOwner)
  assert.equal(typeof resolvedOwner.source, 'string')
})

test('importacao dry-run bloqueia fluxo sem ownership efetivo', async () => {
  const baseBundle = cloneFaqBuilderPackage('aluno')
  setFaqBuilderBundleOperationalOwner(baseBundle, {
    ownerType: 'queue',
    queueKey: 'nao_aplicavel',
  })

  const dryRun = dryRunFaqBuilderImport(
    [
      {
        node_id: 'no-raiz',
        short_title: 'Inicio da triagem',
        node_type: 'path',
        parent_id: '',
        response_content: '',
        closing_action: 'ir_para_subniveis',
        theme: 'matricula',
        subtheme: 'regularizacao',
        queue_destination: 'nao_aplicavel',
        criticality: 'media',
        sla: '48h',
        owner_inherit: 'sim',
      },
      {
        node_id: 'no-final',
        short_title: 'Resposta final',
        node_type: 'final',
        parent_id: 'no-raiz',
        response_content: 'Resposta final de teste.',
        closing_action: 'mostrar_resposta',
        theme: 'matricula',
        subtheme: 'regularizacao',
        queue_destination: 'nao_aplicavel',
        criticality: 'media',
        sla: '48h',
        owner_inherit: 'sim',
      },
    ],
    { faqType: 'aluno', baseBundle },
  )

  assert.equal(dryRun.ok, false)
  assert.ok(
    dryRun.errors.some((issue) =>
      ['bundle_without_default_owner', 'final_without_effective_owner'].includes(issue.code),
    ),
  )
})

test('importacao dry-run bloqueia override com fila inexistente', async () => {
  const baseBundle = cloneFaqBuilderPackage('aluno')
  const dryRun = dryRunFaqBuilderImport(
    [
      {
        node_id: 'raiz-import',
        short_title: 'Inicio',
        node_type: 'path',
        parent_id: '',
        response_content: '',
        closing_action: 'ir_para_subniveis',
        theme: 'matricula',
        subtheme: 'regularizacao',
        queue_destination: 'sra',
        criticality: 'media',
        sla: '48h',
        owner_inherit: 'sim',
      },
      {
        node_id: 'final-invalido',
        short_title: 'Resposta',
        node_type: 'final',
        parent_id: 'raiz-import',
        response_content: 'Texto final.',
        closing_action: 'mostrar_resposta',
        theme: 'matricula',
        subtheme: 'regularizacao',
        queue_destination: 'sra',
        criticality: 'media',
        sla: '48h',
        owner_inherit: 'nao',
        owner_type: 'queue',
        owner_queue: 'fila_inexistente_xyz',
      },
    ],
    { faqType: 'aluno', baseBundle },
  )

  assert.equal(dryRun.ok, false)
  assert.ok(dryRun.errors.some((issue) => issue.code === 'invalid_owner_override'))
})

test('builder bloqueia publicacao quando no final aponta para area inexistente', async () => {
  const bundle = cloneFaqBuilderPackage('aluno')
  const finalNode = bundle.nodes.find((node) => node.node_kind === 'leaf')
  assert.ok(finalNode)

  setFaqBuilderNodeOwnership(bundle, finalNode.id, {
    inherit: false,
    ownerType: 'area',
    areaLabel: 'Area Fantasma QA',
  })

  const validation = validateFaqBuilderBundle(bundle)
  assert.equal(validation.hasBlockingPublishError, true)
  assert.ok(
    validation.errors.some((issue) =>
      ['invalid_owner_reference', 'final_with_invalid_owner_reference'].includes(issue.code),
    ),
  )
})

test('publicacao do builder bloqueia quando ownership estiver incompleto', async () => {
  const workspace = createFaqBuilderWorkspace('aluno', 'QA Ownership')
  setFaqBuilderBundleOperationalOwner(workspace.draftBundle, {
    ownerType: 'queue',
    queueKey: 'nao_aplicavel',
  })

  const finalNode = workspace.draftBundle.nodes.find((node) => node.node_kind === 'leaf')
  assert.ok(finalNode)
  setFaqBuilderNodeOwnership(workspace.draftBundle, finalNode.id, {
    inherit: false,
    ownerType: 'queue',
    queueKey: 'nao_aplicavel',
  })

  const publication = publishFaqBuilderWorkspace(workspace, {
    actorName: 'QA Ownership',
    summary: 'Teste de bloqueio por ownership incompleto.',
  })

  assert.equal(publication.ok, false)
  assert.ok(publication.validation?.hasBlockingPublishError)
  assert.equal(publication.errorCode, 'PUBLISH_BLOCKED_BY_OWNERSHIP_COVERAGE')
})

test('enforcement de cobertura para publish retorna codigo canonico backend', async () => {
  const validation = {
    errors: [
      {
        code: 'final_without_effective_owner',
      },
    ],
  }
  const result = validateBundleOwnershipCoverageForServer(validation)
  assert.equal(result.ok, false)
  assert.ok(result.errorCodes.includes('PUBLISH_BLOCKED_BY_OWNERSHIP_COVERAGE'))
})

test('protocolo aberto da FAQ nasce com ownership operacional no payload', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const bundle = cloneFaqBuilderPackage('aluno')
  const node = bundle.nodes.find((entry) => entry.node_kind === 'leaf' && entry.acao.includes('abrir'))
  assert.ok(node)

  const draft = store.startProtocolFromFaq({
    node,
    lineage: [node],
    currentDate: new Date('2026-04-08T12:15:00-03:00'),
  })
  assert.ok(draft?.context?.ownership?.hasOwner)
  store.updateProtocolField('description', 'Descricao de teste para envio do protocolo.')
  if (Array.isArray(draft?.requiredFields) && draft.requiredFields.includes('anexo_obrigatorio')) {
    store.setProtocolAttachments(['anexo-teste.pdf'])
  }
  const submission = store.submitProtocol(new Date('2026-04-08T12:16:00-03:00'))
  assert.equal(submission.ok, true)
  assert.ok(submission.protocol.ownerKey)
  assert.ok(submission.protocol.ownerQueue || submission.protocol.ownerArea || submission.protocol.ownerRole)
  const ownershipEnvelope = validateOperationalOwnershipEnvelope(submission.protocol, {
    requireSourceBinding: true,
    requireBundleVersion: true,
  })
  assert.equal(ownershipEnvelope.ok, true)
})

test('FAQ -> draft bloqueia quando no final aponta area invalida', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const bundle = cloneFaqBuilderPackage('aluno')
  const node = bundle.nodes.find((entry) => entry.node_kind === 'leaf' && entry.acao.includes('abrir'))
  assert.ok(node)

  setFaqBuilderNodeOwnership(bundle, node.id, {
    inherit: false,
    ownerType: 'area',
    areaLabel: 'Area Inexistente QA',
  })

  const draft = store.startProtocolFromFaq({
    node,
    lineage: [node],
    currentDate: new Date('2026-04-08T12:18:00-03:00'),
  })

  assert.equal(draft, null)
})

test('follow-up do aluno preserva ownership e source binding do protocolo', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const bundle = cloneFaqBuilderPackage('aluno')
  const node = bundle.nodes.find((entry) => entry.node_kind === 'leaf' && entry.acao.includes('abrir'))
  assert.ok(node)

  const draft = store.startProtocolFromFaq({
    node,
    lineage: [node],
    currentDate: new Date('2026-04-08T12:35:00-03:00'),
  })
  assert.ok(draft)
  store.updateProtocolField('description', 'Protocolo base para follow-up.')

  const submission = store.submitProtocol(new Date('2026-04-08T12:36:00-03:00'))
  assert.equal(submission.ok, true)
  const createdProtocol = submission.protocol
  assert.ok(createdProtocol?.protocolNumber)

  const updated = store.submitRequestFollowUp({
    requestId: createdProtocol.protocolNumber,
    note: 'Complemento enviado pelo aluno.',
    attachments: ['documento-complementar.pdf'],
    currentDate: new Date('2026-04-08T13:05:00-03:00'),
  })

  assert.ok(updated)
  assert.equal(updated.ownerKey, createdProtocol.ownerKey)
  assert.equal(updated.ownerType, createdProtocol.ownerType)
  assert.equal(updated.sourceBundleId, createdProtocol.sourceBundleId)
  assert.equal(updated.sourceNodeId, createdProtocol.sourceNodeId)
  const ownershipEnvelope = validateOperationalOwnershipEnvelope(updated, {
    requireSourceBinding: true,
    requireBundleVersion: true,
  })
  assert.equal(ownershipEnvelope.ok, true)
})

test('protocolo canonico local preserva sourceNodeId e estado de source binding', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const bundle = cloneFaqBuilderPackage('aluno')
  const node = bundle.nodes.find((entry) => entry.node_kind === 'leaf' && entry.acao.includes('abrir'))
  assert.ok(node)

  const draft = store.startProtocolFromFaq({
    node,
    lineage: [node],
    currentDate: new Date('2026-04-08T13:20:00-03:00'),
  })
  assert.ok(draft)
  store.updateProtocolField('description', 'Validacao de source binding no runtime canonico.')

  const submission = store.submitProtocol(new Date('2026-04-08T13:21:00-03:00'))
  assert.equal(submission.ok, true)
  const canonicalProtocol = store.canonicalCaseProtocols.find(
    (record) => record.id === submission.protocol.protocolNumber,
  )

  assert.ok(canonicalProtocol)
  assert.equal(canonicalProtocol.sourceBundleId, submission.protocol.sourceBundleId)
  assert.equal(canonicalProtocol.sourceBundleVersionId, submission.protocol.sourceBundleVersionId)
  assert.equal(canonicalProtocol.sourceNodeId, submission.protocol.sourceNodeId)
  assert.equal(canonicalProtocol.hasSourceBinding, true)
  assert.equal(canonicalProtocol.sourceBindingStateCode, 'source_binding_resolved')
})

test('protocolos seed canonicos recebem source binding rastreavel no runtime', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const seedProtocols = store.canonicalCaseProtocols.filter((record) => record.sourceType === 'seed_queue')

  assert.ok(seedProtocols.length > 0)
  assert.ok(seedProtocols.every((record) => String(record.sourceBundleId || '').trim().length > 0))
  assert.ok(seedProtocols.every((record) => String(record.sourceNodeId || '').trim().length > 0))
  assert.ok(seedProtocols.every((record) => record.hasSourceBinding === true))
  assert.ok(
    seedProtocols.every((record) =>
      ['source_binding_resolved', 'source_binding_missing'].includes(record.sourceBindingStateCode),
    ),
  )
})

test('mudanca de owner em nova sessao nao altera snapshot de protocolo ja aberto', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const bundle = cloneFaqBuilderPackage('aluno')
  const node = bundle.nodes.find((entry) => entry.node_kind === 'leaf' && entry.acao.includes('abrir'))
  assert.ok(node)

  const firstDraft = store.startProtocolFromFaq({
    node,
    lineage: [node],
    currentDate: new Date('2026-04-08T14:00:00-03:00'),
  })
  assert.ok(firstDraft)
  store.updateProtocolField('description', 'Primeiro protocolo antes da mudanca de owner.')
  if (Array.isArray(firstDraft?.requiredFields) && firstDraft.requiredFields.includes('anexo_obrigatorio')) {
    store.setProtocolAttachments(['anexo-owner-1.pdf'])
  }
  const firstSubmission = store.submitProtocol(new Date('2026-04-08T14:01:00-03:00'))
  assert.equal(firstSubmission.ok, true)

  setFaqBuilderNodeOwnership(bundle, node.id, {
    inherit: false,
    ownerType: 'area',
    areaLabel: 'Secretaria Academica',
  })

  const secondDraft = store.startProtocolFromFaq({
    node,
    lineage: [node],
    currentDate: new Date('2026-04-08T14:10:00-03:00'),
  })
  assert.ok(secondDraft)
  store.updateProtocolField('description', 'Segundo protocolo depois da mudanca de owner.')
  if (Array.isArray(secondDraft?.requiredFields) && secondDraft.requiredFields.includes('anexo_obrigatorio')) {
    store.setProtocolAttachments(['anexo-owner-2.pdf'])
  }
  const secondSubmission = store.submitProtocol(new Date('2026-04-08T14:11:00-03:00'))
  assert.equal(secondSubmission.ok, true)

  assert.notEqual(secondSubmission.protocol.ownerKey, firstSubmission.protocol.ownerKey)

  const followUp = store.submitRequestFollowUp({
    requestId: firstSubmission.protocol.protocolNumber,
    note: 'Complemento para protocolo antigo.',
    attachments: ['followup-owner-1.pdf'],
    currentDate: new Date('2026-04-08T14:20:00-03:00'),
  })

  assert.ok(followUp)
  assert.equal(followUp.ownerKey, firstSubmission.protocol.ownerKey)
  assert.equal(followUp.sourceBundleId, firstSubmission.protocol.sourceBundleId)
  assert.equal(followUp.sourceNodeId, firstSubmission.protocol.sourceNodeId)
})

test('envelope bloqueia quando sourceBundleVersionId estiver ausente e for obrigatoria', async () => {
  const envelope = validateOperationalOwnershipEnvelope(
    {
      ownerType: 'queue',
      ownerKey: 'queue:sra',
      ownerQueue: 'sra',
      hasOperationalOwner: true,
      ownershipStateCode: 'owner_resolved',
      sourceBundleId: 'bundle:matricula',
      sourceNodeId: 'node:final-1',
      sourceBundleVersionId: '',
    },
    {
      requireSourceBinding: true,
      requireBundleVersion: true,
    },
  )

  assert.equal(envelope.ok, false)
  assert.ok(envelope.missingFields.includes('sourceBundleVersionId'))
})

test('envelope de ownership rejeita ownerType invalido', async () => {
  const envelope = validateOperationalOwnershipEnvelope({
    ownerType: 'person',
    ownerKey: 'person:joao',
    hasOperationalOwner: true,
    ownershipStateCode: 'owner_resolved',
    sourceBundleId: 'bundle:foo',
    sourceNodeId: 'node:bar',
  }, {
    requireSourceBinding: true,
  })

  assert.equal(envelope.ok, false)
  assert.ok(envelope.missingFields.includes('ownerType_invalid'))
})

test('envelope de ownership rejeita ownerKey inconsistente com ownerType', async () => {
  const envelope = validateOperationalOwnershipEnvelope(
    {
      ownerType: 'area',
      ownerKey: 'queue:sra',
      ownerArea: 'Secretaria Academica',
      hasOperationalOwner: true,
      ownershipStateCode: 'owner_resolved',
      sourceBundleId: 'bundle:foo',
      sourceBundleVersionId: 'v1',
      sourceNodeId: 'node:bar',
    },
    {
      requireSourceBinding: true,
      requireBundleVersion: true,
    },
  )

  assert.equal(envelope.ok, false)
  assert.ok(envelope.missingFields.includes('ownerKey_mismatch'))
})

test('envelope de ownership rejeita ownerQueue placeholder nao_aplicavel', async () => {
  const envelope = validateOperationalOwnershipEnvelope(
    {
      ownerType: 'queue',
      ownerKey: 'queue:nao_aplicavel',
      ownerQueue: 'nao_aplicavel',
      hasOperationalOwner: true,
      ownershipStateCode: 'owner_resolved',
      sourceBundleId: 'bundle:foo',
      sourceBundleVersionId: 'v1',
      sourceNodeId: 'node:bar',
    },
    {
      requireSourceBinding: true,
      requireBundleVersion: true,
    },
  )

  assert.equal(envelope.ok, false)
  assert.ok(envelope.missingFields.includes('ownerQueue'))
})

test('envelope de ownership rejeita referencia de area invalida quando enforceReferences=true', async () => {
  const references = buildOperationalOwnershipReferenceCatalog()
  const envelope = validateOperationalOwnershipEnvelope(
    {
      ownerType: 'area',
      ownerKey: 'area:Area Fantasma',
      ownerArea: 'Area Fantasma',
      hasOperationalOwner: true,
      ownershipStateCode: 'owner_resolved',
      sourceBundleId: 'bundle:foo',
      sourceBundleVersionId: 'v1',
      sourceNodeId: 'node:bar',
    },
    {
      requireSourceBinding: true,
      requireBundleVersion: true,
      enforceReferences: true,
      references,
    },
  )

  assert.equal(envelope.ok, false)
  assert.ok(envelope.invalidReferences.includes('ownerArea_reference_invalid'))
})

test('envelope de ownership rejeita referencia de role invalida quando enforceReferences=true', async () => {
  const references = buildOperationalOwnershipReferenceCatalog()
  const envelope = validateOperationalOwnershipEnvelope(
    {
      ownerType: 'role',
      ownerKey: 'role:papel_inexistente',
      ownerRole: 'papel_inexistente',
      hasOperationalOwner: true,
      ownershipStateCode: 'owner_resolved',
      sourceBundleId: 'bundle:foo',
      sourceBundleVersionId: 'v1',
      sourceNodeId: 'node:bar',
    },
    {
      requireSourceBinding: true,
      requireBundleVersion: true,
      enforceReferences: true,
      references,
    },
  )

  assert.equal(envelope.ok, false)
  assert.ok(envelope.invalidReferences.includes('ownerRole_reference_invalid'))
})

test('contrato backend mapeia issue canonica para codigo de erro server-side', async () => {
  assert.equal(mapOwnershipIssueToBackendErrorCode('ownerQueue_reference_invalid'), 'OWNER_QUEUE_NOT_FOUND')
  assert.equal(mapOwnershipIssueToBackendErrorCode('ownerArea_reference_invalid'), 'OWNER_AREA_NOT_FOUND')
  assert.equal(mapOwnershipIssueToBackendErrorCode('sourceBundleVersionId'), 'BUNDLE_VERSION_REQUIRED')
})

test('enforcement server-side bloqueia source binding ausente', async () => {
  const references = buildOperationalOwnershipReferenceCatalog()
  const validation = validateOperationalOwnershipForServer(
    {
      ownerType: 'queue',
      ownerKey: 'queue:sra',
      ownerQueue: 'sra',
      hasOperationalOwner: true,
      ownershipStateCode: 'owner_resolved',
      sourceBundleId: '',
      sourceBundleVersionId: 'v1',
      sourceNodeId: '',
    },
    {
      endpoint: OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE,
      references,
      requireSourceBinding: true,
      requireBundleVersion: true,
      enforceReferences: true,
    },
  )

  assert.equal(validation.ok, false)
  assert.ok(validation.errorCodes.includes('SOURCE_BINDING_INVALID'))
})

test('enforcement server-side bloqueia payload legado em escrita nova', async () => {
  const references = buildOperationalOwnershipReferenceCatalog()
  const validation = validateOperationalOwnershipForServer(
    {
      ownerType: 'queue',
      ownerKey: 'queue:sra',
      ownerQueue: 'sra',
      hasOperationalOwner: true,
      ownershipStateCode: 'owner_resolved_fallback',
      ownerSource: 'legacy_fallback',
      sourceBundleId: 'legacy-bundle:provas',
      sourceBundleVersionId: 'legacy',
      sourceNodeId: 'legacy-node:123',
    },
    {
      endpoint: OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE,
      references,
      requireSourceBinding: true,
      requireBundleVersion: true,
      enforceReferences: true,
    },
  )

  assert.equal(validation.ok, false)
  assert.ok(validation.errorCodes.includes('LEGACY_OWNERSHIP_REQUIRES_MIGRATION'))
  assert.ok(validation.errorCodes.includes('LEGACY_SOURCE_BINDING_REQUIRES_MIGRATION'))
})

test('auditoria de legado classifica registros canonical vs legacy', async () => {
  const references = buildOperationalOwnershipReferenceCatalog()
  const report = auditLegacyOwnershipRecords(
    [
      {
        protocolNumber: 'UVSP-20260420-100',
        ownerType: 'queue',
        ownerKey: 'queue:sra',
        ownerQueue: 'sra',
        hasOperationalOwner: true,
        ownershipStateCode: 'owner_resolved',
        sourceBundleId: 'bundle:provas',
        sourceBundleVersionId: 'v2.0',
        sourceNodeId: 'node:provas:final',
      },
      {
        protocolNumber: 'UVSP-20260420-101',
        ownerType: 'queue',
        ownerKey: 'queue:sra',
        ownerQueue: 'sra',
        hasOperationalOwner: true,
        ownershipStateCode: 'owner_resolved_fallback',
        ownerSource: 'legacy_fallback',
        sourceBundleId: 'legacy-bundle:provas',
        sourceBundleVersionId: 'legacy',
        sourceNodeId: 'legacy-node:101',
      },
    ],
    {
      references,
    },
  )

  assert.equal(report.totalRecords, 2)
  assert.equal(report.canonicalRecords, 1)
  assert.equal(report.legacyRecords, 1)
  assert.equal(report.legacySafeToNormalize, 1)
})

test('normalizacao corrige ownerKey legado quando prefixo diverge do ownerType', async () => {
  const snapshot = normalizeOperationalOwnerSnapshot({
    ownerType: 'area',
    ownerKey: 'queue:sra',
    ownerArea: 'Secretaria Academica',
    ownerQueue: '',
    ownerRole: '',
  })

  assert.equal(snapshot.ownerType, 'area')
  assert.equal(snapshot.ownerKey, 'area:Secretaria Academica')
  assert.equal(snapshot.hasOwner, true)
})

test('abertura assistida pelo OP bloqueia protocolo sem owner operacional efetivo', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const beforeCount = store.operatorProtocols.length
  const result = store.createOperatorAssistedCase({
    studentData: {
      nome: 'Aluno sem owner',
      email: 'aluno.sem.owner@univesp.br',
      ra: '21999999',
      curso: 'Pedagogia',
      polo: 'Guarulhos',
    },
    context: {
      theme: 'teste_owner',
      subtheme: 'sem_owner',
      subject: 'Teste de ownership ausente',
      queueDestination: 'nao_aplicavel',
      criticality: 'media',
      sla: '48h',
      displayedAnswer: 'Resposta de teste',
      finalNode: {
        id: 'node-sem-owner',
        bundleId: 'bundle:sem-owner',
        bundleVersionId: 'v1',
      },
      ownership: {
        ownerType: 'queue',
        ownerKey: '',
        queueKey: 'nao_aplicavel',
        areaLabel: '',
        roleKey: '',
        routingPolicy: '',
        source: 'test_case',
      },
    },
    verifiedSummary: 'Triagem feita, mas sem dono operacional definido.',
    contactChannel: 'telefone',
    actorName: 'Juliana Prado',
    actionType: 'open_case',
    currentDate: new Date('2026-04-08T12:20:00-03:00'),
  })

  assert.ok(result)
  assert.equal(result.ok, false)
  assert.equal(store.operatorProtocols.length, beforeCount)
})

test('abertura assistida pelo OP bloqueia owner role invalido', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const beforeCount = store.operatorProtocols.length
  const result = store.createOperatorAssistedCase({
    studentData: {
      nome: 'Aluno role invalido',
      email: 'aluno.role.invalido@univesp.br',
      ra: '21888888',
      curso: 'Letras',
      polo: 'Guarulhos',
    },
    context: {
      theme: 'provas',
      subtheme: 'segunda_chamada',
      subject: 'Teste owner role invalido',
      queueDestination: 'sra',
      criticality: 'media',
      sla: '48h',
      displayedAnswer: 'Resposta de teste',
      finalNode: {
        id: 'node-role-invalido',
        bundleId: 'bundle:test-role',
        bundleVersionId: 'v1',
      },
      ownership: {
        ownerType: 'role',
        ownerKey: 'role:papel_que_nao_existe',
        queueKey: '',
        areaLabel: '',
        roleKey: 'papel_que_nao_existe',
        routingPolicy: '',
        source: 'test_case',
      },
    },
    verifiedSummary: 'Triagem com owner role invalido.',
    contactChannel: 'telefone',
    actorName: 'Juliana Prado',
    actionType: 'open_case',
    currentDate: new Date('2026-04-08T12:28:00-03:00'),
  })

  assert.ok(result)
  assert.equal(result.ok, false)
  assert.equal(store.operatorProtocols.length, beforeCount)
  assert.equal(result.errorCode, 'OWNER_ROLE_NOT_FOUND')
})

test('fila da area permite recorte explicito de owner_missing', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const managerContext = getMockContext('gestor_area')
  const entries = store.areaQueueEntries(managerContext)
  const ownerMissingEntries = entries.filter((entry) => entry.ownershipState === 'owner_missing')
  const filtered = filterAreaQueueEntries(entries, {
    search: '',
    area: 'todos',
    subject: 'todos',
    status: 'todos',
    owner: 'todos',
    scopeState: 'owner_missing',
    bucket: 'all',
  })

  assert.equal(filtered.length, ownerMissingEntries.length)
  assert.ok(filtered.every((entry) => entry.hasOperationalOwnerError))
})

test('fila da area diferencia sem owner estrutural de sem assignee humano', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const managerContext = getMockContext('gestor_area')
  const entries = store.areaQueueEntries(managerContext)
  const unassignedWithOwner = entries.filter(
    (entry) => entry.currentAssigneeLabel === 'Sem responsavel' && !entry.hasOperationalOwnerError,
  )
  const ownerMissingEntries = entries.filter((entry) => entry.hasOperationalOwnerError)
  const onlyOwnerMissing = filterAreaQueueEntries(entries, {
    search: '',
    area: 'todos',
    subject: 'todos',
    status: 'todos',
    owner: 'todos',
    scopeState: 'owner_missing',
    bucket: 'all',
  })

  assert.ok(unassignedWithOwner.length > 0)
  assert.ok(ownerMissingEntries.length >= 0)
  assert.equal(onlyOwnerMissing.length, ownerMissingEntries.length)
  assert.ok(
    unassignedWithOwner.every(
      (entry) => !ownerMissingEntries.some((ownerMissing) => ownerMissing.id === entry.id),
    ),
  )
})

test('assign manual da area gera trilha append-only e conclui assignments anteriores', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const caseId = 'UVSP-20260327-239'
  const areaLabel = 'Suporte Academico Digital'
  const baseline = store.canonicalCaseAssignments.filter(
    (record) => record.caseId === caseId && record.areaLabel === areaLabel,
  ).length

  const first = store.assignAreaCase({
    caseId,
    areaLabel,
    analystName: 'Camila Nunes',
    actorName: 'Rafael Martins',
    reason: 'Primeira atribuicao gerencial.',
    currentDate: new Date('2026-04-08T10:30:00-03:00'),
  })

  const second = store.assignAreaCase({
    caseId,
    areaLabel,
    analystName: 'Leandro Farias',
    actorName: 'Rafael Martins',
    reason: 'Redistribuicao gerencial.',
    currentDate: new Date('2026-04-08T11:30:00-03:00'),
  })

  const records = store.canonicalCaseAssignments.filter(
    (record) => record.caseId === caseId && record.areaLabel === areaLabel,
  )
  const activeRecords = records.filter((record) => record.statusCode !== CASE_ASSIGNMENT_STATUSES.COMPLETED)

  assert.equal(records.length, baseline + 2)
  assert.equal(activeRecords.length, 1)
  assert.equal(activeRecords[0].analystName, 'Leandro Farias')
  assert.ok(records.some((record) => record.id === first.id && record.statusCode === CASE_ASSIGNMENT_STATUSES.COMPLETED))
  assert.ok(records.some((record) => record.id === second.id && record.statusCode !== CASE_ASSIGNMENT_STATUSES.COMPLETED))
})

test('auto assignment preserva assignmentMode e scoreSummary apos rehidratacao', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const assignment = store.applyAutomaticAreaAssignment({
    caseId: 'UVSP-20260327-239',
    areaLabel: 'Suporte Academico Digital',
    actorName: 'Sistema',
    currentDate: new Date('2026-04-08T12:00:00-03:00'),
  })

  store.persistState()

  const rehydratedStore = createFreshStore(storage, { reset: false })
  const rehydratedAssignment =
    rehydratedStore.canonicalCaseAssignments
      .filter((record) => record.caseId === 'UVSP-20260327-239' && record.id === assignment.id)
      .at(-1) || null

  assert.ok(rehydratedAssignment)
  assert.equal(rehydratedAssignment.assignmentMode, 'auto')
  assert.ok(Array.isArray(rehydratedAssignment.scoreSummary?.candidateScores))
  assert.ok(rehydratedAssignment.scoreSummary.candidateScores.length > 0)
})

test('manager_exception gera routing decision rastreavel', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const caseId = store.areaQueueEntries().find((record) => record.areaBucket === 'needs_review')?.id

  const actionLog = store.registerAreaAction({
    caseId,
    actionType: 'reassign',
    nextArea: 'Secretaria Academica',
    isManagerException: true,
    actorName: 'Rafael Martins',
    currentDate: new Date('2026-04-08T13:15:00-03:00'),
  })
  const lastRoutingDecision =
    store.mergedCaseRoutingDecisions.filter((record) => record.caseId === caseId).at(-1) || null

  assert.ok(caseId)
  assert.ok(actionLog)
  assert.equal(actionLog.routingMode, 'manager_exception')
  assert.ok(lastRoutingDecision)
  assert.equal(lastRoutingDecision.routingMode, 'manager_exception')
  assert.equal(lastRoutingDecision.resolvedAreaLabel, 'Secretaria Academica')
})

test('aprovacao e publicacao canonicas preservam historico e trocam a versao ativa', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const bundleType = 'faq_aluno'
  const previousPublishedVersion = store.knowledgeBundleVersions.find(
    (record) => record.bundleType === bundleType && record.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
  )
  const targetVersion = store.knowledgeBundleVersions.find(
    (record) =>
      record.bundleType === bundleType &&
      [KNOWLEDGE_BUNDLE_VERSION_STATUSES.DRAFT, KNOWLEDGE_BUNDLE_VERSION_STATUSES.IN_REVIEW, KNOWLEDGE_BUNDLE_VERSION_STATUSES.APPROVED].includes(record.statusCode),
  )
  const publicationHistoryBefore = store.knowledgePublications.filter((record) => record.bundleType === bundleType).length

  assert.ok(previousPublishedVersion)
  assert.ok(targetVersion)

  store.approveKnowledgeBundleVersion({
    bundleVersionId: targetVersion.id,
    actorName: 'Admin central',
    currentDate: new Date('2026-04-08T14:00:00-03:00'),
  })
  store.publishKnowledgeBundleVersion({
    bundleVersionId: targetVersion.id,
    actorName: 'Admin central',
    currentDate: new Date('2026-04-08T14:05:00-03:00'),
  })

  const refreshedTarget = store.knowledgeBundleVersions.find((record) => record.id === targetVersion.id)
  const archivedPrevious = store.knowledgeBundleVersions.find((record) => record.id === previousPublishedVersion.id)
  const publicationHistoryAfter = store.knowledgePublications.filter((record) => record.bundleType === bundleType)
  const activeVersionId = getActiveKnowledgeBundleVersionId(bundleType, store.knowledgeFoundation)
  const versionScopedNodes = store.knowledgeFoundation.nodes.filter((record) => record.bundleVersionId === targetVersion.id)

  assert.equal(refreshedTarget.statusCode, KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED)
  assert.equal(archivedPrevious.statusCode, KNOWLEDGE_BUNDLE_VERSION_STATUSES.ARCHIVED)
  assert.equal(publicationHistoryAfter.length, publicationHistoryBefore + 1)
  assert.ok(publicationHistoryAfter.some((record) => record.bundleVersionId === previousPublishedVersion.id))
  assert.ok(publicationHistoryAfter.some((record) => record.bundleVersionId === targetVersion.id))
  assert.equal(activeVersionId, targetVersion.id)
  assert.ok(versionScopedNodes.length > 0)
  assert.ok(versionScopedNodes.every((record) => record.id.startsWith(`${targetVersion.id}:node:`)))
})

test('escopo por assunto respeita analista elegivel e libera gestor da area', async () => {
  const foundation = cloneCanonicalFoundationSeeds()
  const entry = {
    currentAreaLabel: 'Suporte Academico Digital',
    themeKey: 'estagio',
    subsubjectKey: 'termo_de_compromisso',
  }

  assert.equal(
    canViewerAccessAreaSubject(entry, { profileKey: 'analista_area', userName: 'Leandro Farias' }, foundation.areaSubjectEligibility),
    false,
  )
  assert.equal(
    canViewerAccessAreaSubject(entry, { profileKey: 'analista_area', userName: 'Camila Nunes' }, foundation.areaSubjectEligibility),
    true,
  )
  assert.equal(
    canViewerAccessAreaSubject(entry, { profileKey: 'gestor_area', userName: 'Rafael Martins' }, foundation.areaSubjectEligibility),
    true,
  )
})

test('detalhe do OP usa fallback do seed quando houver protocolo persistido parcial com o mesmo id', async () => {
  const storage = createBrowserMock(
    JSON.stringify({
      protocols: [
        {
          protocolNumber: 'UVSP-20260319-104',
          subject: '',
          studentData: {
            nome: '',
            ra: '',
            polo: '',
          },
          context: {},
          timeline: [],
          interactions: [],
          attachments: [],
        },
      ],
    }),
  )
  const store = createFreshStore(storage, { reset: false })
  const detail = store.operatorCaseById('UVSP-20260319-104')
  const matchingEntries = store.operatorQueueEntries().filter((entry) => entry.id === 'UVSP-20260319-104')

  assert.ok(detail)
  assert.equal(detail.subject, 'Rematricula para o proximo semestre')
  assert.equal(detail.studentData.nome, 'Marina Costa')
  assert.ok(Array.isArray(detail.timeline))
  assert.ok(Array.isArray(detail.interactions))
  assert.ok(Array.isArray(detail.attachments))
  assert.ok(detail.playbook)
  assert.ok(detail.correlatedHistory)
  assert.equal(matchingEntries.length, 1)
})

test('todos os casos visiveis na fila do OP abrem detalhe sem quebrar', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const opContext = getMockContext('op')
  const queueEntries = store.operatorQueueEntries(opContext)

  assert.ok(queueEntries.length > 0)

  for (const entry of queueEntries) {
    const detail = store.operatorCaseById(entry.id, opContext)

    assert.ok(detail, `Detalhe do OP ausente para ${entry.id}`)
    assert.ok(detail.subject, `Assunto ausente no detalhe do OP para ${entry.id}`)
    assert.ok(Array.isArray(detail.timeline), `Timeline invalida no detalhe do OP para ${entry.id}`)
    assert.ok(Array.isArray(detail.interactions), `Interacoes invalidas no detalhe do OP para ${entry.id}`)
    assert.ok(Array.isArray(detail.attachments), `Anexos invalidos no detalhe do OP para ${entry.id}`)
    assert.ok(detail.playbook, `Playbook ausente no detalhe do OP para ${entry.id}`)
  }
})

test('componente de detalhe do OP renderiza todos os casos visiveis sem falha', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const contexts = [
    { profileKey: 'op', poloLabel: 'Guarulhos' },
    { profileKey: 'gestor_polos', poloLabel: 'Guarulhos' },
  ]

  for (const contextConfig of contexts) {
    const context = getMockContext(contextConfig.profileKey)
    context.currentPolo = contextConfig.poloLabel
    const entries = store.operatorQueueEntries(context)

    assert.ok(entries.length > 0, `Nenhum caso visivel encontrado para ${contextConfig.profileKey}`)

    for (const entry of entries) {
      const rendered = await renderOperatorCaseDetailCase({
        caseId: entry.id,
        profileKey: contextConfig.profileKey,
        poloLabel: contextConfig.poloLabel,
      })

      assert.ok(rendered.detail, `Detalhe do OP nao montado para ${contextConfig.profileKey} em ${entry.id}`)
      assert.ok(rendered.html.includes('Detalhe do atendimento'), `Cabecalho do detalhe do OP ausente em ${entry.id}`)
      assert.ok(rendered.html.includes(entry.subject), `Assunto do detalhe do OP ausente em ${entry.id}`)
    }
  }
})

test('todos os casos visiveis para analista e gestor da area abrem detalhe sem quebrar', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const analystContext = getMockContext('analista_area')
  const managerContext = getMockContext('gestor_area')
  const analystEntries = store.areaQueueEntries(analystContext)
  const managerEntries = store.areaQueueEntries(managerContext)

  assert.ok(analystEntries.length > 0)
  assert.ok(managerEntries.length > 0)

  for (const [label, entries, context] of [
    ['analista', analystEntries, analystContext],
    ['gestor', managerEntries, managerContext],
  ]) {
    for (const entry of entries) {
      const detail = store.areaCaseById(entry.id, context)

      assert.ok(detail, `Detalhe da area ausente para ${label} em ${entry.id}`)
      assert.ok(detail.subject, `Assunto ausente no detalhe da area para ${label} em ${entry.id}`)
      assert.ok(Array.isArray(detail.summaryBullets), `Resumo invalido no detalhe da area para ${label} em ${entry.id}`)
      assert.ok(Array.isArray(detail.analysisSections), `Analise invalida no detalhe da area para ${label} em ${entry.id}`)
      assert.ok(Array.isArray(detail.availableAreas), `Areas disponiveis invalidas para ${label} em ${entry.id}`)
    }
  }
})

test('detalhe da area continua abrindo quando o header esta em outra area visivel', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const analystDefaultContext = getMockContext('analista_area')
  const analystAltAreaContext = {
    ...analystDefaultContext,
    currentArea: 'Secretaria Academica',
  }
  const managerDefaultContext = getMockContext('gestor_area')
  const managerAltAreaContext = {
    ...managerDefaultContext,
    currentArea: 'Secretaria Academica',
  }

  const analystAltEntry = store.areaQueueEntries(analystAltAreaContext)[0] || null
  const managerAltEntry = store.areaQueueEntries(managerAltAreaContext)[0] || null

  assert.ok(analystAltEntry, 'Nao foi encontrado caso alternativo para analista na outra area visivel')
  assert.ok(managerAltEntry, 'Nao foi encontrado caso alternativo para gestor na outra area visivel')

  const analystDetail = store.areaCaseById(analystAltEntry.id, analystDefaultContext)
  const managerDetail = store.areaCaseById(managerAltEntry.id, managerDefaultContext)

  assert.ok(analystDetail, `Detalhe da area ausente para analista com area desencontrada em ${analystAltEntry.id}`)
  assert.ok(managerDetail, `Detalhe da area ausente para gestor com area desencontrada em ${managerAltEntry.id}`)
  assert.equal(analystDetail.id, analystAltEntry.id)
  assert.equal(managerDetail.id, managerAltEntry.id)
})

test('fila e detalhe da area resistem a protocolo persistido antigo com status defasado', async () => {
  const storage = createBrowserMock(
    JSON.stringify({
      protocols: [
        {
          protocolNumber: 'UVSP-20260326-214',
          statusCode: 'waiting_area',
          statusLabel: 'Escalado para area interna',
          pendingLabel: 'Aguardando secretaria academica',
          studentData: null,
          timeline: null,
          interactions: null,
          attachments: null,
          context: null,
        },
      ],
    }),
  )
  const store = createFreshStore(storage, { reset: false })
  const managerContext = getMockContext('gestor_area')
  managerContext.currentArea = 'Secretaria Academica'

  const entry = store.areaQueueEntries(managerContext).find((item) => item.id === 'UVSP-20260326-214')
  const detail = store.areaCaseById('UVSP-20260326-214', managerContext)

  assert.ok(entry, 'Caso 214 nao apareceu na fila da area com estado persistido antigo')
  assert.equal(resolveAreaQueueBucket(entry), 'completed')
  assert.ok(detail, 'Detalhe da area nao abriu para o caso 214 com estado persistido antigo')
  assert.equal(detail.areaStatusLabel, 'Concluido pela area')
  assert.equal(detail.studentData.nome, 'Beatriz Moura')
  assert.ok(Array.isArray(detail.timeline))
  assert.ok(Array.isArray(detail.interactions))
  assert.ok(Array.isArray(detail.attachments))
  assert.ok(Array.isArray(detail.summaryBullets))
  assert.ok(Array.isArray(detail.handoffItems))
  assert.ok(Array.isArray(detail.analysisSections))
})

test('detalhe da area renderiza casos devolvidos pela area sem tela em branco', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const managerContext = getMockContext('gestor_area')
  managerContext.currentArea = 'Suporte Academico Digital'

  const answeredEntry = store.areaQueueEntries(managerContext).find((entry) => entry.id === 'UVSP-20260320-119')
  const complementedEntry = store.areaQueueEntries(managerContext).find((entry) => entry.id === 'UVSP-20260326-233')

  const answeredCase = await renderAreaCaseDetailCase({
    caseId: 'UVSP-20260320-119',
    profileKey: 'gestor_area',
    areaLabel: 'Suporte Academico Digital',
  })
  const complementedCase = await renderAreaCaseDetailCase({
    caseId: 'UVSP-20260326-233',
    profileKey: 'gestor_area',
    areaLabel: 'Suporte Academico Digital',
  })

  assert.ok(answeredCase.detail, 'Detalhe do caso 119 nao foi montado para renderizacao')
  assert.ok(answeredEntry, 'Caso 119 nao apareceu na fila da area')
  assert.equal(answeredEntry.areaBucket, 'completed')
  assert.ok(answeredCase.html.includes('Detalhe da analise'))
  assert.ok(answeredCase.html.includes('Envio de atestado para segunda chamada'))

  assert.ok(complementedCase.detail, 'Detalhe do caso 233 nao foi montado para renderizacao')
  assert.ok(complementedEntry, 'Caso 233 nao apareceu na fila da area')
  assert.equal(complementedEntry.areaBucket, 'waiting_complement')
  assert.ok(complementedCase.html.includes('Detalhe da analise'))
  assert.ok(complementedCase.html.includes('Envio de atividade sem print completo do erro no AVA'))
})

test('componente de detalhe da area renderiza todos os casos visiveis sem falha', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)

  for (const [profileKey, areaLabel] of [
    ['analista_area', 'Suporte Academico Digital'],
    ['gestor_area', 'Suporte Academico Digital'],
    ['gestor_area', 'Secretaria Academica'],
  ]) {
    const context = getMockContext(profileKey)
    context.currentArea = areaLabel
    const entries = store.areaQueueEntries(context)

    assert.ok(entries.length > 0, `Nenhum caso visivel encontrado para ${profileKey} em ${areaLabel}`)

    for (const entry of entries) {
      const rendered = await renderAreaCaseDetailCase({
        caseId: entry.id,
        profileKey,
        areaLabel,
      })

      assert.ok(rendered.detail, `Detalhe nao montado para ${profileKey} em ${entry.id}`)
      assert.ok(rendered.html.includes('Detalhe da analise'), `Tela nao renderizou cabecalho para ${profileKey} em ${entry.id}`)
      assert.ok(rendered.html.includes(entry.subject), `Assunto nao apareceu no render para ${profileKey} em ${entry.id}`)
    }
  }
})

test('home gerencial da area carrega visao consolidada com backlog e distribuicao', async () => {
  const storage = createBrowserMock()
  const store = createFreshStore(storage)
  const managerContext = getMockContext('gestor_area')
  const overview = store.areaManagerOverview(managerContext)

  assert.ok(overview)
  assert.ok(overview.summary.length >= 5)
  assert.ok(overview.summary.some((item) => item.id === 'owner_missing'))
  assert.ok(Array.isArray(overview.loadByAnalyst))
  assert.ok(Array.isArray(overview.subjectBottlenecks))
  assert.ok(Array.isArray(overview.redistributionSuggestions))
})

test('importacao JSON canonica preserva rascunho e valida midia segura', async () => {
  const source = cloneFaqBuilderPackage('aluno')
  const finalNode = source.nodes.find((node) => node.node_kind === 'leaf')
  assert.ok(finalNode)
  finalNode.media = [
    {
      type: 'image',
      source_url: 'https://conteudo.univesp.br/guias/matricula.png',
      alt: 'Tela de matricula com o botao de confirmacao destacado',
      caption: 'Confirmacao da matricula',
    },
  ]

  const imported = normalizeImportedPayload(source, {
    faqType: 'aluno',
    baseBundle: cloneFaqBuilderPackage('aluno'),
  })
  const validation = validateFaqBuilderBundle(imported, { mode: 'import' })

  assert.equal(imported.versioning.import_source, 'json')
  assert.equal(imported.versioning.publication_status, 'draft')
  assert.equal(validation.hasBlockingImportError, false)
})

test('importacao JSON bloqueia URL insegura e imagem sem texto alternativo', async () => {
  const source = cloneFaqBuilderPackage('aluno')
  const finalNode = source.nodes.find((node) => node.node_kind === 'leaf')
  assert.ok(finalNode)
  finalNode.media = [{ type: 'image', source_url: 'http://inseguro.example/imagem.png' }]

  const imported = normalizeImportedPayload(source, {
    faqType: 'aluno',
    baseBundle: cloneFaqBuilderPackage('aluno'),
  })
  const validation = validateFaqBuilderBundle(imported, { mode: 'import' })

  assert.equal(validation.hasBlockingImportError, true)
  assert.ok(validation.errors.some((issue) => issue.code === 'unsafe_media_url'))
  assert.ok(validation.errors.some((issue) => issue.code === 'image_without_alt'))
})

test('procedure-capture-v1 gera FAQ linear revisavel sem publicar automaticamente', async () => {
  const bundle = buildProcedureCaptureBundle(
    {
      schemaVersion: 'procedure-capture-v1',
      checksum: 'sha256-demo',
      procedure: {
        id: 'emitir-declaracao',
        title: 'Emitir declaracao de matricula',
        system: 'Portal do Aluno',
      },
      sources: [
        {
          type: 'video',
          source_url: 'https://conteudo.univesp.br/guias/declaracao.mp4',
          caption: 'Emissao da declaracao',
          transcript: 'Acesse Documentos e escolha Declaracao de matricula.',
        },
      ],
      steps: [
        { order: 1, action: 'Abra o menu Documentos.' },
        { order: 2, action: 'Selecione Declaracao de matricula.', expectedResult: 'PDF gerado.' },
      ],
    },
    { faqType: 'aluno', baseBundle: cloneFaqBuilderPackage('aluno') },
  )
  const validation = validateFaqBuilderBundle(bundle, { mode: 'import' })

  assert.equal(bundle.nodes.length, 2)
  assert.equal(bundle.links.length, 1)
  assert.equal(bundle.versioning.import_source, 'procedure-capture-json')
  assert.equal(bundle.versioning.publication_status, 'draft')
  assert.equal(validation.hasBlockingImportError, false)
  assert.match(bundle.nodes[1].resposta, /PDF gerado/)
})
test('procedure-capture documentado aceita schema no topo e owner de fila', async () => {
  const baseBundle = cloneFaqBuilderPackage('aluno')
  const ownerId = baseBundle.operational_owner.queueKey
  const bundle = normalizeImportedPayload(
    {
      schema: 'procedure-capture-v1',
      procedure_id: 'recuperar-senha',
      title: 'Recuperar senha',
      summary: 'Procedimento de recuperacao.',
      owner: { type: 'queue', id: ownerId },
      steps: [
        { order: 1, instruction: 'Selecione Esqueci minha senha.' },
        { order: 2, instruction: 'Confirme o e-mail institucional.' },
      ],
    },
    { faqType: 'aluno', baseBundle },
  )

  assert.equal(bundle.metadata.title, 'Recuperar senha')
  assert.equal(bundle.operational_owner.queueKey, ownerId)
  assert.ok(bundle.nodes.every((node) => node.fila_destino === ownerId))
  assert.equal(bundle.versioning.publication_status, 'draft')
})

test('biblioteca do FAQ Builder renderiza sem loop reativo e sem tela vazia', async () => {
  const html = await renderAdminFaqLibrary()
  assert.ok(html.includes('Biblioteca de fluxos da base de conhecimento'))
  assert.ok(html.includes('Filtros da biblioteca'))
})

let failures = 0

try {
  for (const entry of tests) {
    try {
      await entry.fn()
      console.log(`OK  ${entry.name}`)
    } catch (error) {
      failures += 1
      console.error(`FAIL ${entry.name}`)
      console.error(error?.stack || error?.message || error)
    }
  }
} finally {
  await server.close()
}

if (failures > 0) {
  console.error(`\n${failures} teste(s) falharam.`)
  process.exit(1)
}

console.log(`\n${tests.length} teste(s) passaram.`)
