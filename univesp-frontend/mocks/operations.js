export const studentQuickActions = [
  'Navegar pela FAQ em arvore',
  'Abrir um novo protocolo',
  'Consultar minhas solicitacoes',
]

export const studentProtocols = [
  {
    id: 'UVSP-20260319-104',
    subject: 'Rematricula para o proximo semestre',
    status: 'Aguardando retorno do OP',
    priority: 'Alta',
    sla: '4h uteis',
    updatedAt: 'Hoje, 14:20',
    pending: 'Enviar comprovante complementar',
  },
  {
    id: 'UVSP-20260316-091',
    subject: 'Segunda via de boleto',
    status: 'Resolvido pela FAQ com registro',
    priority: 'Media',
    sla: 'Encerrado',
    updatedAt: '24/03, 09:10',
    pending: 'Nenhuma pendencia',
  },
  {
    id: 'UVSP-20260311-072',
    subject: 'Erro de acesso ao AVA',
    status: 'Escalado para suporte academico digital',
    priority: 'Critica',
    sla: '1h util',
    updatedAt: '23/03, 18:40',
    pending: 'Aguardando analise interna',
  },
]

export const studentNotifications = [
  {
    id: 'n1',
    title: 'Complementacao pendente',
    message: 'O protocolo UVSP-20260319-104 precisa de um comprovante para continuidade.',
    type: 'action',
  },
  {
    id: 'n2',
    title: 'Atualizacao de protocolo',
    message: 'Seu caso sobre acesso ao AVA foi encaminhado para a area interna responsavel.',
    type: 'status',
  },
]

export const operatorQueue = [
  {
    id: 'UVSP-20260319-104',
    theme: 'matricula',
    subtheme: 'perda_de_prazo',
    student: 'Marina Costa',
    polo: 'Guarulhos',
    subject: 'Rematricula para o proximo semestre',
    priority: 'Alta',
    queue: 'Secretaria Academica',
    sla: '45 min restantes',
    criticality: 'Alta',
    status: 'Aguardando acao do OP',
    createdAt: '2026-03-19T14:20:00-03:00',
    createdAtLabel: '19/03/2026 14:20',
    source: 'mock_operacional',
  },
  {
    id: 'UVSP-20260320-117',
    theme: 'atividades_avaliativas',
    subtheme: 'prazo_encerrado',
    student: 'Carlos Menezes',
    polo: 'Sao Jose dos Campos',
    subject: 'Prazo encerrado da atividade avaliativa',
    priority: 'Maxima',
    queue: 'Suporte Academico Digital',
    sla: '20 min restantes',
    criticality: 'Critica',
    status: 'Prioridade maxima',
    createdAt: '2026-03-20T13:10:00-03:00',
    createdAtLabel: '20/03/2026 13:10',
    source: 'mock_operacional',
  },
  {
    id: 'UVSP-20260320-119',
    theme: 'provas',
    subtheme: 'envio_de_atestado',
    student: 'Ana Beatriz Lima',
    polo: 'Campinas',
    subject: 'Envio de atestado para segunda chamada',
    priority: 'Alta',
    queue: 'Suporte Academico Digital',
    sla: '55 min restantes',
    criticality: 'Alta',
    status: 'Em validacao operacional',
    createdAt: '2026-03-20T15:45:00-03:00',
    createdAtLabel: '20/03/2026 15:45',
    source: 'mock_operacional',
  },
]

