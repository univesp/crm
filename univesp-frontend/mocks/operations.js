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
    student: 'Marina Costa',
    subject: 'Rematricula para o proximo semestre',
    queue: 'Secretaria Academica',
    sla: '45 min restantes',
    criticality: 'Alta',
    status: 'Aguardando acao do OP',
  },
  {
    id: 'UVSP-20260320-117',
    student: 'Carlos Menezes',
    subject: 'Pagamento nao identificado',
    queue: 'Financeiro',
    sla: '20 min restantes',
    criticality: 'Critica',
    status: 'Prioridade maxima',
  },
  {
    id: 'UVSP-20260320-119',
    student: 'Ana Beatriz Lima',
    subject: 'Problema em prova do AVA',
    queue: 'Suporte Academico Digital',
    sla: '55 min restantes',
    criticality: 'Alta',
    status: 'Em validacao operacional',
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
