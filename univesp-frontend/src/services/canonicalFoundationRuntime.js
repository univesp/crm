import faqAluno from '../../mocks/faq-aluno.json'
import faqOp from '../../mocks/faq-op.json'
import { areaSubjectRuleSeeds, knowledgeSuggestionSeeds, areaTeamCatalog } from '../../mocks/areaGovernance'
import { operationalAreaSeeds, userAvailabilitySeeds } from '../../mocks/canonicalFoundation'
import { resolveLastMileAreaLabel } from '@/services/caseRoutingRuntime'

export const KNOWLEDGE_BUNDLE_VERSION_STATUSES = Object.freeze({
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
})

export const KNOWLEDGE_SUGGESTION_STATUSES = Object.freeze({
  PENDING_REVIEW: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IMPLEMENTED: 'Implemented',
  SUPERSEDED: 'Superseded',
})

export const CASE_PROTOCOL_STATUSES = Object.freeze({
  NEW: 'new',
  TRIAGE: 'triage',
  IN_PROGRESS_OP: 'in_progress_op',
  WAITING_STUDENT: 'waiting_student',
  WAITING_AREA: 'waiting_area',
  IN_PROGRESS_AREA: 'in_progress_area',
  REROUTED: 'rerouted',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
})

export const CASE_ASSIGNMENT_STATUSES = Object.freeze({
  PENDING_ASSIGNMENT: 'pending_assignment',
  ASSIGNED: 'assigned',
  REASSIGNED: 'reassigned',
  UNASSIGNED_EXCEPTION: 'unassigned_exception',
  COMPLETED: 'completed',
})

export const USER_AVAILABILITY_STATUSES = Object.freeze({
  AVAILABLE: 'available',
  REDUCED_CAPACITY: 'reduced_capacity',
  UNAVAILABLE: 'unavailable',
})

const KNOWLEDGE_STATUS_FROM_LEGACY = Object.freeze({
  draft: KNOWLEDGE_BUNDLE_VERSION_STATUSES.DRAFT,
  review: KNOWLEDGE_BUNDLE_VERSION_STATUSES.IN_REVIEW,
  approved: KNOWLEDGE_BUNDLE_VERSION_STATUSES.APPROVED,
  published: KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
  archived: KNOWLEDGE_BUNDLE_VERSION_STATUSES.ARCHIVED,
})

const KNOWLEDGE_SUGGESTION_CODE_FROM_LEGACY = Object.freeze({
  pending: KNOWLEDGE_SUGGESTION_STATUSES.PENDING_REVIEW,
  approved: KNOWLEDGE_SUGGESTION_STATUSES.APPROVED,
  rejected: KNOWLEDGE_SUGGESTION_STATUSES.REJECTED,
  implemented: KNOWLEDGE_SUGGESTION_STATUSES.IMPLEMENTED,
  superseded: KNOWLEDGE_SUGGESTION_STATUSES.SUPERSEDED,
})

const LEGACY_KNOWLEDGE_STATUS_FROM_CODE = Object.freeze({
  [KNOWLEDGE_SUGGESTION_STATUSES.PENDING_REVIEW]: 'pending',
  [KNOWLEDGE_SUGGESTION_STATUSES.APPROVED]: 'approved',
  [KNOWLEDGE_SUGGESTION_STATUSES.REJECTED]: 'rejected',
  [KNOWLEDGE_SUGGESTION_STATUSES.IMPLEMENTED]: 'implemented',
  [KNOWLEDGE_SUGGESTION_STATUSES.SUPERSEDED]: 'superseded',
})

const KNOWLEDGE_BUNDLE_CATALOG = Object.freeze({
  faq_aluno: Object.freeze({
    bundleType: 'faq_aluno',
    bundleLabel: 'FAQ do aluno',
    faqPackage: faqAluno,
    profile: 'aluno',
  }),
  orientacao_operacional: Object.freeze({
    bundleType: 'orientacao_operacional',
    bundleLabel: 'Orientacao operacional',
    faqPackage: faqOp,
    profile: 'operacao',
  }),
})

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

export function normalizeCanonicalText(value = '') {
  return String(value || '').trim().toLowerCase()
}

