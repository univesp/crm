import { defineStore } from 'pinia'

import { attendanceFlows, summarizeAnswers } from '@/data/flowBlueprint'
import { buildTicketDraft, getFrappeOperations } from '@/services/frappeClient'
import { buildTransferPacket } from '@/services/handoffRuntime'
import { describeSsoFlow } from '@/services/ssoClient'
import { defaultAnswersByFlow, mockCustomer, mockSession } from '../../mocks/journey'

export const useJourneyStore = defineStore('journey', {
  state: () => ({
    activeFlowId: 'matricula',
    answers: { ...defaultAnswersByFlow.matricula },
    customer: { ...mockCustomer },
    session: { ...mockSession },
    remoteTicket: null,
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
    transferBrief() {
      return buildTransferPacket({
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
    applyAuthenticatedUser(user) {
      if (!user) {
        return
      }

      const displayName = user.displayName || user.email || this.customer.name
      const email = user.email || this.customer.email

      this.customer = {
        ...this.customer,
        name: displayName,
        email,
        ssoStatus: describeSsoFlow(user.flow, email),
      }
    },
    setRemoteTicket(ticket) {
      this.remoteTicket = ticket
    },
  },
})
