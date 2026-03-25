import { journeyStages } from '@/data/flowBlueprint'

export const navigationSections = [
  {
    id: 'foundation',
    label: 'Fluxo base',
    items: journeyStages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      route: stage.route,
      description: stage.description,
    })),
  },
  {
    id: 'student',
    label: 'Aluno',
    items: [
      {
        id: 'student-home',
        label: 'Home do atendimento',
        route: '/aluno',
        description: 'Entrada com FAQ, protocolo, pendencias e notificacoes.',
      },
      {
        id: 'student-requests',
        label: 'Minhas solicitacoes',
        route: '/aluno/solicitacoes',
        description: 'Lista e detalhe dos protocolos do aluno.',
      },
    ],
  },
  {
    id: 'operator',
    label: 'OP',
    items: [
      {
        id: 'operator-queue',
        label: 'Fila operacional',
        route: '/op/fila',
        description: 'Fila priorizada por SLA, criticidade e contexto do caso.',
      },
      {
        id: 'operator-playbook',
        label: 'FAQ operacional',
        route: '/op/playbook',
        description: 'Playbook para resolver ou escalar com consistencia.',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin e gestao',
    items: [
      {
        id: 'admin-dashboard',
        label: 'Dashboard geral',
        route: '/admin/dashboard',
        description: 'Volume, backlog, risco de SLA e leitura executiva.',
      },
      {
        id: 'admin-faq',
        label: 'Gestao da FAQ',
        route: '/admin/faq',
        description: 'Governanca das FAQs do aluno e do OP.',
      },
      {
        id: 'admin-parameters',
        label: 'Parametros operacionais',
        route: '/admin/parametros',
        description: 'SLA, criticidade e impacto por tema, subtema e fila.',
      },
      {
        id: 'admin-permissions',
        label: 'Permissoes e visibilidade',
        route: '/admin/permissoes',
        description: 'Matriz de acesso por perfil, fila e area com auditoria administrativa.',
      },
    ],
  },
]
