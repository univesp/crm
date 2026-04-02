function hasAction(mockContext, actionKey) {
  return Boolean(mockContext?.allowedActions?.includes(actionKey))
}

export function buildNavigationSections(mockContext) {
  if (!mockContext) {
    return []
  }

  if (mockContext.isStudentShell) {
    return [
      {
        id: 'student',
        label: 'Aluno',
        items: [
          {
            id: 'student-home',
            label: 'Inicio',
            route: '/aluno',
            matches: ['/aluno'],
            description: 'Escolha entre nova duvida e acompanhamento.',
          },
          {
            id: 'student-journey',
            label: 'Tenho uma duvida',
            route: '/aluno/duvida',
            matches: ['/aluno/duvida'],
            prefixMatches: ['/aluno/protocolo', '/aluno/confirmacao'],
            description: 'Jornada guiada antes da solicitacao.',
          },
          {
            id: 'student-requests',
            label: 'Minhas solicitacoes',
            route: '/aluno/solicitacoes',
            matches: ['/aluno/solicitacoes'],
            prefixMatches: ['/aluno/solicitacoes/'],
            description: 'Acompanhe protocolos e respostas registradas.',
          },
        ],
      },
    ]
  }

  if (mockContext.isOperationalShell) {
    const queueLabel = mockContext.profileKey === 'gestor_polos' ? 'Atendimentos do polo' : 'Meus atendimentos'

    return [
      {
        id: 'operational',
        label: mockContext.profileKey === 'gestor_polos' ? 'Gestao de polos' : 'Operacao do polo',
        items: [
          {
            id: 'operator-queue',
            label: queueLabel,
            route: '/op/fila',
            prefixMatches: ['/op/fila/'],
            description: 'Fila de trabalho dentro do escopo atual.',
          },
          {
            id: 'operator-assisted-intake',
            label: 'Abrir atendimento',
            route: '/op/novo-atendimento',
            description: 'Registrar um atendimento em nome do aluno quando a tratativa precisar continuar.',
          },
          {
            id: 'operator-playbook',
            label: 'Consultar orientacao',
            route: '/op/playbook',
            description: 'Consultar a FAQ do aluno e a orientacao do OP antes de decidir.',
          },
        ],
      },
    ]
  }

  const adminItems = [
    {
      id: 'admin-dashboard',
      label: 'Dashboard geral',
      route: '/admin/dashboard',
      description: 'Resumo executivo e operacional dos casos em andamento.',
    },
  ]

  if (hasAction(mockContext, 'edit_faq')) {
    adminItems.push({
      id: 'admin-faq',
      label: 'FAQ e playbooks',
      route: '/admin/faq',
      description: 'Governanca da FAQ do aluno, do OP e dos destaques de calendario.',
    })
  }

  if (hasAction(mockContext, 'edit_parameters')) {
    adminItems.push({
      id: 'admin-parameters',
      label: 'SLA e criticidade',
      route: '/admin/parametros',
      description: 'Niveis oficiais e impacto das regras sobre os casos.',
    })
  }

  if (hasAction(mockContext, 'view_audit')) {
    adminItems.push({
      id: 'admin-permissions',
      label: 'Permissoes e visibilidade',
      route: '/admin/permissoes',
      description: 'Matriz por perfil, fila e area com auditoria administrativa.',
    })
  }

  if (hasAction(mockContext, 'publish_version')) {
    adminItems.push({
      id: 'admin-versioning',
      label: 'Publicacao e versionamento',
      route: '/admin/publicacao',
      description: 'Comparacao entre a edicao atual e a versao ativa.',
    })
  }

  return [
    {
      id: 'governance',
      label: 'Administrativo e governanca',
      items: adminItems,
    },
  ]
}
