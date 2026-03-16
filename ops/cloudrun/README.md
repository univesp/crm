# Frappe CRM no Cloud Run

Este diretório empacota uma topologia de Cloud Run adaptada ao Frappe CRM:

- `web`: Cloud Run público com `nginx + gunicorn + socket.io` no mesmo container.
- `worker`: Cloud Run privado, instância fixa, CPU sempre alocada, processando filas Redis.
- `scheduler`: Cloud Run privado, instância fixa, CPU sempre alocada, executando `bench schedule`.
- `bootstrap`: Cloud Run Job idempotente para criar o site, instalar o app e rodar `migrate`.

## Decisões importantes

- Branch: use `main`, não `develop`. Em 16 de março de 2026 o próprio README do projeto marca `main` como estável e `develop` como futuro/v2.
- Frappe branch: a imagem usa `version-16` para viabilizar PostgreSQL. O código oficial do Frappe v16 expõe suporte a PostgreSQL, mas marca esse caminho como experimental.
- Banco: com as instâncias citadas (`pgsql17-prod` e `mysql8-geral`), não existe uma combinação 100% suportada pelo upstream sem trade-off:
  - `PostgreSQL 17` + `version-16`: caminho explícito no código do Frappe, porém experimental.
  - `MySQL 8` + modo `mariadb`: plausível no protocolo, porém não é a combinação oficialmente testada pelo Frappe.
  - Para suporte upstream mais conservador, o ideal seria uma instância MariaDB compatível.
- SSL: o fluxo padrão aqui usa `Cloud Run domain mapping` com certificado gerenciado pelo Google e renovação automática. Isso substitui `certbot` porque Cloud Run gerenciado não recebe certificado PEM diretamente como um VM/reverse proxy clássico. Se você insistir em `certbot + Let's Encrypt`, a arquitetura correta passa a ser `External HTTPS Load Balancer + Certificate Manager/self-managed cert`, não domain mapping direto.
- DNS Cloudflare: o deploy cria ou lê o `domain mapping` e sincroniza os registros no Cloudflare via API. Os registros são gravados com `proxied=false` para não atrapalhar validação e renovação do certificado gerenciado.

## Pré-requisitos

### GitHub

- Fork em `univesp/crm`
- GitHub Actions habilitado
- Secrets:
  - `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - `GCP_DEPLOYER_SERVICE_ACCOUNT`
  - `DB_ROOT_PASSWORD`
  - `DB_PASSWORD`
  - `ADMIN_PASSWORD`
  - `REDIS_CACHE_URL`
  - `REDIS_QUEUE_URL`
  - `REDIS_SOCKETIO_URL`
  - `CLOUDFLARE_API_TOKEN`

### GitHub Variables

- `GCP_PROJECT_ID=univesp-201808`
- `GCP_REGION=us-east1`
- `ARTIFACT_REPOSITORY=crm`
- `IMAGE_NAME=frappe-crm`
- `FRAPPE_SITE_NAME=homolog.crm.univesp.br`
- `PUBLIC_DOMAIN=homolog.crm.univesp.br`
- `DB_TYPE=postgres`
- `DB_NAME=crm_homolog`
- `DB_USER=crm_homolog`
- `DB_ROOT_USERNAME=postgres`
- `CLOUDSQL_INSTANCE=univesp-201808:us-east1:pgsql17-prod`
- `SITES_BUCKET=univesp-201808-crm-homolog-sites`
- `VPC_NETWORK=default`
- `VPC_CONNECTOR=crm-homolog-connector`
- `VPC_CONNECTOR_RANGE=10.8.0.0/28`
- `CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=crm-homolog-run@univesp-201808.iam.gserviceaccount.com`
- `REDIS_CACHE_SECRET_NAME=crm-homolog-redis-cache-url`
- `REDIS_QUEUE_SECRET_NAME=crm-homolog-redis-queue-url`
- `REDIS_SOCKETIO_SECRET_NAME=crm-homolog-redis-socketio-url`
- `DB_ROOT_PASSWORD_SECRET_NAME=crm-homolog-db-root-password`
- `DB_PASSWORD_SECRET_NAME=crm-homolog-db-password`
- `ADMIN_PASSWORD_SECRET_NAME=crm-homolog-admin-password`
- `CLOUDFLARE_ZONE_ID=<zone id do domínio univesp.br>`

### Google Cloud / domínio

- O domínio `univesp.br` ou o subdomínio apropriado precisa estar verificado no Google para o `Cloud Run domain mapping`.
- O service account usado pelo GitHub OIDC precisa ter permissões para Artifact Registry, Cloud Run, Secret Manager e, se for provisionar tudo, VPC Access e Memorystore.

## Fluxo

1. Execute `ops/cloudrun/provision.sh` autenticado no GCP para criar Artifact Registry, bucket, service account, VPC connector e permissões mínimas do runtime.
2. Alimente os secrets do GitHub.
3. Rode o workflow `Univesp Cloud Run Homolog`.
4. O workflow:
   - autentica no GCP via Workload Identity Federation,
   - builda a imagem em Artifact Registry,
   - sincroniza os secrets no Secret Manager,
   - executa o job de bootstrap,
   - publica `web`, `worker` e `scheduler`,
   - cria o `domain mapping`,
   - sincroniza os registros DNS no Cloudflare.

## Comandos locais úteis

Provisionar infra base:

```bash
export PATH="$HOME/.local/src/google-cloud-sdk/bin:$PATH"
export GCP_PROJECT_ID=univesp-201808
export GCP_REGION=us-east1
export CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=crm-homolog-run@univesp-201808.iam.gserviceaccount.com
export SITES_BUCKET=univesp-201808-crm-homolog-sites
export VPC_CONNECTOR=crm-homolog-connector
./ops/cloudrun/provision.sh
```

Executar deploy completo:

```bash
export PATH="$HOME/.local/src/google-cloud-sdk/bin:$PATH"
export GCP_PROJECT_ID=univesp-201808
export GCP_REGION=us-east1
export IMAGE_URI=us-east1-docker.pkg.dev/univesp-201808/crm/frappe-crm:manual
export CLOUDSQL_INSTANCE=univesp-201808:us-east1:pgsql17-prod
export SITES_BUCKET=univesp-201808-crm-homolog-sites
export VPC_CONNECTOR=crm-homolog-connector
export CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=crm-homolog-run@univesp-201808.iam.gserviceaccount.com
./ops/cloudrun/deploy.sh
```
