# Frappe CRM no Cloud Run

Este diretório empacota uma topologia de Cloud Run adaptada ao Frappe CRM:

- `web`: Cloud Run público com `nginx + gunicorn + socket.io` no mesmo container, servindo o `univesp-frontend` na raiz e o Frappe CRM em `/crm`.
- `worker`: Cloud Run privado, instância fixa, CPU sempre alocada, processando filas Redis.
- `scheduler`: Cloud Run privado, instância fixa, CPU sempre alocada, executando `bench schedule`.
- `bootstrap`: Cloud Run Job idempotente para criar o site, instalar o app e rodar `migrate`.

## Modo econômico para homolog

Se a homolog vai ficar um tempo com pouco uso e sem necessidade de processar fila em tempo real, use o perfil barato:

- `DEPLOY_PROFILE=single-user` reduz `web` para `1 vCPU`, `1 GiB`, `minScale=0`, `maxScale=1`.
- Esse mesmo perfil também "estaciona" `worker` e `scheduler`: ambos passam a `minScale=0` e CPU com throttling, então podem escalar para zero.
- Resultado prático: a aplicação web continua acessível, mas jobs assíncronos e rotinas agendadas deixam de ser garantidos enquanto o ambiente estiver estacionado.

Trade-offs do modo econômico:

- filas Redis podem acumular;
- envios assíncronos, notificações e tarefas em background podem atrasar ou não rodar;
- tarefas periódicas do Frappe deixam de ser confiáveis até reativar o modo completo.

Para alternar apenas os serviços existentes, sem rebuild da imagem e sem mexer no banco:

```bash
export GCP_PROJECT_ID=univesp-201808
MODE=parked ./ops/cloudrun/set-service-mode.sh
```

Para restaurar o comportamento atual:

```bash
export GCP_PROJECT_ID=univesp-201808
MODE=full ./ops/cloudrun/set-service-mode.sh
```

## Decisões importantes

- Base upstream: use `main`, não `develop`. Em 16 de março de 2026 o próprio README do projeto marca `main` como estável e `develop` como futuro/v2.
- Estratégia do fork: mantenha `origin/main` como espelho limpo do upstream e deixe traduções `pt_BR`, GitHub Actions, Cloud Run e `univesp-frontend` somente em `univesp/cloudrun-homolog`.
- Frappe branch: a imagem usa `version-16` para viabilizar PostgreSQL. O código oficial do Frappe v16 expõe suporte a PostgreSQL, mas marca esse caminho como experimental.
- Banco: com as instâncias citadas (`pgsql17-prod` e `mysql8-geral`), não existe uma combinação 100% suportada pelo upstream sem trade-off:
  - `PostgreSQL 17` + `version-16`: caminho explícito no código do Frappe, porém experimental.
  - `MySQL 8` + modo `mariadb`: plausível no protocolo, porém não é a combinação oficialmente testada pelo Frappe.
  - Para suporte upstream mais conservador, o ideal seria uma instância MariaDB compatível.
- SSL: o fluxo padrão aqui usa `Cloud Run domain mapping` com certificado gerenciado pelo Google e renovação automática. Isso substitui `certbot` porque Cloud Run gerenciado não recebe certificado PEM diretamente como um VM/reverse proxy clássico. Se você insistir em `certbot + Let's Encrypt`, a arquitetura correta passa a ser `External HTTPS Load Balancer + Certificate Manager/self-managed cert`, não domain mapping direto.
- DNS Cloudflare: o deploy cria ou lê o `domain mapping` e sincroniza os registros no Cloudflare via API. Os registros são gravados com `proxied=false` para não atrapalhar validação e renovação do certificado gerenciado.
- Redis: `Cloud Memorystore for Redis` não funciona com esse bootstrap do Frappe porque o Google bloqueia a família de comandos `CLIENT` e o `redis-py` usado pelo Frappe chama `CLIENT ID`. O caminho validado aqui é Redis 7 autogerenciado em uma VM privada com firewall restrito ao range do connector do Cloud Run.
- Cloud SQL: para instâncias sem IP público, o container sobe o `cloud-sql-proxy` com `--private-ip`.

## Pré-requisitos

### GitHub

- Fork em `univesp/crm`
- GitHub Actions habilitado
- Secrets:
  - `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - `GCP_DEPLOYER_SERVICE_ACCOUNT`
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
- `FRAPPE_SITE_NAME=homolog-crm.univesp.br`
- `PUBLIC_DOMAIN=homolog-crm.univesp.br`
- `SSO_GATEWAY_ORIGIN=https://<origem-do-sso-gateway>`
- `DB_TYPE=postgres`
- `DB_SETUP_MODE=existing`
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
- `DB_PASSWORD_SECRET_NAME=crm-homolog-db-password`
- `ADMIN_PASSWORD_SECRET_NAME=crm-homolog-admin-password`
- `CLOUDFLARE_ZONE_ID=<zone id do domínio univesp.br>`

### Fronteira HTTP da homolog

O nginx do serviço público fica como entrada única do ambiente:

