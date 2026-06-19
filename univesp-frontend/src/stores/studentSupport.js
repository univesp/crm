import { defineStore } from 'pinia'

import {
  buildStudentRequestGroups,
  buildSubmittedProtocol,
  buildAnalyticsEvent,
  buildFaqAttendanceContext,
  buildFaqAttendanceRecord,
  buildProtocolDraft,
  buildResolvedState,
  buildStudentFollowUpSubmission,
  validateProtocolDraft,
} from '@/services/studentSupportFlow'
import {
  buildCanonicalAssignmentRecord,
  buildCanonicalCaseEvent,
  buildCanonicalProtocolFromLocalProtocol,
  buildCanonicalProtocolFromSeed,
  buildCanonicalRoutingDecision,
  buildInitialKnowledgeUsageForProtocol,
  buildCanonicalSla,
  mapLegacyCaseStatusCode,
  resolvePendingParty,
} from '@/services/canonicalCaseRuntime'
import {
  buildSubjectCode,
  buildSubsubjectCode,
  CASE_ASSIGNMENT_STATUSES,
  KNOWLEDGE_BUNDLE_VERSION_STATUSES,
  cloneCanonicalFoundationSeeds,
  normalizePersistedAreaSubjectRule,
  normalizePersistedKnowledgeSuggestion,
  normalizePersistedUserAvailability,
} from '@/services/canonicalFoundationRuntime'
import { buildDistributionDecision } from '@/services/distributionEngine'
import {
  buildOperatorActionLog,
  buildOperatorCaseDetail,
  buildOperatorQueueEntries as buildOperatorQueueRuntime,
} from '@/services/operatorQueueRuntime'
import { buildOperatorAssistedCase } from '@/services/operatorIntakeRuntime'
import { buildAdminDashboardData } from '@/services/adminDashboardRuntime'
import {
  buildAreaActionLog,
  buildAreaCaseDetail,
  buildAreaQueueEntries as buildAreaQueueRuntime,
} from '@/services/areaQueueRuntime'
import {
  buildAreaKnowledgeRows,
  buildAreaManagerOverview,
  buildAreaSubjectGovernanceRows,
  cloneAreaGovernanceSeeds,
  getTeamMembersForArea,
} from '@/services/areaGovernanceRuntime'
import {
  buildOperationalOwnerIntegrity,
  resolveOperationalOwnerFromProtocol,
} from '@/services/operationalOwnershipRuntime'
import { buildOperationalOwnershipReferenceCatalog } from '@/services/operationalOwnershipReferences'
import { validateOperationalOwnershipEnvelope } from '@/contracts/operationalOwnershipContract'
import { OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS } from '@/contracts/operationalOwnershipBackendContract'
import {
  shouldSyncProtocolWithFrappe,
  submitStudentProtocolTicket,
} from '@/services/frappeClient'
import {
  DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
  auditLegacyOwnershipRecords,
  validateOperationalOwnershipForServer,
} from '@/services/operationalOwnershipServerRuntime'
import { areaActionSeeds, operatorAuditSeeds, operatorQueue, studentProtocols } from '../../mocks/operations'
import { mockAccessProfiles } from '../../mocks/mockAccessProfiles'

const STORAGE_KEY = 'univesp-student-support'

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function getLatestLog(logs = [], caseId = '') {
  return logs
    .filter((log) => log.caseId === caseId)
    .sort((left, right) => new Date(left.occurredAt || 0).getTime() - new Date(right.occurredAt || 0).getTime())
    .at(-1) || null
}

function sortByAssignedAtAsc(records = []) {
  return [...records].sort(
    (left, right) => new Date(left.assignedAt || 0).getTime() - new Date(right.assignedAt || 0).getTime(),
  )
}

