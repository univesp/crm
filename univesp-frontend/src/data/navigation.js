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
    const isAreaProfile = ['analista_area', 'gestor_area'].includes(mockContext.profileKey)
    const queueLabel = isAreaProfile
      ? mockContext.profileKey === 'gestor_area'
        ? 'Casos da área'
        : 'Minha fila da área'
      : mockContext.profileKey === 'gestor_polos'
        ? 'Atendimentos do polo'
        : 'Meus atendimentos'
    const sectionLabel = isAreaProfile
      ? mockContext.profileKey === 'gestor_area'
        ? 'Gestão de áreas'
        : 'Área especializada'
      : mockContext.profileKey === 'gestor_polos'
        ? 'Gestao de polos'
        : 'Operação do polo'

    return [
      {
        id: 'operational',
        label: sectionLabel,
        items: isAreaProfile
          ? [
              ...(mockContext.profileKey === 'gestor_area'
                ? [
                    {
                      id: 'area-manager-home',
                      label: 'Operação da área',
                      route: '/area/operacao',
                      description: 'Backlog, gargalos, redistribuicao e excecoes no escopo atual.',
                    },
                  ]
                : []),
              {
                id: 'area-queue',
                label: queueLabel,
                route: '/area/fila',
                prefixMatches: ['/area/fila/'],
                description: 'Fila especializada com handoff do OP e analise tecnica da area.',
              },
              {
                id: 'area-guidance',
                label: 'Conteúdo vigente',
                route: '/area/orientacao',
                description: 'Consulta da FAQ, da orientacao operacional e do playbook vigente da area.',
              },
              ...(mockContext.profileKey === 'gestor_area'
                ? [
                    {
                      id: 'area-knowledge-review',
                      label: 'Mudanças pendentes',
                      route: '/area/mudancas',
                      description: 'Sugestoes aguardando decisao e leitura da trilha vigente de publicacao.',
                    },
                    {
                      id: 'area-governance',
                      label: 'Regras operacionais',
                      route: '/area/governanca',
                      description: 'Escopo por assunto, disponibilidade do time e regras de distribuicao.',
                    },
                  ]
                : []),
            ]
          : [
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
            label: 'Consultar orientação',
            route: '/op/playbook',
            description: 'Consultar a FAQ do aluno e a orientacao do OP antes de decidir.',
          },
        ],
      },
    ]
  }

  // Heroicons v2 24/outline paths
  const ICON_DASHBOARD =
    'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z'
  const ICON_FAQ =
    'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25'
  const ICON_SLA = 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
  const ICON_PERMISSIONS =
    'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z'
  const ICON_PROTOCOLS =
    'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z'
  const ICON_AUDIT =
    'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4'

  const adminItems = [
    {
      id: 'admin-dashboard',
      label: 'Visão geral',
      route: '/admin/dashboard',
      icon: ICON_DASHBOARD,
    },
  ]

  if (hasAction(mockContext, 'view_ticket')) {
    adminItems.push({
      id: 'admin-protocols',
      label: 'Protocolos',
      route: '/admin/protocolos',
      icon: ICON_PROTOCOLS,
    })
    adminItems.push({
      id: 'admin-audit',
      label: 'Auditoria',
      route: '/admin/auditoria',
      icon: ICON_AUDIT,
    })
  }

  if (hasAction(mockContext, 'edit_faq')) {
    adminItems.push({
      id: 'admin-faq',
      label: 'FAQs e orientações',
      route: '/admin/faq',
      icon: ICON_FAQ,
    })
  }

  if (hasAction(mockContext, 'edit_parameters')) {
    adminItems.push({
      id: 'admin-parameters',
      label: 'Regras e prazos',
      route: '/admin/parametros',
      icon: ICON_SLA,
    })
  }

  if (hasAction(mockContext, 'view_audit')) {
    adminItems.push({
      id: 'admin-permissions',
      label: 'Pessoas e acessos',
      route: '/admin/permissoes',
      icon: ICON_PERMISSIONS,
    })
  }

  return [
    {
      id: 'governance',
      label: 'Menu',
      items: adminItems,
    },
  ]
}
