import { studentProtocols as seededStudentProtocols } from '../../mocks/operations'

export const STUDENT_REQUEST_STATES = {
  DRAFT: 'draft',
  ACTION_REQUIRED: 'action_required',
  WAITING: 'waiting',
  ANSWERED_IN_PORTAL: 'answered_in_portal',
  COMPLETED: 'completed',
}

const SEEDED_STATUS_STATE_MAP = Object.freeze({
  'resolvido pela faq com registro': STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL,
  'respondido pelo op': STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL,
  concluido: STUDENT_REQUEST_STATES.COMPLETED,
  encerrado: STUDENT_REQUEST_STATES.COMPLETED,
})

export function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function tokenize(value = '') {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
}

function matchesQuery(value, query) {
  const haystack = normalizeText(value)
  const terms = tokenize(query)

  if (!terms.length) {
    return true
  }

  return terms.every((term) => haystack.includes(term))
}

function parseDatePart(datePart = '') {
  const normalized = String(datePart || '').trim()

  if (!/^\d{8}$/.test(normalized)) {
    return null
  }

  const year = Number(normalized.slice(0, 4))
  const month = Number(normalized.slice(4, 6)) - 1
  const day = Number(normalized.slice(6, 8))

  return new Date(year, month, day).getTime()
}

function resolveSeedTimestamp(protocol) {
  if (protocol.updatedAtIso) {
    return new Date(protocol.updatedAtIso).getTime()
  }

  const match = String(protocol.id || '').match(/(\d{8})/)
  if (match) {
    return parseDatePart(match[1])
  }

  return 0
}

function resolveDraftTimestamp(draft) {
  return draft?.createdAt ? new Date(draft.createdAt).getTime() : 0
}

function resolveRecordTimestamp(record) {
  return record?.createdAt ? new Date(record.createdAt).getTime() : 0
}

function resolveProtocolTimestamp(protocol) {
  return protocol?.updatedAt ? new Date(protocol.updatedAt).getTime() : 0
}

function buildStateCopy(studentState, pendingLabel = '') {
  if (studentState === STUDENT_REQUEST_STATES.DRAFT) {
    return {
      statusLabel: 'Em preenchimento',
      nextStepTitle: 'Complete e envie sua solicitacao',
      nextStepDescription: 'Revise o resumo, complemente a descricao e envie quando estiver tudo certo.',
    }
  }

  if (studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED) {
    return {
      statusLabel: 'Precisa da sua acao',
      nextStepTitle: 'Sua acao e necessaria',
      nextStepDescription: pendingLabel || 'Existe uma pendencia que depende de voce para o atendimento continuar.',
    }
  }

  if (studentState === STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL) {
    return {
      statusLabel: 'Respondida no portal',
      nextStepTitle: 'Resposta registrada no portal',
      nextStepDescription: 'A orientacao ja foi registrada e pode ser consultada novamente sempre que necessario.',
    }
  }

  if (studentState === STUDENT_REQUEST_STATES.COMPLETED) {
    return {
      statusLabel: 'Concluida',
      nextStepTitle: 'Atendimento concluido',
      nextStepDescription: 'Este atendimento foi encerrado e nao exige mais nenhuma acao sua.',
    }
  }

  return {
    statusLabel: 'Aguardando atendimento',
    nextStepTitle: 'Agora e com nossa equipe',
    nextStepDescription: pendingLabel || 'Seu registro esta em acompanhamento e voce sera avisado quando houver novidade.',
  }
}

function resolveStudentState({
  studentState = '',
  outcome = '',
  statusCode = '',
  statusLabel = '',
  pendingLabel = '',
} = {}) {
  if (studentState && Object.values(STUDENT_REQUEST_STATES).includes(studentState)) {
    return studentState
  }

  if (outcome === 'resolved_by_faq') {
    return STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL
  }

  if (statusCode === 'completed') {
    return STUDENT_REQUEST_STATES.COMPLETED
  }

  const normalizedStatus = normalizeText(`${statusLabel} ${pendingLabel}`)
  const exactStatus = normalizeText(statusLabel)

  if (SEEDED_STATUS_STATE_MAP[exactStatus]) {
    return SEEDED_STATUS_STATE_MAP[exactStatus]
  }

  if (
    normalizedStatus.includes('respondida no portal') ||
    normalizedStatus.includes('resolvido pela faq') ||
    normalizedStatus.includes('respondido pelo op')
  ) {
    return STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL
  }

  if (normalizedStatus.includes('conclu') || normalizedStatus.includes('encerrad')) {
    return STUDENT_REQUEST_STATES.COMPLETED
  }

  if (
    normalizedStatus.includes('document') ||
    normalizedStatus.includes('complement') ||
    normalizedStatus.includes('enviar') ||
    normalizedStatus.includes('sua resposta') ||
    normalizedStatus.includes('sua acao')
  ) {
    return STUDENT_REQUEST_STATES.ACTION_REQUIRED
  }

  return STUDENT_REQUEST_STATES.WAITING
}

