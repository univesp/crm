# Handoff da TI para homologação do Atendimento UNIVESP

Este é o checklist canônico para manter o candidato acadêmico atualizado e preparar a homologação. A topologia Cloud Run está em `ops/cloudrun/README.md`; a alternativa de VM permanece em `ops/vm/HANDOFF_TI.md`.

## Estado e regra de branch

- `origin/main`: espelho do upstream; não recebe customizações UNIVESP.
- `origin/univesp/cloudrun-homolog`: linha acadêmica estável da homologação.
- Mudanças entram por branch curta e PR com base `univesp/cloudrun-homolog`.
- Deploy é manual, aprovado pelo Environment `homolog`, usando SHA integrado.
- Imagens e rollback usam SHA ou digest; nunca `latest`.

## 1. O que este release passa a entregar

O workflow constrói dois artefatos do mesmo SHA: a imagem Frappe com CRM, Helpdesk e `univesp_atendimento`, e a imagem Node do SSO Gateway/BFF.

O gateway é implantado primeiro. A URL é obtida pelo workflow e passada ao front door. O bootstrap instala apps ausentes, executa migrations, grava o HMAC no `site_config.json` e provisiona uma conta técnica Frappe.

Fronteira pública:

- `/api/me`, `/api/sso/*` e `/api/app/v1/*` -> gateway;
- gateway -> somente `univesp_atendimento.api.v1.*`, com API key, contexto HMAC e segredo de borda;
- APIs genéricas Frappe, Desk, arquivos e Socket.IO permanecem bloqueados.

## 2. Configuração única no GitHub

Crie o Environment `homolog` com required reviewers, branch permitida `univesp/cloudrun-homolog`, prevenção de self-review e janela de mudança.

### Variables obrigatórias

Base: `GCP_PROJECT_ID`, `GCP_REGION`, `ARTIFACT_REPOSITORY`, `IMAGE_NAME`, `GATEWAY_IMAGE_NAME`, `GATEWAY_SERVICE`, `FRAPPE_SITE_NAME`, `FRAPPE_SERVICE_USER_EMAIL` e `PUBLIC_DOMAIN`.

Dados/rede: `DB_TYPE`, `DB_SETUP_MODE`, `DB_NAME`, `DB_USER`, `DB_ROOT_USERNAME`, `CLOUDSQL_INSTANCE`, `SITES_BUCKET`, `VPC_NETWORK`, `VPC_CONNECTOR`, `VPC_CONNECTOR_RANGE` e `CLOUDRUN_RUNTIME_SERVICE_ACCOUNT`.

Nomes dos secrets:

- `DB_PASSWORD_SECRET_NAME`, `ADMIN_PASSWORD_SECRET_NAME`;
- `REDIS_CACHE_SECRET_NAME`, `REDIS_QUEUE_SECRET_NAME`, `REDIS_SOCKETIO_SECRET_NAME`;
- `BFF_SHARED_SECRET_NAME`, `EDGE_SHARED_SECRET_NAME`;
- `FRAPPE_API_KEY_SECRET_NAME`, `FRAPPE_API_SECRET_SECRET_NAME`;
- `GATEWAY_SESSION_SECRET_NAME`, `GATEWAY_JWT_SECRET_NAME`, `GATEWAY_REDIS_SECRET_NAME`;
- `AZURE_ADMIN_CLIENT_SECRET_NAME`, `AZURE_ACADEMICO_CLIENT_SECRET_NAME`, `SAML_IDP_CERT_SECRET_NAME`.

IdPs: `AZURE_ADMIN_CLIENT_ID`, `AZURE_ADMIN_TENANT_ID`, `AZURE_ACADEMICO_CLIENT_ID`, `AZURE_ACADEMICO_TENANT_ID`, `SAML_IDP_SSO_URL`, `SAML_IDP_SLO_URL` quando houver e `SAML_ENTITY_ID`. `CLOUDFLARE_ZONE_ID` é condicional.

`SSO_GATEWAY_ORIGIN` não é mais manual: o workflow lê a URL do gateway recém-publicado.

### Secrets obrigatórios