function slugify(value = '') {
  return normalizeCanonicalText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function titleCase(value = '') {
  const normalized = String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()

  if (!normalized) {
    return 'Nao informado'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function buildSubjectCode(themeKey = '') {
  return slugify(themeKey)
}

export function buildSubsubjectCode(themeKey = '', subsubjectKey = '') {
  const subjectCode = buildSubjectCode(themeKey)
  const normalizedSubsubject = slugify(subsubjectKey || 'geral')
  return subjectCode && normalizedSubsubject ? `${subjectCode}__${normalizedSubsubject}` : normalizedSubsubject
}

function buildAreaCode(areaLabel = '') {
  return slugify(areaLabel)
}

function mapBundleStatus(status = '') {
  return KNOWLEDGE_STATUS_FROM_LEGACY[normalizeCanonicalText(status)] || KNOWLEDGE_BUNDLE_VERSION_STATUSES.DRAFT
}

export function normalizeKnowledgeSuggestionStatusCode(status = '') {
  if (Object.values(KNOWLEDGE_SUGGESTION_STATUSES).includes(status)) {
    return status
  }

  return (
    KNOWLEDGE_SUGGESTION_CODE_FROM_LEGACY[normalizeCanonicalText(status)] ||
    KNOWLEDGE_SUGGESTION_STATUSES.PENDING_REVIEW
  )
}

export function mapKnowledgeSuggestionLegacyStatus(statusCode = '') {
  return LEGACY_KNOWLEDGE_STATUS_FROM_CODE[statusCode] || 'pending'
}

function buildAreaGuidanceSnapshot(node = {}) {
  const sections = []

  if (Array.isArray(node.checklist_op) && node.checklist_op.length) {
    sections.push(`O que verificar: ${node.checklist_op.join('; ')}`)
  }

  if (Array.isArray(node.sistemas_a_consultar) && node.sistemas_a_consultar.length) {
    sections.push(`Onde verificar: ${node.sistemas_a_consultar.join('; ')}`)
  }

  if (Array.isArray(node.documentos_a_solicitar) && node.documentos_a_solicitar.length) {
    sections.push(`Documentos a observar: ${node.documentos_a_solicitar.join('; ')}`)
  }

  if (node.criterio_de_escalonamento) {
    sections.push(`Quando escalar: ${node.criterio_de_escalonamento}`)
  }

  if (node.motivo_escalonamento_sugerido) {
    sections.push(`Regra de excecao: ${node.motivo_escalonamento_sugerido}`)
  }

  return sections.join(' | ')
}

function buildKnowledgeBundleVersions(bundleDefinition) {
  const versioning = bundleDefinition.faqPackage.versioning || {}
  const publication = bundleDefinition.faqPackage.publication || {}
  const currentStatus = mapBundleStatus(versioning.publication_status)
  const records = []

  if (versioning.published_version) {
    records.push({
      id: `${bundleDefinition.bundleType}:${versioning.published_version}`,
      bundleType: bundleDefinition.bundleType,
      bundleLabel: bundleDefinition.bundleLabel,
      versionNumber: versioning.published_version,
      statusCode: KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
      changeSummary: publication.last_published_at
        ? `Versao publicada em ${publication.last_published_at}.`
        : 'Versao publicada historicamente na base.',
      createdBy: publication.last_published_by || bundleDefinition.faqPackage.metadata?.owner || 'Sistema',
      approvedBy: publication.last_published_by || bundleDefinition.faqPackage.metadata?.owner || 'Sistema',
      approvedAt: publication.last_published_at || null,
      publishedBy: publication.last_published_by || bundleDefinition.faqPackage.metadata?.owner || 'Sistema',
      publishedAt: publication.last_published_at || null,
      replacesVersion: null,
      isRuntimePayload: currentStatus === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
    })
  }

  if (versioning.draft_version) {
    records.push({
      id: `${bundleDefinition.bundleType}:${versioning.draft_version}`,
      bundleType: bundleDefinition.bundleType,
      bundleLabel: bundleDefinition.bundleLabel,
      versionNumber: versioning.draft_version,
      statusCode: currentStatus,
      changeSummary: versioning.change_summary || 'Alteracoes em rascunho na base de conhecimento.',
      createdBy: bundleDefinition.faqPackage.metadata?.owner || 'Sistema',
      approvedBy: '',
      approvedAt: null,
      publishedBy: '',
      publishedAt: null,
      replacesVersion: versioning.base_version || versioning.published_version || null,
      isRuntimePayload: currentStatus !== KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
    })
  }

  if (!records.length) {
    records.push({
      id: `${bundleDefinition.bundleType}:runtime-current`,
      bundleType: bundleDefinition.bundleType,
      bundleLabel: bundleDefinition.bundleLabel,
      versionNumber: 'runtime-current',
      statusCode: KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
      changeSummary: 'Versao corrente sem metadados completos no mock.',
      createdBy: bundleDefinition.faqPackage.metadata?.owner || 'Sistema',
      approvedBy: bundleDefinition.faqPackage.metadata?.owner || 'Sistema',
      approvedAt: publication.last_published_at || null,
      publishedBy: bundleDefinition.faqPackage.metadata?.owner || 'Sistema',
      publishedAt: publication.last_published_at || null,
      replacesVersion: null,
      isRuntimePayload: true,
    })
  }

  return records
}

function buildKnowledgePublicationRecords(bundleDefinition, bundleVersions = []) {
  return bundleVersions
    .filter((record) => record.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED)
    .map((record) => ({
      id: `publication:${record.id}`,
      bundleVersionId: record.id,
      bundleType: record.bundleType,
      publicationStatus: record.statusCode,
      approvedAt: record.approvedAt || record.publishedAt || bundleDefinition.faqPackage.publication?.last_published_at || null,
      approvedBy: record.approvedBy || bundleDefinition.faqPackage.publication?.last_published_by || '',
      publishedAt: record.publishedAt || bundleDefinition.faqPackage.publication?.last_published_at || null,
      publishedBy: record.publishedBy || bundleDefinition.faqPackage.publication?.last_published_by || '',
    }))
}

function buildVersionScopedNodeId(bundleVersionId = '', legacyNodeId = '') {
  return `${bundleVersionId}:node:${legacyNodeId}`
}

function buildVersionScopedLinkId(bundleVersionId = '', parentNodeId = '', childNodeId = '', sortOrder = 0) {
  return `${bundleVersionId}:link:${parentNodeId}:${childNodeId}:${sortOrder}`
}

function buildKnowledgeEntitiesFromBundle(bundleDefinition, bundleVersions = []) {
  const subjects = []
  const subjectMap = new Map()
  const subsubjects = []
  const subsubjectMap = new Map()
  const nodes = []
  const links = []

  for (const node of bundleDefinition.faqPackage.nodes || []) {
    const subjectCode = buildSubjectCode(node.tema)
    const subsubjectCode = buildSubsubjectCode(node.tema, node.subtema)
    const subjectKey = subjectCode
    const subsubjectKey = `${subjectCode}::${subsubjectCode}`

    if (!subjectMap.has(subjectKey)) {
      const subjectRecord = {
        id: `subject:${subjectCode}`,
        subjectCode,
        subjectLabel: titleCase(node.tema),
        isActive: true,
      }
      subjectMap.set(subjectKey, subjectRecord)
      subjects.push(subjectRecord)
    }

    if (!subsubjectMap.has(subsubjectKey)) {
      const subsubjectRecord = {
        id: `subsubject:${subsubjectCode}`,
        subjectId: `subject:${subjectCode}`,
        subjectCode,
        subsubjectCode,
        subsubjectLabel: titleCase(node.subtema || 'geral'),
        isActive: true,
      }
      subsubjectMap.set(subsubjectKey, subsubjectRecord)
      subsubjects.push(subsubjectRecord)
    }

  }

  const versionSnapshots = bundleVersions.length
    ? bundleVersions
    : [
        {
          id: `${bundleDefinition.bundleType}:runtime-current`,
          versionNumber: 'runtime-current',
          statusCode: KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
        },
      ]

  for (const versionRecord of versionSnapshots) {
    for (const node of bundleDefinition.faqPackage.nodes || []) {
      const subjectCode = buildSubjectCode(node.tema)
      const subsubjectCode = buildSubsubjectCode(node.tema, node.subtema)

      nodes.push({
        id: buildVersionScopedNodeId(versionRecord.id, node.id),
        legacyNodeId: node.id,
        bundleType: bundleDefinition.bundleType,
        bundleVersionId: versionRecord.id,
        subjectId: `subject:${subjectCode}`,
        subjectCode,
        subsubjectId: `subsubject:${subsubjectCode}`,
        subsubjectCode,
        nodeType: node.node_kind || node.node_type || 'leaf',
        questionText: node.pergunta_exibida || '',
        responseText: node.resposta || '',
        defaultAreaId: node.fila_destino ? `area:${buildAreaCode(resolveLastMileAreaLabel(node.fila_destino))}` : '',
        defaultAreaLabel: node.fila_destino ? resolveLastMileAreaLabel(node.fila_destino) : 'Nao aplicavel',
        defaultSlaPolicyCode: String(node.sla_padrao || '').trim() || '',
        criticalityLevel: String(node.criticidade_padrao || '').trim() || 'media',
        requiredFields: Array.isArray(node.campos_exigidos) ? [...node.campos_exigidos] : [],
        requiredDocuments: Array.isArray(node.documentos_a_solicitar) ? [...node.documentos_a_solicitar] : [],
        studentGuidance: node.resposta || '',
        operatorGuidance: node.resposta_padrao_sugerida || '',
        areaGuidance: buildAreaGuidanceSnapshot(node),
        exceptionRule: node.motivo_escalonamento_sugerido || node.criterio_de_escalonamento || '',
        isTerminal: Boolean(node.abre_atendimento) || ['leaf'].includes(node.node_kind || node.node_type || 'leaf'),
        publicationStatus: versionRecord.statusCode,
        nodeVersion: node.node_version || versionRecord.versionNumber || versionRecord.id,
        isActive: node.ativo !== false,
        isPublishedSnapshot: versionRecord.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
        profile: bundleDefinition.profile,
        title: node.titulo_exibido || '',
        actionCode: node.acao || '',
        queueDestinationCode: node.fila_destino || '',
        tags: Array.isArray(node.tags) ? [...node.tags] : [],
        keywords: Array.isArray(node.palavras_chave) ? [...node.palavras_chave] : [],
      })
    }

    for (const link of bundleDefinition.faqPackage.links || []) {
      links.push({
        id: buildVersionScopedLinkId(versionRecord.id, link.parent_node_id, link.child_node_id, link.ordem || 0),
        legacyLinkId: `${link.parent_node_id}:${link.child_node_id}:${link.ordem || 0}`,
        bundleType: bundleDefinition.bundleType,
        bundleVersionId: versionRecord.id,
        parentNodeId: buildVersionScopedNodeId(versionRecord.id, link.parent_node_id),
        childNodeId: buildVersionScopedNodeId(versionRecord.id, link.child_node_id),
        parentLegacyNodeId: link.parent_node_id,
        childLegacyNodeId: link.child_node_id,
        conditionLabel: link.condicao_resposta || '',
        sortOrder: link.ordem ?? 0,
        isActive: link.ativo !== false,
      })
    }
  }

  return {
    subjects,
    subsubjects,
    nodes,
    links,
  }
}

function buildOperationalAreaRecords() {
  return operationalAreaSeeds.map((item) => ({
    ...item,
    areaId: `area:${buildAreaCode(item.areaLabel)}`,
    teamMembers: [...(areaTeamCatalog[item.areaLabel] || [])],
  }))
}

function normalizeAreaSubjectRule(rule = {}) {
  const subjectCode = buildSubjectCode(rule.themeKey)
  const subsubjectCode = buildSubsubjectCode(rule.themeKey, rule.subsubjectKey)

  return {
    ...rule,
    areaId: `area:${buildAreaCode(rule.areaLabel)}`,
    subjectId: `subject:${subjectCode}`,
    subjectCode,
    subsubjectId: `subsubject:${subsubjectCode}`,
    subsubjectCode,
    visibilityMode: rule.accessMode || 'team',
    eligibleUsers: [...(rule.allowedAnalysts || [])],
    isActive: true,
  }
}

function normalizeUserAvailability(record = {}) {
  return {
    ...record,
    areaId: record.areaLabel ? `area:${buildAreaCode(record.areaLabel)}` : '',
    statusCode: Object.values(USER_AVAILABILITY_STATUSES).includes(record.statusCode)
      ? record.statusCode
      : USER_AVAILABILITY_STATUSES.AVAILABLE,
    capacityFactor:
      typeof record.capacityFactor === 'number'
        ? record.capacityFactor
        : record.statusCode === USER_AVAILABILITY_STATUSES.REDUCED_CAPACITY
          ? 0.5
          : record.statusCode === USER_AVAILABILITY_STATUSES.UNAVAILABLE
            ? 0
            : 1,
  }
}

function normalizeKnowledgeSuggestion(record = {}) {
  const statusCode = normalizeKnowledgeSuggestionStatusCode(record.statusCode || record.status)
  const subjectCode = buildSubjectCode(record.themeKey)
  const subsubjectCode = buildSubsubjectCode(record.themeKey, record.subsubjectKey)

  return {
    ...record,
    areaId: record.areaLabel ? `area:${buildAreaCode(record.areaLabel)}` : '',
    subjectId: `subject:${subjectCode}`,
    subjectCode,
    subsubjectId: `subsubject:${subsubjectCode}`,
    subsubjectCode,
    statusCode,
    status: record.status || mapKnowledgeSuggestionLegacyStatus(statusCode),
    reviewerName: record.reviewerName || '',
    reviewedAtLabel: record.reviewedAtLabel || '',
    decisionNote: record.decisionNote || '',
  }
}

function buildKnowledgeSuggestionReviewRecords(suggestions = []) {
  return suggestions
    .filter((suggestion) => suggestion.reviewerName || suggestion.reviewedAtLabel)
    .map((suggestion) => ({
      id: `suggestion-review:${suggestion.id}`,
      suggestionId: suggestion.id,
      reviewerName: suggestion.reviewerName,
      decision: suggestion.statusCode,
      decisionNote: suggestion.decisionNote || '',
      reviewedAtLabel: suggestion.reviewedAtLabel || '',
    }))
}

function buildFoundationSeeds() {
  const knowledgeBundleVersions = []
  const knowledgePublications = []
  const knowledgeSubjects = []
  const knowledgeSubsubjects = []
  const knowledgeNodes = []
  const knowledgeNodeLinks = []
  const bundleLookups = {}

  for (const bundleDefinition of Object.values(KNOWLEDGE_BUNDLE_CATALOG)) {
    const bundleVersions = buildKnowledgeBundleVersions(bundleDefinition)
    const bundleEntities = buildKnowledgeEntitiesFromBundle(bundleDefinition, bundleVersions)
    const runtimeVersionId =
      bundleVersions.find((record) => record.isRuntimePayload)?.id ||
      bundleVersions.find((record) => record.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED)?.id ||
      bundleVersions[0]?.id ||
      ''

    knowledgeBundleVersions.push(...bundleVersions)
    knowledgePublications.push(...buildKnowledgePublicationRecords(bundleDefinition, bundleVersions))
    knowledgeSubjects.push(...bundleEntities.subjects)
    knowledgeSubsubjects.push(...bundleEntities.subsubjects)
    knowledgeNodes.push(...bundleEntities.nodes)
    knowledgeNodeLinks.push(...bundleEntities.links)
    bundleLookups[bundleDefinition.bundleType] = {
      runtimeVersionId,
      publishedVersionId:
        bundleVersions.find((record) => record.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED)?.id || runtimeVersionId,
    }
  }

  const uniqueSubjects = Object.values(
    Object.fromEntries(knowledgeSubjects.map((item) => [item.subjectCode, item])),
  )
  const uniqueSubsubjects = Object.values(
    Object.fromEntries(knowledgeSubsubjects.map((item) => [item.subsubjectCode, item])),
  )
  const operationalAreas = buildOperationalAreaRecords()
  const areaSubjectEligibility = areaSubjectRuleSeeds.map(normalizeAreaSubjectRule)
  const userAvailability = userAvailabilitySeeds.map(normalizeUserAvailability)
  const knowledgeSuggestions = knowledgeSuggestionSeeds.map(normalizeKnowledgeSuggestion)
  const knowledgeSuggestionReviews = buildKnowledgeSuggestionReviewRecords(knowledgeSuggestions)

  return {
    knowledgeSubjects: uniqueSubjects,
    knowledgeSubsubjects: uniqueSubsubjects,
    knowledgeNodes,
    knowledgeNodeLinks,
    knowledgeBundleVersions,
    knowledgePublications,
    operationalAreas,
    areaSubjectEligibility,
    userAvailability,
    knowledgeSuggestions,
    knowledgeSuggestionReviews,
    bundleLookups,
  }
}

const FOUNDATION = buildFoundationSeeds()

export function cloneCanonicalFoundationSeeds() {
  return cloneJson({
    knowledgeSubjects: FOUNDATION.knowledgeSubjects,
    knowledgeSubsubjects: FOUNDATION.knowledgeSubsubjects,
    knowledgeNodes: FOUNDATION.knowledgeNodes,
    knowledgeNodeLinks: FOUNDATION.knowledgeNodeLinks,
    knowledgeBundleVersions: FOUNDATION.knowledgeBundleVersions,
    knowledgePublications: FOUNDATION.knowledgePublications,
    operationalAreas: FOUNDATION.operationalAreas,
    areaSubjectEligibility: FOUNDATION.areaSubjectEligibility,
    userAvailability: FOUNDATION.userAvailability,
    knowledgeSuggestions: FOUNDATION.knowledgeSuggestions,
    knowledgeSuggestionReviews: FOUNDATION.knowledgeSuggestionReviews,
  })
}

function resolveFoundationCollections(foundation = FOUNDATION) {
  return {
    subjects: foundation.knowledgeSubjects || foundation.subjects || [],
    subsubjects: foundation.knowledgeSubsubjects || foundation.subsubjects || [],
    nodes: foundation.knowledgeNodes || foundation.nodes || [],
    nodeLinks: foundation.knowledgeNodeLinks || foundation.nodeLinks || [],
    bundleVersions: foundation.knowledgeBundleVersions || foundation.bundleVersions || [],
    publications: foundation.knowledgePublications || foundation.publications || [],
    suggestions: foundation.knowledgeSuggestions || foundation.suggestions || [],
    suggestionReviews: foundation.knowledgeSuggestionReviews || foundation.suggestionReviews || [],
  }
}

function buildBundleLookups(bundleVersions = []) {
  const grouped = new Map()

  for (const record of bundleVersions) {
    const existing = grouped.get(record.bundleType) || {
      runtimeVersionId: '',
      publishedVersionId: '',
    }

    if (!existing.runtimeVersionId && record.isRuntimePayload) {
      existing.runtimeVersionId = record.id
    }

    if (!existing.publishedVersionId && record.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED) {
      existing.publishedVersionId = record.id
    }

    grouped.set(record.bundleType, existing)
  }

  return Object.fromEntries([...grouped.entries()].map(([bundleType, payload]) => [bundleType, payload]))
}

function buildKnowledgeLookupIndex(foundation = FOUNDATION) {
  const collections = resolveFoundationCollections(foundation)
  const studentNodesByKey = new Map()
  const operatorNodesByKey = new Map()
  const subjectByCode = new Map((collections.subjects || []).map((item) => [item.subjectCode, item]))
  const subsubjectByCode = new Map((collections.subsubjects || []).map((item) => [item.subsubjectCode, item]))
  const bundleLookups = buildBundleLookups(collections.bundleVersions || [])

  for (const node of collections.nodes || []) {
    const key = `${node.subjectCode}::${node.subsubjectCode}`
    const activeBundleVersionId =
      bundleLookups[node.bundleType]?.publishedVersionId || bundleLookups[node.bundleType]?.runtimeVersionId || ''

    if (node.bundleVersionId !== activeBundleVersionId) {
      continue
    }

    if (node.bundleType === 'faq_aluno' && node.nodeType === 'leaf' && !studentNodesByKey.has(key)) {
      studentNodesByKey.set(key, node)
    }

    if (node.bundleType === 'orientacao_operacional' && node.nodeType === 'leaf' && !operatorNodesByKey.has(key)) {
      operatorNodesByKey.set(key, node)
    }
  }

  return {
    studentNodesByKey,
    operatorNodesByKey,
    subjectByCode,
    subsubjectByCode,
    bundleLookups,
  }
}

const KNOWLEDGE_LOOKUPS = buildKnowledgeLookupIndex(FOUNDATION)

export function getActiveKnowledgeBundleVersionId(bundleType = '', foundation = FOUNDATION) {
  const collections = resolveFoundationCollections(foundation)
  const lookup = buildBundleLookups(collections.bundleVersions || [])[bundleType]
  return lookup?.publishedVersionId || lookup?.runtimeVersionId || ''
}

export function findKnowledgeDefinitionBySubject(themeKey = '', subsubjectKey = '', foundation = FOUNDATION) {
  const collections = resolveFoundationCollections(foundation)
  const subjectCode = buildSubjectCode(themeKey)
  const subsubjectCode = buildSubsubjectCode(themeKey, subsubjectKey)
  const lookupKey = `${subjectCode}::${subsubjectCode}`
  const knowledgeLookups = foundation === FOUNDATION ? KNOWLEDGE_LOOKUPS : buildKnowledgeLookupIndex(foundation)
  const subject = knowledgeLookups.subjectByCode.get(subjectCode) || null
  const subsubject = knowledgeLookups.subsubjectByCode.get(subsubjectCode) || null
  const studentBundleVersionId = getActiveKnowledgeBundleVersionId('faq_aluno', foundation)
  const operatorBundleVersionId = getActiveKnowledgeBundleVersionId('orientacao_operacional', foundation)
  const studentNode =
    knowledgeLookups.studentNodesByKey.get(lookupKey) ||
    (collections.nodes || []).find(
      (node) =>
        node.bundleType === 'faq_aluno' &&
        node.bundleVersionId === studentBundleVersionId &&
        node.subjectCode === subjectCode,
    ) ||
    null
  const operatorNode =
    knowledgeLookups.operatorNodesByKey.get(lookupKey) ||
    (collections.nodes || []).find(
      (node) =>
        node.bundleType === 'orientacao_operacional' &&
        node.bundleVersionId === operatorBundleVersionId &&
        node.subjectCode === subjectCode,
    ) ||
    null

  return {
    subject,
    subsubject,
    studentNode,
    operatorNode,
    studentBundleVersionId,
    operatorBundleVersionId,
  }
}

export function buildInitialKnowledgeUsageRecords({
  caseId = '',
  themeKey = '',
  subsubjectKey = '',
  actorName = '',
  actorRole = '',
  usedAt = new Date().toISOString(),
  knowledgeFoundation = FOUNDATION,
} = {}) {
  const definition = findKnowledgeDefinitionBySubject(themeKey, subsubjectKey, knowledgeFoundation)
  const records = []

  if (definition.studentNode) {
    records.push({
      id: `knowledge-usage:${caseId}:faq_aluno:${usedAt}`,
      caseId,
      bundleType: 'faq_aluno',
      bundleVersionId: definition.studentBundleVersionId,
      knowledgeNodeId: definition.studentNode.id,
      displayedResponseSnapshot: definition.studentNode.responseText || '',
      studentGuidanceSnapshot: definition.studentNode.studentGuidance || definition.studentNode.responseText || '',
      operatorGuidanceSnapshot: '',
      areaGuidanceSnapshot: '',
      usedBy: actorName || 'Sistema',
      usedByRole: actorRole || 'sistema',
      usedAt,
    })
  }

  if (definition.operatorNode) {
    records.push({
      id: `knowledge-usage:${caseId}:orientacao_operacional:${usedAt}`,
      caseId,
      bundleType: 'orientacao_operacional',
      bundleVersionId: definition.operatorBundleVersionId,
      knowledgeNodeId: definition.operatorNode.id,
      displayedResponseSnapshot:
        definition.operatorNode.operatorGuidance || definition.operatorNode.responseText || '',
      studentGuidanceSnapshot: '',
      operatorGuidanceSnapshot:
        definition.operatorNode.operatorGuidance || definition.operatorNode.responseText || '',
      areaGuidanceSnapshot: definition.operatorNode.areaGuidance || '',
      usedBy: actorName || 'Sistema',
      usedByRole: actorRole || 'sistema',
      usedAt,
    })
  }

  return records
}

export function normalizePersistedAreaSubjectRule(rule = {}) {
  return normalizeAreaSubjectRule(rule)
}

export function normalizePersistedUserAvailability(record = {}) {
  return normalizeUserAvailability(record)
}

export function normalizePersistedKnowledgeSuggestion(record = {}) {
  return normalizeKnowledgeSuggestion(record)
}

export function getOperationalAreaTeam(areaLabel = '') {
  return [...(areaTeamCatalog[areaLabel] || [])]
}
