# Autenticacao e acesso ao Frappe

O navegador se autentica no SSO Gateway e consome apenas APIs same-origin do
BFF. O Frappe e o motor interno e nao recebe chamadas diretas do frontend.

## Fluxo

1. OIDC/SAML e concluido no gateway, com validacao de assinatura, issuer,
   audience, `state` e `nonce`;
2. o gateway cria cookie `Secure`, `HttpOnly` e `SameSite=Lax`;
3. `/api/me` devolve identidade, perfil, escopos, acoes e expiracao;
4. o frontend chama `/api/app/v1/*` com `credentials: include`;
5. o gateway assina a identidade e chama `univesp_atendimento.api.v1` no
   Frappe pela rede interna.

## Configuracao publica

```bash
VITE_APP_BASE=/
VITE_ROUTER_BASE=/
VITE_APP_API_BASE=/api/app/v1
VITE_SSO_SESSION_PATH=/api/me
VITE_SSO_START_PATH=/api/sso/start
VITE_SSO_AZURE_START_PATH=/api/sso/azure/start
VITE_SSO_SAML_START_PATH=/api/sso/saml/start
VITE_SSO_LOGOUT_PATH=/api/sso/logout
VITE_SSO_LOGOUT_METHOD=POST
```

Nenhuma chave, segredo, token tecnico, client secret ou cabecalho de
autorizacao pode existir em variavel `VITE_*`, `localStorage` ou
`sessionStorage`.

## Rotas

- `GET /api/me`
- `GET /api/sso/start`
- `GET /api/sso/azure/start`
- `GET /api/sso/saml/start`
- `POST /api/sso/logout`
- `/api/app/v1/*`, conforme `docs/architecture/API_CONTRACT.md`

`/api/resource`, `/api/method` e `/private/files` devem retornar 404 no dominio
publico. Credenciais de servico ficam no secret manager e somente no processo
do gateway.
