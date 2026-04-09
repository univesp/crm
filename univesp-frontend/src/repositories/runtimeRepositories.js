import { buildAdminVersioningRuntime } from '@/services/adminVersioningRuntime'

export function createRuntimeRepositories(studentSupportStore) {
  return {
    knowledge: {
      listBundles() {
        return buildAdminVersioningRuntime({
          knowledgeFoundation: studentSupportStore.knowledgeFoundation,
        }).bundles
      },
      listFoundation() {
        return studentSupportStore.knowledgeFoundation
      },
      approveVersion({ bundleVersionId, actorName, currentDate = new Date() }) {
        return studentSupportStore.approveKnowledgeBundleVersion({
          bundleVersionId,
          actorName,
          currentDate,
        })
      },
      publishVersion({ bundleVersionId, actorName, currentDate = new Date() }) {
        return studentSupportStore.publishKnowledgeBundleVersion({
          bundleVersionId,
          actorName,
          currentDate,
        })
      },
      listSuggestions() {
        return [...studentSupportStore.knowledgeSuggestions]
      },
      submitSuggestion(payload = {}) {
        return studentSupportStore.submitKnowledgeSuggestion(payload)
      },
      reviewSuggestion(payload = {}) {
        return studentSupportStore.reviewKnowledgeSuggestion(payload)
      },
    },
    cases: {
      listProtocols() {
        return studentSupportStore.canonicalCaseProtocols
      },
      getProtocol(caseId = '') {
        return studentSupportStore.canonicalCaseProtocols.find((record) => record.id === caseId) || null
      },
      getOperatorDetail(caseId = '', viewerContext = null) {
        return studentSupportStore.operatorCaseById(caseId, viewerContext)
      },
      getAreaDetail(caseId = '', viewerContext = null) {
        return studentSupportStore.areaCaseById(caseId, viewerContext)
      },
      getKnowledgeUsage(caseId = '') {
        return studentSupportStore.mergedCaseKnowledgeUsages.filter((record) => record.caseId === caseId)
      },
      getRoutingDecisions(caseId = '') {
        return studentSupportStore.mergedCaseRoutingDecisions.filter((record) => record.caseId === caseId)
      },
      getEvents(caseId = '') {
        return studentSupportStore.mergedCaseEvents.filter((record) => record.caseId === caseId)
      },
      listAssignments() {
        return studentSupportStore.canonicalCaseAssignments
      },
      registerOperatorAction(payload = {}) {
        return studentSupportStore.registerOperatorAction(payload)
      },
      registerAreaAction(payload = {}) {
        return studentSupportStore.registerAreaAction(payload)
      },
      assignAreaCase(payload = {}) {
        return studentSupportStore.assignAreaCase(payload)
      },
    },
    governance: {
      listEligibilityRules() {
        return studentSupportStore.areaSubjectEligibilityRules
      },
      listAvailability() {
        return studentSupportStore.userAvailabilityCatalog
      },
      upsertEligibilityRule(payload = {}) {
        return studentSupportStore.upsertAreaSubjectRule(payload)
      },
      upsertAvailability(payload = {}) {
        return studentSupportStore.upsertUserAvailability(payload)
      },
    },
  }
}
