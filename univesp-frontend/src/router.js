const routes = [
  {
    path: '/',
    name: 'overview',
    component: () => import('@/pages/OverviewPage.vue'),
    meta: {
      title: 'Mapa da jornada',
      stage: 'overview',
    },
  },
  {
    path: '/triagem',
    name: 'triage',
    component: () => import('@/pages/TriagePage.vue'),
    meta: {
      title: 'Triagem guiada',
      stage: 'triage',
    },
  },
  {
    path: '/ticket',
    name: 'ticket',
    component: () => import('@/pages/TicketPage.vue'),
    meta: {
      title: 'Contrato do ticket',
      stage: 'ticket',
    },
  },
  {
    path: '/chat-ia',
    name: 'ai-chat',
    component: () => import('@/pages/AIPage.vue'),
    meta: {
      title: 'Chatbot com IA',
      stage: 'ai',
    },
  },
  {
    path: '/handoff',
    name: 'handoff',
    component: () => import('@/pages/HandoffPage.vue'),
    meta: {
      title: 'Handoff humano',
      stage: 'handoff',
    },
  },
  {
    path: '/integracoes',
    name: 'integrations',
    component: () => import('@/pages/IntegrationsPage.vue'),
    meta: {
      title: 'Integracoes e SSO',
      stage: 'integrations',
    },
  },
]

export default routes
