# Analise SSO Frappe para aproximacao de producao

## Objetivo

Consolidar o caminho tecnico para aproximar o `univesp-frontend` da homolog/producao sem alterar autenticacao, rotas ou contratos existentes nesta etapa.

Esta analise compara tres opcoes:

- gateway SSO institucional expondo `/api/sso/*` e `/api/me`
- Social Login Key/OAuth/OIDC nativo do Frappe
- token/API key do Frappe apenas para integracoes server-to-server ou debug isolado

## Estado atual do repositorio

O desenho atual do `univesp-frontend` ja separa autenticacao institucional da API de negocio:

- `src/services/ssoClient.js` centraliza sessao, inicio de login e logout.
- `src/stores/auth.js` consome o runtime de SSO e define o estado autenticado do app.
- `src/services/frappeApi.js` chama `/api/resource/...` e `/api/method/...` com `credentials: include`.
- `docs/frappe-crm-auth.md` define que o navegador deve usar sessao institucional do gateway SSO, sem segredo Frappe no bundle.

Endpoints esperados hoje:

- `GET /api/me`
- `GET /api/sso/start?email=...&next=/crm/...`
- `GET /api/sso/azure/start?tenant=admin|academico&next=/crm/...`
- `GET /api/sso/saml/start?next=/crm/...`
- `POST /api/sso/logout`

Lacuna atual: `ssoClient.js` ainda resolve parte do fluxo no frontend para desenvolvimento/prototipo, incluindo montagem de URL Azure e processamento de `id_token` no browser. Para homolog/producao, essa responsabilidade deve sair do bundle e ir para um gateway/backend confiavel.

## Documentacao Frappe consultada

A documentacao oficial do Frappe cobre estes blocos relevantes:

