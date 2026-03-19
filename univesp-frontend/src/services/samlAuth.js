export const samlBlueprint = {
  identityProvider: 'Keycloak, Azure AD ou outro IdP institucional',
  serviceProviderEntityId:
    import.meta.env.VITE_SAML_ENTITY_ID || 'urn:univesp:service-desk',
  assertionConsumerUrl:
    import.meta.env.VITE_SAML_ACS_URL ||
    'https://service.example.com/api/method/univesp.api.sso.consume_saml',
  singleLogoutUrl: 'https://service.example.com/api/method/univesp.api.sso.logout',
  sessionPolicy:
    'Criar cookie HTTP-only para web e token de servico para chamadas internas ao backend.',
}

export const samlClaims = [
  { claim: 'eduPersonPrincipalName', mappedTo: 'login', purpose: 'Identificar o usuario logado.' },
  { claim: 'givenName', mappedTo: 'first_name', purpose: 'Personalizar o atendimento.' },
  { claim: 'sn', mappedTo: 'last_name', purpose: 'Completar o nome do aluno.' },
  { claim: 'mail', mappedTo: 'email', purpose: 'Contato e auditoria do ticket.' },
  { claim: 'studentId', mappedTo: 'ra', purpose: 'Relacionar atendimento ao cadastro academico.' },
  { claim: 'department', mappedTo: 'polo', purpose: 'Roteamento contextual por polo.' },
  { claim: 'memberOf', mappedTo: 'roles', purpose: 'Definir permissoes e personas.' },
]

export const environmentChecklist = [
  {
    key: 'VITE_FRAPPE_BASE_URL',
    purpose: 'Base do backend Frappe para tickets e consulta de contexto.',
  },
  {
    key: 'VITE_FRAPPE_TICKET_DOCTYPE',
    purpose: 'DocType alvo do ticket, como Issue ou HD Ticket.',
  },
  {
    key: 'VITE_AI_GATEWAY_URL',
    purpose: 'Servico que orquestra a conversa com IA.',
  },
  {
    key: 'VITE_AI_NAMESPACE',
    purpose: 'Namespace da base de conhecimento usada pelo bot.',
  },
  {
    key: 'VITE_SAML_ENTITY_ID',
    purpose: 'Entity ID do frontend ou gateway de autenticacao.',
  },
  {
    key: 'VITE_SAML_ACS_URL',
    purpose: 'Assertion consumer service que recebe a resposta SAML.',
  },
  {
    key: 'VITE_SAML_IDP_METADATA_URL',
    purpose: 'Metadata do IdP para bootstrap da confianca.',
  },
  {
    key: 'VITE_HANDOFF_WEBHOOK_URL',
    purpose: 'Webhook para repassar a conversa ao atendimento humano.',
  },
]