export const operatorCaseSeeds = [
  {
    id: 'UVSP-20260319-104',
    studentData: {
      nome: 'Marina Costa',
      email: 'marina.costa@example.com',
      ra: '22100489',
      curso: 'Pedagogia',
      polo: 'Guarulhos',
    },
    timeline: [
      {
        id: 'seed-marina-1',
        title: 'Atendimento aberto pelo portal',
        description: 'O aluno navegou pela FAQ de matricula e optou por continuar com atendimento.',
        at: '2026-03-19T14:20:00-03:00',
        atLabel: '19/03/2026 14:20',
        tone: 'primary',
      },
      {
        id: 'seed-marina-2',
        title: 'Caso roteado para o OP',
        description: 'O protocolo foi direcionado para a fila operacional do polo antes de eventual escalonamento.',
        at: '2026-03-19T14:24:00-03:00',
        atLabel: '19/03/2026 14:24',
        tone: 'warning',
      },
    ],
    attachments: [
      {
        id: 'seed-marina-att-1',
        name: 'cronograma-rematricula.pdf',
        status: 'Recebido no portal',
      },
    ],
    interactions: [
      {
        id: 'seed-marina-int-1',
        actor: 'Aluno',
        channel: 'Portal do atendimento',
        text: 'Perdi o prazo de rematricula e preciso entender se ainda existe possibilidade de analise.',
        at: '2026-03-19T14:20:00-03:00',
        atLabel: '19/03/2026 14:20',
      },
      {
        id: 'seed-marina-int-2',
        actor: 'Sistema',
        channel: 'FAQ oficial',
        text: 'A resposta institucional foi exibida antes da abertura do protocolo.',
        at: '2026-03-19T14:21:00-03:00',
        atLabel: '19/03/2026 14:21',
      },
    ],
  },
  {
    id: 'UVSP-20260320-117',
    studentData: {
      nome: 'Carlos Menezes',
      email: 'carlos.menezes@example.com',
      ra: '23100451',
      curso: 'Letras',
      polo: 'Sao Jose dos Campos',
    },
    timeline: [
      {
        id: 'seed-carlos-1',
        title: 'Atendimento aberto pelo portal',
        description: 'O aluno registrou excecao para atividade avaliativa apos ler a orientacao oficial.',
        at: '2026-03-20T13:10:00-03:00',
        atLabel: '20/03/2026 13:10',
        tone: 'primary',
      },
      {
        id: 'seed-carlos-2',
        title: 'Fila operacional priorizada',
        description: 'O caso entrou em prioridade maxima pela janela curta do calendario academico.',
        at: '2026-03-20T13:14:00-03:00',
        atLabel: '20/03/2026 13:14',
        tone: 'warning',
      },
    ],
    attachments: [
      {
        id: 'seed-carlos-att-1',
        name: 'print-erro-atividade.png',
        status: 'Recebido no portal',
      },
    ],
    interactions: [
      {
        id: 'seed-carlos-int-1',
        actor: 'Aluno',
        channel: 'Portal do atendimento',
        text: 'A atividade fechou antes de eu concluir o envio e preciso verificar se existe excecao.',
        at: '2026-03-20T13:10:00-03:00',
        atLabel: '20/03/2026 13:10',
      },
    ],
  },
  {
    id: 'UVSP-20260320-119',
    studentData: {
      nome: 'Ana Beatriz Lima',
      email: 'ana.beatriz@example.com',
      ra: '22111452',
      curso: 'Matematica',
      polo: 'Campinas',
    },
    timeline: [
      {
        id: 'seed-ana-1',
        title: 'Solicitacao criada pelo aluno',
        description: 'O aluno informou ausencia em prova e anexou documento para segunda chamada.',
        at: '2026-03-20T15:45:00-03:00',
        atLabel: '20/03/2026 15:45',
        tone: 'primary',
      },
      {
        id: 'seed-ana-2',
        title: 'Caso em validacao operacional',
        description: 'O OP precisa conferir o atestado e a janela institucional antes de escalar.',
        at: '2026-03-20T15:49:00-03:00',
        atLabel: '20/03/2026 15:49',
        tone: 'warning',
      },
    ],
    attachments: [
      {
        id: 'seed-ana-att-1',
        name: 'atestado-medico.pdf',
        status: 'Recebido no portal',
      },
    ],
    interactions: [
      {
        id: 'seed-ana-int-1',
        actor: 'Aluno',
        channel: 'Portal do atendimento',
        text: 'Estou enviando o atestado medico referente a prova de ontem para solicitar segunda chamada.',
        at: '2026-03-20T15:45:00-03:00',
        atLabel: '20/03/2026 15:45',
      },
    ],
  },
]