function normalizeAreaLabel(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeSourceBindingText(value = '') {
  return String(value || '').trim()
}

function resolveProtocolSourceBinding(protocol = {}) {
  const contextFinalNode = protocol?.context?.finalNode || {}
  const fallbackProtocolRef = normalizeSourceBindingText(
    protocol.protocolNumber || protocol.id || protocol.sourceRecordId || '',
  )
  const fallbackThemeRef = normalizeSourceBindingText(
    protocol?.context?.theme || protocol?.context?.themeKey || protocol?.form?.theme || '',
  )
  const sourceBundleId = normalizeSourceBindingText(
    protocol.sourceBundleId ||
      contextFinalNode.bundleId ||
      contextFinalNode.bundle_id ||
      (fallbackThemeRef ? `legacy-bundle:${fallbackThemeRef}` : '') ||
      '',
  )
  const sourceBundleVersionId = normalizeSourceBindingText(
    protocol.sourceBundleVersionId ||
      contextFinalNode.bundleVersionId ||
      contextFinalNode.bundle_version_id ||
      contextFinalNode.bundle_version ||
      (sourceBundleId ? 'legacy' : '') ||
      '',
  )
  const sourceNodeId = normalizeSourceBindingText(
    protocol.sourceNodeId ||
      protocol.currentNodeId ||
      contextFinalNode.id ||
      contextFinalNode.node_id ||
      (fallbackProtocolRef ? `legacy-node:${fallbackProtocolRef}` : '') ||
      '',
  )
  const hasSourceBinding = Boolean(sourceBundleId && sourceNodeId)

  return {
    sourceBundleId,
    sourceBundleVersionId,
    sourceNodeId,
    hasSourceBinding,
    sourceBindingStateCode: hasSourceBinding ? 'source_binding_resolved' : 'source_binding_missing',
  }
}

function normalizeProtocolOwnershipPayload(protocol = {}, source = 'store_protocol') {
  if (!protocol || typeof protocol !== 'object') {
    return protocol
  }

  const ownershipSnapshot = resolveOperationalOwnerFromProtocol(
    {
      ...protocol,
      context: protocol.context || {},
    },
    {
      fallbackQueue: protocol.queueLabel || protocol.context?.routing?.currentQueueLabel || protocol.context?.queueDestination || '',
      fallbackArea:
        protocol.currentAreaLabel ||
        protocol.lastMileAreaLabel ||
        protocol.context?.routing?.targetAreaLabel ||
        '',
      source: protocol.ownerSource || protocol.context?.ownership?.source || source,
    },
  )
  const ownershipIntegrity = buildOperationalOwnerIntegrity(ownershipSnapshot)
  const sourceBinding = resolveProtocolSourceBinding(protocol)

  return {
    ...protocol,
    sourceBundleId: sourceBinding.sourceBundleId,
    sourceBundleVersionId: sourceBinding.sourceBundleVersionId,
    sourceNodeId: sourceBinding.sourceNodeId,
    hasSourceBinding: sourceBinding.hasSourceBinding,
    sourceBindingStateCode: sourceBinding.sourceBindingStateCode,
    ownerType: ownershipSnapshot.ownerType || '',
    ownerKey: ownershipSnapshot.ownerKey || '',
    ownerQueue: ownershipSnapshot.ownerQueue || '',
    ownerArea: ownershipSnapshot.ownerArea || '',
    ownerRole: ownershipSnapshot.ownerRole || '',
    ownerSource: ownershipSnapshot.source || source,
    ownerRoutingHint: ownershipSnapshot.routingHint || '',
    hasOperationalOwner: Boolean(ownershipSnapshot.hasOwner),
    ownershipStateCode: ownershipSnapshot.stateCode || '',
    ownershipIntegrityMessage: ownershipIntegrity.message || '',
    operationalOwnerSnapshot: { ...ownershipSnapshot },
    context: {
      ...(protocol.context || {}),
      ownership: {
        ...(protocol.context?.ownership || {}),
        ownerType: ownershipSnapshot.ownerType || '',
        ownerKey: ownershipSnapshot.ownerKey || '',
        queueKey: ownershipSnapshot.ownerQueue || '',
        areaLabel: ownershipSnapshot.ownerArea || '',
        roleKey: ownershipSnapshot.ownerRole || '',
        routingPolicy: ownershipSnapshot.routingHint || '',
        source: ownershipSnapshot.source || source,
        hasOwner: Boolean(ownershipSnapshot.hasOwner),
        stateCode: ownershipSnapshot.stateCode || '',
      },
    },
  }
}

function normalizeProtocolDraftOwnershipPayload(draft = {}) {
  if (!draft || typeof draft !== 'object') {
    return draft
  }

  const ownershipSnapshot = resolveOperationalOwnerFromProtocol(
    {
      context: draft.context || {},
      ownerType: draft.form?.ownerType || '',
      ownerKey: draft.form?.ownerKey || '',
      ownerQueue: draft.form?.ownerQueue || '',
      ownerArea: draft.form?.ownerArea || '',
      ownerRole: draft.form?.ownerRole || '',
      ownerRoutingHint: draft.form?.routingHint || '',
      ownerSource: draft.form?.ownerSource || draft.context?.ownership?.source || '',
    },
    {
      fallbackQueue: draft.form?.queueDestination || draft.context?.queueDestination || '',
      fallbackArea: draft.form?.routingArea || draft.context?.routing?.targetAreaLabel || '',
      source: draft.form?.ownerSource || draft.context?.ownership?.source || 'protocol_draft',
    },
  )
  const ownershipIntegrity = buildOperationalOwnerIntegrity(ownershipSnapshot)
  const sourceBinding = resolveProtocolSourceBinding({
    sourceBundleId: draft.form?.bundleId || '',
    sourceBundleVersionId: draft.form?.bundleVersionId || '',
    sourceNodeId: draft.form?.sourceNodeId || '',
    currentNodeId: draft.context?.finalNode?.id || '',
    context: draft.context || {},
  })

  return {
    ...draft,
    context: {
      ...(draft.context || {}),
      ownership: {
        ...(draft.context?.ownership || {}),
        ownerType: ownershipSnapshot.ownerType || '',
        ownerKey: ownershipSnapshot.ownerKey || '',
        queueKey: ownershipSnapshot.ownerQueue || '',
        areaLabel: ownershipSnapshot.ownerArea || '',
        roleKey: ownershipSnapshot.ownerRole || '',
        routingPolicy: ownershipSnapshot.routingHint || '',
        source: ownershipSnapshot.source || 'protocol_draft',
        hasOwner: Boolean(ownershipSnapshot.hasOwner),
        stateCode: ownershipSnapshot.stateCode || '',
      },
    },
    form: {
      ...(draft.form || {}),
      ownerType: ownershipSnapshot.ownerType || '',
      ownerKey: ownershipSnapshot.ownerKey || '',
      ownerQueue: ownershipSnapshot.ownerQueue || '',
      ownerArea: ownershipSnapshot.ownerArea || '',
      ownerRole: ownershipSnapshot.ownerRole || '',
      ownerSource: ownershipSnapshot.source || '',
      routingHint: ownershipSnapshot.routingHint || '',
      hasOperationalOwner: Boolean(ownershipSnapshot.hasOwner),
      ownershipStateCode: ownershipSnapshot.stateCode || '',
      ownershipIntegrityMessage: ownershipIntegrity.message || '',
      bundleId: sourceBinding.sourceBundleId,
      bundleVersionId: sourceBinding.sourceBundleVersionId,
      sourceNodeId: sourceBinding.sourceNodeId,
      hasSourceBinding: sourceBinding.hasSourceBinding,
      sourceBindingStateCode: sourceBinding.sourceBindingStateCode,
    },
  }
}

function deriveClosedBy({
  existingClosedBy = '',
  latestOperatorLog = null,
  latestAreaLog = null,
  statusCode = '',
  fallbackStatusLabel = '',
}) {
  if (latestAreaLog?.closedBy) {
    return latestAreaLog.closedBy
  }

  if (latestOperatorLog?.closedBy) {
    return latestOperatorLog.closedBy
  }

  if (latestAreaLog?.actionType === 'conclude') {
    return 'area'
  }

  if (latestOperatorLog?.actionType === 'reply') {
    return 'op'
  }

  if (existingClosedBy) {
    return existingClosedBy
  }

  const normalizedStatus = String(fallbackStatusLabel || '').trim().toLowerCase()

  if (normalizedStatus.includes('concluido pela area')) {
    return 'area'
  }

  if (normalizedStatus.includes('faq')) {
    return 'faq'
  }

  if (statusCode === 'resolved') {
    return 'op'
  }

  if (statusCode === 'closed') {
    return 'area'
  }

  return ''
}

function deriveCanonicalStatus({
  existingStatusCode = '',
  existingPendingParty = '',
  existingClosedBy = '',
  existingRoutingMode = '',
  latestOperatorLog = null,
  latestAreaLog = null,
  fallbackStatusLabel = '',
  fallbackPendingLabel = '',
}) {
  const derivedStatusCode = mapLegacyCaseStatusCode({
    statusLabel: latestAreaLog?.statusAfter || latestOperatorLog?.statusAfter || fallbackStatusLabel,
    pendingLabel: latestAreaLog?.pendingLabel || latestOperatorLog?.pendingLabel || fallbackPendingLabel,
    latestOperatorActionType: latestOperatorLog?.actionType,
    latestAreaActionType: latestAreaLog?.actionType,
  })

  const hasWorkflowSignal = Boolean(latestAreaLog || latestOperatorLog)
  const nextStatusCode =
    latestAreaLog?.canonicalStatusCode ||
    latestOperatorLog?.canonicalStatusCode ||
    derivedStatusCode ||
    existingStatusCode ||
    mapLegacyCaseStatusCode({
      statusCode: existingStatusCode,
      statusLabel: fallbackStatusLabel,
      pendingLabel: fallbackPendingLabel,
    })

  const nextPendingParty =
    latestAreaLog?.pendingParty ||
    latestOperatorLog?.pendingParty ||
    (hasWorkflowSignal
      ? resolvePendingParty({
          statusCode: nextStatusCode,
          latestOperatorActionType: latestOperatorLog?.actionType,
          latestAreaActionType: latestAreaLog?.actionType,
        })
      : existingPendingParty ||
        resolvePendingParty({
          statusCode: nextStatusCode,
          latestOperatorActionType: latestOperatorLog?.actionType,
          latestAreaActionType: latestAreaLog?.actionType,
        }))

  return {
    statusCode: nextStatusCode,
    pendingParty: nextPendingParty,
    closedBy: deriveClosedBy({
      existingClosedBy,
      latestOperatorLog,
      latestAreaLog,
      statusCode: nextStatusCode,
      fallbackStatusLabel,
    }),
    routingMode: latestAreaLog?.routingMode || latestOperatorLog?.routingMode || existingRoutingMode || 'standard',
  }
}

function completeMatchingAssignments(assignments = [], caseId = '', areaLabel = '') {
  return assignments.map((assignment) => {
    if (assignment.caseId !== caseId || assignment.statusCode === CASE_ASSIGNMENT_STATUSES.COMPLETED) {
      return assignment
    }

    if (areaLabel && normalizeAreaLabel(assignment.areaLabel) !== normalizeAreaLabel(areaLabel)) {
      return assignment
    }

    return {
      ...assignment,
      statusCode: CASE_ASSIGNMENT_STATUSES.COMPLETED,
    }
  })
}

function hasAreaTechnicalReply(areaLogs = [], caseId = '') {
  return areaLogs.some(
    (log) => log.caseId === caseId && String(log.actionType || '').trim() === 'technical_reply',
  )
}

function buildCanonicalProtocolsCollection({
  protocols = [],
  operatorProtocols = [],
  operatorActionLogs = [],
  areaActionLogs = [],
  knowledgeFoundation = null,
  currentDate = new Date(),
}) {
  const localProtocols = [...protocols, ...operatorProtocols].map((protocol) => {
    const base = buildCanonicalProtocolFromLocalProtocol(protocol, currentDate, knowledgeFoundation)
    const latestOperatorLog = getLatestLog(operatorActionLogs, base.id)
    const latestAreaLog = getLatestLog(areaActionLogs, base.id)
    const canonicalStatus = deriveCanonicalStatus({
      existingStatusCode: protocol.statusCode || base.statusCode,
      existingPendingParty: protocol.pendingParty || base.pendingParty,
      existingClosedBy: base.closedBy,
      existingRoutingMode: base.routingMode,
      latestOperatorLog,
      latestAreaLog,
      fallbackStatusLabel: latestAreaLog?.statusAfter || latestOperatorLog?.statusAfter || protocol.statusLabel,
      fallbackPendingLabel: latestAreaLog?.pendingLabel || latestOperatorLog?.pendingLabel || protocol.pendingLabel,
    })
    const nextStatusCode = canonicalStatus.statusCode
    const nextPendingParty = canonicalStatus.pendingParty
    const nextClosedBy = canonicalStatus.closedBy
    const nextRoutingMode = canonicalStatus.routingMode
    const resolvedAreaLabel =
      latestAreaLog?.resolvedAreaLabel ||
      latestAreaLog?.destinationLabel ||
      latestOperatorLog?.resolvedAreaLabel ||
      latestOperatorLog?.destinationLabel ||
      base.currentAreaLabel
    const nextSla = buildCanonicalSla({
      statusCode: nextStatusCode,
      createdAt: protocol.createdAt,
      slaPolicyCode: base.slaPolicyCode,
      currentDate,
      legacyLabel: protocol.slaLabel || base.slaLabel,
    })

    return {
      ...base,
      statusCode: nextStatusCode,
      pendingParty: nextPendingParty,
      latestOperatorActionType: latestOperatorLog?.actionType || '',
      latestAreaActionType: latestAreaLog?.actionType || '',
      queueLabel: latestAreaLog?.queueAfter || latestOperatorLog?.queueAfter || base.queueLabel,
      currentAreaLabel: resolvedAreaLabel,
      lastMileAreaLabel: resolvedAreaLabel || base.lastMileAreaLabel,
      routingMode: nextRoutingMode,
      exceptionReason:
        nextRoutingMode === 'manager_exception'
          ? latestAreaLog?.note || latestOperatorLog?.note || base.exceptionReason
          : base.exceptionReason,
      closedBy: nextClosedBy,
      slaDeadlineAt: nextSla.slaDeadlineAt,
      slaState: nextSla.slaState,
      slaMinutesRemaining: nextSla.slaMinutesRemaining,
      slaLabel: nextSla.slaLabel,
    }
  })

  const seedProtocols = operatorQueue.map((entry) => {
    const base = buildCanonicalProtocolFromSeed(entry, currentDate, knowledgeFoundation)
    const latestOperatorLog = getLatestLog(operatorActionLogs, base.id)
    const latestAreaLog = getLatestLog(areaActionLogs, base.id)
    const canonicalStatus = deriveCanonicalStatus({
      existingStatusCode: base.statusCode,
      existingPendingParty: base.pendingParty,
      existingClosedBy: base.closedBy,
      existingRoutingMode: base.routingMode,
      latestOperatorLog,
      latestAreaLog,
      fallbackStatusLabel: latestAreaLog?.statusAfter || latestOperatorLog?.statusAfter || entry.status,
      fallbackPendingLabel: latestAreaLog?.pendingLabel || latestOperatorLog?.pendingLabel || entry.pendingLabel,
    })
    const nextStatusCode = canonicalStatus.statusCode
    const nextPendingParty = canonicalStatus.pendingParty
    const nextClosedBy = canonicalStatus.closedBy
    const nextRoutingMode = canonicalStatus.routingMode
    const resolvedAreaLabel =
      latestAreaLog?.resolvedAreaLabel ||
      latestAreaLog?.destinationLabel ||
      latestOperatorLog?.resolvedAreaLabel ||
      latestOperatorLog?.destinationLabel ||
      base.currentAreaLabel
    const nextSla = buildCanonicalSla({
      statusCode: nextStatusCode,
      createdAt: entry.createdAt,
      slaPolicyCode: base.slaPolicyCode,
      currentDate,
      legacyLabel: entry.sla || base.slaLabel,
      preferLegacyLabel: true,
    })

    return {
      ...base,
      statusCode: nextStatusCode,
      pendingParty: nextPendingParty,
      latestOperatorActionType: latestOperatorLog?.actionType || '',
      latestAreaActionType: latestAreaLog?.actionType || '',
      queueLabel: latestAreaLog?.queueAfter || latestOperatorLog?.queueAfter || base.queueLabel,
      currentAreaLabel: resolvedAreaLabel,
      lastMileAreaLabel: resolvedAreaLabel || base.lastMileAreaLabel,
      routingMode: nextRoutingMode,
      exceptionReason:
        nextRoutingMode === 'manager_exception'
          ? latestAreaLog?.note || latestOperatorLog?.note || base.exceptionReason
          : base.exceptionReason,
      closedBy: nextClosedBy,
      slaDeadlineAt: nextSla.slaDeadlineAt,
      slaState: nextSla.slaState,
      slaMinutesRemaining: nextSla.slaMinutesRemaining,
      slaLabel: nextSla.slaLabel,
    }
  })

  return [...new Map([...seedProtocols, ...localProtocols].map((item) => [item.id, item])).values()]
}

function buildSeedKnowledgeUsageCollection(caseProtocols = [], knowledgeFoundation = null) {
  return caseProtocols.flatMap((protocol) =>
    buildInitialKnowledgeUsageForProtocol({
      protocolId: protocol.id,
      themeKey: protocol.themeKey,
      subsubjectKey: protocol.subsubjectKey,
      actorName: 'Sistema',
      actorRole: 'seed',
      usedAt: protocol.createdAt || new Date().toISOString(),
      knowledgeFoundation,
    }),
  )
}

function buildSeedRoutingDecisionCollection(caseProtocols = []) {
  return caseProtocols.map((protocol) =>
    buildCanonicalRoutingDecision({
      caseId: protocol.id,
      sourceNodeId: protocol.currentNodeId || '',
      defaultAreaLabel: protocol.lastMileAreaLabel || protocol.currentAreaLabel || '',
      resolvedAreaLabel: protocol.currentAreaLabel || protocol.lastMileAreaLabel || '',
      routingMode: protocol.routingMode || 'standard',
      justification: protocol.exceptionReason || 'Roteamento inicial derivado da base canonica do conhecimento.',
      decidedBy: 'Sistema',
      decidedAt: protocol.createdAt || new Date().toISOString(),
    }),
  )
}

function buildSeedCaseEventCollection(caseProtocols = [], operatorActionLogs = [], areaActionLogs = []) {
  const protocolEvents = caseProtocols.map((protocol) =>
    buildCanonicalCaseEvent({
      caseId: protocol.id,
      eventType: 'case_created',
      actor: 'Sistema',
      actorRole: 'seed',
      fromStatus: '',
      toStatus: protocol.statusCode,
      description: 'Protocolo carregado para a operacao a partir da base mockada canonica.',
      payload: {
        subjectCode: protocol.subjectCode,
        subsubjectCode: protocol.subsubjectCode,
        currentAreaLabel: protocol.currentAreaLabel,
      },
      createdAt: protocol.createdAt || new Date().toISOString(),
    }),
  )
  const operatorEvents = operatorActionLogs.map((log) =>
    buildCanonicalCaseEvent({
      caseId: log.caseId,
      eventType: `operator_${log.actionType}`,
      actor: log.actor || 'Operacao do polo',
      actorRole: 'op',
      fromStatus: log.statusBefore || '',
      toStatus: log.statusAfter || '',
      description: log.note || log.actionLabel || 'Acao operacional registrada.',
      payload: {
        queueBefore: log.queueBefore,
        queueAfter: log.queueAfter,
        destinationLabel: log.destinationLabel || log.queueAfter,
      },
      createdAt: log.occurredAt || new Date().toISOString(),
    }),
  )
  const areaEvents = areaActionLogs.map((log) =>
    buildCanonicalCaseEvent({
      caseId: log.caseId,
      eventType: `area_${log.actionType}`,
      actor: log.actor || 'Area interna',
      actorRole: 'area',
      fromStatus: log.statusBefore || '',
      toStatus: log.statusAfter || '',
      description: log.note || log.actionLabel || 'Acao da area registrada.',
      payload: {
        queueBefore: log.queueBefore,
        queueAfter: log.queueAfter,
        destinationLabel: log.destinationLabel || log.queueAfter,
        routingMode: log.routingMode || 'standard',
      },
      createdAt: log.occurredAt || new Date().toISOString(),
    }),
  )

  return [...protocolEvents, ...operatorEvents, ...areaEvents]
}

function normalizePersistedAssignment(record = {}) {
  const payload = buildCanonicalAssignmentRecord({
    caseId: record.caseId,
    areaLabel: record.areaLabel,
    analystName: record.analystName,
    assignedBy: record.assignedBy || 'Gestao da area',
    assignedAt: record.assignedAt || new Date().toISOString(),
    reason: record.reason || 'Redistribuicao gerencial.',
    assignmentMode: record.assignmentMode || 'manager_manual',
    assignmentStatusCode: record.statusCode || '',
    scoreSummary: record.scoreSummary || null,
  })

  return {
    ...payload,
    id: record.id || payload.id,
    assignedAtLabel: record.assignedAtLabel || payload.assignedAtLabel,
  }
}

function normalizePersistedState(rawState) {
  const canonicalSeeds = cloneCanonicalFoundationSeeds()
  const governanceSeeds = cloneAreaGovernanceSeeds()
  const mergedState = {
    ...defaultState(),
    ...cloneJson(rawState || {}),
  }

  return {
    ...mergedState,
    protocolDraft: normalizeProtocolDraftOwnershipPayload(mergedState.protocolDraft),
    protocols: (mergedState.protocols || []).map((protocol) =>
      normalizeProtocolOwnershipPayload(protocol, 'persisted_protocol'),
    ),
    operatorProtocols: (mergedState.operatorProtocols || []).map((protocol) =>
      normalizeProtocolOwnershipPayload(protocol, 'persisted_operator_protocol'),
    ),
    areaSubjectRules: (mergedState.areaSubjectRules || canonicalSeeds.areaSubjectEligibility || []).map(
      normalizePersistedAreaSubjectRule,
    ),
    areaCaseAssignments: (mergedState.areaCaseAssignments || governanceSeeds.areaCaseAssignments || []).map(
      normalizePersistedAssignment,
    ),
    knowledgeSuggestions: (mergedState.knowledgeSuggestions || canonicalSeeds.knowledgeSuggestions || []).map(
      normalizePersistedKnowledgeSuggestion,
    ),
    knowledgeSuggestionReviews: mergedState.knowledgeSuggestionReviews || canonicalSeeds.knowledgeSuggestionReviews,
    knowledgeSubjects: mergedState.knowledgeSubjects || canonicalSeeds.knowledgeSubjects,
    knowledgeSubsubjects: mergedState.knowledgeSubsubjects || canonicalSeeds.knowledgeSubsubjects,
    knowledgeNodes: mergedState.knowledgeNodes || canonicalSeeds.knowledgeNodes,
    knowledgeNodeLinks: mergedState.knowledgeNodeLinks || canonicalSeeds.knowledgeNodeLinks,
    knowledgeBundleVersions: mergedState.knowledgeBundleVersions || canonicalSeeds.knowledgeBundleVersions,
    knowledgePublications: mergedState.knowledgePublications || canonicalSeeds.knowledgePublications,
    operationalAreas: mergedState.operationalAreas || canonicalSeeds.operationalAreas,
    userAvailability: (mergedState.userAvailability || canonicalSeeds.userAvailability || []).map(
      normalizePersistedUserAvailability,
    ),
    caseKnowledgeUsages: mergedState.caseKnowledgeUsages || [],
    caseRoutingDecisions: mergedState.caseRoutingDecisions || [],
    caseEvents: mergedState.caseEvents || [],
  }
}

function defaultState() {
  const governanceSeeds = cloneAreaGovernanceSeeds()
  const canonicalSeeds = cloneCanonicalFoundationSeeds()

  return {
    activeFaqSessionId: null,
    currentFaqContext: null,
    resolvedState: null,
    protocolDraft: null,
    records: [],
    protocols: [],
    operatorProtocols: [],
    analyticsEvents: [],
    operatorActionLogs: [],
    areaActionLogs: [],
    areaSubjectRules: canonicalSeeds.areaSubjectEligibility.map((item) => ({ ...item })),
    areaCaseAssignments: governanceSeeds.areaCaseAssignments.map(normalizePersistedAssignment),
    knowledgeSuggestions: canonicalSeeds.knowledgeSuggestions,
    knowledgeSuggestionReviews: canonicalSeeds.knowledgeSuggestionReviews,
    knowledgeSubjects: canonicalSeeds.knowledgeSubjects,
    knowledgeSubsubjects: canonicalSeeds.knowledgeSubsubjects,
    knowledgeNodes: canonicalSeeds.knowledgeNodes,
    knowledgeNodeLinks: canonicalSeeds.knowledgeNodeLinks,
    knowledgeBundleVersions: canonicalSeeds.knowledgeBundleVersions,
    knowledgePublications: canonicalSeeds.knowledgePublications,
    operationalAreas: canonicalSeeds.operationalAreas,
    userAvailability: canonicalSeeds.userAvailability,
    caseKnowledgeUsages: [],
    caseRoutingDecisions: [],
    caseEvents: [],
  }
}

function loadPersistedState() {
  if (typeof window === 'undefined') {
    return defaultState()
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)

    if (!rawValue) {
      return defaultState()
    }

    return normalizePersistedState(JSON.parse(rawValue))
  } catch {
    return defaultState()
  }
}