- `/` e `/login` servem o `univesp-frontend`.
- `/api/me` e `/api/sso/*` vão para `SSO_GATEWAY_ORIGIN`.
- `/api/method/*`, `/api/resource/*`, `/crm*`, `/app*`, `/desk*`, `/assets*` e `/files*` vão para o Frappe.
- `/socket.io*` vai para o processo realtime do Frappe.

Essa separação evita o erro `Cannot GET /api/method/...`: chamadas Frappe não devem cair no frontend/SSO, e chamadas SSO não devem cair no Frappe.

### Google Cloud / domínio

- O domínio `univesp.br` ou o subdomínio apropriado precisa estar verificado no Google para o `Cloud Run domain mapping`.
- O service account usado pelo GitHub OIDC precisa ter permissões para Artifact Registry, Cloud Run, Secret Manager e, se for provisionar tudo, VPC Access e Compute Engine.

## Estratégia de branches do fork

Use esta divisão de responsabilidade:

- `upstream/main`: fonte estável do projeto.
- `origin/main`: espelho limpo do upstream no seu fork. Não suba commits da Univesp aqui.
- `origin/univesp/cloudrun-homolog`: branch longa com tudo que é específico da Univesp.

O workflow `Univesp Cloud Run Homolog` agora dispara apenas em `push` para `univesp/cloudrun-homolog`, então o deploy não depende mais de promover essas customizações para a `main` do fork.

Sincronização recomendada:

```bash
./scripts/sync-univesp-fork.sh
```

Esse script:

1. garante o remote `upstream` apontando para `https://github.com/frappe/crm.git`;
2. trata sua `main` local como espelho de `upstream/main`, criando um backup local se houver commits próprios no fork;
3. permite espelhar essa `main` em `origin/main`, usando `force-with-lease` quando necessário;
4. reaplica `univesp/cloudrun-homolog` sobre a `main` já sincronizada.

O fluxo correto para o seu caso é sempre sincronizar primeiro `upstream/main -> origin/main` e só depois atualizar `univesp/cloudrun-homolog`.

Casos comuns:

```bash
# Atualiza só as branches locais
./scripts/sync-univesp-fork.sh

# Atualiza a main local e espelha no fork
PUSH_MAIN=true ./scripts/sync-univesp-fork.sh

# Atualiza a main do fork e publica a branch customizada reescrita com rebase
PUSH_MAIN=true PUSH_CUSTOM=true ./scripts/sync-univesp-fork.sh

# Atualiza a main do fork e publica a branch customizada sem reescrever histórico
SYNC_MODE=merge PUSH_MAIN=true PUSH_CUSTOM=true ./scripts/sync-univesp-fork.sh
```

Use `SYNC_MODE=rebase` quando a branch for basicamente sua e você quiser histórico linear. Use `SYNC_MODE=merge` quando a branch já estiver compartilhada com outras pessoas e você quiser evitar `force-push`.

## Fluxo

1. Execute `ops/cloudrun/provision.sh` autenticado no GCP para criar Artifact Registry, bucket, service account, VPC connector, Redis VM e permissões mínimas do runtime.
2. Alimente os secrets do GitHub.
3. Faça push em `univesp/cloudrun-homolog` ou rode manualmente o workflow `Univesp Cloud Run Homolog`.
4. O workflow:
   - autentica no GCP via Workload Identity Federation,
   - builda a imagem em Artifact Registry,
   - sincroniza os secrets no Secret Manager,
   - executa o job de bootstrap,
   - publica `web`, `worker` e `scheduler`,
   - cria o `domain mapping`,
   - sincroniza os registros DNS no Cloudflare.

## Banco gerenciado

O fluxo atual assume `DB_SETUP_MODE=existing`, ou seja:

- o usuário e o banco são criados no Cloud SQL via `gcloud sql`;
- o job de bootstrap do Frappe usa `bench new-site --no-setup-db`;
- nenhuma senha de superusuário do PostgreSQL precisa ficar exposta para o container.

## Comandos locais úteis

Provisionar infra base:

```bash
export PATH="$HOME/.local/src/google-cloud-sdk/bin:$PATH"
export GCP_PROJECT_ID=univesp-201808
export GCP_REGION=us-east1
export CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=crm-homolog-run@univesp-201808.iam.gserviceaccount.com
export SITES_BUCKET=univesp-201808-crm-homolog-sites
export VPC_CONNECTOR=crm-homolog-connector
export CREATE_REDIS=true
export REDIS_BACKEND=vm
export REDIS_VM_NAME=crm-homolog-redis
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

Executar deploy barato para homolog de baixa utilização:

```bash
export PATH="$HOME/.local/src/google-cloud-sdk/bin:$PATH"
export GCP_PROJECT_ID=univesp-201808
export GCP_REGION=us-east1
export IMAGE_URI=us-east1-docker.pkg.dev/univesp-201808/crm/frappe-crm:manual
export CLOUDSQL_INSTANCE=univesp-201808:us-east1:pgsql17-prod
export SITES_BUCKET=univesp-201808-crm-homolog-sites
export VPC_CONNECTOR=crm-homolog-connector
export CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=crm-homolog-run@univesp-201808.iam.gserviceaccount.com
export DEPLOY_PROFILE=single-user
./ops/cloudrun/deploy.sh
```
