# Contrato do SSO Gateway / BFF

O gateway e a unica borda autenticada do atendimento. O navegador nao recebe
tokens tecnicos do Frappe e nao acessa `/api/resource` ou `/api/method`.

## Responsabilidades

1. concluir OIDC/SAML no servidor, validando assinatura, issuer, audience,
   `state` e `nonce`;
2. manter a sessao em cookie `Secure`, `HttpOnly` e `SameSite=Lax`;
3. consultar o perfil autorizado no app `univesp_atendimento`;
4. expor `/api/me` e `/api/app/v1/*` no mesmo dominio do portal;
5. assinar o contexto enviado ao Frappe e encaminhar `X-Request-ID`;
6. aplicar limite de requisicoes, tamanho de upload e logs sem dados pessoais.

## Contexto assinado

Antes de chamar um metodo whitelisted do Frappe, o gateway envia:

- `X-Univesp-User-Context`: JSON em base64url com `email`, `name`, `ra` e `timestamp`;
- `X-Univesp-Timestamp`: epoch em segundos;
- `X-Univesp-Signature`: HMAC-SHA256 hexadecimal de
  `<timestamp>.<X-Univesp-User-Context>`;
- `X-Request-ID`: UUID propagado durante toda a requisicao.

O segredo HMAC fica somente no secret manager/gateway e em
`univesp_bff_shared_secret` no `site_config.json`. A janela aceita pelo Frappe e
de 60 segundos.

## Bloqueio de liberacao

Nao publicar este fluxo enquanto o codigo real do gateway nao estiver
versionado, revisado e coberto por testes de sessao forjada, elevacao de perfil,
CSRF e IDOR.