export const operatorCorrelationHistory = [
  {
    id: 'hist-marina-001',
    student: 'Marina Costa',
    polo: 'Guarulhos',
    subject: 'Perdi o prazo de rematricula',
    theme: 'matricula',
    subtheme: 'perda_de_prazo',
    type: 'faq_resolved',
    status: 'Resolvido pela FAQ com registro',
    createdAt: '2026-03-05T10:30:00-03:00',
    createdAtLabel: '05/03/2026 10:30',
  },
  {
    id: 'hist-marina-002',
    student: 'Marina Costa',
    polo: 'Guarulhos',
    subject: 'Regularizacao de rematricula anterior',
    theme: 'matricula',
    subtheme: 'perda_de_prazo',
    type: 'protocol_submitted',
    status: 'Concluido',
    createdAt: '2026-02-18T16:10:00-03:00',
    createdAtLabel: '18/02/2026 16:10',
  },
  {
    id: 'hist-marina-003',
    student: 'Marina Costa',
    polo: 'Guarulhos',
    subject: 'Documento de matricula',
    theme: 'matricula',
    subtheme: 'documentacao',
    type: 'faq_resolved',
    status: 'Resolvido pela FAQ com registro',
    createdAt: '2026-01-28T09:20:00-03:00',
    createdAtLabel: '28/01/2026 09:20',
  },
  {
    id: 'hist-carlos-001',
    student: 'Carlos Menezes',
    polo: 'Sao Jose dos Campos',
    subject: 'Envio fora do prazo de atividade avaliativa',
    theme: 'atividades_avaliativas',
    subtheme: 'prazo_encerrado',
    type: 'faq_resolved',
    status: 'Resolvido pela FAQ com registro',
    createdAt: '2026-03-02T11:05:00-03:00',
    createdAtLabel: '02/03/2026 11:05',
  },
  {
    id: 'hist-carlos-002',
    student: 'Carlos Menezes',
    polo: 'Sao Jose dos Campos',
    subject: 'Reabertura de atividade avaliativa',
    theme: 'atividades_avaliativas',
    subtheme: 'prazo_encerrado',
    type: 'protocol_submitted',
    status: 'Respondido pelo OP',
    createdAt: '2026-02-27T14:50:00-03:00',
    createdAtLabel: '27/02/2026 14:50',
  },
  {
    id: 'hist-ana-001',
    student: 'Ana Beatriz Lima',
    polo: 'Campinas',
    subject: 'Atestado para segunda chamada',
    theme: 'provas',
    subtheme: 'envio_de_atestado',
    type: 'faq_resolved',
    status: 'Resolvido pela FAQ com registro',
    createdAt: '2026-03-18T08:40:00-03:00',
    createdAtLabel: '18/03/2026 08:40',
  },
  {
    id: 'hist-ana-002',
    student: 'Ana Beatriz Lima',
    polo: 'Campinas',
    subject: 'Segunda chamada de prova presencial',
    theme: 'provas',
    subtheme: 'envio_de_atestado',
    type: 'protocol_submitted',
    status: 'Escalado para area interna',
    createdAt: '2026-03-12T17:15:00-03:00',
    createdAtLabel: '12/03/2026 17:15',
  },
]

