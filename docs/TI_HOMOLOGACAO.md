# Handoff da TI para homologação do Atendimento UNIVESP

Este é o checklist canônico para manter o candidato acadêmico atualizado e preparar a homologação. A topologia Cloud Run está em `ops/cloudrun/README.md`; a alternativa de VM permanece em `ops/vm/HANDOFF_TI.md`.

O kit executável para administradores GitHub, GCP e IdP está em `ops/cloudrun/ti/README.md`. Comece pelo workflow somente leitura `Univesp Cloud Run Readiness`; o deploy deve permanecer bloqueado até o artefato de readiness ficar verde.

## Estado verificado em 21/07/2026

Os PRs de prontidão, descoberta e migração de segredos foram integrados até o merge `3d5f0dbe`. A execução [29850321560](https://github.com/univesp/crm/actions/runs/29850321560) comprovou:

- autenticação OIDC do GitHub no projeto `univesp-201808`;
- Artifact Registry e runtime service account acessíveis;
- 15 secrets com versão `latest` habilitada, incluindo Redis, conta técnica Frappe, Azure administrativo, Azure acadêmico e certificado SAML;
- descoberta do gateway legado `sgp` e migração dos valores IdP legados ao Secret Manager sem registrá-los em log;
- nenhuma imagem construída e nenhum tráfego alterado, pois o preflight interrompeu a execução antes do build.

O deploy está bloqueado somente pela leitura/uso de três dependências GCP pela service account armazenada em `GCP_DEPLOYER_SERVICE_ACCOUNT`: Cloud SQL `pgsql17-prod`, bucket `univesp-201808-crm-homolog-sites` e VPC connector `crm-homolog-connector`.

Um administrador GCP deve conceder à identidade de deploy os papéis mínimos abaixo no projeto:

```bash
export PROJECT_ID=univesp-201808
export DEPLOYER_SA=<valor-de-GCP_DEPLOYER_SERVICE_ACCOUNT>

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}" \
  --role roles/cloudsql.client

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}" \
  --role roles/storage.bucketViewer

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}" \
  --role roles/vpcaccess.user

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA}" \
  --role roles/compute.viewer
```

`roles/cloudsql.client` inclui `cloudsql.instances.get`; `roles/storage.bucketViewer` permite somente metadados/listagem de buckets; e o Google exige Serverless VPC Access User mais Compute Viewer para implantar Cloud Run com connector. Referências oficiais: [Cloud SQL IAM](https://docs.cloud.google.com/sql/docs/postgres/iam-roles), [Cloud Storage IAM](https://docs.cloud.google.com/storage/docs/access-control/iam-roles) e [Serverless VPC Access](https://docs.cloud.google.com/vpc/docs/configure-serverless-vpc-access).

Depois da concessão, execute novamente `Univesp Cloud Run Homolog` com `confirm_homolog_deploy=true` e `provision_infra=false`. Não é necessário rotacionar ou recadastrar os segredos já migrados.

Um administrador do repositório também deve endurecer o Environment `homolog` com reviewers obrigatórios, branch permitida e prevenção de self-review. A conta atual conseguiu publicar variables/secrets e PRs, mas recebeu `403 Must have admin rights to Repository` ao tentar administrar Environments.

### Contas sintéticas que a TI deve criar nos IdPs

Criar contas exclusivas de homologação, sem reutilizar pessoas reais, com MFA e owner de expiração:

| Perfil | IdP/claim esperado | Escopo mínimo |
|---|---|---|
| aluno | Azure acadêmico ou SAML; identificador acadêmico estável | próprios tickets e FAQ publicada |
| operador | Azure administrativo; grupo/claim de OP | filas atribuídas, claim e resposta |
| área | Azure administrativo; área explícita | somente tickets da própria área |
| admin | Azure administrativo; grupo administrativo | catálogos, parâmetros e publicação de FAQ |

A criação automática dessas identidades não deve ser feita pelo CRM: ela exige governança do tenant/IdP. Configure `INITIAL_ADMIN_EMAIL` com a conta sintética administrativa; o bootstrap cria somente o primeiro `admin_central`. Os outros logins geram solicitações que o admin deve aprovar como `aluno`, `op` e `analista_area`, com filas/áreas explícitas. Registre os identificadores no cofre de testes e execute `docs/HOMOLOG_READINESS.md`. Não armazenar senhas no repositório ou em variables do GitHub.

## Estado e regra de branch

- `origin/main`: espelho do upstream; não recebe customizações UNIVESP.
- `origin/univesp/cloudrun-homolog`: linha acadêmica estável da homologação.
- Mudanças entram por branch curta e PR com base `univesp/cloudrun-homolog`.
- Deploy é manual, aprovado pelo Environment `homolog`, usando SHA integrado.
- Imagens e rollback usam SHA ou digest; nunca `latest`.

## 1. O que este release passa a entregar

O workflow constrói dois artefatos do mesmo SHA: a imagem Frappe com CRM, Helpdesk e `univesp_atendimento`, e a imagem Node do SSO Gateway/BFF.

O gateway é implantado primeiro. A URL é obtida pelo workflow e passada ao front door. O bootstrap instala apps ausentes, executa migrations, grava o HMAC no `site_config.json`, provisiona a conta técnica Frappe e cria o primeiro `admin_central` de forma idempotente quando ainda não existe administrador ativo.

Fronteira pública:

- `/api/me`, `/api/sso/*` e `/api/app/v1/*` -> gateway;
- gateway -> somente `univesp_atendimento.api.v1.*`, com API key, contexto HMAC e segredo de borda;
- APIs genéricas Frappe, Desk, arquivos e Socket.IO permanecem bloqueados.

## 2. Configuração única no GitHub

Crie o Environment `homolog` com required reviewers, branch permitida `univesp/cloudrun-homolog`, prevenção de self-review e janela de mudança.

### Variables obrigatórias

Base: `GCP_PROJECT_ID`, `GCP_REGION`, `ARTIFACT_REPOSITORY`, `IMAGE_NAME`, `GATEWAY_IMAGE_NAME`, `GATEWAY_SERVICE`, `FRAPPE_SITE_NAME`, `FRAPPE_SERVICE_USER_EMAIL`, `INITIAL_ADMIN_EMAIL` e `PUBLIC_DOMAIN`.

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
