export const studentFaqTree = [
  {
    id: 'academic-life',
    title: 'Vida academica',
    description: 'Matricula, rematricula, documentos e regras de curso.',
    topics: [
      'Matricula e rematricula',
      'Aproveitamento de disciplinas',
      'Declaracoes e historico',
    ],
  },
  {
    id: 'financial',
    title: 'Financeiro',
    description: 'Boletos, comprovantes, acordos e divergencias de cobranca.',
    topics: ['Segunda via', 'Comprovantes', 'Parcelamento e estorno'],
  },
  {
    id: 'digital-campus',
    title: 'AVA e portal',
    description: 'Login, provas, materiais, ambiente virtual e recursos digitais.',
    topics: ['Acesso ao portal', 'Problemas em disciplina', 'Atividades e provas'],
  },
]

export const operatorPlaybookTree = [
  {
    id: 'validation',
    title: 'Validacao inicial',
    description: 'Checklist para confirmar identidade, contexto e anexos antes da resposta.',
    steps: ['Conferir RA, polo e curso', 'Confirmar assunto e urgencia', 'Validar protocolo e evidencias'],
  },
  {
    id: 'resolution',
    title: 'Tentativa de resolucao',
    description: 'Playbook para responder diretamente quando a fila de OP tem autonomia.',
    steps: ['Consultar FAQ operacional', 'Responder pelo portal oficial', 'Registrar resumo no protocolo'],
  },
  {
    id: 'escalation',
    title: 'Escalonamento',
    description: 'Criticidade, SLA ou bloqueio operacional que exigem area interna.',
    steps: ['Classificar criticidade', 'Escalar com resumo pronto', 'Manter notificacao ao aluno'],
  },
]

export const faqGovernanceSnapshot = [
  {
    id: 'student-faq',
    title: 'FAQ do aluno',
    owner: 'Atendimento + Conteudo',
    status: 'Revisao mensal',
    items: 42,
  },
  {
    id: 'operator-faq',
    title: 'FAQ do OP',
    owner: 'Operacao',
    status: 'Revisao quinzenal',
    items: 28,
  },
]
