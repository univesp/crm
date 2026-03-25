export const servicePersonas = [
  {
    id: 'student',
    name: 'Aluno',
    summary:
      'Precisa resolver sua demanda com pouco atrito, linguagem clara e contexto reaproveitado.',
    highlights: ['Acesso Unificado', 'FAQ em arvore', 'Protocolo e acompanhamento'],
    route: '/aluno',
    cta: 'Abrir experiencia do aluno',
    accentClass: 'bg-sky-950 text-white',
    chipClass: 'bg-white/10 text-white/80 border-white/10',
  },
  {
    id: 'operator',
    name: 'Operacao OP',
    summary:
      'Recebe a fila priorizada por SLA e criticidade, com playbook operacional antes do escalonamento.',
    highlights: ['Fila operacional', 'Playbook FAQ', 'Escalonamento para area interna'],
    route: '/op/fila',
    cta: 'Abrir fila operacional',
    accentClass: 'bg-white/80 text-slate-950',
    chipClass: 'bg-slate-950/5 text-slate-700 border-slate-900/10',
  },
  {
    id: 'management',
    name: 'Gestao e admin',
    summary:
      'Controla dashboard, FAQ, parametros de SLA, permissoes e visibilidade por area.',
    highlights: ['Dashboard geral', 'Gestao da FAQ', 'Governanca e auditoria'],
    route: '/admin/dashboard',
    cta: 'Abrir visao de gestao',
    accentClass: 'bg-amber-300 text-slate-950',
    chipClass: 'bg-slate-950/10 text-slate-800 border-slate-950/10',
  },
]

export const personaJourneys = [
  {
    personaId: 'student',
    title: 'Jornada do aluno',
    objective: 'Buscar resposta na FAQ, registrar atendimento e acompanhar protocolos.',
    screens: ['Home do atendimento', 'FAQ', 'Minhas solicitacoes', 'Detalhe do protocolo'],
  },
  {
    personaId: 'operator',
    title: 'Jornada do OP',
    objective: 'Priorizar a fila, usar o playbook operacional e responder ou escalar.',
    screens: ['Fila operacional', 'Detalhe do atendimento', 'FAQ operacional'],
  },
  {
    personaId: 'management',
    title: 'Jornada de gestao',
    objective: 'Enxergar filas, SLA, criticidade, FAQ, permissoes e auditoria.',
    screens: ['Dashboard geral', 'Gestao da FAQ', 'Governanca e integracoes'],
  },
]
