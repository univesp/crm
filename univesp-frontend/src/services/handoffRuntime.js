export function buildTransferPacket({ customer, flow, ticketDraft, answerSummary }) {
  const urgency =
    answerSummary.find((item) => item.questionId === 'urgency')?.answer || 'Padrao'
  const evidence =
    answerSummary.find((item) => item.questionId === 'evidence')?.answer || 'Sem detalhe'

  return {
    reason: `Continuidade humana planejada para ${flow.queue} com urgencia "${urgency}" e contexto "${evidence}".`,
    summary: `${customer.name} iniciou atendimento no canal ${customer.channel}. A triagem classificou o caso em ${flow.name.toLowerCase()} e o protocolo ${ticketDraft.protocol} ja foi aberto para continuidade institucional.`,
    packetItems: [
      { label: 'Fila inicial', value: flow.queue },
      { label: 'Protocolo', value: ticketDraft.protocol },
      { label: 'Cliente autenticado', value: customer.ssoStatus },
      { label: 'SLA alvo', value: flow.expectedSla },
    ],
    agentFocus: [
      'Validar regra operacional e excecoes antes da primeira resposta.',
      'Confirmar anexos, comprovantes ou protocolos anteriores.',
      'Responder no portal sem repetir a coleta inicial.',
    ],
    nextActions: [
      'Registrar o resumo da triagem no protocolo.',
      'Manter fila e prioridade sincronizadas no Frappe.',
      'Encaminhar o contexto certo para o time humano responsavel.',
    ],
  }
}
