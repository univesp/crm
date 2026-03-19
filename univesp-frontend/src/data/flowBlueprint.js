export const journeyStages = [
  {
    id: 'overview',
    label: 'Mapa da jornada',
    route: '/',
    description: 'Visao da trilha completa do primeiro contato ao handoff.',
    output: 'Blueprint visual e escopo do MVP.',
  },
  {
    id: 'triage',
    label: 'Triagem guiada',
    route: '/triagem',
    description: 'Fluxos prontos com perguntas iniciais e opcoes fechadas.',
    output: 'Intencao classificada e contexto capturado.',
  },
  {
    id: 'ticket',
    label: 'Ticket Frappe',
    route: '/ticket',
    description: 'Contrato do ticket, payload e roteamento para fila.',
    output: 'Payload inicial e operacoes esperadas.',
  },
  {
    id: 'ai',
    label: 'Chatbot IA',
    route: '/chat-ia',
    description: 'Sessao assistida com contexto do ticket e guardrails.',
    output: 'Resposta guiada e criterio de escalacao.',
  },
  {
    id: 'handoff',
    label: 'Handoff humano',
    route: '/handoff',
    description: 'Transferencia sem perda de contexto para atendimento final.',
    output: 'Briefing do atendente e checklist de transicao.',
  },
  {
    id: 'integrations',
    label: 'Integracoes e SSO',
    route: '/integracoes',
    description: 'Arquitetura de APIs, SAML e organizacao do frontend.',
    output: 'Contratos e pasta base para evolucao.',
  },
]

