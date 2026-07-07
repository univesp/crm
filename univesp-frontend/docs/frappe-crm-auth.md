# Frappe CRM Auth e API

## Objetivo

Documentar a configuracao minima para o `univesp-frontend` usar o mesmo SSO do SGP e consumir o Frappe CRM apenas via API.

## Regra principal

Para navegador, usar sessao institucional do gateway SSO.

- login por SAML ou OAuth2 acontece em `/api/sso/*`
- o gateway devolve a sessao institucional e expone `/api/me`
- o frontend consome a API com `credentials: include`

Nao usar `VITE_FRAPPE_API_SECRET`. Segredo em `VITE_*` fica exposto no bundle.

## Variaveis publicas do frontend

```bash
VITE_APP_BASE=/
VITE_ROUTER_BASE=/
VITE_FRAPPE_BASE_URL=
VITE_FRAPPE_AUTH_MODE=session
VITE_SSO_BASE_URL=
VITE_SSO_SESSION_PATH=/api/me
VITE_SSO_START_PATH=/api/sso/start
VITE_SSO_AZURE_START_PATH=/api/sso/azure/start
VITE_SSO_SAML_START_PATH=/api/sso/saml/start
VITE_SSO_LOGOUT_PATH=/api/sso/logout
VITE_SAML_ENTITY_ID=crm_production
VITE_SAML_NAME_ID_FORMAT=urn:oasis:names:tc:SAML:2.0:nameid-format:email
VITE_SAML_NAME_ID_ATTRIBUTE=mail
VITE_SAML_ACS_URL=https://homolog-crm.univesp.br/consume
VITE_SAML_LOGOUT_URL=https://homolog-crm.univesp.br/logout
VITE_AZURE_REDIRECT_URI=https://homolog-crm.univesp.br/api/sso/azure/callback
```

Com `VITE_FRAPPE_BASE_URL=` vazio, o frontend usa a mesma origem e depende do proxy reverso local ou do Cloud Run.

## Metadata SAML recebida

### homolog

- `Entity ID`: `crm_production`
- `AssertionConsumerService`: `https://homolog-crm.univesp.br/consume`
- `SingleLogoutService`: `https://homolog-crm.univesp.br/logout`
- `NameIDFormat`: `urn:oasis:names:tc:SAML:2.0:nameid-format:email`
- `simplesaml.nameidattribute`: `mail`

### local

- `Entity ID`: `crm_development`
- `AssertionConsumerService`: `http://localhost:8080/consume`
- `SingleLogoutService`: `http://localhost:8080/logout`
- `NameIDFormat`: `urn:oasis:names:tc:SAML:2.0:nameid-format:email`
- `simplesaml.nameidattribute`: `mail`

## Callback Azure AD

- local: `http://localhost:8080/api/sso/azure/callback`
- homolog: `https://homolog-crm.univesp.br/api/sso/azure/callback`

## Quando usar chave de API do Frappe

So para integracoes server-to-server ou debug isolado.

Passos:

1. criar um usuario tecnico dedicado no Frappe
2. restringir perfis e permissoes ao minimo necessario
3. gerar `API Key` e `API Secret`
4. guardar isso fora do frontend, de preferencia no backend ou secret manager

## Token manual so para dev/homolog

Se precisar validar uma chamada no browser antes do backend de login estar pronto:

1. defina `VITE_FRAPPE_AUTH_MODE=token`
2. no DevTools do navegador:

```js
localStorage.setItem('univesp.frappe.authHeader', 'token API_KEY:API_SECRET')
```

3. recarregue a pagina

Para remover:

```js
localStorage.removeItem('univesp.frappe.authHeader')
sessionStorage.removeItem('univesp.frappe.authHeader')
```

## Endpoints esperados pelo frontend

- `GET /api/me`
- `GET /api/sso/start?email=...&next=/...`
- `GET /api/sso/azure/start?tenant=admin|academico&next=/...`
- `GET /api/sso/saml/start?next=/...`
- `POST /api/sso/logout`
- `POST /api/resource/:doctype`
- `POST /api/method/univesp.api.ticket.attach_triage`
- `POST /api/method/univesp.api.ticket.append_chat_summary`
- `POST /api/method/univesp.api.ticket.request_handoff`
