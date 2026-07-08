export const samlBlueprint = {
  identityProvider: 'login.univesp.br com o mesmo gateway SSO do SGP',
  serviceProviderEntityId: import.meta.env.VITE_SAML_ENTITY_ID || 'crm_development',
  nameIdFormat:
    import.meta.env.VITE_SAML_NAME_ID_FORMAT ||
    'urn:oasis:names:tc:SAML:2.0:nameid-format:email',
  nameIdAttribute: import.meta.env.VITE_SAML_NAME_ID_ATTRIBUTE || 'mail',
  assertionConsumerUrl:
    import.meta.env.VITE_SAML_ACS_URL || 'http://localhost:8080/consume',
  singleLogoutUrl: import.meta.env.VITE_SAML_LOGOUT_URL || 'http://localhost:8080/logout',
  azureRedirectUri:
    import.meta.env.VITE_AZURE_REDIRECT_URI ||
    'http://localhost:8080/crm/login',
  sessionPolicy:
    'O frontend libera o acesso pela sessao SSO institucional; Frappe fica apenas como API.',
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
    key: 'VITE_SSO_SESSION_PATH',
    purpose: 'Endpoint que replica o contrato do SGP para sessao atual, por padrao /api/me.',
  },
  {
    key: 'VITE_SSO_START_PATH',
    purpose: 'Inicio generico do SSO que classifica email e redireciona para Azure ou SAML.',
  },
  {
    key: 'VITE_SSO_AZURE_START_PATH',
    purpose: 'Entrada direta do Azure AD para @univesp.br e @*.univesp.br.',
  },
  {
    key: 'VITE_SSO_SAML_START_PATH',
    purpose: 'Entrada direta do SAML para @aluno.univesp.br.',
  },
  {
    key: 'VITE_SSO_LOGOUT_PATH',
    purpose: 'Endpoint de logout da sessao SSO, por padrao /api/sso/logout.',
  },
  {
    key: 'VITE_FRAPPE_BASE_URL',
    purpose: 'Base do backend Frappe para tickets e consulta de contexto.',
  },
  {
    key: 'VITE_FRAPPE_TICKET_DOCTYPE',
    purpose: 'DocType alvo do ticket, como Issue ou HD Ticket.',
  },
  {
    key: 'VITE_SAML_ENTITY_ID',
    purpose: 'Entity ID do frontend ou gateway de autenticacao.',
  },
  {
    key: 'VITE_SAML_ACS_URL',
    purpose: 'Assertion consumer service do frontend/gateway. Local: http://localhost:8080/consume.',
  },
  {
    key: 'VITE_SAML_LOGOUT_URL',
    purpose: 'Single logout do perfil SAML. Homolog: https://homolog-crm.univesp.br/logout.',
  },
  {
    key: 'VITE_AZURE_REDIRECT_URI',
    purpose: 'Callback do OAuth2/Azure AD. Homolog: https://homolog-crm.univesp.br/login.',
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
