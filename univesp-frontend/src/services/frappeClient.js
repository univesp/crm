import {
  callFrappeMethod,
  createResource,
  getFrappeRuntimeConfig,
  unwrapFrappePayload,
} from '@/services/frappeApi'

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
      name: 'Registrar contexto de atendimento',
      method: 'POST',
      endpoint: '/api/method/univesp.api.ticket.append_attendance_context',
      detail: 'Guarda o resumo da triagem e do handoff operacional.',
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
  'Preferir sessao/cookie do Frappe para navegacao web; nao embutir api_secret em VITE_.',
  'Definir se o ticket sera Issue, HD Ticket ou DocType customizado.',
  'Persistir resumo de triagem e handoff, sem depender de conversa automatica.',
  'Guardar o estado da triagem em campo JSON para reuso posterior.',
  'Planejar eventos para atualizacao em tempo real da fila do atendente.',
]

export function getFrappeIntegrationProfile() {
  const config = getFrappeRuntimeConfig()

  return {
    ...config,
    apiBaseUrl: `${config.baseUrl}${config.apiPrefix}`,
    authSummary:
      config.authMode === 'token'
        ? 'Token manual de dev/homolog armazenado no browser.'
        : 'Sessao web do Frappe via cookie HTTP-only.',
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
  return unwrapFrappePayload(await createResource(draft.doctype, draft.payload))
}

export async function submitTicketDraft(ticketDraft) {
  return unwrapFrappePayload(await createResource(ticketDraft.doctype, ticketDraft.payload))
}

export async function attachTriageContext({
  documentName,
  protocol,
  flow,
  customer,
  session,
  answerSummary,
}) {
  return callFrappeMethod('univesp.api.ticket.attach_triage', {
    document_name: documentName,
    custom_protocol: protocol,
    custom_flow_id: flow.id,
    custom_queue: flow.queue,
    custom_channel: customer.channel,
    custom_sso_status: customer.ssoStatus,
    custom_student_ra: customer.ra,
    custom_student_polo: customer.polo,
    custom_priority: session.priority,
    custom_triage_summary: answerSummary.map((item) => ({
      question: item.question,
      answer: item.answer,
      value: item.value,
    })),
  })
}

export async function appendAttendanceContext({
  documentName,
  protocol,
  flow,
  triageSummary,
  handoffSummary,
}) {
  return callFrappeMethod('univesp.api.ticket.append_attendance_context', {
    document_name: documentName,
    custom_protocol: protocol,
    custom_flow_id: flow.id,
    custom_queue: flow.queue,
    triage_context: triageSummary,
    handoff_context: handoffSummary,
  })
}

export async function requestHumanHandoff({
  documentName,
  protocol,
  flow,
  customer,
  session,
  transferBrief,
}) {
  return callFrappeMethod('univesp.api.ticket.request_handoff', {
    document_name: documentName,
    custom_protocol: protocol,
    queue: flow.queue,
    customer_name: customer.name,
    customer_email: customer.email,
    priority: session.priority,
    summary: transferBrief,
  })
}
