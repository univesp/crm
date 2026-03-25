const routes = [
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
    path: '/',
    name: 'overview',
    component: () => import('@/pages/OverviewPage.vue'),
    meta: {
      title: 'Visao institucional',
      stage: 'overview',
      requiresAuth: true,
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
    },
  },
  {
    path: '/chat-ia',
    name: 'ai-chat',
    component: () => import('@/pages/AIPage.vue'),
    meta: {
      title: 'Atendimento assistido',
      stage: 'ai',
      requiresAuth: true,
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
    },
  },
  {
    path: '/aluno',
    name: 'student-home',
    component: () => import('@/pages/student/StudentHomePage.vue'),
    meta: {
      title: 'Home do atendimento',
      stage: 'student-home',
      requiresAuth: true,
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
    },
  },
  {
    path: '/aluno/protocolo',
    name: 'student-protocol',
    component: () => import('@/pages/student/StudentProtocolPage.vue'),
    meta: {
      title: 'Protocolo mockado',
      stage: 'student-protocol',
      requiresAuth: true,
    },
  },
  {
    path: '/aluno/solicitacoes/:protocolId',
    name: 'student-request-detail',
    component: () => import('@/pages/student/StudentRequestDetailPage.vue'),
    meta: {
      title: 'Detalhe do protocolo',
      stage: 'student-request-detail',
      requiresAuth: true,
    },
  },
  {
    path: '/op/fila',
    name: 'operator-queue',
    component: () => import('@/pages/operator/OperatorQueuePage.vue'),
    meta: {
      title: 'Fila operacional',
      stage: 'operator-queue',
    },
  },
  {
    path: '/op/fila/:caseId',
    name: 'operator-case-detail',
    component: () => import('@/pages/operator/OperatorCaseDetailPage.vue'),
    meta: {
      title: 'Detalhe operacional',
      stage: 'operator-case-detail',
    },
  },
  {
    path: '/op/playbook',
    name: 'operator-playbook',
    component: () => import('@/pages/operator/OperatorPlaybookPage.vue'),
    meta: {
      title: 'FAQ operacional',
      stage: 'operator-playbook',
      requiresAuth: true,
    },
  },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('@/pages/admin/AdminDashboardPage.vue'),
    meta: {
      title: 'Dashboard geral',
      stage: 'admin-dashboard',
      requiresAuth: true,
    },
  },
  {
    path: '/admin/faq',
    name: 'admin-faq',
    component: () => import('@/pages/admin/AdminFaqPage.vue'),
    meta: {
      title: 'Gestao da FAQ',
      stage: 'admin-faq',
      requiresAuth: true,
    },
  },
  {
    path: '/admin/parametros',
    name: 'admin-parameters',
    component: () => import('@/pages/admin/AdminParametersPage.vue'),
    meta: {
      title: 'Parametros de SLA e criticidade',
      stage: 'admin-parameters',
    },
  },
  {
    path: '/admin/permissoes',
    name: 'admin-permissions',
    component: () => import('@/pages/admin/AdminPermissionsPage.vue'),
    meta: {
      title: 'Permissoes e visibilidade',
      stage: 'admin-permissions',
    },
  },
]

export default routes