function buildSearchText(...parts) {
  return parts.flat().filter(Boolean).join(' ')
}

function uniqueEntriesById(entries = []) {
  const seen = new Set()
  const uniqueEntries = []

  for (const entry of entries) {
    if (!entry || seen.has(entry.id)) {
      continue
    }

    seen.add(entry.id)
    uniqueEntries.push(entry)
  }

  return uniqueEntries
}

function buildResolvedRecordEntry(record) {
  const studentState = resolveStudentState({
    studentState: record.studentState,
    outcome: record.outcome,
    statusLabel: record.statusLabel,
    pendingLabel: record.pendingLabel,
  })
  const stateCopy = buildStateCopy(studentState, record.pendingLabel)

  return {
    id: record.id,
    subject: record.subject,
    studentState,
    statusLabel: stateCopy.statusLabel,
    pendingLabel: record.pendingLabel,
    updatedAtLabel: record.createdAtLabel,
    timestampMs: resolveRecordTimestamp(record),
    route: `/aluno/solicitacoes/${record.id}`,
    searchText: buildSearchText(
      record.id,
      record.subject,
      record.context?.theme,
      record.context?.subtheme,
      record.context?.displayedAnswer,
      record.statusLabel,
    ),
    detailSource: 'record',
    rawRecord: record,
    nextStepTitle: stateCopy.nextStepTitle,
    nextStepDescription: stateCopy.nextStepDescription,
  }
}

function buildDraftEntry(protocolDraft) {
  if (!protocolDraft) {
    return null
  }

  const stateCopy = buildStateCopy(STUDENT_REQUEST_STATES.DRAFT)

  return {
    id: protocolDraft.id,
    subject: protocolDraft.form.subject,
    studentState: STUDENT_REQUEST_STATES.DRAFT,
    statusLabel: stateCopy.statusLabel,
    pendingLabel: 'Revise a descricao e os anexos antes de enviar.',
    updatedAtLabel: protocolDraft.createdAtLabel,
    timestampMs: resolveDraftTimestamp(protocolDraft),
    route: '/aluno/protocolo',
    searchText: buildSearchText(
      protocolDraft.id,
      protocolDraft.form.subject,
      protocolDraft.form.theme,
      protocolDraft.form.subtheme,
      protocolDraft.form.breadcrumb,
    ),
    detailSource: 'draft',
    rawDraft: protocolDraft,
    nextStepTitle: stateCopy.nextStepTitle,
    nextStepDescription: stateCopy.nextStepDescription,
  }
}

function buildLocalProtocolEntry(protocol) {
  const studentState = resolveStudentState({
    studentState: protocol.studentState,
    statusCode: protocol.statusCode,
    statusLabel: protocol.statusLabel,
    pendingLabel: protocol.pendingLabel,
  })
  const stateCopy = buildStateCopy(studentState, protocol.pendingLabel)

  return {
    id: protocol.protocolNumber,
    subject: protocol.subject,
    studentState,
    statusLabel: stateCopy.statusLabel,
    pendingLabel: protocol.pendingLabel,
    updatedAtLabel: protocol.updatedAtLabel,
    timestampMs: resolveProtocolTimestamp(protocol),
    route: `/aluno/solicitacoes/${protocol.protocolNumber}`,
    searchText: buildSearchText(
      protocol.protocolNumber,
      protocol.subject,
      protocol.context?.theme,
      protocol.context?.subtheme,
      protocol.pendingLabel,
      protocol.statusLabel,
    ),
    detailSource: 'protocol',
    rawProtocol: protocol,
    nextStepTitle: stateCopy.nextStepTitle,
    nextStepDescription: stateCopy.nextStepDescription,
  }
}

function buildSeedProtocolEntry(protocol) {
  const studentState = resolveStudentState({
    statusLabel: protocol.status,
    pendingLabel: protocol.pending,
  })
  const stateCopy = buildStateCopy(studentState, protocol.pending)

  return {
    id: protocol.id,
    subject: protocol.subject,
    studentState,
    statusLabel: stateCopy.statusLabel,
    pendingLabel: protocol.pending,
    updatedAtLabel: protocol.updatedAt,
    timestampMs: resolveSeedTimestamp(protocol),
    route: `/aluno/solicitacoes/${protocol.id}`,
    searchText: buildSearchText(protocol.id, protocol.subject, protocol.status, protocol.pending),
    detailSource: 'seed',
    rawSeed: protocol,
    nextStepTitle: stateCopy.nextStepTitle,
    nextStepDescription: stateCopy.nextStepDescription,
  }
}