export const operatorAuditSeeds = [
  {
    id: 'audit-seed-001',
    caseId: 'UVSP-20260319-104',
    actor: 'OP Juliana Prado',
    actionType: 'reply',
    actionLabel: 'Resposta registrada pelo OP',
    occurredAt: '2026-03-19T15:05:00-03:00',
    occurredAtLabel: '19/03/2026 15:05',
    statusBefore: 'Aguardando acao do OP',
    statusAfter: 'Respondido pelo OP',
    queueBefore: 'Secretaria Academica',
    queueAfter: 'Secretaria Academica',
    escalationReason: null,
    note: 'Orientacao institucional registrada no portal do atendimento.',
  },
  {
    id: 'audit-seed-002',
    caseId: 'UVSP-20260320-117',
    actor: 'OP Henrique Ramos',
    actionType: 'request_info',
    actionLabel: 'Complementacao solicitada',
    occurredAt: '2026-03-20T13:22:00-03:00',
    occurredAtLabel: '20/03/2026 13:22',
    statusBefore: 'Prioridade maxima',
    statusAfter: 'Aguardando complementacao do aluno',
    queueBefore: 'Suporte Academico Digital',
    queueAfter: 'Suporte Academico Digital',
    escalationReason: null,
    note: 'Solicitados print adicional e contexto da atividade avaliativa.',
  },
  {
    id: 'audit-seed-003',
    caseId: 'UVSP-20260320-119',
    actor: 'OP Aline Costa',
    actionType: 'escalate',
    actionLabel: 'Escalado para area interna',
    occurredAt: '2026-03-20T16:04:00-03:00',
    occurredAtLabel: '20/03/2026 16:04',
    statusBefore: 'Em validacao operacional',
    statusAfter: 'Escalado para area interna',
    queueBefore: 'Suporte Academico Digital',
    queueAfter: 'Area interna · Suporte Academico Digital',
    escalationReason: 'segunda_chamada_prova',
    note: 'Atestado validado pelo OP e encaminhado para decisao academica.',
  },
]

export const operatorActionCards = [
  {
    title: 'Responder pelo portal',
    description: 'O portal do atendimento e a fonte oficial da resposta ao aluno.',
  },
  {
    title: 'Solicitar complementacao',
    description: 'Pedir texto ou anexo adicional sem perder o contexto ja capturado.',
  },
  {
    title: 'Escalar para area interna',
    description: 'Acionar o last mile com resumo, SLA e criticidade do caso.',
  },
]

export const mockOperationalQueues = [
  {
    id: 'academic',
    name: 'Secretaria Academica',
    persona: 'operator',
    scope: 'Matricula, rematricula, retorno, declaracoes e aproveitamento.',
    sla: 'Ate 4h uteis',
  },
  {
    id: 'finance',
    name: 'Financeiro',
    persona: 'operator',
    scope: 'Boletos, comprovantes, estorno, acordo e cobranca.',
    sla: 'Ate 2h uteis',
  },
  {
    id: 'digital-support',
    name: 'Suporte Academico Digital',
    persona: 'operator',
    scope: 'AVA, portal, atividades, provas e recursos digitais.',
    sla: 'Ate 1h util',
  },
]

export const adminDashboardStats = [
  { label: 'Casos abertos', value: 128, hint: 'Fila consolidada entre aluno, OP e area interna.' },
  { label: 'Criticos hoje', value: 17, hint: 'Casos com SLA curto ou bloqueio sensivel.' },
  { label: 'FAQ do aluno', value: 42, hint: 'Itens publicados e versionados.' },
  { label: 'Areas com backlog', value: 3, hint: 'Demandam atencao de gestao.' },
]

export const adminAreaBreakdown = [
  {
    area: 'Secretaria Academica',
    openCases: 41,
    slaRisk: 'Moderado',
    note: 'Maior volume em rematricula e declaracoes.',
  },
  {
    area: 'Financeiro',
    openCases: 33,
    slaRisk: 'Alto',
    note: 'Concentracao em vencimentos do dia e estorno.',
  },
  {
    area: 'Suporte Academico Digital',
    openCases: 22,
    slaRisk: 'Moderado',
    note: 'Ocorrencias com prova e acesso ao AVA.',
  },
]

export const adminGovernanceCards = [
  {
    title: 'Permissoes e visibilidade',
    description: 'Definir o que OP, area interna e gestao enxergam por fila e criticidade.',
  },
  {
    title: 'FAQ e playbooks',
    description: 'Versionar conteudo institucional e operacional sem depender do e-mail.',
  },
  {
    title: 'Auditoria e historico',
    description: 'Registrar quem respondeu, quem escalou e qual regra foi aplicada.',
  },
]
