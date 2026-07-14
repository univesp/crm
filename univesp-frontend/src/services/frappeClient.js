import {
  addTicketMessage,
  assignTicket,
  createTicket,
  transitionTicket,
} from '@/services/appApi'

export function buildTicketDraft({ customer, session, flow, answerSummary }) {
  const subjectSeed =
    answerSummary.find((item) => item.questionId === 'need')?.answer || flow.name

  const payload = {
    doctype: 'HD Ticket',
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
    endpoint: '/api/app/v1/tickets',
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
      endpoint: '/api/app/v1/tickets',
      detail: `Cria o ticket base para o fluxo ${flow.name}.`,
    },
    {
      name: 'Anexar contexto de triagem',
      method: 'PUT',
      endpoint: '/api/app/v1/tickets/:id',
      detail: 'Persiste respostas, canal, SSO e dados do aluno.',
    },
    {
      name: 'Registrar contexto de atendimento',
      method: 'POST',
      endpoint: '/api/app/v1/tickets/:id/messages',
      detail: 'Guarda o resumo da triagem e do handoff operacional.',
    },
    {
      name: 'Transferir para fila humana',
      method: 'POST',
      endpoint: '/api/app/v1/tickets/:id/transition',
      detail: `Solicita atendente da fila ${flow.queue}.`,
    },
  ]
}

export const frappeModelNotes = [
  'O navegador usa apenas a sessao institucional do gateway; nenhum segredo Frappe entra no bundle.',
  'HD Ticket e o registro operacional oficial do atendimento.',
  'Persistir resumo de triagem e handoff, sem depender de conversa automatica.',
  'Guardar o estado da triagem em campo JSON para reuso posterior.',
  'Planejar eventos para atualizacao em tempo real da fila do atendente.',
]

export function getFrappeIntegrationProfile() {
  return {
    apiBaseUrl: '/api/app/v1',
    authSummary: 'Sessao institucional HTTP-only validada pelo SSO Gateway.',
  }
}

export async function submitTicketDraft(ticketDraft) {
  const result = await createTicket({
    subject: ticketDraft.payload.subject,
    description: ticketDraft.payload.description,
    priority: ticketDraft.payload.priority,
    source: ticketDraft.payload.custom_channel || 'portal',
    queue: ticketDraft.payload.custom_queue,
    triage: ticketDraft.payload.custom_triage_summary,
    student: {
      ra: ticketDraft.payload.custom_student_ra,
      polo: ticketDraft.payload.custom_student_polo,
    },
    knowledge: {
      flow_id: ticketDraft.payload.custom_flow_id,
    },
  })
  return result.data
}

export async function attachTriageContext({
  documentName,
  protocol,
  flow,
  customer,
  session,
  answerSummary,
}) {
  return transitionTicket(documentName, {
    status: 'in_analysis',
    protocol,
    context: {
      flow_id: flow.id,
      queue: flow.queue,
      channel: customer.channel,
      student_ra: customer.ra,
      student_polo: customer.polo,
      priority: session.priority,
      triage: answerSummary,
    },
  })
}

export async function appendAttendanceContext({
  documentName,
  protocol,
  flow,
  triageSummary,
  handoffSummary,
}) {
  return addTicketMessage(
    documentName,
    JSON.stringify({ protocol, flow_id: flow.id, queue: flow.queue, triageSummary, handoffSummary }),
  )
}

export async function requestHumanHandoff({
  documentName,
  protocol,
  flow,
  customer,
  session,
  transferBrief,
}) {
  await assignTicket(documentName, { queue: flow.queue })
  return transitionTicket(documentName, {
    status: 'waiting_internal',
    protocol,
    priority: session.priority,
    summary: transferBrief,
    customer: { name: customer.name, email: customer.email },
  })
}