export function buildStudentPortalRequestEntries({
  protocolDraft = null,
  records = [],
  protocols = [],
  seededProtocols = seededStudentProtocols,
} = {}) {
  const entries = uniqueEntriesById([
    buildDraftEntry(protocolDraft),
    ...records.filter((record) => record.outcome === 'resolved_by_faq').map(buildResolvedRecordEntry),
    ...protocols.map(buildLocalProtocolEntry),
    ...seededProtocols.map(buildSeedProtocolEntry),
  ].filter(Boolean))

  return entries.sort((left, right) => right.timestampMs - left.timestampMs)
}

function matchesPeriod(entry, periodKey) {
  if (periodKey === 'all' || !entry.timestampMs) {
    return true
  }

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  if (periodKey === '7d') {
    return now - entry.timestampMs <= 7 * dayMs
  }

  if (periodKey === '30d') {
    return now - entry.timestampMs <= 30 * dayMs
  }

  if (periodKey === 'semester') {
    const referenceDate = new Date()
    const year = referenceDate.getFullYear()
    const month = referenceDate.getMonth()
    const semesterStartMonth = month < 6 ? 0 : 6
    const semesterEndMonth = month < 6 ? 5 : 11
    const semesterStart = new Date(year, semesterStartMonth, 1, 0, 0, 0, 0).getTime()
    const semesterEnd = new Date(year, semesterEndMonth + 1, 0, 23, 59, 59, 999).getTime()

    return entry.timestampMs >= semesterStart && entry.timestampMs <= semesterEnd
  }

  return true
}

export function buildStudentRequestSections({
  protocolDraft = null,
  records = [],
  protocols = [],
  seededProtocols = seededStudentProtocols,
  query = '',
  period = 'all',
} = {}) {
  const entries = buildStudentPortalRequestEntries({
    protocolDraft,
    records,
    protocols,
    seededProtocols,
  })
    .filter((entry) => matchesPeriod(entry, period))
    .filter((entry) => matchesQuery(entry.searchText, query))

  const sections = {
    drafts: [],
    actionRequired: [],
    waiting: [],
    completed: [],
  }

  for (const entry of entries) {
    if (entry.studentState === STUDENT_REQUEST_STATES.DRAFT) {
      sections.drafts.push(entry)
      continue
    }

    if (entry.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED) {
      sections.actionRequired.push(entry)
      continue
    }

    if (
      entry.studentState === STUDENT_REQUEST_STATES.ANSWERED_IN_PORTAL ||
      entry.studentState === STUDENT_REQUEST_STATES.COMPLETED
    ) {
      sections.completed.push(entry)
      continue
    }

    sections.waiting.push(entry)
  }

  return sections
}

export function buildStudentRequestSummary(sections) {
  const counts = {
    drafts: sections.drafts.length,
    actionRequired: sections.actionRequired.length,
    waiting: sections.waiting.length,
    completed: sections.completed.length,
  }

  const totalVisible =
    counts.drafts +
    counts.actionRequired +
    counts.waiting +
    counts.completed

  return {
    counts,
    totalVisible,
    hasResults: totalVisible > 0,
    actionRequiredCount: counts.actionRequired,
  }
}

function collectFaqNodes(nodes = [], items = [], lineage = []) {
  for (const node of nodes) {
    const nextLineage = [...lineage, node]
    items.push({
      id: node.id,
      title: node.titulo_exibido,
      description: node.pergunta_exibida || node.descricao_interna || node.resposta || '',
      route: `/aluno/duvida?node=${node.id}`,
      searchText: buildSearchText(
        node.titulo_exibido,
        node.pergunta_exibida,
        node.descricao_interna,
        node.resposta,
        node.palavras_chave || [],
        node.tags || [],
        node.tema,
        node.subtema,
      ),
      highlighted: Boolean(node.runtime?.isHighlighted),
      lineage: nextLineage.map((step) => step.titulo_exibido),
    })

    collectFaqNodes(node.children || [], items, nextLineage)
  }

  return items
}