- Deploy: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOYER_SERVICE_ACCOUNT`.
- Dados: `DB_PASSWORD`, `ADMIN_PASSWORD`, `REDIS_CACHE_URL`, `REDIS_QUEUE_URL`, `REDIS_SOCKETIO_URL`.
- Frappe: `FRAPPE_API_KEY`, `FRAPPE_API_SECRET`.
- Gateway: `GATEWAY_SESSION_SECRET`, `GATEWAY_JWT_SECRET`, `GATEWAY_REDIS_URL`.
- Confiança: `UNIVESP_BFF_SHARED_SECRET` aleatório com mínimo de 32 bytes e `UNIVESP_EDGE_SHARED_SECRET` com exatamente 64 caracteres hexadecimais.
- IdPs: `AZURE_ADMIN_CLIENT_SECRET`, `AZURE_ACADEMICO_CLIENT_SECRET`, `SAML_IDP_CERT`.
- DNS: `CLOUDFLARE_API_TOKEN` quando aplicável.

Use valores independentes. Nunca registre segredos em Git, logs, screenshots, vídeos ou tickets.

## 3. Cadastro nos provedores de identidade

Azure, para cada app registration:

```text
https://<PUBLIC_DOMAIN>/api/sso/azure/callback
```

SAML:

```text
ACS:      https://<PUBLIC_DOMAIN>/api/sso/saml/callback
EntityID: <SAML_ENTITY_ID>
```

A TI deve entregar tenant/client IDs, secrets, certificado SAML vigente, claims institucionais, usuários sintéticos por perfil e owner de rotação/revogação.

## 4. Conta técnica Frappe

Defina `FRAPPE_SERVICE_USER_EMAIL` com conta exclusiva, nunca `Administrator` ou conta pessoal. O bootstrap cria/habilita o System User e aplica as chaves.

A TI deve gerar chaves próprias de homologação, limitar acesso aos secrets, rotacionar gateway e Frappe juntos e auditar chamadas pelo usuário técnico e `X-Request-ID`.

## 5. Infraestrutura e dados

Confirmar Artifact Registry, Workload Identity Federation, Cloud SQL, banco/usuário, backup/restore com RTO/RPO, bucket, VPC connector, Redis 7 privado, service account mínima, quotas e alertas para web, gateway, worker, scheduler e bootstrap.

Use `provision_infra=true` somente depois de inventariar os recursos existentes.

## 6. Gate e deploy

O PR precisa passar lint, typecheck, build, foundation, E2E, gateway/front door, Semgrep, pre-commit e Semantic Commits. Revisar autorização, migrations, edge, IdP e rollback.

Antes do merge, registre SHA, janela, responsável, canal de incidente, digest anterior, backup e critério de abort.

No GitHub Actions:

1. selecione `univesp/cloudrun-homolog`;
2. execute `Univesp Cloud Run Homolog`;
3. marque `confirm_homolog_deploy=true`;
4. mantenha `provision_infra=false` no deploy normal;
5. aprove o Environment `homolog`;
6. acompanhe secrets, imagens, gateway, bootstrap, web, worker e scheduler;
7. registre URLs, revisões, digests e horário.

O workflow não dispara por push.

## 7. Smoke obrigatório

Sem sessão:

- `/` e `/healthz` retornam 200;
- callback Azure é processado pelo gateway, nunca pela SPA;
- `/api/me` e `/api/app/v1/*` retornam 401;
- APIs Frappe genéricas, Desk, arquivos e Socket.IO retornam 404;
- método institucional interno retorna 404 sem o segredo de borda.

Com contas sintéticas:

- Azure administrativo/acadêmico e SAML concluem login, logout e expiração;
- aluno acessa apenas os próprios tickets;
- OP vê suas filas, faz claim atômico, responde e transiciona;
- analista/gestor acessa apenas sua área;
- admin salva/publica FAQ e confirma consumo no portal;
- usuário A nunca lê ou altera objeto de B;
- worker e scheduler processam após reinício.

Também validar `X-Request-ID`, sessão Redis após escala, payload/anexo inválido, negativas de autorização e mocks desligados.

## 8. Evidências e rollback

Após o deploy, o workflow executa o preflight GCP, o smoke anônimo, captura o manifesto de todos os serviços e publica o artefato `homolog-evidence-<run>-<attempt>`. A TI deve guardar a evidência junto da janela de mudança e complementar os testes por perfil conforme `docs/HOMOLOG_READINESS.md`.

O rollback cobre web, worker, scheduler e gateway e exige duas imagens imutáveis:

```bash
export GCP_PROJECT_ID=<projeto>
export GCP_REGION=<regiao>
export ROLLBACK_IMAGE_URI=<imagem-frappe-anterior-por-sha-ou-digest>
export ROLLBACK_GATEWAY_IMAGE_URI=<imagem-gateway-anterior-por-sha-ou-digest>
export CONFIRM_ROLLBACK=homolog
./ops/cloudrun/rollback.sh
```

O script registra manifestos pré e pós-rollback. Migrations não são desfeitas. Restore exige owner, backup identificado e smoke completo.

## 9. Critério de prontidão

CI comprova o contrato, não a integração real. Homologação assistida exige IdPs configurados, serviços saudáveis, apps/conta técnica provisionados, smoke por perfil, negativos de autorização, observabilidade e restore/rollback exercitados.

A carga rápida de FAQs por XLSX ou JSON, com imagem/vídeo por HTTPS, está em `docs/FAQ_CARGA_RAPIDA.md`.
