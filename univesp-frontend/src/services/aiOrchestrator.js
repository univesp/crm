export const aiGuardrails = [
  'Nao pedir novamente dados que vieram do SSO ou do ticket.',
  'Escalar quando houver bloqueio operacional, prazo critico ou risco financeiro.',
  'Persistir resumo do atendimento antes de transferir para humano.',
  'Responder apenas com playbooks e base de conhecimento vigentes.',
]

export function buildBotContext({ customer, flow, ticketDraft, answerSummary }) {
  return {
    sessionId: `bot-${ticketDraft.protocol.toLowerCase()}`,
    protocol: ticketDraft.protocol,
    intent: flow.id,
    queueFallback: flow.queue,
    knowledgeNamespace: import.meta.env.VITE_AI_NAMESPACE || 'univesp-atendimento',
    customer: {
      name: customer.name,
      ra: customer.ra,
      polo: customer.polo,
      channel: customer.channel,
      ssoStatus: customer.ssoStatus,
    },
    triage: answerSummary,
  }
}

export function buildConversationPreview({ customer, flow, ticketDraft, answerSummary }) {
  const need =
    answerSummary.find((item) => item.questionId === 'need')?.answer || flow.name
  const urgency =
    answerSummary.find((item) => item.questionId === 'urgency')?.answer || 'Padrao'

  return [
    {
      role: 'user',
      speaker: customer.name,
      text: `Preciso de ajuda com ${need.toLowerCase()}.`,
    },
    {
      role: 'assistant',
      speaker: 'UNIVESP IA',
      text: `Ja associei sua solicitacao ao protocolo ${ticketDraft.protocol} e recebi o contexto da triagem.`,
    },
    {
      role: 'assistant',
      speaker: 'UNIVESP IA',
      text: `Vou seguir o playbook de ${flow.name.toLowerCase()} e considerar a urgencia "${urgency.toLowerCase()}".`,
    },
    {
      role: 'assistant',
      speaker: 'UNIVESP IA',
      text: `Se eu identificar bloqueio ou excecao, encaminho com resumo pronto para ${flow.queue}.`,
    },
  ]
}

export function buildTransferBrief({ customer, flow, ticketDraft, answerSummary }) {
  const urgency =
    answerSummary.find((item) => item.questionId === 'urgency')?.answer || 'Padrao'
  const blocker =
    answerSummary.find((item) => item.questionId === 'evidence')?.answer || 'Sem detalhe'

  return {
    reason: `Escalacao planejada para ${flow.queue} com base na urgencia "${urgency}" e no contexto "${blocker}".`,
    summary: `${customer.name} iniciou atendimento no canal ${customer.channel}. A triagem classificou o caso em ${flow.name.toLowerCase()} e o protocolo ${ticketDraft.protocol} ja foi aberto.`,
    packetItems: [
      { label: 'Fila destino', value: flow.queue },
      { label: 'Protocolo', value: ticketDraft.protocol },
      { label: 'Cliente autenticado', value: customer.ssoStatus },
      { label: 'SLA alvo', value: flow.expectedSla },
    ],
    agentFocus: [
      'Validar se a regra aplicada pela IA cobre excecoes do caso.',
      'Confirmar anexos, comprovantes ou protocolos anteriores.',
      'Dar a resposta final sem repetir a coleta inicial.',
    ],
    nextActions: [
      'Registrar resumo do chatbot no ticket.',
      'Manter a fila e a prioridade sincronizadas no Frappe.',
      'Enviar ao atendente a transcricao resumida e os campos capturados.',
    ],
  }
}
