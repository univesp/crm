import loggedStudent from '../../mocks/usuario-logado.json'
import { buildCaseRoutingContext } from '@/services/caseRoutingRuntime'
import { buildSubsubjectCode, buildSubjectCode } from '@/services/canonicalFoundationRuntime'
import { resolveFaqNodeOperationalOwner } from '@/services/faqBuilderHybridRuntime'
import { faqAdminSettings } from '../../mocks/faqAdminSettings'
import { STUDENT_REQUEST_STATES } from '@/services/studentPortalRuntime'
import {
  buildOperationalOwnerIntegrity,
  normalizeOperationalOwnerSnapshot,
  resolveOperationalOwnerFromProtocol,
} from '@/services/operationalOwnershipRuntime'

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

function mapOwnershipSnapshotToContext(snapshot = {}) {
  return {
    ...snapshot,
    ownerType: snapshot.ownerType || '',
    ownerKey: snapshot.ownerKey || '',
    queueKey: snapshot.ownerQueue || '',
    areaLabel: snapshot.ownerArea || '',
    roleKey: snapshot.ownerRole || '',
    routingPolicy: snapshot.routingHint || '',
  }
}

function resolveDraftOperationalOwner(draft = {}) {
  return resolveOperationalOwnerFromProtocol(
    {
      context: draft.context || {},
      ownerType: draft.form?.ownerType || '',
      ownerKey: draft.form?.ownerKey || '',
      ownerQueue: draft.form?.ownerQueue || '',
      ownerArea: draft.form?.ownerArea || '',
      ownerRole: draft.form?.ownerRole || '',
      ownerRoutingHint: draft.form?.routingHint || '',
    },
    {
      source: 'faq_draft',
    },
  )
}

function resolveBundleId(node = {}) {
  if (node.bundle_id) {
    return node.bundle_id
  }
  if (node.faq_id) {
    return node.faq_id
  }
  return `faq-${node.tipo_faq || 'aluno'}:${node.tema || 'geral'}`
}

function resolveBundleVersionId(node = {}) {
  return (
    node.node_version ||
    node.bundle_version_id ||
    node.bundleVersionId ||
    node.bundle_version ||
    ''
  )
}

export function formatStudentFacingStatusLabel(status = '') {
  const normalized = String(status || '').trim().toLowerCase()

  if (!normalized) {
    return 'Em andamento'
  }

  if (normalized.includes('resolvido pela faq') || normalized.includes('respondido pelo op')) {
    return 'Respondida no portal'
  }

  if (normalized.includes('aguardando complementacao')) {
    return 'Aguardando sua resposta'
  }

  if (
    normalized.includes('aguardando acao do op') ||
    normalized.includes('aguardando ação do op') ||
    normalized.includes('aguardando triagem')
  ) {
    return 'Em analise inicial'
  }

  if (normalized.includes('escalado para area interna')) {
    return 'Em analise'
  }

  if (normalized.includes('conclu')) {
    return 'Concluida'
  }

  return status
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
  const rawOperationalOwner = resolveFaqNodeOperationalOwner({
    node,
    lineage,
    faqType: node.tipo_faq || 'aluno',
  })
  const operationalOwner = normalizeOperationalOwnerSnapshot(
    {
      ownerType: rawOperationalOwner.ownerType,
      ownerKey: rawOperationalOwner.ownerKey,
      ownerQueue: rawOperationalOwner.queueKey,
      ownerArea: rawOperationalOwner.areaLabel,
      ownerRole: rawOperationalOwner.roleKey,
      routingHint: rawOperationalOwner.routingPolicy,
      source: rawOperationalOwner.source || 'faq_lineage',
    },
    {
      fallbackQueue: node.fila_destino || '',
      source: rawOperationalOwner.source || 'faq_lineage',
    },
  )
  const queueDestinationForRouting =
    operationalOwner.hasOwner && operationalOwner.ownerType === 'queue'
      ? operationalOwner.ownerQueue
      : node.fila_destino
  const routing = buildCaseRoutingContext({
    studentPolo: loggedStudent.polo,
    theme: node.tema,
    subtheme: node.subtema,
    queueDestination: queueDestinationForRouting,
    criticality: node.criticidade_padrao,
    entryOrigin: loggedStudent.origem_autenticacao || 'Acesso Unificado',
  })

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
      bundleId: resolveBundleId(node),
      bundleVersionId: resolveBundleVersionId(node),
    },
    subjectCode: buildSubjectCode(node.tema),
    subsubjectCode: buildSubsubjectCode(node.tema, node.subtema || node.titulo_exibido),
    displayedAnswer: node.resposta || '',
    action: node.acao,
    queueDestination: queueDestinationForRouting,
    criticality: node.criticidade_padrao,
    sla: node.sla_padrao,
    ownership: {
      ...mapOwnershipSnapshotToContext(operationalOwner),
      required: true,
      hasOwner: Boolean(operationalOwner.hasOwner),
    },
    calendarHighlight: highlight,
    studentPolo: loggedStudent.polo,
    entryOrigin: routing.entryOrigin,
    routing,
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
    outcome === 'resolved_by_faq' ? 'Respondida no portal' : 'Aguardando continuidade da solicitacao'

  return {
    id: recordId,
    createdAt: timestamp.iso,
    createdAtLabel: timestamp.label,
    outcome,
    studentState:
      outcome === 'resolved_by_faq'
        ? STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL
        : STUDENT_REQUEST_STATES.WAITING,
    statusLabel,
    source: 'faq_aluno',
    subject: context.subject,
    queueDestination: context.queueDestination,
    criticality: context.criticality,
    sla: context.sla,
    pendingLabel:
      outcome === 'resolved_by_faq'
        ? 'Nenhuma pendencia'
        : 'Completar a solicitacao, se necessario',
    context,
  }
}