export function buildStudentPortalSearch({
  faqTree = [],
  protocolDraft = null,
  records = [],
  protocols = [],
  seededProtocols = seededStudentProtocols,
  query = '',
  limit = 4,
} = {}) {
  if (!tokenize(query).length) {
    return {
      faqMatches: [],
      requestMatches: [],
    }
  }

  const faqMatches = collectFaqNodes(faqTree)
    .filter((item) => matchesQuery(item.searchText, query))
    .sort((left, right) => Number(right.highlighted) - Number(left.highlighted))
    .slice(0, limit)

  const requestMatches = buildStudentPortalRequestEntries({
    protocolDraft,
    records,
    protocols,
    seededProtocols,
  })
    .filter((item) => matchesQuery(item.searchText, query))
    .slice(0, limit)

  return {
    faqMatches,
    requestMatches,
  }
}

function buildFallbackTimeline(detail) {
  return [
    {
      id: `${detail.id}-created`,
      title: detail.statusLabel,
      description: detail.nextStepDescription,
      atLabel: detail.updatedAtLabel,
    },
  ]
}

function buildRecordDetail(recordEntry) {
  const record = recordEntry.rawRecord

  return {
    id: recordEntry.id,
    subject: recordEntry.subject,
    studentState: recordEntry.studentState,
    statusLabel: recordEntry.statusLabel,
    updatedAtLabel: recordEntry.updatedAtLabel,
    nextStepTitle: recordEntry.nextStepTitle,
    nextStepDescription: recordEntry.nextStepDescription,
    summary: record.context?.displayedAnswer || 'Resposta registrada no portal.',
    timeline: [
      {
        id: `${record.id}-faq`,
        title: 'Resposta registrada no portal',
        description: record.context?.displayedAnswer || 'A orientacao oficial foi registrada para consulta.',
        atLabel: record.createdAtLabel,
      },
    ],
    attachments: [],
    canUploadDocument: false,
    actionLabel: '',
    actionDescription: 'Nenhuma acao sua e necessaria neste registro.',
    contextTrail: record.context?.breadcrumb || [],
  }
}

function buildProtocolDetail(protocolEntry) {
  const protocol = protocolEntry.rawProtocol
  const canUploadDocument = protocolEntry.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED
  const actionDescription = canUploadDocument
    ? protocol.pendingLabel
    : protocolEntry.studentState === STUDENT_REQUEST_STATES.WAITING
      ? 'Agora e com nossa equipe. Nao ha nenhuma acao pendente para voce.'
      : protocolEntry.nextStepDescription

  return {
    id: protocolEntry.id,
    subject: protocolEntry.subject,
    studentState: protocolEntry.studentState,
    statusLabel: protocolEntry.statusLabel,
    updatedAtLabel: protocolEntry.updatedAtLabel,
    nextStepTitle: protocolEntry.nextStepTitle,
    nextStepDescription: protocolEntry.nextStepDescription,
    summary: protocol.interactions?.[0]?.text || 'Solicitacao registrada no portal.',
    timeline: protocol.timeline || buildFallbackTimeline(protocolEntry),
    attachments: protocol.attachments || [],
    canUploadDocument,
    actionLabel: canUploadDocument ? 'Documento pendente' : '',
    actionDescription,
    contextTrail: protocol.context?.breadcrumb || [],
  }
}

function buildSeedDetail(seedEntry) {
  return {
    id: seedEntry.id,
    subject: seedEntry.subject,
    studentState: seedEntry.studentState,
    statusLabel: seedEntry.statusLabel,
    updatedAtLabel: seedEntry.updatedAtLabel,
    nextStepTitle: seedEntry.nextStepTitle,
    nextStepDescription: seedEntry.nextStepDescription,
    summary: seedEntry.pendingLabel,
    timeline: buildFallbackTimeline(seedEntry),
    attachments: [],
    canUploadDocument: seedEntry.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED,
    actionLabel: seedEntry.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED ? 'Documento pendente' : '',
    actionDescription:
      seedEntry.studentState === STUDENT_REQUEST_STATES.ACTION_REQUIRED
        ? seedEntry.pendingLabel
        : 'Este registro permanece disponivel no portal para acompanhamento.',
    contextTrail: [],
  }
}

export function buildStudentRequestDetail({
  requestId = '',
  protocolDraft = null,
  records = [],
  protocols = [],
  seededProtocols = seededStudentProtocols,
} = {}) {
  const normalizedId = String(requestId || '')

  if (!normalizedId) {
    return null
  }

  const entry = buildStudentPortalRequestEntries({
    protocolDraft,
    records,
    protocols,
    seededProtocols,
  }).find((item) => item.id === normalizedId)

  if (!entry) {
    return null
  }

  if (entry.detailSource === 'record') {
    return buildRecordDetail(entry)
  }

  if (entry.detailSource === 'protocol') {
    return buildProtocolDetail(entry)
  }

  if (entry.detailSource === 'seed') {
    return buildSeedDetail(entry)
  }

  return null
}
