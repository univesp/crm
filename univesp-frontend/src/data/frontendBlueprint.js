export const experiencePillars = [
  {
    id: 'single-entry',
    name: 'Entrada unica com contexto',
    description:
      'Aluno autenticado nao precisa repetir dados basicos. A jornada parte de SSO, protocolo e assunto.',
  },
  {
    id: 'smart-routing',
    name: 'Triagem que reduz retrabalho',
    description:
      'Perguntas fechadas, urgencia e evidencias devem alimentar ticket, fila do polo e last mile.',
  },
  {
    id: 'guided-continuity',
    name: 'Continuidade guiada',
    description:
      'A jornada orienta, registra contexto e escala, sem inventar regra academica ou financeira.',
  },
  {
    id: 'ops-visibility',
    name: 'Gestao com visibilidade',
    description:
      'A operacao precisa enxergar gargalos, SLAs e dependencias de integracao desde o primeiro MVP.',
  },
]

export const routeBlueprint = [
  {
    path: '/',
    owner: 'Institucional',
    purpose: 'Apresenta as jornadas, prioridades do MVP e direcao do produto.',
  },
  {
    path: '/triagem',
    owner: 'Aluno',
    purpose: 'Captura intencao, urgencia e evidencias antes do ticket.',
  },
  {
    path: '/ticket',
    owner: 'Aluno + OP',
    purpose: 'Mostra o contrato do protocolo e o payload previsto para o Frappe.',
  },
  {
    path: '/handoff',
    owner: 'Operacao OP',
    purpose: 'Explica o pacote de transferencia para atendimento humano.',
  },
  {
    path: '/integracoes',
    owner: 'Gestao + Tecnologia',
    purpose: 'Documenta contratos, ambiente, estrutura e dependencias externas.',
  },
  {
    path: '/aluno',
    owner: 'Aluno',
    purpose: 'Home do atendimento com FAQ, notificacoes e entrada para protocolo.',
  },
  {
    path: '/aluno/solicitacoes',
    owner: 'Aluno',
    purpose: 'Acompanhamento de protocolos, pendencias e historico.',
  },
  {
    path: '/op/fila',
    owner: 'Operacao OP',
    purpose: 'Fila priorizada com SLA, criticidade e contexto do atendimento.',
  },
  {
    path: '/op/playbook',
    owner: 'Operacao OP',
    purpose: 'FAQ operacional para resolver ou escalar com consistencia.',
  },
  {
    path: '/admin/dashboard',
    owner: 'Admin e gestao',
    purpose: 'Dashboard geral, filas por area e leitura executiva.',
  },
  {
    path: '/admin/faq',
    owner: 'Admin e gestao',
    purpose: 'Gestao visual da FAQ do aluno e do OP.',
  },
]

export const pageBlueprint = [
  {
    area: 'Aluno',
    currentState: 'Agora possui home de atendimento e pagina de solicitacoes baseada em mocks.',
    nextStep: 'Conectar FAQ em arvore, abertura de protocolo, anexos e detalhe real do atendimento.',
  },
  {
    area: 'Operacao OP',
    currentState: 'Agora possui fila operacional e FAQ/playbook em estrutura inicial.',
    nextStep: 'Criar detalhe do atendimento, resposta ao aluno e abertura em nome do aluno.',
  },
  {
    area: 'Gestao e admin',
    currentState: 'Agora possui dashboard inicial e base para governanca da FAQ.',
    nextStep: 'Adicionar parametros de SLA, criticidade, permissoes e auditoria detalhada.',
  },
]

export const sharedComponentBlueprint = [
  {
    name: 'SectionPanel',
    purpose: 'Wrapper padrao para blocos de documentacao, tela e card institucional.',
  },
  {
    name: 'MetricCard',
    purpose: 'Indicadores sinteticos de fila, protocolo, SLA e cobertura.',
  },
  {
    name: 'QuestionStep',
    purpose: 'Perguntas guiadas da triagem com opcoes fechadas e baixo atrito.',
  },
  {
    name: 'AppSidebar',
    purpose: 'Navegacao do shell institucional com contexto do caso de referencia.',
  },
]

export const mockModulesBlueprint = [
  {
    module: 'mocks/personas.js',
    responsibility: 'Personas, jornadas-alvo e entry points de aluno, OP e admin.',
  },
  {
    module: 'mocks/journey.js',
    responsibility: 'Sessao, aluno e estado base do caso de referencia.',
  },
  {
    module: 'mocks/knowledgeBase.js',
    responsibility: 'FAQ do aluno, playbook do OP e snapshot de governanca.',
  },
  {
    module: 'mocks/operations.js',
    responsibility: 'Protocolos, notificacoes, fila operacional e dashboard admin.',
  },
]
