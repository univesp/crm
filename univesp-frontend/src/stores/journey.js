import { defineStore } from 'pinia'

import { attendanceFlows, summarizeAnswers } from '@/data/flowBlueprint'
import { buildConversationPreview, buildBotContext, buildTransferBrief } from '@/services/aiOrchestrator'
import { buildTicketDraft, getFrappeOperations } from '@/services/frappeClient'
import { defaultAnswersByFlow, mockCustomer, mockSession } from '../../mocks/journey'

export const useJourneyStore = defineStore('journey', {
  state: () => ({
    activeFlowId: 'matricula',
    answers: { ...defaultAnswersByFlow.matricula },
    customer: { ...mockCustomer },
    session: { ...mockSession },
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
