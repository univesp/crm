import {
  CASE_ASSIGNMENT_STATUSES,
  USER_AVAILABILITY_STATUSES,
  buildSubjectCode,
  buildSubsubjectCode,
  normalizeCanonicalText,
} from '@/services/canonicalFoundationRuntime'

function normalizeDate(value = new Date()) {
  return value instanceof Date ? value : new Date(value)
}

function isActiveWindow(record = {}, currentDate = new Date()) {
  const now = normalizeDate(currentDate).getTime()
  const startsAt = record.startsAt ? new Date(record.startsAt).getTime() : Number.NEGATIVE_INFINITY
  const endsAt = record.endsAt ? new Date(record.endsAt).getTime() : Number.POSITIVE_INFINITY

  return now >= startsAt && now <= endsAt
}

function buildAvailabilityDefault(userName = '', areaLabel = '') {
  return {
    id: `availability-default:${normalizeCanonicalText(userName)}:${normalizeCanonicalText(areaLabel)}`,
    userName,
    areaLabel,
    areaId: '',
    statusCode: USER_AVAILABILITY_STATUSES.AVAILABLE,
    reasonType: 'default',
    capacityFactor: 1,
    startsAt: '',
    endsAt: '',
    notes: '',
  }
}

export function resolveUserAvailability(userName = '', areaLabel = '', userAvailability = [], currentDate = new Date()) {
  const matchingWindows = userAvailability
    .filter(
      (record) =>
        normalizeCanonicalText(record.userName) === normalizeCanonicalText(userName) &&
        (!areaLabel ||
          !normalizeCanonicalText(record.areaLabel) ||
          normalizeCanonicalText(record.areaLabel) === normalizeCanonicalText(areaLabel)) &&
        isActiveWindow(record, currentDate),
    )
    .sort((left, right) => {
      const priority = {
        [USER_AVAILABILITY_STATUSES.UNAVAILABLE]: 3,
        [USER_AVAILABILITY_STATUSES.REDUCED_CAPACITY]: 2,
        [USER_AVAILABILITY_STATUSES.AVAILABLE]: 1,
      }

      const priorityDelta = (priority[right.statusCode] || 0) - (priority[left.statusCode] || 0)
      if (priorityDelta !== 0) {
        return priorityDelta
      }

      const leftSpecificity =
        normalizeCanonicalText(left.areaLabel) === normalizeCanonicalText(areaLabel) && normalizeCanonicalText(left.areaLabel)
          ? 1
          : 0
      const rightSpecificity =
        normalizeCanonicalText(right.areaLabel) === normalizeCanonicalText(areaLabel) && normalizeCanonicalText(right.areaLabel)
          ? 1
          : 0

      return rightSpecificity - leftSpecificity
    })

  return matchingWindows[0] || buildAvailabilityDefault(userName, areaLabel)
}

function findEligibilityRule(areaLabel = '', subjectCode = '', subsubjectCode = '', areaSubjectEligibility = []) {
  return (
    areaSubjectEligibility.find(
      (rule) =>
        rule.isActive !== false &&
        normalizeCanonicalText(rule.areaLabel) === normalizeCanonicalText(areaLabel) &&
        normalizeCanonicalText(rule.subjectCode) === normalizeCanonicalText(subjectCode) &&
        normalizeCanonicalText(rule.subsubjectCode) === normalizeCanonicalText(subsubjectCode),
    ) ||
    areaSubjectEligibility.find(
      (rule) =>
        rule.isActive !== false &&
        normalizeCanonicalText(rule.areaLabel) === normalizeCanonicalText(areaLabel) &&
        normalizeCanonicalText(rule.subjectCode) === normalizeCanonicalText(subjectCode) &&
        !normalizeCanonicalText(rule.subsubjectCode),
    ) ||
    null
  )
}

function isActiveCaseStatus(statusCode = '') {
  return !['resolved', 'closed'].includes(statusCode)
}

function buildWorkloadIndex(caseProtocols = [], caseAssignments = [], currentDate = new Date()) {
  const assignmentByCaseId = new Map()

  for (const assignment of caseAssignments.filter((item) => item.statusCode !== CASE_ASSIGNMENT_STATUSES.COMPLETED)) {
    const existing = assignmentByCaseId.get(assignment.caseId)

    if (!existing) {
      assignmentByCaseId.set(assignment.caseId, assignment)
      continue
    }

    const existingTimestamp = new Date(existing.assignedAt || 0).getTime()
    const currentTimestamp = new Date(assignment.assignedAt || 0).getTime()

    if (currentTimestamp >= existingTimestamp) {
      assignmentByCaseId.set(assignment.caseId, assignment)
    }
  }

  const workload = new Map()
  const now = normalizeDate(currentDate).getTime()

  for (const protocol of caseProtocols) {
    if (!isActiveCaseStatus(protocol.statusCode)) {
      continue
    }

    const assignment = assignmentByCaseId.get(protocol.id)
    if (!assignment?.analystName) {
      continue
    }

    const current = workload.get(assignment.analystName) || {
      activeCases: 0,
      riskCases: 0,
      overdueCases: 0,
    }

    current.activeCases += 1

    if (protocol.slaDeadlineAt) {
      const deadline = new Date(protocol.slaDeadlineAt).getTime()
      if (deadline <= now) {
        current.overdueCases += 1
      } else if (deadline - now <= 1000 * 60 * 120) {
        current.riskCases += 1
      }
    } else if (protocol.slaState === 'overdue') {
      current.overdueCases += 1
    } else if (protocol.slaState === 'at_risk') {
      current.riskCases += 1
    }

    workload.set(assignment.analystName, current)
  }

  return workload
}

