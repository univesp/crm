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
  buildOperatorActionLog,
  buildOperatorCaseDetail,
  buildOperatorQueueEntries as buildOperatorQueueRuntime,
} from '@/services/operatorQueueRuntime'
import { buildOperatorAssistedCase } from '@/services/operatorIntakeRuntime'
import { buildAdminDashboardData } from '@/services/adminDashboardRuntime'
import { studentProtocols } from '../../mocks/operations'

const STORAGE_KEY = 'univesp-student-support'

function defaultState() {
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

    return {
      ...defaultState(),
      ...JSON.parse(rawValue),
    }
  } catch {
    return defaultState()
  }
}

function nextSessionId(currentDate = new Date()) {
  const compact = String(currentDate.getTime())
  return `faq-session-${compact}`
}

export const useStudentSupportStore = defineStore('studentSupport', {
  state: () => loadPersistedState(),
  getters: {
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
          actionLogs: state.operatorActionLogs,
          viewerContext,
        })
    },
    operatorCaseById(state) {
      return (caseId, viewerContext = null) =>
        buildOperatorCaseDetail({
          caseId,
          protocols: [...state.protocols, ...state.operatorProtocols],
          records: state.records,
          actionLogs: state.operatorActionLogs,
          viewerContext,
        })
    },
    adminDashboardData(state) {
      return (viewerContext = null) =>
        buildAdminDashboardData({
          protocols: [...state.protocols, ...state.operatorProtocols],
          records: state.records,
          actionLogs: state.operatorActionLogs,
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
        }),
      )
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
      const record = buildFaqAttendanceRecord({
        context,
        outcome: 'faq_not_resolved',
        currentDate,
      })
      const draft = buildProtocolDraft({
        context,
        sourceRecordId: record.id,
        currentDate,
      })

      this.records = [record, ...this.records]
      this.protocolDraft = draft
      this.resolvedState = null
      this.appendAnalytics('faq_not_resolved', context, currentDate)
      this.appendAnalytics('protocol_started', context, currentDate)
      this.persistState()

      return draft
    },
    submitProtocol(currentDate = new Date()) {
      const validation = validateProtocolDraft(this.protocolDraft)

      if (!validation.isValid || !this.protocolDraft) {
        return {
          ok: false,
          validation,
        }
      }

      const protocol = buildSubmittedProtocol({
        draft: this.protocolDraft,
        currentDate,
      })

      this.protocols = [protocol, ...this.protocols]
      this.records = this.records.map((record) =>
        record.id === this.protocolDraft.sourceRecordId
          ? {
              ...record,
              pendingLabel: `Protocolo ${protocol.protocolNumber} enviado para continuidade`,
            }
          : record,
      )
      this.appendAnalytics('protocol_submitted', protocol.context, currentDate)
      this.protocolDraft = null
      this.persistState()

      return {
        ok: true,
        protocol,
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

      this.operatorProtocols = [createdCase, ...this.operatorProtocols]

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
      this.persistState()

      return actionLog
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

      if (existingProtocol) {
        this.protocols = this.protocols.map((protocol) =>
          protocol.protocolNumber === normalizedId ? updatedProtocol : protocol,
        )
      } else {
        this.protocols = [updatedProtocol, ...this.protocols]
      }

      this.persistState()
      return updatedProtocol
    },
  },
})
