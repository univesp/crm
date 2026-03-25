import { faqAdminSettings } from '../../mocks/faqAdminSettings'

function pad(value) {
  return String(value).padStart(2, '0')
}

function padMilliseconds(value) {
  return String(value).padStart(3, '0')
}

function normalizeDate(value = new Date()) {
  return value instanceof Date ? value : new Date(value)
}

function buildTimestampParts(value = new Date()) {
  const date = normalizeDate(value)

  return {
    iso: date.toISOString(),
    compact: [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
      padMilliseconds(date.getMilliseconds()),
    ].join(''),
    label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function buildLineagePayload(lineage) {
  return lineage.map((step) => ({
    id: step.id,
    title: step.titulo_exibido,
    nodeType: step.node_type || step.node_kind || 'leaf',
  }))
}

function resolveCalendarHighlight(lineage, node) {
  const highlightedStep =
    [...lineage].reverse().find((step) => step.runtime?.highlightLabel) ||
    (node.runtime?.highlightLabel ? node : null)

  if (!highlightedStep) {
    return null
  }

  return {
    label: highlightedStep.runtime.highlightLabel,
    rule: highlightedStep.runtime.highlightRule || null,
  }
}

function buildContextSubject(node) {
  return node.titulo_exibido || [node.tema, node.subtema].filter(Boolean).join(' / ')
}

export function formatProtocolFieldLabel(field) {
  const labels = {
    descricao: 'Descricao complementar',
    anexo_obrigatorio: 'Anexo obrigatorio',
    anexo_opcional: 'Anexo opcional',
  }

  return labels[field] || field.replaceAll('_', ' ')
}

export function buildFaqAttendanceContext({ node, lineage, sessionId, currentDate = new Date() }) {
  const timestamp = buildTimestampParts(currentDate)
  const highlight = resolveCalendarHighlight(lineage, node)

  return {
    sessionId,
    capturedAt: timestamp.iso,
    capturedAtLabel: timestamp.label,
    theme: node.tema,
    subtheme: node.subtema || null,
    breadcrumb: lineage.map((step) => step.titulo_exibido),
    breadcrumbPath: buildLineagePayload(lineage),
    finalNode: {
      id: node.id,
      title: node.titulo_exibido,
      nodeType: node.node_type || node.node_kind || 'leaf',
    },
    displayedAnswer: node.resposta || '',
    action: node.acao,
    queueDestination: node.fila_destino,
    criticality: node.criticidade_padrao,
    sla: node.sla_padrao,
    calendarHighlight: highlight,
    opensTicket: Boolean(node.abre_atendimento),
    allowsAttachment: Boolean(node.permite_anexo),
    requiredFields: Array.isArray(node.campos_exigidos) ? [...node.campos_exigidos] : [],
    subject: buildContextSubject(node),
  }
}

export function buildFaqAttendanceRecord({ context, outcome, currentDate = new Date() }) {
  const timestamp = buildTimestampParts(currentDate)
  const recordId = `ATD-${timestamp.compact}`
  const statusLabel =
    outcome === 'resolved_by_faq' ? 'Resolvido pela FAQ com registro' : 'Aguardando continuidade do protocolo'

  return {
    id: recordId,
    createdAt: timestamp.iso,
    createdAtLabel: timestamp.label,
    outcome,
    statusLabel,
    source: 'faq_aluno',
    subject: context.subject,
    queueDestination: context.queueDestination,
    criticality: context.criticality,
    sla: context.sla,
    pendingLabel:
      outcome === 'resolved_by_faq'
        ? 'Nenhuma pendencia'
        : 'Preencher o protocolo com descricao complementar',
    context,
  }
}

export function buildProtocolDraft({ context, sourceRecordId, currentDate = new Date() }) {
  const timestamp = buildTimestampParts(currentDate)

  return {
    id: `PTC-${timestamp.compact}`,
    sourceRecordId,
    createdAt: timestamp.iso,
    createdAtLabel: timestamp.label,
    title: faqAdminSettings.protocolDraft.title,
    description: faqAdminSettings.protocolDraft.description,
    context,
    allowsAttachment: context.allowsAttachment,
    requiredFields: [...context.requiredFields],
    form: {
      theme: context.theme || '',
      subtheme: context.subtheme || '',
      subject: context.subject,
      breadcrumb: context.breadcrumb.join(' > '),
      finalNodeTitle: context.finalNode.title,
      displayedAnswer: context.displayedAnswer,
      action: context.action,
      queueDestination: context.queueDestination,
      criticality: context.criticality,
      sla: context.sla,
      description: '',
      attachments: [],
    },
  }
}

export function buildProtocolFieldRules(draft) {
  const requiredFields = Array.isArray(draft?.requiredFields) ? draft.requiredFields : []
  const allowsAttachment = Boolean(draft?.allowsAttachment)

  return {
    descriptionRequired: requiredFields.includes('descricao'),
    attachmentRequired: requiredFields.includes('anexo_obrigatorio'),
    attachmentOptional: allowsAttachment,
  }
}

export function validateProtocolDraft(draft) {
  if (!draft) {
    return {
      isValid: false,
      errors: {
        form: 'Nenhum rascunho de protocolo esta disponivel.',
      },
      rules: buildProtocolFieldRules(null),
    }
  }

  const rules = buildProtocolFieldRules(draft)
  const errors = {}
  const description = draft.form.description?.trim() || ''
  const attachments = Array.isArray(draft.form.attachments) ? draft.form.attachments : []

  if (rules.descriptionRequired && description.length === 0) {
    errors.description =
      'Descreva brevemente o que ainda precisa de atendimento para continuar o protocolo.'
  }

  if (rules.attachmentRequired && attachments.length === 0) {
    errors.attachments = 'Este fluxo exige ao menos um anexo antes do envio mockado.'
  }

  if (!draft.allowsAttachment && rules.attachmentRequired) {
    errors.attachments =
      'O no final marcou anexo obrigatorio, mas o fluxo atual nao permite anexos neste mock.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    rules,
  }
}

export function buildSubmittedProtocol({ draft, currentDate = new Date() }) {
  const timestamp = buildTimestampParts(currentDate)
  const priorityLabel = draft.context.criticality
    ? `${draft.context.criticality.charAt(0).toUpperCase()}${draft.context.criticality.slice(1)}`
    : 'Media'
  const protocolNumber = `UVSP-${timestamp.compact.slice(0, 8)}-${timestamp.compact.slice(8, 14)}`
  const attachments = (draft.form.attachments || []).map((name, index) => ({
    id: `ATT-${timestamp.compact}-${index + 1}`,
    name,
    status: 'Recebido em modo mock',
  }))
  const description =
    draft.form.description?.trim() ||
    'O aluno iniciou o protocolo com o contexto herdado da FAQ e sem descricao complementar.'

  return {
    id: protocolNumber,
    protocolNumber,
    sourceRecordId: draft.sourceRecordId,
    createdAt: timestamp.iso,
    createdAtLabel: timestamp.label,
    updatedAt: timestamp.iso,
    updatedAtLabel: timestamp.label,
    statusCode: 'aguardando_acao_op',
    statusLabel: 'Aguardando acao do OP',
    statusGroup: 'submitted',
    subject: draft.form.subject,
    priorityLabel,
    queueLabel: draft.context.queueDestination,
    slaLabel: draft.context.sla,
    pendingLabel: 'Aguardando triagem inicial da operacao',
    context: draft.context,
    attachments,
    timeline: [
      {
        id: `TL-${timestamp.compact}-1`,
        title: 'FAQ finalizada com continuidade',
        description: 'O aluno chegou ao no folha da FAQ e optou por continuar com atendimento.',
        atLabel: timestamp.label,
        tone: 'info',
      },
      {
        id: `TL-${timestamp.compact}-2`,
        title: 'Protocolo mockado enviado',
        description: `O portal gerou o protocolo ${protocolNumber} para a fila ${draft.context.queueDestination}.`,
        atLabel: timestamp.label,
        tone: 'primary',
      },
      {
        id: `TL-${timestamp.compact}-3`,
        title: 'Aguardando acao do OP',
        description: `Status inicial definido com SLA ${draft.context.sla} e criticidade ${draft.context.criticality}.`,
        atLabel: timestamp.label,
        tone: 'warning',
      },
    ],
    interactions: [
      {
        id: `INT-${timestamp.compact}-1`,
        actor: 'Aluno',
        channel: 'Portal do atendimento',
        text: description,
        atLabel: timestamp.label,
      },
      {
        id: `INT-${timestamp.compact}-2`,
        actor: 'Sistema',
        channel: 'FAQ oficial',
        text: `Contexto herdado: ${draft.context.breadcrumb.join(' > ')}.`,
        atLabel: timestamp.label,
      },
    ],
  }
}

export function buildAnalyticsEvent({ name, context, currentDate = new Date() }) {
  const timestamp = buildTimestampParts(currentDate)

  return {
    id: `${name}-${timestamp.compact}`,
    name,
    occurredAt: timestamp.iso,
    occurredAtLabel: timestamp.label,
    payload: {
      sessionId: context?.sessionId || null,
      theme: context?.theme || null,
      subtheme: context?.subtheme || null,
      finalNodeId: context?.finalNode?.id || null,
      action: context?.action || null,
      queueDestination: context?.queueDestination || null,
      criticality: context?.criticality || null,
      sla: context?.sla || null,
      calendarHighlight: context?.calendarHighlight?.label || null,
    },
  }
}

export function buildResolvedState(record) {
  return {
    recordId: record.id,
    title: faqAdminSettings.studentResolvedState.title,
    message: faqAdminSettings.studentResolvedState.message,
    helper: faqAdminSettings.studentResolvedState.helper,
  }
}

export function mapRecordToStudentProtocolCard(record) {
  const priorityLabel = record.context.criticality
    ? `${record.context.criticality.charAt(0).toUpperCase()}${record.context.criticality.slice(1)}`
    : 'Media'

  return {
    id: record.id,
    subject: record.subject,
    status: record.statusLabel,
    priority: priorityLabel,
    sla: record.context.sla,
    updatedAt: record.createdAtLabel,
    pending: record.pendingLabel,
  }
}

export function mapDraftToStudentRequestCard(draft) {
  const priorityLabel = draft.context.criticality
    ? `${draft.context.criticality.charAt(0).toUpperCase()}${draft.context.criticality.slice(1)}`
    : 'Media'

  return {
    id: draft.id,
    subject: draft.form.subject,
    status: 'Rascunho do protocolo',
    priority: priorityLabel,
    sla: draft.context.sla,
    updatedAt: draft.createdAtLabel,
    pending: 'Completar descricao complementar e revisar anexos',
    route: '/aluno/protocolo',
  }
}

export function mapProtocolToStudentRequestCard(protocol) {
  return {
    id: protocol.protocolNumber,
    subject: protocol.subject,
    status: protocol.statusLabel,
    priority: protocol.priorityLabel,
    sla: protocol.slaLabel,
    updatedAt: protocol.updatedAtLabel,
    pending: protocol.pendingLabel,
    route: `/aluno/solicitacoes/${protocol.protocolNumber}`,
  }
}

export function buildStudentRequestGroups({
  records = [],
  protocols = [],
  protocolDraft = null,
  seededProtocols = [],
}) {
  const groups = {
    resolvedByFaq: records
      .filter((record) => record.outcome === 'resolved_by_faq')
      .map((record) => mapRecordToStudentProtocolCard(record)),
    drafts: protocolDraft ? [mapDraftToStudentRequestCard(protocolDraft)] : [],
    submitted: protocols
      .filter((protocol) => protocol.statusGroup === 'submitted')
      .map((protocol) => mapProtocolToStudentRequestCard(protocol)),
    concluded: protocols
      .filter((protocol) => protocol.statusGroup === 'completed')
      .map((protocol) => mapProtocolToStudentRequestCard(protocol)),
  }

  for (const protocol of seededProtocols) {
    const normalizedCard = {
      id: protocol.id,
      subject: protocol.subject,
      status: protocol.status,
      priority: protocol.priority,
      sla: protocol.sla,
      updatedAt: protocol.updatedAt,
      pending: protocol.pending,
      route: null,
    }
    const statusText = protocol.status.toLowerCase()

    if (statusText.includes('faq')) {
      groups.resolvedByFaq.push(normalizedCard)
      continue
    }

    if (statusText.includes('conclu') || statusText.includes('encerrad')) {
      groups.concluded.push(normalizedCard)
      continue
    }

    groups.submitted.push(normalizedCard)
  }

  return groups
}