function nextSessionId(currentDate = new Date()) {
  const compact = String(currentDate.getTime())
  return `faq-session-${compact}`
}

function resolveOwnershipReferenceCatalog(state = {}) {
  return buildOperationalOwnershipReferenceCatalog({
    operationalAreas: state?.operationalAreas || [],
    profiles: mockAccessProfiles,
  })
}

function resolveOwnershipServerValidation({
  state = {},
  payload = {},
  endpoint = OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE,
  requireSourceBinding = true,
  requireBundleVersion = true,
  legacyPolicy = DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
} = {}) {
  return validateOperationalOwnershipForServer(payload, {
    endpoint,
    references: resolveOwnershipReferenceCatalog(state),
    requireSourceBinding,
    requireBundleVersion,
    enforceReferences: true,
    legacyPolicy,
  })
}

export const useStudentSupportStore = defineStore('studentSupport', {
  state: () => loadPersistedState(),
  getters: {
    mergedOperatorActionLogs(state) {
      return [...operatorAuditSeeds, ...state.operatorActionLogs]
    },
    mergedAreaActionLogs(state) {
      return [...areaActionSeeds, ...state.areaActionLogs]
    },
    latestRecord(state) {
      return state.records[0] || null
    },
    latestProtocol(state) {
      return state.protocols[0] || null
    },
    latestOperatorProtocol(state) {
      return state.operatorProtocols[0] || null
    },
    latestOperatorAction(state) {
      return state.operatorActionLogs[state.operatorActionLogs.length - 1] || null
    },
    latestAreaAction(state) {
      return state.areaActionLogs[state.areaActionLogs.length - 1] || null
    },
    ownershipLegacyAudit(state) {
      return auditLegacyOwnershipRecords(
        [...(state.protocols || []), ...(state.operatorProtocols || [])],
        {
          references: resolveOwnershipReferenceCatalog(state),
          legacyPolicy: DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
        },
      )
    },
    areaTeamMembers() {
      return (areaLabel = '') => {
        const area = (this.operationalAreas || []).find(
          (item) => item.areaLabel === areaLabel,
        )

        return area?.teamMembers?.length ? [...area.teamMembers] : getTeamMembersForArea(areaLabel)
      }
    },
    canonicalCaseProtocols(state) {
      return buildCanonicalProtocolsCollection({
        protocols: state.protocols,
        operatorProtocols: state.operatorProtocols,
        operatorActionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
        areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
        knowledgeFoundation: this.knowledgeFoundation,
      })
    },
    mergedCaseKnowledgeUsages(state) {
      const seedRecords = buildSeedKnowledgeUsageCollection(this.canonicalCaseProtocols, this.knowledgeFoundation)
      const merged = new Map()

      for (const record of [...seedRecords, ...state.caseKnowledgeUsages]) {
        merged.set(record.id, record)
      }

      return [...merged.values()].sort(
        (left, right) => new Date(left.usedAt || 0).getTime() - new Date(right.usedAt || 0).getTime(),
      )
    },
    mergedCaseRoutingDecisions(state) {
      const seedRecords = buildSeedRoutingDecisionCollection(this.canonicalCaseProtocols)
      return [...new Map([...seedRecords, ...state.caseRoutingDecisions].map((record) => [record.id, record])).values()]
    },
    mergedCaseEvents(state) {
      const seedRecords = buildSeedCaseEventCollection(
        this.canonicalCaseProtocols,
        [...operatorAuditSeeds, ...state.operatorActionLogs],
        [...areaActionSeeds, ...state.areaActionLogs],
      )
      return [...new Map([...seedRecords, ...state.caseEvents].map((record) => [record.id, record])).values()]
    },
    operationalAreaCatalog(state) {
      return [...state.operationalAreas]
    },
    canonicalCaseAssignments(state) {
      return sortByAssignedAtAsc(state.areaCaseAssignments)
    },
    areaSubjectEligibilityRules(state) {
      return [...state.areaSubjectRules]
    },
    userAvailabilityCatalog(state) {
      return [...state.userAvailability]
    },
    knowledgeFoundation(state) {
      return {
        subjects: [...state.knowledgeSubjects],
        subsubjects: [...state.knowledgeSubsubjects],
        nodes: [...state.knowledgeNodes],
        nodeLinks: [...state.knowledgeNodeLinks],
        bundleVersions: [...state.knowledgeBundleVersions],
        publications: [...state.knowledgePublications],
        suggestions: [...state.knowledgeSuggestions],
        suggestionReviews: [...state.knowledgeSuggestionReviews],
      }
    },
    protocolValidation(state) {
      return validateProtocolDraft(state.protocolDraft)
    },
    requestGroups(state) {
      return buildStudentRequestGroups({
        records: state.records,
        protocols: state.protocols,
        protocolDraft: state.protocolDraft,
        seededProtocols: studentProtocols,
      })
    },
    operatorQueueEntries(state) {
      return (viewerContext = null) =>
        buildOperatorQueueRuntime({
          protocols: [...state.protocols, ...state.operatorProtocols],
          actionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
          areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
          canonicalCaseProtocols: this.canonicalCaseProtocols,
          caseKnowledgeUsages: this.mergedCaseKnowledgeUsages,
          viewerContext,
        })
    },
    operatorCaseById(state) {
      return (caseId, viewerContext = null) =>
        buildOperatorCaseDetail({
          caseId,
          protocols: [...state.protocols, ...state.operatorProtocols],
          records: state.records,
          actionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
          areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
          canonicalCaseProtocols: this.canonicalCaseProtocols,
          caseKnowledgeUsages: this.mergedCaseKnowledgeUsages,
          caseRoutingDecisions: this.mergedCaseRoutingDecisions,
          caseEvents: this.mergedCaseEvents,
          viewerContext,
        })
    },
    areaQueueEntries(state) {
      return (viewerContext = null) =>
        buildAreaQueueRuntime({
          protocols: [...state.protocols, ...state.operatorProtocols],
          records: state.records,
          operatorActionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
          areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
          subjectRules: state.areaSubjectRules,
          assignments: this.canonicalCaseAssignments,
          userAvailability: state.userAvailability,
          operationalAreas: state.operationalAreas,
          canonicalCaseProtocols: this.canonicalCaseProtocols,
          viewerContext,
        })
    },
    areaCaseById(state) {
      return (caseId, viewerContext = null) =>
        buildAreaCaseDetail({
          caseId,
          protocols: [...state.protocols, ...state.operatorProtocols],
          records: state.records,
          operatorActionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
          areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
          subjectRules: state.areaSubjectRules,
          assignments: this.canonicalCaseAssignments,
          userAvailability: state.userAvailability,
          operationalAreas: state.operationalAreas,
          canonicalCaseProtocols: this.canonicalCaseProtocols,
          caseKnowledgeUsages: this.mergedCaseKnowledgeUsages,
          caseRoutingDecisions: this.mergedCaseRoutingDecisions,
          caseEvents: this.mergedCaseEvents,
          viewerContext,
        })
    },
    areaManagerOverview(state) {
      return (viewerContext = null) =>
        buildAreaManagerOverview({
          entries: buildAreaQueueRuntime({
            protocols: [...state.protocols, ...state.operatorProtocols],
            records: state.records,
            operatorActionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
            areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
            subjectRules: state.areaSubjectRules,
            assignments: this.canonicalCaseAssignments,
            userAvailability: state.userAvailability,
            operationalAreas: state.operationalAreas,
            canonicalCaseProtocols: this.canonicalCaseProtocols,
            viewerContext,
          }),
          assignments: this.canonicalCaseAssignments,
          suggestions: state.knowledgeSuggestions,
          rules: state.areaSubjectRules,
          userAvailability: state.userAvailability,
          viewerContext,
        })
    },
    areaGovernanceRows(state) {
      return (viewerContext = null) =>
        buildAreaSubjectGovernanceRows(
          buildAreaQueueRuntime({
            protocols: [...state.protocols, ...state.operatorProtocols],
            records: state.records,
            operatorActionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
            areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
            subjectRules: state.areaSubjectRules,
            assignments: this.canonicalCaseAssignments,
            userAvailability: state.userAvailability,
            operationalAreas: state.operationalAreas,
            canonicalCaseProtocols: this.canonicalCaseProtocols,
            viewerContext: viewerContext && viewerContext.profileKey === 'gestor_area' ? viewerContext : null,
          }),
          state.areaSubjectRules,
          viewerContext?.currentArea,
        )
    },
    areaKnowledgeRows(state) {
      return (viewerContext = null) =>
        buildAreaKnowledgeRows(
          buildAreaQueueRuntime({
            protocols: [...state.protocols, ...state.operatorProtocols],
            records: state.records,
            operatorActionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
            areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
            subjectRules: state.areaSubjectRules,
            assignments: this.canonicalCaseAssignments,
            userAvailability: state.userAvailability,
            operationalAreas: state.operationalAreas,
            canonicalCaseProtocols: this.canonicalCaseProtocols,
            viewerContext,
          }),
          state.knowledgeSuggestions,
          viewerContext?.currentArea,
        )
    },
    adminDashboardData(state) {
      return (viewerContext = null) =>
        buildAdminDashboardData({
          protocols: [...state.protocols, ...state.operatorProtocols],
          records: state.records,
          actionLogs: [...operatorAuditSeeds, ...state.operatorActionLogs],
          areaActionLogs: [...areaActionSeeds, ...state.areaActionLogs],
          viewerContext,
        })
    },
  },
  actions: {
    persistState() {
      if (typeof window === 'undefined') {
        return
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeFaqSessionId: this.activeFaqSessionId,
          currentFaqContext: this.currentFaqContext,
          resolvedState: this.resolvedState,
          protocolDraft: this.protocolDraft,
          records: this.records,
          protocols: this.protocols,
          operatorProtocols: this.operatorProtocols,
          analyticsEvents: this.analyticsEvents,
          operatorActionLogs: this.operatorActionLogs,
          areaActionLogs: this.areaActionLogs,
          areaSubjectRules: this.areaSubjectRules,
          areaCaseAssignments: this.areaCaseAssignments,
          knowledgeSuggestions: this.knowledgeSuggestions,
          knowledgeSuggestionReviews: this.knowledgeSuggestionReviews,
          knowledgeSubjects: this.knowledgeSubjects,
          knowledgeSubsubjects: this.knowledgeSubsubjects,
          knowledgeNodes: this.knowledgeNodes,
          knowledgeNodeLinks: this.knowledgeNodeLinks,
          knowledgeBundleVersions: this.knowledgeBundleVersions,
          knowledgePublications: this.knowledgePublications,
          operationalAreas: this.operationalAreas,
          userAvailability: this.userAvailability,
          caseKnowledgeUsages: this.caseKnowledgeUsages,
          caseRoutingDecisions: this.caseRoutingDecisions,
          caseEvents: this.caseEvents,
        }),
      )
    },
    appendCaseKnowledgeUsage(records = []) {
      if (!Array.isArray(records) || !records.length) {
        return
      }

      const nextRecords = [...this.caseKnowledgeUsages]

      for (const record of records) {
        const existingIndex = nextRecords.findIndex((item) => item.id === record.id)

        if (existingIndex >= 0) {
          nextRecords[existingIndex] = record
        } else {
          nextRecords.push(record)
        }
      }

      this.caseKnowledgeUsages = nextRecords
    },
    appendCaseRoutingDecision(record = null) {
      if (!record) {
        return
      }

      this.caseRoutingDecisions = [...this.caseRoutingDecisions, record]
    },
    appendCaseEvent(record = null) {
      if (!record) {
        return
      }

      this.caseEvents = [...this.caseEvents, record]
    },
    applyAutomaticAreaAssignment({
      caseId,
      areaLabel = '',
      actorName = '',
      currentDate = new Date(),
    }) {
      const caseProtocol = this.canonicalCaseProtocols.find((item) => item.id === caseId)

      if (!caseProtocol) {
        return null
      }

      const decision = buildDistributionDecision({
        caseProtocol: {
          ...caseProtocol,
          currentAreaLabel: areaLabel || caseProtocol.currentAreaLabel,
          lastMileAreaLabel: areaLabel || caseProtocol.lastMileAreaLabel,
        },
        operationalAreas: this.operationalAreas,
        areaSubjectEligibility: this.areaSubjectRules,
        userAvailability: this.userAvailability,
        caseAssignments: this.areaCaseAssignments,
        caseProtocols: this.canonicalCaseProtocols,
        currentDate,
      })

      const currentAreaLabel = areaLabel || caseProtocol.currentAreaLabel
      const existingAssignment =
        sortByAssignedAtAsc(this.areaCaseAssignments)
          .filter(
            (assignment) =>
              assignment.caseId === caseId &&
              normalizeAreaLabel(assignment.areaLabel) === normalizeAreaLabel(currentAreaLabel) &&
              assignment.statusCode !== CASE_ASSIGNMENT_STATUSES.COMPLETED,
          )
          .at(-1) || null
      const assignment = buildCanonicalAssignmentRecord({
        caseId,
        areaLabel: currentAreaLabel,
        analystName: decision.analystName,
        assignedBy: actorName || 'Sistema',
        assignedAt: currentDate.toISOString(),
        reason: decision.reason,
        assignmentMode: decision.assignmentMode,
        assignmentStatusCode: decision.assignmentStatusCode,
        previousAssignment: existingAssignment,
        scoreSummary: decision.scoreSummary,
      })

      this.areaCaseAssignments = [
        ...completeMatchingAssignments(this.areaCaseAssignments, caseId, currentAreaLabel),
        assignment,
      ]

      this.appendCaseEvent(
        buildCanonicalCaseEvent({
          caseId,
          eventType:
            decision.assignmentStatusCode === CASE_ASSIGNMENT_STATUSES.UNASSIGNED_EXCEPTION
              ? 'assignment_unassigned_exception'
              : existingAssignment
                ? 'assignment_auto_reassigned'
                : 'assignment_auto_created',
          actor: actorName || 'Sistema',
          actorRole: 'system',
          fromStatus: existingAssignment?.statusCode || '',
          toStatus: assignment.statusCode,
          description: decision.reason,
          payload: {
            areaLabel: currentAreaLabel,
            analystName: decision.analystName || '',
            assignmentMode: decision.assignmentMode,
            scoreSummary: decision.scoreSummary,
          },
          createdAt: currentDate.toISOString(),
        }),
      )

      return assignment
    },
    appendAnalytics(name, context, currentDate = new Date()) {
      this.analyticsEvents = [
        buildAnalyticsEvent({
          name,
          context,
          currentDate,
        }),
        ...this.analyticsEvents,
      ]
    },
    ensureFaqSession(currentDate = new Date()) {
      if (!this.activeFaqSessionId) {
        this.activeFaqSessionId = nextSessionId(currentDate)
        return true
      }

      return false
    },
    setFaqContext({ node, lineage, currentDate = new Date() }) {
      const startedNow = this.ensureFaqSession(currentDate)

      const context = buildFaqAttendanceContext({
        node,
        lineage,
        sessionId: this.activeFaqSessionId,
        currentDate,
      })

      this.currentFaqContext = context
      this.resolvedState = null

      if (startedNow) {
        this.appendAnalytics('faq_started', context, currentDate)
      }

      this.appendAnalytics('faq_node_opened', context, currentDate)
      this.persistState()

      return context
    },
    resolveFaq({ node, lineage, currentDate = new Date() }) {
      const context = this.setFaqContext({
        node,
        lineage,
        currentDate,
      })
      const record = buildFaqAttendanceRecord({
        context,
        outcome: 'resolved_by_faq',
        currentDate,
      })

      this.records = [record, ...this.records]
      this.resolvedState = buildResolvedState(record)
      this.protocolDraft = null
      this.appendAnalytics('faq_resolved', context, currentDate)
      this.persistState()

      return record
    },
    startProtocolFromFaq({ node, lineage, currentDate = new Date() }) {
      const context = this.setFaqContext({
        node,
        lineage,
        currentDate,
      })
      const rawDraft = buildProtocolDraft({
        context,
        sourceRecordId: '',
        currentDate,
      })
      const draft = normalizeProtocolDraftOwnershipPayload(rawDraft)
      const ownershipSnapshot = resolveOperationalOwnerFromProtocol({
        context: draft?.context || {},
        ownerType: draft?.form?.ownerType || '',
        ownerKey: draft?.form?.ownerKey || '',
        ownerQueue: draft?.form?.ownerQueue || '',
        ownerArea: draft?.form?.ownerArea || '',
        ownerRole: draft?.form?.ownerRole || '',
        ownerRoutingHint: draft?.form?.routingHint || '',
        ownerSource: draft?.form?.ownerSource || '',
      })
      const ownershipIntegrity = buildOperationalOwnerIntegrity(ownershipSnapshot)
      const ownershipEnvelope = validateOperationalOwnershipEnvelope(
        {
          ownerType: ownershipSnapshot.ownerType || '',
          ownerKey: ownershipSnapshot.ownerKey || '',
          ownerQueue: ownershipSnapshot.ownerQueue || '',
          ownerArea: ownershipSnapshot.ownerArea || '',
          ownerRole: ownershipSnapshot.ownerRole || '',
          hasOperationalOwner: Boolean(ownershipSnapshot.hasOwner),
          ownershipStateCode: ownershipSnapshot.stateCode || '',
          sourceBundleId: draft?.form?.bundleId || '',
          sourceBundleVersionId: draft?.form?.bundleVersionId || '',
          sourceNodeId: draft?.form?.sourceNodeId || '',
        },
        {
          requireSourceBinding: true,
          requireBundleVersion: true,
          enforceReferences: true,
          references: resolveOwnershipReferenceCatalog(this),
        },
      )
      const ownershipServerValidation = resolveOwnershipServerValidation({
        state: this,
        payload: {
          ownerType: ownershipSnapshot.ownerType || '',
          ownerKey: ownershipSnapshot.ownerKey || '',
          ownerQueue: ownershipSnapshot.ownerQueue || '',
          ownerArea: ownershipSnapshot.ownerArea || '',
          ownerRole: ownershipSnapshot.ownerRole || '',
          ownerSource: ownershipSnapshot.source || '',
          ownershipStateCode: ownershipSnapshot.stateCode || '',
          hasOperationalOwner: Boolean(ownershipSnapshot.hasOwner),
          sourceBundleId: draft?.form?.bundleId || '',
          sourceBundleVersionId: draft?.form?.bundleVersionId || '',
          sourceNodeId: draft?.form?.sourceNodeId || '',
          operationalOwnerSnapshot: { ...ownershipSnapshot },
        },
        endpoint: OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.DRAFT_CREATE,
        requireSourceBinding: true,
        requireBundleVersion: true,
        legacyPolicy: {
          ...DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
          allowLegacyWrite: false,
          allowLegacyFollowUpWrite: false,
          allowFallbackOwnerWrite: false,
          allowLegacySourceBindingWrite: false,
        },
      })

      if (!ownershipIntegrity.ok || !ownershipEnvelope.ok || !ownershipServerValidation.ok) {
        this.protocolDraft = null
        this.resolvedState = null
        this.appendAnalytics('protocol_start_blocked_missing_owner', context, currentDate)
        this.persistState()
        return null
      }

      const record = buildFaqAttendanceRecord({
        context,
        outcome: 'faq_not_resolved',
        currentDate,
      })
      const finalDraft = {
        ...draft,
        sourceRecordId: record.id,
      }

      this.records = [record, ...this.records]
      this.protocolDraft = finalDraft
      this.resolvedState = null
      this.appendAnalytics('faq_not_resolved', context, currentDate)
      this.appendAnalytics('protocol_started', context, currentDate)
      this.persistState()

      return finalDraft
    },
    async submitProtocol(currentDate = new Date()) {
      const validation = validateProtocolDraft(this.protocolDraft)

      if (!validation.isValid || !this.protocolDraft) {
        return {
          ok: false,
          validation,
        }
      }

      const protocol = normalizeProtocolOwnershipPayload(
        buildSubmittedProtocol({
          draft: this.protocolDraft,
          currentDate,
        }),
        'submitted_protocol',
      )
      const ownershipIntegrity = buildOperationalOwnerIntegrity(
        protocol.operationalOwnerSnapshot || {
          ownerType: protocol.ownerType || '',
          ownerKey: protocol.ownerKey || '',
          ownerQueue: protocol.ownerQueue || '',
          ownerArea: protocol.ownerArea || '',
          ownerRole: protocol.ownerRole || '',
          source: protocol.ownerSource || '',
          routingHint: protocol.ownerRoutingHint || '',
          hasOwner: protocol.hasOperationalOwner,
          stateCode: protocol.ownershipStateCode || '',
        },
      )
      const ownershipEnvelope = validateOperationalOwnershipEnvelope(
        protocol,
        {
          requireSourceBinding: true,
          requireBundleVersion: true,
          enforceReferences: true,
          references: resolveOwnershipReferenceCatalog(this),
        },
      )
      const ownershipServerValidation = resolveOwnershipServerValidation({
        state: this,
        payload: protocol,
        endpoint: OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE,
        requireSourceBinding: true,
        requireBundleVersion: true,
        legacyPolicy: {
          ...DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
          allowLegacyWrite: false,
          allowLegacyFollowUpWrite: false,
          allowFallbackOwnerWrite: false,
          allowLegacySourceBindingWrite: false,
        },
      })

      if (!ownershipIntegrity.ok || !ownershipEnvelope.ok || !ownershipServerValidation.ok) {
        const serverMessage = ownershipServerValidation.primaryError?.userMessage || ''
        return {
          ok: false,
          validation: {
            ...validation,
            isValid: false,
            errors: {
              ...(validation.errors || {}),
              form:
                serverMessage ||
                ownershipIntegrity.message ||
                ownershipEnvelope.message ||
                'Nao foi possivel enviar porque o protocolo esta sem dono operacional efetivo.',
            },
          },
          backendValidation: ownershipServerValidation,
        }
      }

      let protocolToPersist = protocol
      let remoteTicket = null

      if (shouldSyncProtocolWithFrappe()) {
        try {
          remoteTicket = await submitStudentProtocolTicket(protocol)
          protocolToPersist = {
            ...protocol,
            remoteSyncStatus: 'synced',
            remoteDoctype: import.meta.env.VITE_FRAPPE_TICKET_DOCTYPE || 'Issue',
            remoteDocumentName: remoteTicket?.name || '',
            remoteDocument: remoteTicket || null,
          }
        } catch (error) {
          return {
            ok: false,
            validation: {
              ...validation,
              isValid: false,
              errors: {
                ...(validation.errors || {}),
                form:
                  error?.message ||
                  'Nao foi possivel registrar a solicitacao no Frappe. Tente novamente em instantes.',
              },
            },
            remoteSyncStatus: 'failed',
            remoteError: error,
          }
        }
      }

      this.protocols = [protocolToPersist, ...this.protocols]
      this.appendCaseKnowledgeUsage(
        buildInitialKnowledgeUsageForProtocol({
          protocolId: protocolToPersist.protocolNumber,
          themeKey: protocolToPersist.context?.theme,
          subsubjectKey: protocolToPersist.context?.subtheme || protocolToPersist.context?.finalNode?.title,
          actorName: 'Aluno',
          actorRole: 'student',
          usedAt: protocolToPersist.createdAt,
          knowledgeFoundation: this.knowledgeFoundation,
        }),
      )
      this.appendCaseRoutingDecision(
        buildCanonicalRoutingDecision({
          caseId: protocolToPersist.protocolNumber,
          sourceNodeId: protocolToPersist.context?.finalNode?.id || '',
          defaultAreaLabel:
            protocolToPersist.ownerArea ||
            protocolToPersist.lastMileAreaLabel ||
            protocolToPersist.context?.routing?.targetAreaLabel ||
            protocolToPersist.ownerQueue ||
            '',
          resolvedAreaLabel:
            protocolToPersist.ownerArea ||
            protocolToPersist.lastMileAreaLabel ||
            protocolToPersist.context?.routing?.targetAreaLabel ||
            protocolToPersist.ownerQueue ||
            '',
          routingMode: 'standard',
          justification:
            protocolToPersist.context?.routing?.assignmentRuleLabel ||
            'Roteamento inicial pelo conhecimento vigente.',
          decidedBy: 'Aluno',
          decidedAt: protocolToPersist.createdAt,
        }),
      )
      this.appendCaseEvent(
        buildCanonicalCaseEvent({
          caseId: protocolToPersist.protocolNumber,
          eventType: 'case_submitted',
          actor: 'Aluno',
          actorRole: 'student',
          fromStatus: '',
          toStatus: mapLegacyCaseStatusCode({
            statusCode: protocolToPersist.statusCode,
            statusLabel: protocolToPersist.statusLabel,
            pendingLabel: protocolToPersist.pendingLabel,
          }),
          description: 'Protocolo enviado a partir da FAQ com snapshots de conhecimento registrados.',
          payload: {
            subjectCode: buildSubjectCode(protocolToPersist.context?.theme),
            subsubjectCode: buildSubsubjectCode(
              protocolToPersist.context?.theme,
              protocolToPersist.context?.subtheme || protocolToPersist.context?.finalNode?.title,
            ),
            queueLabel: protocolToPersist.queueLabel,
            lastMileAreaLabel: protocolToPersist.lastMileAreaLabel,
            ownerType: protocolToPersist.ownerType || '',
            ownerKey: protocolToPersist.ownerKey || '',
            ownerQueue: protocolToPersist.ownerQueue || '',
            ownerArea: protocolToPersist.ownerArea || '',
            remoteDoctype: protocolToPersist.remoteDoctype || '',
            remoteDocumentName: protocolToPersist.remoteDocumentName || '',
          },
          createdAt: protocolToPersist.createdAt,
        }),
      )
      this.records = this.records.map((record) =>
        record.id === this.protocolDraft.sourceRecordId
          ? {
              ...record,
              pendingLabel: `Protocolo ${protocolToPersist.protocolNumber} enviado para continuidade`,
            }
          : record,
      )
      this.appendAnalytics('protocol_submitted', protocolToPersist.context, currentDate)
      this.protocolDraft = null
      this.persistState()

      return {
        ok: true,
        protocol: protocolToPersist,
        remoteTicket,
        validation,
      }
    },
    updateProtocolField(field, value) {
      if (!this.protocolDraft) {
        return
      }

      this.protocolDraft = {
        ...this.protocolDraft,
        form: {
          ...this.protocolDraft.form,
          [field]: value,
        },
      }
      this.persistState()
    },
    setProtocolAttachments(attachments) {
      this.updateProtocolField('attachments', attachments)
    },
    resetFaqExperience() {
      this.activeFaqSessionId = null
      this.currentFaqContext = null
      this.resolvedState = null
      this.persistState()
    },
    findLocalProtocolById(protocolId) {
      return this.protocols.find((protocol) => protocol.protocolNumber === protocolId) || null
    },
    createOperatorAssistedCase({
      studentData,
      context,
      verifiedSummary = '',
      contactChannel = 'telefone',
      actorName = '',
      actionType = 'open_case',
      playbook = null,
      currentDate = new Date(),
    }) {
      const createdCase = buildOperatorAssistedCase({
        studentData,
        context,
        verifiedSummary,
        contactChannel,
        actorName,
        currentDate,
      })
      const ownershipIntegrity = buildOperationalOwnerIntegrity(
        createdCase?.operationalOwnerSnapshot || {
          ownerType: createdCase?.ownerType || '',
          ownerKey: createdCase?.ownerKey || '',
          ownerQueue: createdCase?.ownerQueue || '',
          ownerArea: createdCase?.ownerArea || '',
          ownerRole: createdCase?.ownerRole || '',
          source: createdCase?.ownerSource || '',
          routingHint: createdCase?.ownerRoutingHint || '',
          hasOwner: createdCase?.hasOperationalOwner,
          stateCode: createdCase?.ownershipStateCode || '',
        },
      )
      const ownershipEnvelope = validateOperationalOwnershipEnvelope(
        createdCase,
        {
          requireSourceBinding: true,
          requireBundleVersion: true,
          enforceReferences: true,
          references: resolveOwnershipReferenceCatalog(this),
        },
      )
      const ownershipServerValidation = resolveOwnershipServerValidation({
        state: this,
        payload: createdCase,
        endpoint: OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_CREATE,
        requireSourceBinding: true,
        requireBundleVersion: true,
        legacyPolicy: {
          ...DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
          allowLegacyWrite: false,
          allowLegacyFollowUpWrite: false,
          allowFallbackOwnerWrite: false,
          allowLegacySourceBindingWrite: false,
        },
      })

      if (!ownershipIntegrity.ok || !ownershipEnvelope.ok || !ownershipServerValidation.ok) {
        this.appendAnalytics('operator_case_open_blocked_missing_owner', context || {}, currentDate)
        this.persistState()
        return {
          ok: false,
          errorCode:
            ownershipServerValidation.primaryError?.code ||
            ownershipIntegrity.code ||
            'owner_missing',
          errorMessage:
            ownershipServerValidation.primaryError?.userMessage ||
            ownershipIntegrity.message ||
            ownershipEnvelope.message ||
            'Nao foi possivel abrir este atendimento porque o fluxo nao possui dono operacional efetivo.',
          caseItem: null,
          actionLog: null,
          backendValidation: ownershipServerValidation,
        }
      }

      this.operatorProtocols = [createdCase, ...this.operatorProtocols]
      this.appendCaseKnowledgeUsage(
        buildInitialKnowledgeUsageForProtocol({
          protocolId: createdCase.protocolNumber,
          themeKey: createdCase.context?.theme,
          subsubjectKey: createdCase.context?.subtheme || createdCase.context?.finalNode?.title,
          actorName: actorName || 'Operacao do polo',
          actorRole: 'op',
          usedAt: createdCase.createdAt,
          knowledgeFoundation: this.knowledgeFoundation,
        }),
      )
      this.appendCaseRoutingDecision(
        buildCanonicalRoutingDecision({
          caseId: createdCase.protocolNumber,
          sourceNodeId: createdCase.context?.finalNode?.id || '',
          defaultAreaLabel:
            createdCase.ownerArea ||
            createdCase.lastMileAreaLabel ||
            createdCase.context?.routing?.targetAreaLabel ||
            createdCase.ownerQueue ||
            '',
          resolvedAreaLabel:
            createdCase.ownerArea ||
            createdCase.lastMileAreaLabel ||
            createdCase.context?.routing?.targetAreaLabel ||
            createdCase.ownerQueue ||
            '',
          routingMode: 'standard',
          justification: createdCase.context?.routing?.assignmentRuleLabel || 'Abertura assistida pelo OP com roteamento padrao.',
          decidedBy: actorName || 'Operacao do polo',
          decidedAt: createdCase.createdAt,
        }),
      )
      this.appendCaseEvent(
        buildCanonicalCaseEvent({
          caseId: createdCase.protocolNumber,
          eventType: 'case_opened_by_operator',
          actor: actorName || 'Operacao do polo',
          actorRole: 'op',
          fromStatus: '',
          toStatus: mapLegacyCaseStatusCode({
            statusCode: createdCase.statusCode,
            statusLabel: createdCase.statusLabel,
            pendingLabel: createdCase.pendingLabel,
          }),
          description: 'Atendimento aberto em nome do aluno com triagem inicial registrada.',
          payload: {
            subjectCode: buildSubjectCode(createdCase.context?.theme),
            subsubjectCode: buildSubsubjectCode(createdCase.context?.theme, createdCase.context?.subtheme || createdCase.context?.finalNode?.title),
            openedChannel: createdCase.operatorIntake?.channel || contactChannel,
            ownerType: createdCase.ownerType || '',
            ownerKey: createdCase.ownerKey || '',
            ownerQueue: createdCase.ownerQueue || '',
            ownerArea: createdCase.ownerArea || '',
            ownerRole: createdCase.ownerRole || '',
            ownershipStateCode: createdCase.ownershipStateCode || '',
            sourceBundleId: createdCase.sourceBundleId || '',
            sourceBundleVersionId: createdCase.sourceBundleVersionId || '',
            sourceNodeId: createdCase.sourceNodeId || '',
          },
          createdAt: createdCase.createdAt,
        }),
      )

      let actionLog = null

      if (actionType === 'request_info' || actionType === 'escalate') {
        actionLog = this.registerOperatorAction({
          caseId: createdCase.protocolNumber,
          actionType,
          note: verifiedSummary,
          playbook,
          actorName,
          currentDate,
        })
      } else {
        this.persistState()
      }

      return {
        ok: true,
        caseItem: createdCase,
        actionLog,
      }
    },
    registerOperatorAction({ caseId, actionType, note = '', playbook, actorName = '', currentDate = new Date() }) {
      const caseEntry = this.operatorQueueEntries().find((entry) => entry.id === caseId) || null

      if (!caseEntry) {
        return null
      }

      const actionLog = buildOperatorActionLog({
        caseEntry,
        actionType,
        note,
        playbook,
        actorName,
        currentDate,
      })

      this.operatorActionLogs = [...this.operatorActionLogs, actionLog]
      this.appendCaseKnowledgeUsage(
        buildInitialKnowledgeUsageForProtocol({
          protocolId: caseId,
          themeKey: caseEntry.themeKey,
          subsubjectKey: caseEntry.subsubjectKey,
          actorName: actorName || caseEntry.assignedOperator || 'Operacao do polo',
          actorRole: 'op',
          usedAt: actionLog.occurredAt,
          knowledgeFoundation: this.knowledgeFoundation,
        }),
      )
      this.appendCaseEvent(
        buildCanonicalCaseEvent({
          caseId,
          eventType: `operator_${actionType}`,
          actor: actorName || caseEntry.assignedOperator || 'Operacao do polo',
          actorRole: 'op',
          fromStatus:
            caseEntry.statusCode ||
            mapLegacyCaseStatusCode({
              statusLabel: actionLog.statusBefore,
              pendingLabel: caseEntry.pendingLabel,
            }),
          toStatus:
            actionLog.canonicalStatusCode ||
            mapLegacyCaseStatusCode({
              statusLabel: actionLog.statusAfter,
              pendingLabel: actionLog.pendingLabel,
              latestOperatorActionType: actionType,
            }),
          description: actionLog.note || actionLog.actionLabel,
          payload: {
            queueBefore: actionLog.queueBefore,
            queueAfter: actionLog.queueAfter,
            destinationLabel: actionLog.destinationLabel || actionLog.queueAfter,
            escalationReason: actionLog.escalationReason || '',
          },
          createdAt: actionLog.occurredAt,
        }),
      )

      if (actionType === 'escalate') {
        this.appendCaseRoutingDecision(
          buildCanonicalRoutingDecision({
            caseId,
            sourceNodeId: this.canonicalCaseProtocols.find((item) => item.id === caseId)?.currentNodeId || '',
            defaultAreaLabel: caseEntry.lastMileAreaLabel || caseEntry.routing?.targetAreaLabel || caseEntry.queue,
            resolvedAreaLabel: caseEntry.lastMileAreaLabel || caseEntry.routing?.targetAreaLabel || caseEntry.queue,
            routingMode: 'standard',
            justification: actionLog.note || actionLog.escalationReason || 'Escalonamento operacional padrao.',
            decidedBy: actorName || caseEntry.assignedOperator || 'Operacao do polo',
            decidedAt: actionLog.occurredAt,
          }),
        )
        this.applyAutomaticAreaAssignment({
          caseId,
          areaLabel: caseEntry.lastMileAreaLabel || caseEntry.routing?.targetAreaLabel || caseEntry.queue,
          actorName: actorName || caseEntry.assignedOperator || 'Operacao do polo',
          currentDate,
        })
      }

      this.persistState()

      return actionLog
    },
    registerAreaAction({
      caseId,
      actionType,
      note = '',
      actorName = '',
      nextArea = '',
      isManagerException = false,
      currentDate = new Date(),
    }) {
      const caseDetail = this.areaCaseById(caseId) || null

      if (!caseDetail) {
        return null
      }

      if (actionType === 'conclude') {
        const mergedAreaLogs = [...areaActionSeeds, ...this.areaActionLogs]
        const hasFinalResponse = hasAreaTechnicalReply(mergedAreaLogs, caseId)

        if (!hasFinalResponse) {
          const error = new Error('Concluir analise interna exige resposta final registrada para aluno e OP.')
          error.code = 'missing_final_response'
          throw error
        }
      }

      const actionLog = buildAreaActionLog({
        caseDetail,
        actionType,
        note,
        actorName,
        nextArea,
        isManagerException,
        currentDate,
      })

      this.areaActionLogs = [...this.areaActionLogs, actionLog]
      this.appendCaseKnowledgeUsage(
        buildInitialKnowledgeUsageForProtocol({
          protocolId: caseId,
          themeKey: caseDetail.themeKey,
          subsubjectKey: caseDetail.subsubjectKey,
          actorName: actorName || 'Area interna',
          actorRole: 'area',
          usedAt: actionLog.occurredAt,
          knowledgeFoundation: this.knowledgeFoundation,
        }),
      )
      this.appendCaseEvent(
        buildCanonicalCaseEvent({
          caseId,
          eventType: `area_${actionType}`,
          actor: actorName || 'Area interna',
          actorRole: 'area',
          fromStatus:
            caseDetail.statusCode ||
            mapLegacyCaseStatusCode({
              statusLabel: actionLog.statusBefore,
              pendingLabel: caseDetail.pendingLabel,
            }),
          toStatus:
            actionLog.canonicalStatusCode ||
            mapLegacyCaseStatusCode({
              statusLabel: actionLog.statusAfter,
              pendingLabel: actionLog.pendingLabel,
              latestAreaActionType: actionType,
            }),
          description: actionLog.note || actionLog.actionLabel,
          payload: {
            queueBefore: actionLog.queueBefore,
            queueAfter: actionLog.queueAfter,
            destinationLabel: actionLog.destinationLabel || actionLog.queueAfter,
            routingMode: actionLog.routingMode || 'standard',
          },
          createdAt: actionLog.occurredAt,
        }),
      )

      if (actionType === 'reassign') {
        this.appendCaseRoutingDecision(
          buildCanonicalRoutingDecision({
            caseId,
            sourceNodeId: this.canonicalCaseProtocols.find((item) => item.id === caseId)?.currentNodeId || '',
            defaultAreaLabel: caseDetail.currentAreaLabel || caseDetail.lastMileAreaLabel || caseDetail.queue,
            resolvedAreaLabel: actionLog.destinationLabel,
            routingMode: actionLog.routingMode || 'standard',
            justification:
              actionLog.note ||
              (isManagerException
                ? 'Excecao gerencial registrada na redistribuicao.'
                : 'Reencaminhamento interno padrao entre areas.'),
            decidedBy: actorName || 'Area interna',
            decidedAt: actionLog.occurredAt,
          }),
        )
        this.areaCaseAssignments = completeMatchingAssignments(this.areaCaseAssignments, caseId, caseDetail.currentAreaLabel)
        this.applyAutomaticAreaAssignment({
          caseId,
          areaLabel: actionLog.destinationLabel,
          actorName: actorName || 'Area interna',
          currentDate,
        })
      } else if (['technical_reply', 'request_complement', 'conclude'].includes(actionType)) {
        this.areaCaseAssignments = completeMatchingAssignments(this.areaCaseAssignments, caseId, caseDetail.currentAreaLabel)
      }

      this.persistState()

      return actionLog
    },
    assignAreaCase({
      caseId,
      areaLabel = '',
      analystName = '',
      actorName = '',
      reason = '',
      currentDate = new Date(),
    }) {
      const previousAssignment =
        sortByAssignedAtAsc(this.areaCaseAssignments)
          .filter(
            (assignment) =>
              assignment.caseId === caseId &&
              normalizeAreaLabel(assignment.areaLabel) === normalizeAreaLabel(areaLabel) &&
              assignment.statusCode !== CASE_ASSIGNMENT_STATUSES.COMPLETED,
          )
          .at(-1) || null
      const payload = buildCanonicalAssignmentRecord({
        caseId,
        areaLabel,
        analystName,
        assignedBy: actorName || 'Gestao da area',
        assignedAt: currentDate.toISOString(),
        reason: reason || 'Redistribuicao gerencial.',
        assignmentMode: previousAssignment ? 'manager_override' : 'manager_manual',
        previousAssignment,
      })

      this.areaCaseAssignments = [
        ...completeMatchingAssignments(this.areaCaseAssignments, caseId, areaLabel),
        payload,
      ]

      this.appendCaseEvent(
        buildCanonicalCaseEvent({
          caseId,
          eventType: previousAssignment ? 'assignment_reassigned' : 'assignment_created',
          actor: actorName || 'Gestao da area',
          actorRole: 'manager',
          fromStatus: previousAssignment?.statusCode || '',
          toStatus: payload.statusCode,
          description: reason || 'Redistribuicao gerencial da area.',
          payload: {
            areaLabel,
            analystName,
            assignmentMode: payload.assignmentMode,
          },
          createdAt: currentDate.toISOString(),
        }),
      )

      this.persistState()
      return payload
    },
    approveKnowledgeBundleVersion({
      bundleVersionId = '',
      actorName = '',
      currentDate = new Date(),
    }) {
      const approvedAt = currentDate.toISOString()
      let updatedVersion = null

      this.knowledgeBundleVersions = this.knowledgeBundleVersions.map((record) => {
        if (record.id !== bundleVersionId) {
          return record
        }

        updatedVersion = {
          ...record,
          statusCode: KNOWLEDGE_BUNDLE_VERSION_STATUSES.APPROVED,
          approvedBy: actorName || 'Admin central',
          approvedAt,
          publishedAt: record.publishedAt || null,
        }

        return updatedVersion
      })

      this.persistState()
      return updatedVersion
    },
    publishKnowledgeBundleVersion({
      bundleVersionId = '',
      actorName = '',
      currentDate = new Date(),
    }) {
      const selectedVersion = this.knowledgeBundleVersions.find((record) => record.id === bundleVersionId) || null

      if (!selectedVersion) {
        return null
      }

      const publishedAt = currentDate.toISOString()
      this.knowledgeBundleVersions = this.knowledgeBundleVersions.map((record) => {
        if (record.bundleType !== selectedVersion.bundleType) {
          return record
        }

        if (record.id === bundleVersionId) {
          return {
            ...record,
            statusCode: KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
            approvedBy: record.approvedBy || actorName || 'Admin central',
            approvedAt: record.approvedAt || publishedAt,
            publishedBy: actorName || 'Admin central',
            publishedAt,
            isRuntimePayload: true,
          }
        }

        if (record.statusCode === KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED) {
          return {
            ...record,
            statusCode: KNOWLEDGE_BUNDLE_VERSION_STATUSES.ARCHIVED,
            isRuntimePayload: false,
          }
        }

        return {
          ...record,
          isRuntimePayload: false,
        }
      })

      const nextPublicationRecord = {
        id: `publication:${bundleVersionId}:${new Date(publishedAt).getTime()}`,
        bundleVersionId,
        bundleType: selectedVersion.bundleType,
        publicationStatus: KNOWLEDGE_BUNDLE_VERSION_STATUSES.PUBLISHED,
        approvedAt: publishedAt,
        approvedBy: selectedVersion.approvedBy || actorName || 'Admin central',
        publishedAt,
        publishedBy: actorName || 'Admin central',
      }

      this.knowledgePublications = [
        ...this.knowledgePublications.filter((record) => record.id !== nextPublicationRecord.id),
        nextPublicationRecord,
      ]

      this.persistState()
      return this.knowledgeBundleVersions.find((record) => record.id === bundleVersionId) || null
    },
    upsertAreaSubjectRule({
      areaLabel = '',
      themeKey = '',
      subsubjectKey = '',
      subjectLabel = '',
      accessMode = 'team',
      allowedAnalysts = [],
      actorName = '',
      currentDate = new Date(),
    }) {
      const normalizedTheme = String(themeKey || '').trim().toLowerCase()
      const normalizedSubsubject = String(subsubjectKey || '').trim().toLowerCase()
      const existingIndex = this.areaSubjectRules.findIndex(
        (rule) =>
          rule.areaLabel === areaLabel &&
          String(rule.themeKey || '').trim().toLowerCase() === normalizedTheme &&
          String(rule.subsubjectKey || '').trim().toLowerCase() === normalizedSubsubject,
      )
      const updatedAtLabel = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()} ${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`
      const payload = {
        id:
          existingIndex >= 0
            ? this.areaSubjectRules[existingIndex].id
            : `scope-${String(areaLabel).trim().toLowerCase().replaceAll(' ', '-')}-${normalizedTheme}-${normalizedSubsubject || 'all'}`,
        areaLabel,
        themeKey,
        subsubjectKey,
        subjectLabel,
        accessMode,
        allowedAnalysts: [...allowedAnalysts],
        subjectCode: buildSubjectCode(themeKey),
        subsubjectCode: buildSubsubjectCode(themeKey, subsubjectKey),
        visibilityMode: accessMode,
        eligibleUsers: accessMode === 'restricted' ? [...allowedAnalysts] : [],
        isActive: true,
        updatedBy: actorName || 'Gestao da area',
        updatedAtLabel,
      }

      if (existingIndex >= 0) {
        this.areaSubjectRules = this.areaSubjectRules.map((rule, index) => (index === existingIndex ? payload : rule))
      } else {
        this.areaSubjectRules = [...this.areaSubjectRules, payload]
      }

      this.persistState()
      return payload
    },
    submitKnowledgeSuggestion({
      areaLabel = '',
      themeKey = '',
      subsubjectKey = '',
      subjectLabel = '',
      contentType = 'playbook_area',
      title = '',
      currentContent = '',
      proposalText = '',
      rationale = '',
      sourceCaseId = '',
      authorName = '',
      currentDate = new Date(),
    }) {
      const createdAtLabel = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()} ${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`
      const payload = {
        id: `knowledge-suggestion-${currentDate.getTime()}`,
        areaLabel,
        themeKey,
        subsubjectKey,
        subjectLabel,
        contentType,
        statusCode: 'Pending Review',
        status: 'pending',
        title,
        currentContent,
        proposalText,
        rationale,
        authorName: authorName || 'Operacao da area',
        sourceCaseId,
        createdAt: currentDate.toISOString(),
        createdAtLabel,
        reviewerName: '',
        reviewedAtLabel: '',
        decisionNote: '',
      }

      this.knowledgeSuggestions = [payload, ...this.knowledgeSuggestions]
      this.persistState()
      return payload
    },
    reviewKnowledgeSuggestion({
      suggestionId = '',
      decision = 'approved',
      reviewerName = '',
      decisionNote = '',
      currentDate = new Date(),
    }) {
      const reviewedAtLabel = `${String(currentDate.getDate()).padStart(2, '0')}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()} ${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}`
      let updatedSuggestion = null
      const statusCode =
        decision === 'approved'
          ? 'Approved'
          : decision === 'rejected'
            ? 'Rejected'
            : decision === 'implemented'
              ? 'Implemented'
              : decision === 'superseded'
                ? 'Superseded'
                : 'Pending Review'

      this.knowledgeSuggestions = this.knowledgeSuggestions.map((suggestion) => {
        if (suggestion.id !== suggestionId) {
          return suggestion
        }

        updatedSuggestion = {
          ...suggestion,
          statusCode,
          status: decision,
          reviewerName: reviewerName || 'Gestao da area',
          reviewedAtLabel,
          decisionNote,
        }

        return updatedSuggestion
      })

      if (updatedSuggestion) {
        this.knowledgeSuggestionReviews = [
          ...this.knowledgeSuggestionReviews,
          {
            id: `suggestion-review-${suggestionId}-${currentDate.getTime()}`,
            suggestionId,
            reviewerName: reviewerName || 'Gestao da area',
            decision: statusCode,
            decisionNote,
            reviewedAtLabel,
          },
        ]
      }

      this.persistState()
      return updatedSuggestion
    },
    upsertUserAvailability({
      userName = '',
      areaLabel = '',
      statusCode = 'available',
      reasonType = 'other',
      capacityFactor = 1,
      startsAt = '',
      endsAt = '',
      notes = '',
    }) {
      const existingIndex = this.userAvailability.findIndex(
        (record) =>
          record.userName === userName &&
          record.areaLabel === areaLabel &&
          record.startsAt === startsAt &&
          record.endsAt === endsAt,
      )
      const payload = normalizePersistedUserAvailability({
        id:
          existingIndex >= 0
            ? this.userAvailability[existingIndex].id
            : `availability-${userName}-${areaLabel}-${Date.now()}`,
        userName,
        areaLabel,
        statusCode,
        reasonType,
        capacityFactor,
        startsAt,
        endsAt,
        notes,
      })

      if (existingIndex >= 0) {
        this.userAvailability = this.userAvailability.map((record, index) => (index === existingIndex ? payload : record))
      } else {
        this.userAvailability = [...this.userAvailability, payload]
      }

      this.persistState()
      return payload
    },
    submitRequestFollowUp({
      requestId,
      note = '',
      attachments = [],
      currentDate = new Date(),
    }) {
      const normalizedId = String(requestId || '').trim()
      if (!normalizedId) {
        return null
      }

      const existingProtocol = this.protocols.find((protocol) => protocol.protocolNumber === normalizedId) || null
      const seedEntry = studentProtocols.find((protocol) => protocol.id === normalizedId) || null

      if (!existingProtocol && !seedEntry) {
        return null
      }

      const updatedProtocol = buildStudentFollowUpSubmission({
        existingProtocol,
        seedEntry,
        note,
        attachmentNames: attachments,
        currentDate,
      })
      const normalizedProtocol = normalizeProtocolOwnershipPayload(
        updatedProtocol,
        'student_followup',
      )
      const ownershipIntegrity = buildOperationalOwnerIntegrity(
        normalizedProtocol.operationalOwnerSnapshot || {
          ownerType: normalizedProtocol.ownerType || '',
          ownerKey: normalizedProtocol.ownerKey || '',
          ownerQueue: normalizedProtocol.ownerQueue || '',
          ownerArea: normalizedProtocol.ownerArea || '',
          ownerRole: normalizedProtocol.ownerRole || '',
          source: normalizedProtocol.ownerSource || '',
          routingHint: normalizedProtocol.ownerRoutingHint || '',
          hasOwner: normalizedProtocol.hasOperationalOwner,
          stateCode: normalizedProtocol.ownershipStateCode || '',
        },
      )
      const ownershipEnvelope = validateOperationalOwnershipEnvelope(
        normalizedProtocol,
        {
          requireSourceBinding: true,
          requireBundleVersion: true,
          enforceReferences: true,
          references: resolveOwnershipReferenceCatalog(this),
        },
      )
      const ownershipServerValidation = resolveOwnershipServerValidation({
        state: this,
        payload: normalizedProtocol,
        endpoint: OPERATIONAL_OWNERSHIP_BACKEND_ENDPOINTS.PROTOCOL_FOLLOW_UP,
        requireSourceBinding: true,
        requireBundleVersion: true,
        legacyPolicy: {
          ...DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY,
          allowLegacyRead: true,
          allowLegacyFollowUpWrite: true,
          allowLegacyWrite: false,
          allowFallbackOwnerWrite: false,
          allowLegacySourceBindingWrite: true,
        },
      })

      if (!ownershipIntegrity.ok || !ownershipEnvelope.ok || !ownershipServerValidation.ok) {
        return null
      }

      if (existingProtocol) {
        this.protocols = this.protocols.map((protocol) =>
          protocol.protocolNumber === normalizedId ? normalizedProtocol : protocol,
        )
      } else {
        this.protocols = [normalizedProtocol, ...this.protocols]
      }

      this.appendCaseEvent(
        buildCanonicalCaseEvent({
          caseId: normalizedId,
          eventType: 'student_followup',
          actor: 'Aluno',
          actorRole: 'student',
          fromStatus: '',
          toStatus: mapLegacyCaseStatusCode({
            statusCode: normalizedProtocol.statusCode,
            statusLabel: normalizedProtocol.statusLabel,
            pendingLabel: normalizedProtocol.pendingLabel,
          }),
          description: note || 'Complementacao enviada pelo aluno no protocolo.',
          payload: {
            attachments,
          },
          createdAt: currentDate.toISOString(),
        }),
      )

      this.persistState()
      return normalizedProtocol
    },
  },
})