export function buildProtocolDraft({ context, sourceRecordId, currentDate = new Date() }) {
  const timestamp = buildTimestampParts(currentDate)

  const ownership = resolveOperationalOwnerFromProtocol(
    {
      context,
      ownerType: context?.ownership?.ownerType || '',
      ownerKey: context?.ownership?.ownerKey || '',
      ownerQueue: context?.ownership?.queueKey || '',
      ownerArea: context?.ownership?.areaLabel || '',
      ownerRole: context?.ownership?.roleKey || '',
      ownerRoutingHint: context?.ownership?.routingPolicy || '',
    },
    {
      source: context?.ownership?.source || 'faq_context',
    },
  )

  return {
    id: `PTC-${timestamp.compact}`,
    sourceRecordId,
    createdAt: timestamp.iso,
    createdAtLabel: timestamp.label,
    studentState: STUDENT_REQUEST_STATES.DRAFT,
    title: faqAdminSettings.protocolDraft.title,
    description: faqAdminSettings.protocolDraft.description,
    context,
    allowsAttachment: context.allowsAttachment,
    requiredFields: [...context.requiredFields],
    form: {
      theme: context.theme || '',
      subtheme: context.subtheme || '',
      subjectCode: context.subjectCode || buildSubjectCode(context.theme),
      subsubjectCode: context.subsubjectCode || buildSubsubjectCode(context.theme, context.subtheme || context.finalNode.title),
      subject: context.subject,
      breadcrumb: context.breadcrumb.join(' > '),
      finalNodeTitle: context.finalNode.title,
      displayedAnswer: context.displayedAnswer,
      action: context.action,
      queueDestination: context.queueDestination,
      ownerType: context.ownership?.ownerType || '',
      ownerKey: ownership.ownerKey || '',
      ownerQueue: ownership.ownerQueue || '',
      ownerArea: ownership.ownerArea || '',
      ownerRole: ownership.ownerRole || '',
      ownerSource: ownership.source || '',
      routingHint: ownership.routingHint || '',
      bundleId: context.finalNode?.bundleId || '',
      bundleVersionId: context.finalNode?.bundleVersionId || '',
      sourceNodeId: context.finalNode?.id || '',
      routingQueue: context.routing.currentQueueLabel,
      routingArea: context.routing.targetAreaLabel,
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

  const ownership = resolveDraftOperationalOwner(draft)
  const ownershipIntegrity = buildOperationalOwnerIntegrity(ownership)
  if (!ownershipIntegrity.ok) {
    errors.form = 'Nao foi possivel enviar este protocolo porque o fluxo FAQ nao possui dono operacional efetivo.'
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
    'A solicitacao foi iniciada com o contexto da orientacao exibida no portal.'

  const ownership = resolveDraftOperationalOwner(draft)

  return {
    id: protocolNumber,
    protocolNumber,
    sourceRecordId: draft.sourceRecordId,
    createdAt: timestamp.iso,
    createdAtLabel: timestamp.label,
    updatedAt: timestamp.iso,
    updatedAtLabel: timestamp.label,
    statusCode: 'aguardando_acao_op',
    canonicalStatusCode: 'in_progress_op',
    studentState: STUDENT_REQUEST_STATES.WAITING,
    statusLabel: draft.context.routing.exceptionToCentral
      ? 'Aguardando triagem central'
      : 'Aguardando acao do OP',
    statusGroup: 'submitted',
    subject: draft.form.subject,
    subjectCode: draft.form.subjectCode || draft.context.subjectCode || buildSubjectCode(draft.context.theme),
    subsubjectCode:
      draft.form.subsubjectCode ||
      draft.context.subsubjectCode ||
      buildSubsubjectCode(draft.context.theme, draft.context.subtheme || draft.context.finalNode.title),
    currentNodeId: draft.context.finalNode?.id || null,
    sourceNodeId: draft.context.finalNode?.id || '',
    sourceBundleId: draft.context.finalNode?.bundleId || '',
    sourceBundleVersionId: draft.context.finalNode?.bundleVersionId || '',
    priorityLabel,
    queueLabel: draft.context.routing.currentQueueLabel,
    currentAreaLabel: draft.context.routing.currentQueueLabel,
    lastMileAreaLabel: draft.context.routing.targetAreaLabel,
    ownerType: ownership.ownerType || '',
    ownerKey: ownership.ownerKey || '',
    ownerQueue: ownership.ownerQueue || '',
    ownerArea: ownership.ownerArea || '',
    ownerRole: ownership.ownerRole || '',
    ownerSource: ownership.source || '',
    ownerRoutingHint: ownership.routingHint || '',
    ownershipStateCode: ownership.stateCode || '',
    hasOperationalOwner: Boolean(ownership.hasOwner),
    operationalOwnerSnapshot: { ...ownership },
    routingMode: 'standard',
    pendingParty: draft.context.routing.exceptionToCentral ? 'op' : 'op',
    slaLabel: draft.context.sla,
    currentResponseSnapshot: draft.context.displayedAnswer || '',
    pendingLabel: draft.context.routing.exceptionToCentral
      ? 'Aguardando triagem inicial da central'
      : 'Aguardando triagem inicial da operacao',
    context: draft.context,
    attachments,
    timeline: [
      {
        id: `TL-${timestamp.compact}-1`,
        title: 'Orientacao concluida no portal',
        description:
          'Voce recebeu a orientacao oficial e escolheu continuar com a solicitacao.',
        atLabel: timestamp.label,
        tone: 'info',
      },
      {
        id: `TL-${timestamp.compact}-2`,
        title: 'Solicitacao enviada',
        description: `O portal registrou sua solicitacao com o numero ${protocolNumber}.`,
        atLabel: timestamp.label,
        tone: 'primary',
      },
      {
        id: `TL-${timestamp.compact}-3`,
        title: draft.context.routing.exceptionToCentral
          ? 'Em analise inicial'
          : 'Recebida pela equipe responsavel',
        description: `${draft.context.routing.assignmentRuleLabel} Prazo inicial estimado: ${draft.context.sla}.`,
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
        channel: 'Orientacao oficial',
        text: `Resumo do caminho: ${draft.context.breadcrumb.join(' > ')}.`,
        atLabel: timestamp.label,
      },
    ],
  }
}

export function buildStudentFollowUpSubmission({
  existingProtocol = null,
  seedEntry = null,
  note = '',
  attachmentNames = [],
  currentDate = new Date(),
}) {
  const timestamp = buildTimestampParts(currentDate)
  const protocolNumber = existingProtocol?.protocolNumber || seedEntry?.id || `UVSP-${timestamp.compact}`
  const subject = existingProtocol?.subject || seedEntry?.subject || 'Solicitacao em acompanhamento'
  const existingAttachments = Array.isArray(existingProtocol?.attachments) ? existingProtocol.attachments : []
  const newAttachments = attachmentNames.map((name, index) => ({
    id: `ATT-${timestamp.compact}-${index + 1}`,
    name,
    status: 'Enviado pelo aluno no portal',
  }))
  const interactionText =
    note?.trim() || (attachmentNames.length ? 'Documento complementar enviado pelo aluno no portal.' : 'Atualizacao enviada pelo aluno no portal.')
  const timelineTitle = attachmentNames.length ? 'Complementacao enviada pelo aluno' : 'Resposta enviada pelo aluno'
  const timelineDescription = attachmentNames.length
    ? 'O aluno enviou novos documentos para continuar a analise.'
    : 'O aluno enviou novas informacoes pelo portal para continuar o atendimento.'
  const sourceBundleId =
    existingProtocol?.sourceBundleId ||
    existingProtocol?.context?.finalNode?.bundleId ||
    seedEntry?.sourceBundleId ||
    (existingProtocol?.context?.theme
      ? `legacy-bundle:${existingProtocol.context.theme}`
      : seedEntry?.theme
        ? `legacy-bundle:${seedEntry.theme}`
        : `legacy-bundle:${protocolNumber}`)
  const sourceBundleVersionId =
    existingProtocol?.sourceBundleVersionId ||
    existingProtocol?.context?.finalNode?.bundleVersionId ||
    seedEntry?.sourceBundleVersionId ||
    'legacy'
  const sourceNodeId =
    existingProtocol?.sourceNodeId ||
    existingProtocol?.currentNodeId ||
    existingProtocol?.context?.finalNode?.id ||
    seedEntry?.sourceNodeId ||
    `legacy-node:${protocolNumber}`
  const ownership = resolveOperationalOwnerFromProtocol(
    {
      ...existingProtocol,
      ownerType: existingProtocol?.ownerType || seedEntry?.ownerType || '',
      ownerKey: existingProtocol?.ownerKey || seedEntry?.ownerKey || '',
      ownerQueue:
        existingProtocol?.ownerQueue ||
        seedEntry?.ownerQueue ||
        existingProtocol?.queueLabel ||
        seedEntry?.queue ||
        '',
      ownerArea:
        existingProtocol?.ownerArea ||
        seedEntry?.ownerArea ||
        existingProtocol?.lastMileAreaLabel ||
        seedEntry?.queue ||
        '',
      ownerRole: existingProtocol?.ownerRole || seedEntry?.ownerRole || '',
      ownerRoutingHint: existingProtocol?.ownerRoutingHint || seedEntry?.ownerRoutingHint || '',
      ownerSource: existingProtocol?.ownerSource || seedEntry?.ownerSource || 'followup_snapshot',
      context: existingProtocol?.context || {},
    },
    {
      source: existingProtocol?.ownerSource || seedEntry?.ownerSource || 'followup_snapshot',
    },
  )

  return {
    id: protocolNumber,
    protocolNumber,
    sourceRecordId: existingProtocol?.sourceRecordId || '',
    createdAt: existingProtocol?.createdAt || timestamp.iso,
    createdAtLabel: existingProtocol?.createdAtLabel || timestamp.label,
    updatedAt: timestamp.iso,
    updatedAtLabel: timestamp.label,
    statusCode: 'aguardando_reanalise',
    studentState: STUDENT_REQUEST_STATES.WAITING,
    statusLabel: 'Aguardando nova analise',
    statusGroup: 'submitted',
    subject,
    sourceNodeId,
    sourceBundleId,
    sourceBundleVersionId,
    priorityLabel: existingProtocol?.priorityLabel || seedEntry?.priority || 'Media',
    queueLabel: existingProtocol?.queueLabel || 'Equipe responsavel',
    lastMileAreaLabel: existingProtocol?.lastMileAreaLabel || 'Atendimento institucional',
    slaLabel: existingProtocol?.slaLabel || seedEntry?.sla || 'Em acompanhamento',
    pendingLabel: 'Aguardando nova analise da equipe',
    context:
      existingProtocol?.context || {
        breadcrumb: [],
        finalNode: { title: subject },
        displayedAnswer: '',
      },
    ownerType: ownership.ownerType || '',
    ownerKey: ownership.ownerKey || '',
    ownerQueue: ownership.ownerQueue || '',
    ownerArea: ownership.ownerArea || '',
    ownerRole: ownership.ownerRole || '',
    ownerSource: ownership.source || '',
    ownerRoutingHint: ownership.routingHint || '',
    ownershipStateCode: ownership.stateCode || '',
    hasOperationalOwner: Boolean(ownership.hasOwner),
    operationalOwnerSnapshot: { ...ownership },
    attachments: [...existingAttachments, ...newAttachments],
    timeline: [
      ...(Array.isArray(existingProtocol?.timeline) ? existingProtocol.timeline : []),
      {
        id: `TL-${timestamp.compact}-follow-up`,
        title: timelineTitle,
        description: timelineDescription,
        atLabel: timestamp.label,
        tone: 'primary',
      },
    ],
    interactions: [
      ...(Array.isArray(existingProtocol?.interactions) ? existingProtocol.interactions : []),
      {
        id: `INT-${timestamp.compact}-follow-up`,
        actor: 'Aluno',
        channel: 'Portal do atendimento',
        text: interactionText,
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
      ownerType: context?.ownership?.ownerType || null,
      ownerKey: context?.ownership?.ownerKey || null,
      ownerQueue: context?.ownership?.queueKey || null,
      ownerArea: context?.ownership?.areaLabel || null,
      ownerRole: context?.ownership?.roleKey || null,
      routingQueue: context?.routing?.currentQueueLabel || null,
      routingArea: context?.routing?.targetAreaLabel || null,
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
    status: formatStudentFacingStatusLabel(record.statusLabel),
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
    status: 'Em preenchimento',
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
    status: formatStudentFacingStatusLabel(protocol.statusLabel),
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
      status: formatStudentFacingStatusLabel(protocol.status),
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
