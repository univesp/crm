import loggedStudent from '../../mocks/usuario-logado.json'
import studentFaq from '../../mocks/faq-aluno.json'
import operatorFaq from '../../mocks/faq-op.json'
import {
  operatorQueue as seededOperatorQueue,
  operatorCaseSeeds,
  operatorCorrelationHistory,
} from '../../mocks/operations'

const PRIORITY_SCORE = {
  maxima: 5,
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
}

const CRITICALITY_SCORE = {
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
}

const STATUS_SCORE = {
  'prioridade maxima': 4,
  'aguardando acao do op': 3,
  'em validacao operacional': 2,
  'aguardando retorno da area': 1,
  'respondido pelo op': 2,
  'aguardando complementacao do aluno': 2,
  'escalado para area interna': 1,
}

const ACTION_METADATA = {
  reply: {
    title: 'Resposta registrada pelo OP',
    statusLabel: 'Respondido pelo OP',
    pendingLabel: 'Aguardando leitura do aluno no portal',
    channel: 'Portal do atendimento',
    defaultText: ({ playbook }) =>
      playbook.responseTemplate ||
      'Orientacao operacional registrada pelo OP no portal do atendimento.',
    buildDescription: ({ note }) =>
      `O OP respondeu ao aluno pelo portal institucional. ${note ? `Resumo: ${note}` : ''}`.trim(),
  },
  request_info: {
    title: 'Complementacao solicitada',
    statusLabel: 'Aguardando complementacao do aluno',
    pendingLabel: 'Aluno precisa complementar informacoes ou anexos',
    channel: 'Portal do atendimento',
    defaultText: ({ playbook }) => {
      const requestedDocuments = playbook.documentsRequested.join(', ')

      if (requestedDocuments) {
        return `Favor complementar o protocolo com ${requestedDocuments}.`
      }

      return 'Favor complementar o protocolo com mais detalhes para continuidade da analise.'
    },
    buildDescription: ({ note }) =>
      `O OP solicitou complementacao ao aluno antes de escalar ou encerrar o caso. ${note ? `Resumo: ${note}` : ''}`.trim(),
  },
  escalate: {
    title: 'Escalado para area interna',
    statusLabel: 'Escalado para area interna',
    pendingLabel: 'Aguardando atuacao do last mile',
    channel: 'Encaminhamento interno',
    defaultText: ({ playbook, caseEntry }) => {
      const escalationReason = playbook.escalationReason || playbook.escalationCriteria

      if (escalationReason) {
        return `Escalonamento solicitado para ${caseEntry.queue}. Motivo: ${escalationReason}.`
      }

      return `Escalonamento solicitado para ${caseEntry.queue} com briefing operacional registrado.`
    },
    buildDescription: ({ note, playbook }) =>
      `O OP escalou o atendimento para area interna. ${note || playbook.escalationReason || playbook.escalationCriteria}`.trim(),
    queueResolver: (caseEntry) => `Area interna · ${caseEntry.queue}`,
  },
}

function normalizeText(value = '') {
  return String(value).trim().toLowerCase()
}

