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

export function shouldSyncProtocolWithFrappe() {
  const mode = String(import.meta.env.VITE_FRAPPE_PROTOCOL_SYNC || 'auto').trim().toLowerCase()

  if (mode === 'disabled' || mode === 'false' || mode === '0') {
    return false
  }

  if (mode === 'enabled' || mode === 'true' || mode === '1') {
    return true
  }

  return String(import.meta.env.VITE_ENABLE_MOCKS || '').trim().toLowerCase() !== 'true'
}

export function buildStudentProtocolTicketDraft(protocol = {}) {
  const doctype = import.meta.env.VITE_FRAPPE_TICKET_DOCTYPE || 'Issue'
  const context = protocol.context || {}
  const form = protocol.form || {}
  const routing = context.routing || {}
  const subject = protocol.subject || form.subject || context.subject || 'Solicitacao academica'
  const description = [
    `Protocolo: ${protocol.protocolNumber || protocol.id || ''}`,
    `Origem: Portal de atendimento UNIVESP`,
    `Status local: ${protocol.statusLabel || protocol.statusCode || ''}`,
    `Fila sugerida: ${protocol.queueLabel || routing.currentQueueLabel || context.queueDestination || ''}`,
    `Area sugerida: ${protocol.lastMileAreaLabel || routing.targetAreaLabel || ''}`,
    `Prioridade: ${protocol.priorityLabel || context.criticality || ''}`,
    `SLA: ${protocol.slaLabel || context.sla || ''}`,
    '',
    'Resumo do caminho:',
    Array.isArray(context.breadcrumb) ? context.breadcrumb.join(' > ') : form.breadcrumb || '',
    '',
    'Orientacao apresentada:',
    context.displayedAnswer || form.displayedAnswer || '',
    '',
    'Descricao enviada pelo aluno:',
    protocol.interactions?.find((item) => item.actor === 'Aluno')?.text || form.description || '',
    '',
    'Snapshot operacional:',
    JSON.stringify(
      {
        protocolNumber: protocol.protocolNumber || protocol.id || '',
        sourceRecordId: protocol.sourceRecordId || '',
        subjectCode: protocol.subjectCode || form.subjectCode || '',
        subsubjectCode: protocol.subsubjectCode || form.subsubjectCode || '',
        sourceBundleId: protocol.sourceBundleId || form.bundleId || '',
        sourceBundleVersionId: protocol.sourceBundleVersionId || form.bundleVersionId || '',
        sourceNodeId: protocol.sourceNodeId || form.sourceNodeId || context.finalNode?.id || '',
        ownerType: protocol.ownerType || '',
        ownerKey: protocol.ownerKey || '',
        ownerQueue: protocol.ownerQueue || '',
        ownerArea: protocol.ownerArea || '',
      },
      null,
      2,
    ),
  ].join('\n')

  return {
    doctype,
    payload: {
      doctype,
      subject,
      status: 'Open',
      priority: normalizeFrappePriority(protocol.priorityLabel || context.criticality),
      description,
    },
  }
}

function normalizeFrappePriority(value = '') {
  const normalized = String(value || '').trim().toLowerCase()

  if (['high', 'alta', 'urgente', 'critica', 'critico'].includes(normalized)) {
    return 'High'
  }

  if (['low', 'baixa'].includes(normalized)) {
    return 'Low'
  }

  return 'Medium'
}

export async function submitStudentProtocolTicket(protocol) {
  const draft = buildStudentProtocolTicketDraft(protocol)
  const context = protocol.context || {}
  const form = protocol.form || {}
  const result = await createTicket({
    subject: draft.payload.subject,
    description: draft.payload.description,
    priority: draft.payload.priority,
    source: 'portal',
    queue:
      protocol.ownerQueue ||
      protocol.queueLabel ||
      context.routing?.currentQueueLabel ||
      form.queueDestination ||
      '',
    area: protocol.ownerArea || protocol.lastMileAreaLabel || context.routing?.targetAreaLabel || '',
    triage: {
      theme: context.theme || '',
      subtheme: context.subtheme || '',
      breadcrumb: Array.isArray(context.breadcrumb) ? context.breadcrumb : [],
    },
    knowledge: {
      bundle_id: protocol.sourceBundleId || form.bundleId || context.finalNode?.bundleId || '',
      bundle_version_id:
        protocol.sourceBundleVersionId ||
        form.bundleVersionId ||
        context.finalNode?.bundleVersionId ||
        '',
      node_id: protocol.sourceNodeId || form.sourceNodeId || context.finalNode?.id || '',
      faq_session_id: form.faqSessionId || context.sessionId || '',
      path: form.sourcePath || context.sourcePath || [],
      audience: form.sourceAudience || context.sourceAudience || 'student',
    },
  })
  const remoteTicket = result.data || {}
  return {
    ...remoteTicket,
    name: remoteTicket.name || remoteTicket.id || '',
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
