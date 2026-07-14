const STATUS_PENDING = {
  open: 'Aguardando triagem da equipe.',
  in_analysis: 'A equipe esta analisando sua solicitacao.',
  waiting_student: 'Envie as informacoes solicitadas para o atendimento continuar.',
  waiting_internal: 'O atendimento esta com uma area interna.',
  resolved: 'A equipe registrou uma resposta para sua solicitacao.',
  closed: 'Atendimento encerrado.',
  cancelled: 'Atendimento cancelado.',
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
    timeline: (ticket.timeline || []).map((event) => ({
      id: event.id,
      title: event.actor || 'Atualizacao',
      description: event.message || '',
      atLabel: formatDateTime(event.created_at),
    })),
    attachments: (ticket.attachments || []).map((file) => ({
      id: file.id,
      name: file.file_name,
      createdAtLabel: formatDateTime(file.created_at),
    })),
    context: { breadcrumb: [] },
  }
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
