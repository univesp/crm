const routes = [
  {
    path: '/',
    name: 'overview',
    component: () => import('@/pages/OverviewPage.vue'),
    meta: {
      title: 'Visao institucional',
      stage: 'overview',
    },
  },
  {
    path: '/triagem',
    name: 'triage',
    component: () => import('@/pages/TriagePage.vue'),
    meta: {
      title: 'Entrada e triagem',
      stage: 'triage',
    },
  },
  {
    path: '/ticket',
    name: 'ticket',
    component: () => import('@/pages/TicketPage.vue'),
    meta: {
      title: 'Registro do protocolo',
      stage: 'ticket',
    },
  },
  {
    path: '/chat-ia',
    name: 'ai-chat',
    component: () => import('@/pages/AIPage.vue'),
    meta: {
      title: 'Atendimento assistido',
      stage: 'ai',
    },
  },
  {
    path: '/handoff',
    name: 'handoff',
    component: () => import('@/pages/HandoffPage.vue'),
    meta: {
      title: 'Escalacao humana',
      stage: 'handoff',
    },
  },
  {
    path: '/integracoes',
    name: 'integrations',
    component: () => import('@/pages/IntegrationsPage.vue'),
    meta: {
      title: 'Integracoes e governanca',
      stage: 'integrations',
    },
  },
  {
    path: '/aluno',
    name: 'student-home',
    component: () => import('@/pages/student/StudentHomePage.vue'),
    meta: {
      title: 'Home do atendimento',
      stage: 'student-home',
    },
  },
  {
    path: '/aluno/solicitacoes',
    name: 'student-requests',
    component: () => import('@/pages/student/StudentRequestsPage.vue'),
    meta: {
      title: 'Minhas solicitacoes',
      stage: 'student-requests',
    },
  },
  {
    path: '/aluno/protocolo',
    name: 'student-protocol',
    component: () => import('@/pages/student/StudentProtocolPage.vue'),
    meta: {
      title: 'Protocolo mockado',
      stage: 'student-protocol',
    },
  },
  {
    path: '/aluno/solicitacoes/:protocolId',
    name: 'student-request-detail',
    component: () => import('@/pages/student/StudentRequestDetailPage.vue'),
    meta: {
      title: 'Detalhe do protocolo',
      stage: 'student-request-detail',
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
    path: '/op/playbook',
    name: 'operator-playbook',
    component: () => import('@/pages/operator/OperatorPlaybookPage.vue'),
    meta: {
      title: 'FAQ operacional',
      stage: 'operator-playbook',
    },
  },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('@/pages/admin/AdminDashboardPage.vue'),
    meta: {
      title: 'Dashboard geral',
      stage: 'admin-dashboard',
    },
  },
  {
    path: '/admin/faq',
    name: 'admin-faq',
    component: () => import('@/pages/admin/AdminFaqPage.vue'),
    meta: {
      title: 'Gestao da FAQ',
      stage: 'admin-faq',
    },
  },
]

export default routes
