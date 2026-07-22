import AdminFaqEditorPage from '@/pages/admin/AdminFaqEditorPage.vue'

function normalizeFaqBuilderBundleId(rawValue = '') {
  let decoded = ''
  try {
    decoded = decodeURIComponent(String(rawValue || ''))
  } catch {
    decoded = String(rawValue || '')
  }

  const normalized = String(decoded || '')
    .split('?')[0]
    .split('#')[0]
    .trim()

  if (!normalized) {
    return ''
  }

  return normalized
    .split('/')
    .filter(Boolean)[0] || ''
}

const routes = [
  {
    path: '/acesso-local/:profileKey?',
    name: 'local-access',
    component: () => import('@/pages/LocalAccessPage.vue'),
    meta: {
      title: 'Acesso local por perfil',
      layout: 'auth',
    },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: {
      title: 'Login UNIVESP',
      layout: 'auth',
      publicOnly: true,
    },
  },
  {
    path: '/acesso-pendente',
    name: 'access-pending',
    component: () => import('@/pages/AccessPendingPage.vue'),
    meta: {
      title: 'Acesso pendente',
      layout: 'auth',
      requiresAuth: true,
    },
  },
  {
    path: '/wireframes/aluno/:screenId?',
    name: 'student-wireframe',
    component: () => import('@/pages/wireframes/StudentWireframePage.vue'),
    meta: {
      title: 'Wireframe navegavel do aluno',
      layout: 'wireframe',
    },
  },
  {
    path: '/',
    name: 'overview',
    component: () => import('@/pages/OverviewPage.vue'),
    meta: {
      title: 'Visao institucional',
      stage: 'overview',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
    },
  },
  {
    path: '/triagem',
    name: 'triage',
    component: () => import('@/pages/TriagePage.vue'),
    meta: {
      title: 'Entrada e triagem',
      stage: 'triage',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
    },
  },
  {
    path: '/ticket',
    name: 'ticket',
    component: () => import('@/pages/TicketPage.vue'),
    meta: {
      title: 'Registro do protocolo',
      stage: 'ticket',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
    },
  },
  {
    path: '/handoff',
    name: 'handoff',
    component: () => import('@/pages/HandoffPage.vue'),
    meta: {
      title: 'Escalacao humana',
      stage: 'handoff',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
    },
  },
  {
    path: '/integracoes',
    name: 'integrations',
    component: () => import('@/pages/IntegrationsPage.vue'),
    meta: {
      title: 'Integracoes e governanca',
      stage: 'integrations',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
    },
  },
  {
    path: '/aluno',
    name: 'student-home',
    component: () => import('@/pages/student/StudentHomePage.vue'),
    meta: {
      title: 'Como podemos ajudar?',
      stage: 'student-home',
      requiresAuth: true,
      shellKey: 'student',
      allowedProfiles: ['aluno'],
    },
  },
  {
    path: '/aluno/duvida',
    name: 'student-journey',
    component: () => import('@/pages/student/StudentJourneyPage.vue'),
    meta: {
      title: 'Tenho uma duvida',
      stage: 'student-journey',
      requiresAuth: true,
      shellKey: 'student',
      allowedProfiles: ['aluno'],
    },
  },
  {
    path: '/aluno/solicitacoes',
    name: 'student-requests',
    component: () => import('@/pages/student/StudentRequestsPage.vue'),
    meta: {
      title: 'Minhas solicitacoes',
      stage: 'student-requests',
      requiresAuth: true,
      shellKey: 'student',
      allowedProfiles: ['aluno'],
    },
  },
  {
    path: '/aluno/protocolo',
    name: 'student-protocol',
    component: () => import('@/pages/student/StudentProtocolPage.vue'),
    meta: {
      title: 'Continuar com a solicitacao',
      stage: 'student-protocol',
      requiresAuth: true,
      shellKey: 'student',
      allowedProfiles: ['aluno'],
    },
  },
  {
    path: '/aluno/confirmacao/:protocolId',
    name: 'student-confirmation',
    component: () => import('@/pages/student/StudentConfirmationPage.vue'),
    meta: {
      title: 'Confirmacao',
      stage: 'student-confirmation',
      requiresAuth: true,
      shellKey: 'student',
      allowedProfiles: ['aluno'],
    },
  },
  {
    path: '/aluno/solicitacoes/:protocolId',
    name: 'student-request-detail',
    component: () => import('@/pages/student/StudentRequestDetailPage.vue'),
    meta: {
      title: 'Detalhe da solicitacao',
      stage: 'student-request-detail',
      requiresAuth: true,
      shellKey: 'student',
      allowedProfiles: ['aluno'],
    },
  },
  {
    path: '/op/fila',
    name: 'operator-queue',
    component: () => import('@/pages/operator/OperatorQueuePage.vue'),
    meta: {
      title: 'Atendimentos',
      stage: 'operator-queue',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['op', 'gestor_polos'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/op/fila/:caseId',
    name: 'operator-case-detail',
    component: () => import('@/pages/operator/OperatorCaseDetailPage.vue'),
    meta: {
      title: 'Análise do caso',
      stage: 'operator-case-detail',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['op', 'gestor_polos'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/op/playbook',
    name: 'operator-playbook',
    component: () => import('@/pages/operator/OperatorGuidancePage.vue'),
    meta: {
      title: 'Consultar orientação',
      stage: 'operator-playbook',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['op', 'gestor_polos'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/op/novo-atendimento',
    name: 'operator-assisted-intake',
    component: () => import('@/pages/operator/OperatorPlaybookPage.vue'),
    meta: {
      title: 'Abrir atendimento em nome do aluno',
      stage: 'operator-assisted-intake',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['op', 'gestor_polos'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/area/operacao',
    name: 'area-manager-home',
    component: () => import('@/pages/area/AreaManagerHomePage.vue'),
    meta: {
      title: 'Operação da área',
      stage: 'area-manager-home',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['gestor_area'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/area/fila',
    name: 'area-queue',
    component: () => import('@/pages/area/AreaQueuePage.vue'),
    meta: {
      title: 'Fila da área',
      stage: 'area-queue',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['analista_area', 'gestor_area'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/area/fila/:caseId',
    name: 'area-case-detail',
    component: () => import('@/pages/area/AreaCaseDetailPage.vue'),
    meta: {
      title: 'Análise da área',
      stage: 'area-case-detail',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['analista_area', 'gestor_area'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/area/orientacao',
    name: 'area-guidance',
    component: () => import('@/pages/area/AreaGuidancePage.vue'),
    meta: {
      title: 'Conteúdo vigente da área',
      stage: 'area-guidance',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['analista_area', 'gestor_area'],
      requiredActions: ['view_area_guidance'],
    },
  },
  {
    path: '/area/mudancas',
    name: 'area-knowledge-review',
    component: () => import('@/pages/area/AreaKnowledgeReviewPage.vue'),
    meta: {
      title: 'Mudanças pendentes',
      stage: 'area-knowledge-review',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['gestor_area'],
      requiredActions: ['approve_knowledge'],
    },
  },
  {
    path: '/area/governanca',
    name: 'area-governance',
    component: () => import('@/pages/area/AreaGovernancePage.vue'),
    meta: {
      title: 'Regras operacionais da área',
      stage: 'area-governance',
      requiresAuth: true,
      shellKey: 'operational',
      allowedProfiles: ['gestor_area'],
      requiredActions: ['manage_area_scope'],
    },
  },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('@/pages/admin/AdminDashboardPage.vue'),
    meta: {
      title: 'Visão geral',
      stage: 'admin-dashboard',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/admin/protocolos/:protocolId',
    name: 'admin-protocol-detail',
    component: () => import('@/pages/admin/AdminProtocolDetailPage.vue'),
    meta: {
      title: 'Consulta de protocolo',
      stage: 'admin-protocol-detail',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
      requiredActions: ['view_ticket'],
    },
  },
  {
    path: '/admin/faq',
    name: 'admin-faq',
    component: () => import('@/pages/admin/AdminFaqLibraryPage.vue'),
    meta: {
      title: 'FAQs e orientações',
      stage: 'admin-faq',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
      requiredActions: ['edit_faq'],
    },
  },
  {
    path: '/admin/faq-editor',
    redirect: () => ({
      name: 'admin-faq',
    }),
  },
  {
    path: '/admin/faq-editor/:bundleId',
    name: 'admin-faq-builder',
    component: AdminFaqEditorPage,
    meta: {
      title: 'Editar FAQ',
      stage: 'admin-faq',
      layout: 'auth',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
      requiredActions: ['edit_faq'],
    },
  },
  {
    path: '/admin/faq/:bundleId/editor',
    redirect: (to) => ({
      name: 'admin-faq-builder',
      params: {
        bundleId: normalizeFaqBuilderBundleId(to.params.bundleId),
      },
      query: { ...to.query },
    }),
  },
  {
    path: '/admin/faq-editor/:bundleId/editor',
    redirect: (to) => {
      const normalizedBundleId = normalizeFaqBuilderBundleId(to.params.bundleId)
      if (!normalizedBundleId) {
        return {
          name: 'admin-faq',
          query: { ...to.query },
        }
      }
      return {
        name: 'admin-faq-builder',
        params: {
          bundleId: normalizedBundleId,
        },
        query: { ...to.query },
      }
    },
  },
  {
    path: '/admin/faq/:bundleId',
    name: 'admin-faq-flow',
    component: () => import('@/pages/admin/AdminFaqPage.vue'),
    meta: {
      title: 'FAQ e orientação',
      stage: 'admin-faq',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
      requiredActions: ['edit_faq'],
    },
  },
  {
    path: '/admin/parametros',
    name: 'admin-parameters',
    component: () => import('@/pages/admin/AdminParametersPage.vue'),
    meta: {
      title: 'Regras e prazos',
      stage: 'admin-parameters',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
      requiredActions: ['edit_parameters'],
    },
  },
  {
    path: '/admin/permissoes',
    name: 'admin-permissions',
    component: () => import('@/pages/admin/AdminPermissionsPage.vue'),
    meta: {
      title: 'Pessoas e acessos',
      stage: 'admin-permissions',
      requiresAuth: true,
      shellKey: 'governance',
      allowedProfiles: ['admin_central'],
      requiredActions: ['manage_users'],
    },
  },
  {
    path: '/admin/publicacao',
    redirect: { name: 'admin-faq' },
  },
]

export default routes
