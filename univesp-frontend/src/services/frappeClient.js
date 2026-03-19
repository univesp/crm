export function buildTicketDraft({ customer, session, flow, answerSummary }) {
  const subjectSeed =
    answerSummary.find((item) => item.questionId === 'need')?.answer || flow.name

  const payload = {
    doctype: import.meta.env.VITE_FRAPPE_TICKET_DOCTYPE || 'Issue',
    subject: `${flow.name} - ${subjectSeed}`,
    status: 'Open',
    priority: session.priority,
    custom_protocol: session.protocol,
    custom_flow_id: flow.id,
    custom_queue: flow.queue,
    custom_channel: customer.channel,
    custom_sso_status: customer.ssoStatus,
    custom_student_ra: customer.ra,
    custom_student_polo: customer.polo,
    custom_triage_summary: answerSummary.map((item) => ({
      question: item.question,
      answer: item.answer,
      value: item.value,
    })),
    description: [
      `Atendimento iniciado por ${customer.name}.`,
      `Fluxo: ${flow.name}.`,
      `Fila sugerida: ${flow.queue}.`,
      '',
      'Resumo da triagem:',
      ...answerSummary.map((item) => `- ${item.question}: ${item.answer}`),
    ].join('\n'),
  }

  return {
    doctype: payload.doctype,
    endpoint: `/api/resource/${payload.doctype}`,
    queue: flow.queue,
    sla: flow.expectedSla,
    protocol: session.protocol,
    fields: [
      { label: 'Assunto', value: payload.subject },
      { label: 'Fila sugerida', value: flow.queue },
      { label: 'Canal', value: customer.channel },
      { label: 'RA', value: customer.ra },
      { label: 'Polo', value: customer.polo },
      { label: 'SSO', value: customer.ssoStatus },
    ],
    payload,
  }
}

export function getFrappeOperations(flow) {
  return [
    {
      name: 'Abrir ticket',
      method: 'POST',
      endpoint: `/api/resource/${import.meta.env.VITE_FRAPPE_TICKET_DOCTYPE || 'Issue'}`,
      detail: `Cria o ticket base para o fluxo ${flow.name}.`,
    },
    {
      name: 'Anexar contexto de triagem',
      method: 'PUT',
      endpoint: '/api/method/univesp.api.ticket.attach_triage',
      detail: 'Persiste respostas, canal, SSO e dados do aluno.',
    },
    {
      name: 'Atualizar timeline do bot',
      method: 'POST',
      endpoint: '/api/method/univesp.api.ticket.append_chat_summary',
      detail: 'Guarda o resumo do chatbot antes do handoff.',
    },
    {
      name: 'Transferir para fila humana',
      method: 'POST',
      endpoint: '/api/method/univesp.api.ticket.request_handoff',
      detail: `Solicita atendente da fila ${flow.queue}.`,
    },
  ]
}

export const frappeModelNotes = [
  'Definir se o ticket sera Issue, HD Ticket ou DocType customizado.',
  'Persistir transcript resumido e nao a conversa completa por default.',
  'Guardar o estado da triagem em campo JSON para reuso posterior.',
  'Planejar eventos para atualizacao em tempo real da fila do atendente.',
]