function titleCase(value = '') {
  const normalized = String(value)
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return 'Nao informado'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildTimestampParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (number) => String(number).padStart(2, '0')

  return {
    iso: date.toISOString(),
    label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`,
    compact: `${date.getTime()}`,
  }
}

function sortByCreatedAtDesc(left, right) {
  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
}

function buildFaqIndex(payload) {
  const nodes = payload.nodes.filter((node) => node.ativo)
  const links = payload.links.filter((link) => link.ativo)
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]))
  const parentByChild = {}

  for (const link of links) {
    parentByChild[link.child_node_id] = link.parent_node_id
  }

  return {
    nodes,
    leafNodes: nodes.filter((node) => node.node_kind === 'leaf'),
    nodeById,
    parentByChild,
  }
}

const studentFaqIndex = buildFaqIndex(studentFaq)
const operatorFaqIndex = buildFaqIndex(operatorFaq)

function findBestFaqLeaf(index, theme, subtheme) {
  const themeKey = normalizeText(theme)
  const subthemeKey = normalizeText(subtheme)

  const exact = index.leafNodes.find(
    (node) =>
      normalizeText(node.tema) === themeKey && normalizeText(node.subtema) === subthemeKey,
  )

  if (exact) {
    return exact
  }

  return (
    index.leafNodes
      .filter((node) => normalizeText(node.tema) === themeKey)
      .sort((left, right) => (right.prioridade_dinamica || 0) - (left.prioridade_dinamica || 0))[0] ||
    null
  )
}

function buildFaqPath(index, nodeId) {
  const path = []
  let currentNodeId = nodeId

  while (currentNodeId && index.nodeById[currentNodeId]) {
    const node = index.nodeById[currentNodeId]
    path.unshift(node)
    currentNodeId = index.parentByChild[currentNodeId]
  }

  return path
}

function buildContextFromFaqLeaf(index, node) {
  if (!node) {
    return {
      theme: 'Nao informado',
      subtheme: null,
      breadcrumb: [],
      finalNode: {
        id: null,
        title: 'Nao informado',
        nodeType: 'leaf',
      },
      displayedAnswer: '',
      action: null,
      queueDestination: null,
      criticality: null,
      sla: null,
    }
  }

  const breadcrumb = buildFaqPath(index, node.id)

  return {
    theme: node.tema,
    subtheme: node.subtema || null,
    breadcrumb: breadcrumb.map((step) => step.titulo_exibido),
    finalNode: {
      id: node.id,
      title: node.titulo_exibido,
      nodeType: node.node_kind || 'leaf',
    },
    displayedAnswer: node.resposta || '',
    action: node.acao || null,
    queueDestination: node.fila_destino || null,
    criticality: node.criticidade_padrao || null,
    sla: node.sla_padrao || null,
  }
}

function formatQueueLabel(queue) {
  const labels = {
    sra: 'Secretaria Academica',
    financeiro: 'Financeiro',
    op: 'Operacao do Polo',
    suporte_academico_digital: 'Suporte Academico Digital',
    nao_aplicavel: 'Nao aplicavel',
  }

  return labels[normalizeText(queue)] || titleCase(queue)
}

function formatCriticalityLabel(criticality) {
  const normalized = normalizeText(criticality)

  if (!normalized) {
    return 'Media'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildPriorityLabel(criticality, fallback = '') {
  const normalizedFallback = normalizeText(fallback)

  if (normalizedFallback) {
    return titleCase(fallback)
  }

  const normalizedCriticality = normalizeText(criticality)

  if (normalizedCriticality === 'critica') {
    return 'Maxima'
  }

  if (normalizedCriticality === 'alta') {
    return 'Alta'
  }

  if (normalizedCriticality === 'baixa') {
    return 'Baixa'
  }

  return 'Media'
}

function buildSortTokens({ priority, criticality, status, activityAt, source }) {
  return {
    priorityScore: PRIORITY_SCORE[normalizeText(priority)] || 0,
    criticalityScore: CRITICALITY_SCORE[normalizeText(criticality)] || 0,
    statusScore: STATUS_SCORE[normalizeText(status)] || 0,
    sourceScore: source === 'portal_aluno' ? 2 : 1,
    activityAtScore: activityAt ? new Date(activityAt).getTime() : 0,
  }
}

function isSlaAtRisk(sla) {
  const normalized = normalizeText(sla)

  return normalized.includes('min') || normalized.includes('restante') || normalized.includes('4h')
}

function matchesFilter(filterValue, currentValue) {
  if (!filterValue || filterValue === 'todos') {
    return true
  }

  return normalizeText(filterValue) === normalizeText(currentValue)
}

function buildFilterOptions(entries, field) {
  return [
    { value: 'todos', label: 'Todos' },
    ...Array.from(new Set(entries.map((entry) => entry[field]).filter(Boolean))).map((value) => ({
      value,
      label: value,
    })),
  ]
}

function getCaseActionLogs(actionLogs = [], caseId) {
  return actionLogs
    .filter((log) => log.caseId === caseId)
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
}

function applyActionLogsToQueueEntry(entry, actionLogs = []) {
  const caseLogs = getCaseActionLogs(actionLogs, entry.id)
  const latestLog = caseLogs[caseLogs.length - 1] || null
  const status = latestLog?.statusLabel || entry.status
  const queue = latestLog?.queueLabel || entry.queue
  const pending = latestLog?.pendingLabel || entry.pendingLabel || 'Aguardando triagem operacional'
  const activityAt = latestLog?.occurredAt || entry.createdAt
  const activityAtLabel = latestLog?.occurredAtLabel || entry.createdAtLabel
  const priority = latestLog?.priorityLabel || entry.priority
  const criticality = latestLog?.criticalityLabel || entry.criticality

  return {
    ...entry,
    status,
    queue,
    pendingLabel: pending,
    activityAt,
    activityAtLabel,
    sortTokens: buildSortTokens({
      priority,
      criticality,
      status,
      activityAt,
      source: entry.source,
    }),
  }
}

function buildSeedQueueEntry(item, actionLogs = []) {
  const priority = buildPriorityLabel(item.criticality, item.priority)
  const criticality = formatCriticalityLabel(item.criticality)

  return applyActionLogsToQueueEntry(
    {
      id: item.id,
      subject: item.subject,
      theme: titleCase(item.theme),
      themeKey: normalizeText(item.theme),
      subsubject: titleCase(item.subtheme),
      subsubjectKey: normalizeText(item.subtheme),
      student: item.student,
      polo: item.polo || 'Nao informado',
      status: item.status,
      priority,
      criticality,
      sla: item.sla,
      queue: item.queue,
      createdAt: item.createdAt || null,
      createdAtLabel: item.createdAtLabel || 'Nao informado',
      source: item.source || 'mock_operacional',
      sourceLabel: item.source === 'portal_aluno' ? 'Portal do aluno' : 'Base operacional mock',
      pendingLabel: 'Leitura inicial pelo OP',
    },
    actionLogs,
  )
}

function buildLocalQueueEntry(protocol, studentProfile = loggedStudent, actionLogs = []) {
  const priority = buildPriorityLabel(protocol.context?.criticality, protocol.priorityLabel)
  const criticality = formatCriticalityLabel(protocol.context?.criticality)
  const status = protocol.statusLabel || 'Aguardando acao do OP'

  return applyActionLogsToQueueEntry(
    {
      id: protocol.protocolNumber,
      subject: protocol.subject,
      theme: titleCase(protocol.context?.theme),
      themeKey: normalizeText(protocol.context?.theme),
      subsubject: titleCase(protocol.context?.subtheme || protocol.context?.finalNode?.title),
      subsubjectKey: normalizeText(protocol.context?.subtheme || protocol.context?.finalNode?.title),
      student: studentProfile.nome || 'Aluno logado',
      polo: studentProfile.polo || 'Nao informado',
      status,
      priority,
      criticality,
      sla: protocol.slaLabel || protocol.context?.sla || 'Nao informado',
      queue: formatQueueLabel(protocol.queueLabel || protocol.context?.queueDestination),
      createdAt: protocol.createdAt,
      createdAtLabel: protocol.createdAtLabel || 'Nao informado',
      source: 'portal_aluno',
      sourceLabel: 'Portal do aluno',
      pendingLabel: protocol.pendingLabel || 'Aguardando triagem operacional',
    },
    actionLogs,
  )
}

function compareQueueEntries(left, right) {
  return (
    right.sortTokens.priorityScore - left.sortTokens.priorityScore ||
    right.sortTokens.criticalityScore - left.sortTokens.criticalityScore ||
    right.sortTokens.statusScore - left.sortTokens.statusScore ||
    right.sortTokens.sourceScore - left.sortTokens.sourceScore ||
    right.sortTokens.activityAtScore - left.sortTokens.activityAtScore
  )
}

function buildPlaybookPayload(entry) {
  const playbookNode = findBestFaqLeaf(operatorFaqIndex, entry.themeKey, entry.subsubjectKey)

  if (!playbookNode) {
    return {
      title: 'Playbook operacional indisponivel',
      checklist: [],
      systemsToCheck: [],
      documentsRequested: [],
      responseTemplate: 'Sem playbook especifico publicado para este tema nesta base mockada.',
      escalationCriteria: 'Aplicar analise operacional antes de escalar.',
      escalationReason: 'playbook_nao_publicado',
      matchedNodeId: null,
    }
  }

  return {
    title: playbookNode.titulo_exibido,
    checklist: playbookNode.checklist_op || [],
    systemsToCheck: playbookNode.sistemas_a_consultar || [],
    documentsRequested: playbookNode.documentos_a_solicitar || [],
    responseTemplate: playbookNode.resposta_padrao_sugerida || '',
    escalationCriteria: playbookNode.criterio_de_escalonamento || '',
    escalationReason: playbookNode.motivo_escalonamento_sugerido || '',
    matchedNodeId: playbookNode.id,
  }
}

function findSeedCaseById(caseId) {
  return operatorCaseSeeds.find((item) => item.id === caseId) || null
}

function buildSeedCaseDetail(entry) {
  const seedCase = findSeedCaseById(entry.id)
  const faqLeaf = findBestFaqLeaf(studentFaqIndex, entry.themeKey, entry.subsubjectKey)
  const context = buildContextFromFaqLeaf(studentFaqIndex, faqLeaf)

  return {
    studentData: seedCase?.studentData || {
      nome: entry.student,
      polo: entry.polo,
    },
    faqContext: context,
    faqAnswer: context.displayedAnswer,
    timeline: seedCase?.timeline || [],
    attachments: seedCase?.attachments || [],
    interactions: seedCase?.interactions || [],
  }
}

function buildLocalCaseDetail(protocol, entry, studentProfile = loggedStudent) {
  return {
    studentData: {
      nome: studentProfile.nome,
      email: studentProfile.email,
      ra: studentProfile.ra,
      curso: studentProfile.curso,
      polo: studentProfile.polo,
    },
    faqContext: protocol.context,
    faqAnswer: protocol.context?.displayedAnswer || '',
    timeline: protocol.timeline || [],
    attachments: protocol.attachments || [],
    interactions: protocol.interactions || [],
  }
}

function buildHistoryItemBase(item) {
  return {
    ...item,
    theme: titleCase(item.theme),
    themeKey: normalizeText(item.theme),
    subsubject: titleCase(item.subtheme),
    subsubjectKey: normalizeText(item.subtheme),
  }
}

function normalizeRecordHistory(record, studentProfile = loggedStudent) {
  return buildHistoryItemBase({
    id: record.id,
    student: studentProfile.nome,
    polo: studentProfile.polo,
    subject: record.subject,
    theme: record.context?.theme,
    subtheme: record.context?.subtheme || record.context?.finalNode?.title,
    type: record.outcome === 'resolved_by_faq' ? 'faq_resolved' : 'faq_record',
    status: record.statusLabel,
    createdAt: record.createdAt,
    createdAtLabel: record.createdAtLabel,
  })
}

function normalizeProtocolHistory(protocol, studentProfile = loggedStudent) {
  return buildHistoryItemBase({
    id: protocol.protocolNumber,
    student: studentProfile.nome,
    polo: studentProfile.polo,
    subject: protocol.subject,
    theme: protocol.context?.theme,
    subtheme: protocol.context?.subtheme || protocol.context?.finalNode?.title,
    type: 'protocol_submitted',
    status: protocol.statusLabel,
    createdAt: protocol.createdAt,
    createdAtLabel: protocol.createdAtLabel,
  })
}

function normalizeSeedHistory(item) {
  return buildHistoryItemBase(item)
}

function buildRecurrenceLabel(summary) {
  if (summary.sameSubsubjectCount > 0) {
    return 'Reincidencia no mesmo subtema identificada.'
  }

  if (summary.sameThemeCount > 0) {
    return 'Reincidencia no mesmo tema identificada.'
  }

  if (summary.previousFaqResolvedCount > 0) {
    return 'Ja houve autoatendimento relacionado neste historico.'
  }

  return 'Nao ha reincidencia relevante nesta janela mockada.'
}

function buildCorrelatedHistory({
  caseEntry,
  records = [],
  protocols = [],
  studentProfile = loggedStudent,
}) {
  const recentThreshold = Date.now() - 1000 * 60 * 60 * 24 * 90
  const allHistory = [
    ...operatorCorrelationHistory.map((item) => normalizeSeedHistory(item)),
    ...records.map((record) => normalizeRecordHistory(record, studentProfile)),
    ...protocols.map((protocol) => normalizeProtocolHistory(protocol, studentProfile)),
  ]

  const relatedItems = allHistory
    .filter(
      (item) =>
        normalizeText(item.student) === normalizeText(caseEntry.student) && item.id !== caseEntry.id,
    )
    .sort(sortByCreatedAtDesc)
    .map((item) => ({
      ...item,
      sameTheme: item.themeKey === caseEntry.themeKey,
      sameSubsubject: item.subsubjectKey === caseEntry.subsubjectKey,
      previousSelfService: item.type === 'faq_resolved',
      recent: new Date(item.createdAt).getTime() >= recentThreshold,
    }))

  const summary = {
    total: relatedItems.length,
    previousFaqResolvedCount: relatedItems.filter((item) => item.type === 'faq_resolved').length,
    previousProtocolsCount: relatedItems.filter((item) => item.type === 'protocol_submitted').length,
    sameThemeCount: relatedItems.filter((item) => item.sameTheme).length,
    sameSubsubjectCount: relatedItems.filter((item) => item.sameSubsubject).length,
    recentWindowCount: relatedItems.filter((item) => item.recent).length,
  }

  const signals = {
    repeatedTheme: summary.sameThemeCount > 0,
    repeatedSubsubject: summary.sameSubsubjectCount > 0,
    priorSelfServiceRelated: relatedItems.some(
      (item) => item.previousSelfService && item.sameTheme,
    ),
  }

  return {
    items: relatedItems,
    summary: {
      ...summary,
      recurrenceLabel: buildRecurrenceLabel(summary),
    },
    signals,
  }
}

export function buildOperatorQueueEntries({
  protocols = [],
  actionLogs = [],
  studentProfile = loggedStudent,
  seededQueue = seededOperatorQueue,
} = {}) {
  const localEntries = protocols
    .filter((protocol) => normalizeText(protocol.statusGroup) !== 'completed')
    .map((protocol) => buildLocalQueueEntry(protocol, studentProfile, actionLogs))

  const seedEntries = seededQueue.map((item) => buildSeedQueueEntry(item, actionLogs))

  return [...localEntries, ...seedEntries].sort(compareQueueEntries)
}

export function filterOperatorQueueEntries(entries = [], filters = {}) {
  return entries.filter((entry) => {
    return (
      matchesFilter(filters.status, entry.status) &&
      matchesFilter(filters.theme, entry.theme) &&
      matchesFilter(filters.criticality, entry.criticality)
    )
  })
}

export function buildOperatorQueueFilterOptions(entries = []) {
  return {
    status: buildFilterOptions(entries, 'status'),
    theme: buildFilterOptions(entries, 'theme'),
    criticality: buildFilterOptions(entries, 'criticality'),
  }
}

export function buildOperatorQueueMetrics(entries = []) {
  const criticalCases = entries.filter((entry) => {
    const criticality = normalizeText(entry.criticality)
    return criticality === 'critica' || criticality === 'alta'
  }).length
  const atRiskCases = entries.filter((entry) => isSlaAtRisk(entry.sla)).length
  const portalCases = entries.filter((entry) => entry.source === 'portal_aluno').length

  return [
    {
      label: 'Fila ativa',
      value: entries.length,
      hint: 'Casos ordenados por prioridade, criticidade e hora de entrada.',
    },
    {
      label: 'Alta criticidade',
      value: criticalCases,
      hint: 'Itens com criticidade alta ou critica para o OP.',
    },
    {
      label: 'SLA em atencao',
      value: atRiskCases,
      hint: 'Casos com janela curta ou tempo restante visivel.',
    },
    {
      label: 'Vindos do aluno',
      value: portalCases,
      hint: 'Protocolos gerados pelo portal do atendimento.',
    },
  ]
}

export function buildOperatorActionLog({
  caseEntry,
  actionType,
  note = '',
  playbook,
  currentDate = new Date(),
}) {
  const timestamp = buildTimestampParts(currentDate)
  const metadata = ACTION_METADATA[actionType]

  if (!metadata) {
    throw new Error(`Acao operacional desconhecida: ${actionType}`)
  }

  const normalizedNote = note.trim() || metadata.defaultText({ playbook, caseEntry })
  const queueLabel = metadata.queueResolver ? metadata.queueResolver(caseEntry, playbook) : caseEntry.queue

  return {
    id: `op-action-${caseEntry.id}-${timestamp.compact}`,
    caseId: caseEntry.id,
    actor: 'Operador de Polo',
    actionType,
    actionLabel: metadata.title,
    occurredAt: timestamp.iso,
    occurredAtLabel: timestamp.label,
    statusBefore: caseEntry.status,
    statusLabel: metadata.statusLabel,
    statusAfter: metadata.statusLabel,
    queueBefore: caseEntry.queue,
    queueLabel,
    queueAfter: queueLabel,
    pendingLabel: metadata.pendingLabel,
    escalationReason: actionType === 'escalate' ? playbook.escalationReason || null : null,
    note: normalizedNote,
    timelineItem: {
      id: `op-timeline-${caseEntry.id}-${timestamp.compact}`,
      title: metadata.title,
      description: metadata.buildDescription({ note: normalizedNote, playbook, caseEntry }),
      at: timestamp.iso,
      atLabel: timestamp.label,
      tone: 'primary',
    },
    interactionItem: {
      id: `op-interaction-${caseEntry.id}-${timestamp.compact}`,
      actor: 'Operador de Polo',
      channel: metadata.channel,
      text: normalizedNote,
      at: timestamp.iso,
      atLabel: timestamp.label,
    },
  }
}

export function buildOperatorCaseDetail({
  caseId,
  protocols = [],
  records = [],
  actionLogs = [],
  studentProfile = loggedStudent,
} = {}) {
  const queueEntries = buildOperatorQueueEntries({
    protocols,
    actionLogs,
    studentProfile,
  })
  const caseEntry = queueEntries.find((entry) => entry.id === caseId) || null

  if (!caseEntry) {
    return null
  }

  const localProtocol = protocols.find((protocol) => protocol.protocolNumber === caseId) || null
  const baseDetail = localProtocol
    ? buildLocalCaseDetail(localProtocol, caseEntry, studentProfile)
    : buildSeedCaseDetail(caseEntry)
  const playbook = buildPlaybookPayload(caseEntry)
  const caseActionLogs = getCaseActionLogs(actionLogs, caseId)

  return {
    ...caseEntry,
    studentData: baseDetail.studentData,
    faqContext: baseDetail.faqContext,
    faqAnswer: baseDetail.faqAnswer,
    timeline: [
      ...(baseDetail.timeline || []),
      ...caseActionLogs.map((log) => log.timelineItem),
    ],
    attachments: baseDetail.attachments || [],
    interactions: [
      ...(baseDetail.interactions || []),
      ...caseActionLogs.map((log) => log.interactionItem),
    ],
    playbook,
    correlatedHistory: buildCorrelatedHistory({
      caseEntry,
      records,
      protocols,
      studentProfile,
    }),
  }
}
