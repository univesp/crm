const STATUS_PENDING = {
  open: 'Aguardando triagem da equipe.',
  in_analysis: 'A equipe esta analisando sua solicitacao.',
  waiting_student: 'Envie as informacoes solicitadas para o atendimento continuar.',
  waiting_internal: 'O atendimento esta com uma area interna.',
  resolved: 'A equipe registrou uma resposta para sua solicitacao.',
  closed: 'Atendimento encerrado.',
  cancelled: 'Atendimento cancelado.',
}

const PRIORITY_LABELS = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Critica',
}

export function mapApiTicketToStudentProtocol(ticket = {}) {
  const updatedAt = ticket.updated_at || ticket.created_at || new Date().toISOString()
  return {
    protocolNumber: ticket.protocol || ticket.id,
    subject: ticket.subject || 'Solicitacao',
    statusCode: ticket.status || 'open',
    statusLabel: ticket.status_label || 'Aberto',
    pendingLabel: STATUS_PENDING[ticket.status] || 'Aguardando atendimento.',
    updatedAt,
    updatedAtLabel: formatDateTime(updatedAt),
    interactions: ticket.description ? [{ actor: 'Aluno', text: ticket.description }] : [],
    timeline: normalizeTimeline(ticket.timeline),
    attachments: normalizeAttachments(ticket.attachments),
    context: { breadcrumb: [] },
  }
}

export function mapApiTicketToOperationalProtocol(ticket = {}) {
  const student = ticket.student || {}
  const knowledge = ticket.knowledge || {}
  const serverContext = ticket.context || {}
  const createdAt = ticket.created_at || ticket.updated_at || new Date().toISOString()
  const updatedAt = ticket.updated_at || createdAt
  const protocolNumber = ticket.protocol || ticket.id
  const queueLabel = ticket.queue || ''
  const areaLabel = ticket.area || ''
  const priorityKey = String(ticket.priority || 'medium').trim().toLowerCase()
  const statusCode = ticket.status || 'open'

  return {
    id: protocolNumber,
    protocolNumber,
    runtimeSource: 'app_api',
    subject: ticket.subject || 'Atendimento sem assunto',
    description: ticket.description || '',
    statusCode,
    statusLabel: ticket.status_label || 'Aberto',
    pendingLabel: STATUS_PENDING[statusCode] || 'Aguardando atendimento.',
    priorityLabel: PRIORITY_LABELS[priorityKey] || ticket.priority || 'Media',
    slaLabel: 'SLA nao calculado',
    queueLabel,
    currentAreaLabel: areaLabel,
    lastMileAreaLabel: areaLabel,
    source: ticket.source || 'portal',
    sourceLabel: ticket.source || 'Portal',
    createdAt,
    createdAtLabel: formatDateTime(createdAt),
    updatedAt,
    updatedAtLabel: formatDateTime(updatedAt),
    assignedOperator: ticket.assignee || '',
    assignedOperatorEmail: ticket.assignee_email || '',
    studentData: {
      nome: student.name || 'Aluno nao informado',
      email: student.email || '',
      ra: student.ra || '',
      curso: student.course || '',
      polo: student.polo || 'Nao informado',
    },
    routing: {
      currentQueueLabel: serverContext.routing?.resolved_queue || queueLabel,
      targetAreaLabel: serverContext.routing?.resolved_area || areaLabel,
      ...serverContext.routing,
    },
    context: {
      ...serverContext,
      theme: knowledge.bundle_id || '',
      breadcrumb: knowledge.path || [],
      breadcrumbPath: knowledge.path || [],
      finalNode: {
        id: knowledge.node_id || '',
        title: knowledge.node_id || '',
      },
      faqSessionId: knowledge.faq_session_id || '',
      bundleVersionId: knowledge.bundle_version_id || '',
      routing: {
        currentQueueLabel: serverContext.routing?.resolved_queue || queueLabel,
        targetAreaLabel: serverContext.routing?.resolved_area || areaLabel,
        ...serverContext.routing,
      },
    },
    knowledge,
    interactions: ticket.description ? [{ actor: student.name || 'Aluno', text: ticket.description }] : [],
    timeline: normalizeTimeline(ticket.timeline),
    attachments: normalizeAttachments(ticket.attachments),
  }
}

function normalizeTimeline(timeline = []) {
  return (timeline || []).map((event) => ({
    id: event.id,
    title: event.actor || 'Atualizacao',
    actor: event.actor || 'Atualizacao',
    description: event.message || '',
    message: event.message || '',
    at: event.created_at,
    atLabel: formatDateTime(event.created_at),
  }))
}

function normalizeAttachments(attachments = []) {
  return (attachments || []).map((file) => ({
    id: file.id,
    name: file.file_name,
    fileName: file.file_name,
    size: file.file_size,
    createdAt: file.created_at,
    createdAtLabel: formatDateTime(file.created_at),
  }))
}

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