export const attendanceFlows = [
  {
    id: 'matricula',
    name: 'Matricula e rematricula',
    summary: 'Fluxo para ingresso, rematricula, reabertura e confirmacao de vinculo.',
    queue: 'Secretaria Academica',
    expectedSla: 'Ate 4h uteis',
    aiGoal: 'Confirmar regra academica, validar documentos e orientar proximo passo.',
    keyFields: [
      'RA ou CPF',
      'Polo e curso',
      'Semestre alvo',
      'Documento ou protocolo relacionado',
    ],
    questions: [
      {
        id: 'persona',
        title: 'Quem esta falando?',
        help: 'Ajuda a escolher a regra correta de atendimento.',
        options: [
          { label: 'Candidato', value: 'candidate', note: 'Ainda nao possui RA ativo.' },
          { label: 'Aluno ativo', value: 'active_student', note: 'Tem RA e deseja continuidade.' },
          { label: 'Ex-aluno', value: 'former_student', note: 'Precisa retornar ou regularizar.' },
        ],
      },
      {
        id: 'need',
        title: 'Qual e a necessidade principal?',
        help: 'Define o roteiro inicial e a fila final.',
        options: [
          { label: 'Nova matricula', value: 'new_enrollment', note: 'Ingresso ou vestibular.' },
          { label: 'Rematricula', value: 're_enrollment', note: 'Continuar no proximo periodo.' },
          { label: 'Reabertura ou retorno', value: 'reopen', note: 'Vinculo interrompido.' },
          { label: 'Aproveitamento', value: 'credit_transfer', note: 'Equivalencia de disciplinas.' },
        ],
      },
      {
        id: 'urgency',
        title: 'Qual o prazo do aluno?',
        help: 'Afeta a urgencia e a prioridade do ticket.',
        options: [
          { label: 'Precisa hoje', value: 'today', note: 'Risco de perda de prazo.' },
          { label: 'Ainda nesta semana', value: 'this_week', note: 'Janela curta, mas controlada.' },
          { label: 'Sem prazo imediato', value: 'flexible', note: 'Pode entrar em fila padrao.' },
        ],
      },
      {
        id: 'evidence',
        title: 'Existe algum documento ou protocolo?',
        help: 'Evita o atendente pedir tudo novamente depois.',
        options: [
          { label: 'Ja tenho protocolo', value: 'has_protocol', note: 'Numero de atendimento anterior.' },
          { label: 'Tenho documento ou print', value: 'has_attachment', note: 'Comprovante ou imagem.' },
          { label: 'Nao tenho nada ainda', value: 'no_evidence', note: 'Primeiro contato sobre o tema.' },
        ],
      },
    ],
  },
  {
    id: 'financeiro',
    name: 'Financeiro e cobranca',
    summary: 'Fluxo para boletos, comprovantes, parcelamentos e divergencias de cobranca.',
    queue: 'Financeiro',
    expectedSla: 'Ate 2h uteis',
    aiGoal: 'Esclarecer a cobranca, reaproveitar comprovantes e preparar negociacao.',
    keyFields: [
      'RA ou CPF',
      'Competencia da cobranca',
      'Valor aproximado',
      'Comprovante ou numero do boleto',
    ],
    questions: [
      {
        id: 'persona',
        title: 'Quem busca suporte financeiro?',
        help: 'Distingue aluno, responsavel ou terceiro autorizado.',
        options: [
          { label: 'Aluno titular', value: 'student_owner', note: 'Fala em nome proprio.' },
          { label: 'Responsavel financeiro', value: 'financial_guardian', note: 'Paga ou gere as faturas.' },
          { label: 'Terceiro autorizado', value: 'authorized_party', note: 'Precisa de validacao extra.' },
        ],
      },
      {
        id: 'need',
        title: 'Qual o assunto?',
        help: 'Define o playbook inicial do chatbot e do ticket.',
        options: [
          { label: 'Segunda via de boleto', value: 'duplicate_invoice', note: 'Reemissao de titulo.' },
          { label: 'Comprovante ou recibo', value: 'receipt', note: 'Declaracao de pagamento.' },
          { label: 'Acordo ou parcelamento', value: 'installments', note: 'Negociacao de debito.' },
          { label: 'Estorno ou cobranca indevida', value: 'refund', note: 'Contestacao financeira.' },
        ],
      },
      {
        id: 'urgency',
        title: 'Qual e o status da cobranca?',
        help: 'Impacta a prioridade de atendimento.',
        options: [
          { label: 'Vence hoje', value: 'due_today', note: 'Alta prioridade.' },
          { label: 'Ja venceu', value: 'overdue', note: 'Pode ter juros ou bloqueio.' },
          { label: 'Divergente, mas sem vencimento', value: 'under_review', note: 'Apenas conferencia por enquanto.' },
        ],
      },
      {
        id: 'evidence',
        title: 'Ha comprovante ou numero do titulo?',
        help: 'Ajuda a IA e o atendente a localizar a cobranca.',
        options: [
          { label: 'Tenho comprovante', value: 'payment_receipt', note: 'Pix, TED ou boleto pago.' },
          { label: 'Tenho numero do boleto', value: 'invoice_number', note: 'Possui identificador da fatura.' },
          { label: 'Preciso localizar tudo', value: 'needs_lookup', note: 'Sem dados detalhados.' },
        ],
      },
    ],
  },
  {
    id: 'documentos',
    name: 'Documentos e certificados',
    summary: 'Fluxo para declaracoes, historico, certificado e ajustes cadastrais.',
    queue: 'Secretaria e Documentos',
    expectedSla: 'Ate 8h uteis',
    aiGoal: 'Conferir disponibilidade do documento e orientar emissao ou ajuste.',
    keyFields: [
      'RA',
      'Documento solicitado',
      'Prazo limite',
      'Forma de entrega esperada',
    ],
    questions: [
      {
        id: 'persona',
        title: 'Qual o perfil do solicitante?',
        help: 'Determina quem pode solicitar o documento.',
        options: [
          { label: 'Aluno ativo', value: 'active_student', note: 'Tem acesso ao portal.' },
          { label: 'Egresso', value: 'graduate', note: 'Solicita documento de conclusao.' },
          { label: 'Representante autorizado', value: 'proxy', note: 'Pode exigir procuracao.' },
        ],
      },
      {
        id: 'need',
        title: 'Qual documento precisa?',
        help: 'Direciona para o fluxo correto de emissao.',
        options: [
          { label: 'Declaracao de matricula', value: 'enrollment_statement', note: 'Uso imediato e digital.' },
          { label: 'Historico escolar', value: 'academic_history', note: 'Extrato das disciplinas.' },
          { label: 'Certificado ou diploma', value: 'certificate', note: 'Conclusao de curso.' },
          { label: 'Correcao cadastral', value: 'data_fix', note: 'Nome, CPF ou dados pessoais.' },
        ],
      },
      {
        id: 'urgency',
        title: 'Qual e o prazo?',
        help: 'Ajuda a prever SLA e possivel handoff.',
        options: [
          { label: 'Preciso em 24h', value: '24h', note: 'Pode exigir prioridade.' },
          { label: 'Preciso nesta semana', value: 'week', note: 'Prazo curto com fila padrao.' },
          { label: 'Sem pressa', value: 'open', note: 'Atendimento normal.' },
        ],
      },
      {
        id: 'evidence',
        title: 'Existe algum bloqueio conhecido?',
        help: 'A IA pode antecipar escalacao.',
        options: [
          { label: 'Pagamento pendente', value: 'financial_block', note: 'Pode impedir emissao.' },
          { label: 'Erro cadastral', value: 'data_mismatch', note: 'Documento sai incorreto.' },
          { label: 'Nenhum bloqueio', value: 'clear_path', note: 'Fluxo deve seguir direto.' },
        ],
      },
    ],
  },
  {
    id: 'ava',
    name: 'Suporte ao AVA',
    summary: 'Fluxo para login, disciplinas, provas, materiais e indisponibilidade do ambiente.',
    queue: 'Suporte Academico Digital',
    expectedSla: 'Ate 1h util',
    aiGoal: 'Resolver rapido ou coletar diagnostico tecnico antes do handoff.',
    keyFields: [
      'RA',
      'Disciplina ou recurso impactado',
      'Dispositivo e navegador',
      'Mensagem de erro ou print',
    ],
    questions: [
      {
        id: 'persona',
        title: 'Onde o problema aparece?',
        help: 'Ajuda a IA a identificar o subsistema correto.',
        options: [
          { label: 'Login no portal', value: 'portal_login', note: 'Entrada na conta.' },
          { label: 'Disciplina especifica', value: 'course_access', note: 'Acesso a materia.' },
          { label: 'Prova ou atividade', value: 'assessment', note: 'Entrega, quiz ou avaliacao.' },
          { label: 'Video ou material', value: 'content', note: 'Consumo de conteudo.' },
        ],
      },
      {
        id: 'need',
        title: 'Qual o impacto agora?',
        help: 'Define se a IA tenta contorno ou ja escala.',
        options: [
          { label: 'Nao consigo entrar', value: 'hard_block', note: 'Bloqueio total.' },
          { label: 'Erro intermitente', value: 'unstable', note: 'Falha ocorre as vezes.' },
          { label: 'Duvida sobre o uso', value: 'guidance', note: 'Precisa de orientacao.' },
        ],
      },
      {
        id: 'urgency',
        title: 'Existe atividade em risco?',
        help: 'Muda a urgencia e a ordem da fila.',
        options: [
          { label: 'Avaliacao hoje', value: 'assessment_today', note: 'Alta prioridade.' },
          { label: 'Atividade nesta semana', value: 'assessment_week', note: 'Prioridade media.' },
          { label: 'Sem entrega imediata', value: 'no_deadline', note: 'Pode seguir playbook padrao.' },
        ],
      },
      {
        id: 'evidence',
        title: 'Voce tem alguma evidencia tecnica?',
        help: 'Evita repetir coleta no handoff.',
        options: [
          { label: 'Tenho print e mensagem', value: 'print_and_error', note: 'Diagnostico mais rapido.' },
          { label: 'Sei o navegador/dispositivo', value: 'device_details', note: 'Contexto tecnico basico.' },
          { label: 'So sei que nao funciona', value: 'basic_report', note: 'Investigacao com mais perguntas.' },
        ],
      },
    ],
  },
]