- [Social Login Key](https://docs.frappe.io/framework/user/en/guides/integration/social_login_key): configura provedores como Frappe, GitHub, Google, Microsoft e provedores customizados com `Client ID` e `Client Secret`.
- [How to setup OAuth 2](https://docs.frappe.io/framework/user/en/guides/integration/how_to_set_up_oauth): descreve OAuth Provider Settings e OAuth Client, com escopos, redirect URIs e grant types.
- [OpenID Connect and Frappe social login](https://docs.frappe.io/framework/user/en/guides/integration/openid_connect_and_frappe_social_login): mostra uso do escopo `openid` para receber `id_token` junto do `access_token`.
- [REST API](https://docs.frappe.io/framework/user/en/api/rest): documenta autenticacao por token, sessao/senha e bearer token OAuth.
- [Simple Authentication](https://docs.frappe.io/framework/user/en/guides/integration/rest_api/simple_authentication): documenta login por `/api/method/login`, cookie `sid`, logout e usuario logado.

Na documentacao oficial consultada, SAML nao aparece como caminho principal consolidado para o Frappe CRM nesta base. Por isso, para o perfil aluno via SAML institucional, o caminho de menor risco e tratar SAML no gateway SSO e entregar ao frontend apenas uma sessao institucional normalizada.

## Comparacao das opcoes

### Opcao 1: Gateway SSO institucional

Recomendacao preliminar para homolog/producao.

Fluxo:

1. O usuario acessa o frontend.
2. O frontend chama `GET /api/me`.
3. Sem sessao, o frontend redireciona para `/api/sso/start?email=...&next=...`.
4. O gateway classifica o usuario e encaminha para Azure AD ou SAML.
5. O callback termina no gateway, que valida tokens/assertions, cria sessao segura e redireciona ao frontend.
6. O frontend passa a consumir Frappe via mesma origem, cookie e `credentials: include`.

Vantagens:

- Compatibiliza Azure/OIDC e SAML sem colocar segredos no browser.
- Mantem o Frappe como backend/engine, sem deslocar regra critica para o cliente.
- Permite replicar o padrao do SGP e aproximar homolog/producao com baixo acoplamento.
- Centraliza mapeamento de claims, grupos, perfis, polos e areas.

Riscos:

- Exige contrato claro do gateway.
- Exige decisao de como a sessao institucional se traduz em usuario/roles do Frappe.
- Exige politicas de cookie, CSRF, SameSite e dominio consistentes entre frontend, gateway e Frappe.

### Opcao 2: Social Login Key/OAuth/OIDC nativo do Frappe

Viavel quando o provedor institucional suportar OAuth/OIDC de forma compativel com o Frappe.

Uso esperado:

- configurar `Social Login Key` no Frappe;
- configurar `OAuth Client`, redirects e escopos quando o Frappe atuar como provider ou client;
- validar mapeamento entre identidade externa, `User`, roles e permissoes Frappe.

Vantagens:

- Usa recursos documentados do Frappe.
- Pode reduzir componentes externos se todos os perfis usarem OIDC/OAuth.
- Mantem autorizacao baseada em roles/permissoes Frappe.

Riscos:

- Pode nao cobrir SAML de aluno sem componente adicional.
- Pode acoplar a tela/fluxo de login ao Frappe Desk em vez do padrao SGP.
- Requer validacao real de callbacks, user provisioning e grupos institucionais.

### Opcao 3: Token/API key do Frappe

Permitido apenas para server-to-server, jobs, scripts, integracoes backend ou debug isolado.

Nao usar no frontend web em producao.

Motivo:

- qualquer variavel `VITE_*` entra no bundle do navegador;
- `API Secret` no browser vira segredo publico;
- o token representa um usuario tecnico e nao substitui sessao por usuario final;
- auditoria, permissao e rastreabilidade ficariam fracas para operacao real.

## Contratos minimos para homolog

### `GET /api/me`

Deve retornar a sessao institucional normalizada.

Campos minimos recomendados:

- `id`
- `email`
- `displayName`
- `flow`: `aluno`, `admin` ou `academico`
- `roles` ou `groups`
- `profileKey` ou perfil operacional equivalente
- `polo` quando aplicavel
- `area` quando aplicavel
- `expiresAt` ou indicacao equivalente de validade da sessao

Resposta sem sessao:

- HTTP `401` ou `204`, desde que o frontend consiga distinguir anonimo de erro operacional.

### `GET /api/sso/start?email=&next=`

Deve:

- validar `next` como rota interna permitida;
- classificar email institucional;
- redirecionar para Azure/OIDC ou SAML;
- preservar estado/nonce no servidor ou em cookie seguro;
- nunca aceitar redirect aberto para dominio externo.

### Callbacks SAML/Azure

Devem terminar no gateway/backend, nao no frontend.

Responsabilidades:

- validar assinatura, issuer, audience, nonce/state e expiracao;
- normalizar claims institucionais;
- resolver ou provisionar usuario autorizado;
- criar sessao segura;
- redirecionar para `next` validado.

### Consumo do Frappe

O frontend deve manter:

```js
fetch(url, {
  credentials: 'include',
})
```

Para metodos mutaveis, o gateway/Frappe deve garantir CSRF compativel com o desenho de cookie. O token tecnico do Frappe deve ficar somente no backend quando for necessario mediar chamadas.

## Decisao recomendada para a proxima etapa

Manter gateway SSO como direcao default ate a validacao com TI/SGP provar que Social Login/OIDC do Frappe cobre todos os perfis com menor risco.

Antes de implementar, levantar com TI:

- IdP real para aluno, OP/secretario, gestor e admin.
- Se aluno obrigatoriamente usa SAML.
- Claims disponiveis: email, nome, RA, polo, area, grupos e vinculos.
- Politica de provisioning de usuarios no Frappe.
- Dominio final, subdominios e politica de cookies.
- SLA de expiracao de sessao e logout institucional.

## Validacao desta etapa

Nivel de validacao: documental.

Esta etapa nao altera:

- componentes `.vue`;
- `src/services`;
- `src/router.js`;
- autenticacao real;
- build/deploy;
- branch `main`.

Evidencias esperadas na entrega:

- `git diff --stat`
- `git status --short`

