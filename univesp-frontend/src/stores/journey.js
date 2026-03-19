import { defineStore } from 'pinia'

import { attendanceFlows, summarizeAnswers } from '@/data/flowBlueprint'
import { buildConversationPreview, buildBotContext, buildTransferBrief } from '@/services/aiOrchestrator'
import { buildTicketDraft, getFrappeOperations } from '@/services/frappeClient'

const defaultAnswersByFlow = {
  matricula: {
    persona: 'active_student',
    need: 're_enrollment',
    urgency: 'this_week',
    evidence: 'has_attachment',
  },
  financeiro: {
    persona: 'student_owner',
    need: 'duplicate_invoice',
    urgency: 'due_today',
    evidence: 'invoice_number',
  },
  documentos: {
    persona: 'active_student',
    need: 'enrollment_statement',
    urgency: 'week',
    evidence: 'clear_path',
  },
  ava: {
    persona: 'course_access',
    need: 'hard_block',
    urgency: 'assessment_today',
    evidence: 'print_and_error',
  },
}

export const useJourneyStore = defineStore('journey', {
  state: () => ({
    activeFlowId: 'matricula',
    answers: { ...defaultAnswersByFlow.matricula },
    customer: {
      name: 'Marina Costa',
      email: 'marina.costa@example.com',
      ra: '22100489',
      polo: 'Polo Guarulhos',
      course: 'Pedagogia',
      channel: 'Portal UNIVESP',
      ssoStatus: 'Autenticado via SAML',
    },
    session: {
      protocol: 'UVSP-20260319-104',
      stage: 'overview',
      priority: 'Alta',
    },
  }),
  getters: {
    activeFlow(state) {
      return attendanceFlows.find((flow) => flow.id === state.activeFlowId) || attendanceFlows[0]
    },
    answerSummary() {
      return summarizeAnswers(this.activeFlow, this.answers)
    },
    completion() {
      const answered = this.answerSummary.filter((item) => item.value).length
      return Math.round((answered / this.activeFlow.questions.length) * 100)
    },
    ticketDraft() {
      return buildTicketDraft({
        customer: this.customer,
        session: this.session,
        flow: this.activeFlow,
        answerSummary: this.answerSummary,
      })
    },
    frappeOperations() {
      return getFrappeOperations(this.activeFlow)
    },
    botContext() {
      return buildBotContext({
        customer: this.customer,
        flow: this.activeFlow,
        ticketDraft: this.ticketDraft,
        answerSummary: this.answerSummary,
      })
    },
    conversationPreview() {
      return buildConversationPreview({
        customer: this.customer,
        flow: this.activeFlow,
        ticketDraft: this.ticketDraft,
        answerSummary: this.answerSummary,
      })
    },
    transferBrief() {
      return buildTransferBrief({
        customer: this.customer,
        flow: this.activeFlow,
        ticketDraft: this.ticketDraft,
        answerSummary: this.answerSummary,
      })
    },
  },
  actions: {
    selectFlow(flowId) {
      this.activeFlowId = flowId
      this.answers = { ...defaultAnswersByFlow[flowId] }
    },
    answer(questionId, value) {
      this.answers = {
        ...this.answers,
        [questionId]: value,
      }
    },
    setStage(stage) {
      this.session.stage = stage
    },
  },
})