export const integrationBlueprint = [
  {
    id: 'frontend-shell',
    name: 'Frontend de atendimento',
    status: 'Pronto para prototipo',
    owner: 'UX + Frontend',
    description: 'Shell visual com rotas, mocks e blocos para desenhar a jornada.',
    deliverable: 'Vue 3 + Tailwind + router + store',
  },
  {
    id: 'frappe-adapter',
    name: 'Adapter Frappe',
    status: 'Contrato inicial',
    owner: 'Backend Frappe',
    description: 'Criacao do ticket, timeline, anexos e consulta de status.',
    deliverable: 'Endpoints REST e eventos de atualizacao',
  },
  {
    id: 'ai-orchestrator',
    name: 'Orquestrador IA',
    status: 'Definir prompts',
    owner: 'IA + Backend',
    description: 'Recebe o contexto da triagem, conversa e decide o handoff.',
    deliverable: 'Sessao de chat, guardrails e resumo final',
  },
  {
    id: 'saml-bridge',
    name: 'SSO SAML',
    status: 'Mapear IdP',
    owner: 'Infra + Seguranca',
    description: 'Autentica o usuario e entrega claims uteis para o atendimento.',
    deliverable: 'Assertion consumer, claim mapping e sessao',
  },
  {
    id: 'handoff-bridge',
    name: 'Bridge de handoff',
    status: 'Modelar fila',
    owner: 'Operacoes',
    description: 'Transfere briefing, transcript e prioridade para um atendente.',
    deliverable: 'Webhook de transferencia e fila humana',
  },
]

export const folderBlueprint = [
  {
    path: 'src/pages',
    purpose: 'Telas da jornada: triagem, ticket, IA, handoff e integracoes.',
  },
  {
    path: 'src/components',
    purpose: 'Blocos reutilizaveis como cards, perguntas e wrappers de secao.',
  },
  {
    path: 'src/data',
    purpose: 'Catalogo de fluxos, jornadas e estruturas mockadas.',
  },
  {
    path: 'src/services',
    purpose: 'Contratos placeholder com Frappe, SAML e chatbot.',
  },
  {
    path: 'src/stores',
    purpose: 'Estado compartilhado do caso em atendimento.',
  },
]

export function resolveOptionLabel(flow, questionId, value) {
  const question = flow.questions.find((item) => item.id === questionId)
  const option = question?.options.find((item) => item.value === value)
  return option?.label || 'Nao definido'
}

export function summarizeAnswers(flow, answers) {
  return flow.questions.map((question) => ({
    questionId: question.id,
    question: question.title,
    answer: resolveOptionLabel(flow, question.id, answers[question.id]),
    value: answers[question.id] || null,
  }))
}
