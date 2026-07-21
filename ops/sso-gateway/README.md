# Contrato do SSO Gateway / BFF

O código executável está em `sso-gateway/`. Ele é a única borda autenticada do atendimento: o navegador não recebe tokens técnicos do Frappe nem acessa APIs genéricas.

## Responsabilidades

1. concluir OIDC/SAML no servidor, validando assinatura, issuer, audience, `state` e `nonce`;
2. manter sessão em cookie `Secure`, `HttpOnly` e `SameSite=Lax`;
3. consultar o perfil autorizado no app `univesp_atendimento`;
4. expor `/api/me` e `/api/app/v1/*` no domínio do portal;
5. assinar contexto Frappe e propagar `X-Request-ID`;
6. persistir sessões no Redis e limitar JSON a 3 MB;
7. usar conta técnica Frappe exclusiva;
8. autenticar a passagem pelo front door com `UNIVESP_EDGE_SHARED_SECRET`.

## Contexto e dupla confiança

O gateway envia:

- `X-Univesp-User-Context`: JSON base64url com identidade;
- `X-Univesp-Timestamp`;
- `X-Univesp-Signature`: HMAC-SHA256 de `<timestamp>.<contexto>`;
- `X-Univesp-Gateway-Key`: segredo de borda;
- `X-Request-ID`: correlação ponta a ponta.

`UNIVESP_BFF_SHARED_SECRET` fica no gateway e em `univesp_bff_shared_secret` do site. `UNIVESP_EDGE_SHARED_SECRET` fica no gateway e no nginx do serviço web. São segredos diferentes.

A API key autentica a conta técnica; o HMAC identifica o usuário final; o app aplica ação/perfil/escopo. Uma camada não substitui outra.

## Cloud Run

A imagem é construída por `sso-gateway/Dockerfile` e publicada por `ops/cloudrun/deploy-sso-gateway.sh`. O serviço:

- escuta em `0.0.0.0:$PORT`;
- confia em um hop do proxy Cloud Run;
- usa Redis persistente;
- expõe `/health`;
- recebe secrets do Secret Manager;
- é publicado antes do front door Frappe.

O workflow calcula automaticamente a URL Cloud Run do gateway. Os callbacks externos continuam no domínio do portal:

- `https://<PUBLIC_DOMAIN>/api/sso/azure/callback`;
- `https://<PUBLIC_DOMAIN>/api/sso/saml/callback`.

A origem Frappe configurada no gateway pode ser o front door público porque somente o namespace institucional protegido pelo header de borda é liberado até o gunicorn.

## Bloqueio de liberação

Não liberar sem app Frappe instalado, conta técnica, Redis, callbacks nos IdPs e smoke por aluno/OP/área/admin. Os valores completos estão em `sso-gateway/.env.example`; o handoff canônico está em `docs/TI_HOMOLOGACAO.md`.