export function resolveEligibleUsers({
  areaLabel = '',
  themeKey = '',
  subsubjectKey = '',
  areaSubjectEligibility = [],
  operationalAreas = [],
}) {
  const subjectCode = buildSubjectCode(themeKey)
  const subsubjectCode = buildSubsubjectCode(themeKey, subsubjectKey)
  const rule = findEligibilityRule(areaLabel, subjectCode, subsubjectCode, areaSubjectEligibility)
  const area = operationalAreas.find(
    (item) => normalizeCanonicalText(item.areaLabel) === normalizeCanonicalText(areaLabel),
  )
  const teamMembers = [...(area?.teamMembers || [])]

  if (!rule || normalizeCanonicalText(rule.visibilityMode) === 'team') {
    return {
      rule,
      eligibleUsers: teamMembers,
    }
  }

  const eligibleUsers = (rule.eligibleUsers || []).filter((userName) =>
    teamMembers.some((member) => normalizeCanonicalText(member) === normalizeCanonicalText(userName)),
  )

  return {
    rule,
    eligibleUsers,
  }
}

export function buildDistributionDecision({
  caseProtocol,
  operationalAreas = [],
  areaSubjectEligibility = [],
  userAvailability = [],
  caseAssignments = [],
  caseProtocols = [],
  currentDate = new Date(),
}) {
  const areaLabel = caseProtocol.currentAreaLabel || caseProtocol.lastMileAreaLabel || caseProtocol.queueLabel || ''
  const { rule, eligibleUsers } = resolveEligibleUsers({
    areaLabel,
    themeKey: caseProtocol.themeKey || caseProtocol.subjectCode,
    subsubjectKey: caseProtocol.subsubjectKey,
    areaSubjectEligibility,
    operationalAreas,
  })
  const workloadIndex = buildWorkloadIndex(caseProtocols, caseAssignments, currentDate)
  const candidateRows = eligibleUsers.map((userName) => {
    const availability = resolveUserAvailability(userName, areaLabel, userAvailability, currentDate)

    return {
      userName,
      availability,
      workload: workloadIndex.get(userName) || {
        activeCases: 0,
        riskCases: 0,
        overdueCases: 0,
      },
    }
  })

  const eligibleCandidates = candidateRows.filter(
    (candidate) => candidate.availability.statusCode !== USER_AVAILABILITY_STATUSES.UNAVAILABLE,
  )
  const scoredCandidates = eligibleCandidates
    .map((candidate) => {
      const capacityFactor = candidate.availability.capacityFactor || 1
      const weightedLoad =
        candidate.workload.activeCases +
        candidate.workload.riskCases * 1.5 +
        candidate.workload.overdueCases * 2
      const score = capacityFactor > 0 ? weightedLoad / capacityFactor : Number.POSITIVE_INFINITY

      return {
        ...candidate,
        capacityFactor,
        score,
      }
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score
      }

      return String(left.userName).localeCompare(String(right.userName), 'pt-BR', { sensitivity: 'base' })
    })

  const winner = scoredCandidates[0] || null
  const subjectCode = caseProtocol.subjectCode || buildSubjectCode(caseProtocol.themeKey)
  const subsubjectCode = caseProtocol.subsubjectCode || buildSubsubjectCode(caseProtocol.themeKey, caseProtocol.subsubjectKey)

  if (!winner) {
    return {
      areaLabel,
      subjectCode,
      subsubjectCode,
      ruleId: rule?.id || '',
      assignmentStatusCode: CASE_ASSIGNMENT_STATUSES.UNASSIGNED_EXCEPTION,
      assignmentMode: 'fallback_unassigned',
      analystName: '',
      reason:
        eligibleUsers.length === 0
          ? 'Nenhum analista elegivel para este assunto/subassunto na area.'
          : 'Todos os elegiveis estao indisponiveis no periodo atual.',
      scoreSummary: {
        eligibleUsers,
        unavailableUsers: candidateRows
          .filter((candidate) => candidate.availability.statusCode === USER_AVAILABILITY_STATUSES.UNAVAILABLE)
          .map((candidate) => candidate.userName),
        candidateScores: [],
      },
    }
  }

  return {
    areaLabel,
    subjectCode,
    subsubjectCode,
    ruleId: rule?.id || '',
    assignmentStatusCode: CASE_ASSIGNMENT_STATUSES.ASSIGNED,
    assignmentMode: 'auto',
    analystName: winner.userName,
    reason:
      winner.availability.statusCode === USER_AVAILABILITY_STATUSES.REDUCED_CAPACITY
        ? `${winner.userName} recebeu o caso por menor carga ponderada, mesmo com capacidade reduzida.`
        : `${winner.userName} recebeu o caso por menor carga ativa ponderada neste assunto.`,
    scoreSummary: {
      eligibleUsers,
      unavailableUsers: candidateRows
        .filter((candidate) => candidate.availability.statusCode === USER_AVAILABILITY_STATUSES.UNAVAILABLE)
        .map((candidate) => candidate.userName),
      candidateScores: scoredCandidates.map((candidate) => ({
        userName: candidate.userName,
        capacityFactor: candidate.capacityFactor,
        activeCases: candidate.workload.activeCases,
        riskCases: candidate.workload.riskCases,
        overdueCases: candidate.workload.overdueCases,
        score: Number(candidate.score.toFixed(2)),
      })),
    },
  }
}
