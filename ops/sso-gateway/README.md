# Contrato do SSO Gateway / BFF

O codigo executavel do gateway esta em `sso-gateway/`. Ele e a unica borda
autenticada do atendimento. O navegador nao recebe
tokens tecnicos do Frappe e nao acessa `/api/resource` ou `/api/method`.

## Responsabilidades

1. concluir OIDC/SAML no servidor, validando assinatura, issuer, audience,
   `state` e `nonce`;
2. manter a sessao em cookie `Secure`, `HttpOnly` e `SameSite=Lax`;
3. consultar o perfil autorizado no app `univesp_atendimento`;
4. expor `/api/me` e `/api/app/v1/*` no mesmo dominio do portal;
5. assinar o contexto enviado ao Frappe e encaminhar `X-Request-ID`;
6. persistir sessoes no Redis e limitar o corpo JSON a 1 MB;
7. usar uma conta tecnica Frappe exclusiva, mantida apenas no `.env` da VM.

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

## Configuracao interna

O Gateway chama somente metodos `univesp_atendimento.api.v1.*` com
`FRAPPE_API_KEY` e `FRAPPE_API_SECRET`. A conta tecnica autentica a chamada; o
contexto HMAC identifica o usuario e o app Frappe aplica perfil, acao e escopo.
Uma camada nao substitui a outra.

Antes do deploy, preencher as variaveis de `sso-gateway/.env.example` no `.env`
existente da VM. As sessoes usam o prefixo exclusivo
`univesp:crm:session:` e podem compartilhar o endpoint Redis gerenciado do
Frappe quando a infraestrutura aceitar apenas o banco padrao.

## Bloqueio de liberacao

Nao aplicar o Nginx restritivo antes de instalar o app Frappe, cadastrar os
perfis de teste, publicar o Gateway e validar aluno/OP ponta a ponta.
