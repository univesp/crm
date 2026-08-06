# Cofre — Secret Manager CRM (referência operacional)

**Projeto GCP:** `univesp-201808`  
**Fonte:** retorno TI 2026-08-06 (`docs/RETORNO_TI_EQUIPE_CRM.md`)  
**Regra:** valores **nunca** em Git, ticket aberto ou print. Só **nomes** das entradas.

A SA **`crm-vm-sa`** (VM) já tem `secretAccessor` — leitura direta na VM.

---

## Como ler (PowerShell local ou bash na VM)

```bash
gcloud secrets versions access latest \
  --secret=NOME_DA_ENTRADA --project=univesp-201808
```

Listar entradas CRM:

```bash
gcloud secrets list --project=univesp-201808 --filter="name:crm-"
```

---

## Tabela completa — cofre → uso na aplicação

| Secret Manager | Formato | Infra relacionada | Montar / usar em |
|----------------|---------|-------------------|------------------|
| `crm-homolog-trino-crm-import` | JSON: `user`, `password`, `host`, `port`, `catalog` | Trino RO conta `crm-import` | `ops/import/.env.trino` na VM |
| `crm-homolog-gcs-sa-key` | JSON Service Account | Bucket **`crm-univesp-uploads`** | `/run/secrets/gcs-sa-homolog.json` (opcional; HMAC e suficiente p/ Frappe S3) |
| `crm-homolog-gcs-hmac` | JSON: `accessId`, `secret`, `endpoint`, `bucket` | HMAC GCS homolog | `site_config` homolog — `s3_key` / `s3_secret` |
| `crm-prod-gcs-sa-key` | JSON Service Account | Bucket **`univesp-crm-attachments-prod`** | `/run/secrets/gcs-sa-prod.json` + `site_config` prod |
| `crm-prod-redis-password` | texto (senha) | Redis `10.142.0.116:6379` | `bench set-config redis_*` site prod |
| `crm-prod-db-password` | texto (senha) | Cloud SQL root @ `10.54.1.3` | `mysql -u root` admin one-time |
| `crm-prod-db-frappe-password` | texto (senha) | Cloud SQL user `frappe` | `bench new-site` / `db_password` site prod |

---

## Receitas (na VM)

### Trino → `.env.trino`

```bash
export SECRET=$(gcloud secrets versions access latest \
  --secret=crm-homolog-trino-crm-import --project=univesp-201808)

python3 - <<'PY'
import json, os
d = json.loads(os.environ["SECRET"])
print(f"""TRINO_HOST={d['host']}
TRINO_PORT={d.get('port', 443)}
TRINO_USER={d['user']}
TRINO_PASSWORD={d['password']}
TRINO_HTTP_SCHEME=https
TRINO_CATALOG={d.get('catalog', 'postgresql-sei')}
TRINO_SCHEMA=public
FRAPPE_SITE_NAME=crm.localhost
STUDENT_SITUACOES=AT
""")
PY
# redirecionar saída para /var/crm/repository/ops/import/.env.trino (chmod 600)
```

Catálogo Trino: usar **`"postgresql-sei"`** (com aspas na query SQL).

### GCS homolog (HMAC — canônico)

Secret **`crm-homolog-gcs-hmac`** (TI 2026-08-06). Campos:

| Campo JSON | `site_config` Frappe |
|------------|----------------------|
| `accessId` | `s3_key` |
| `secret` | `s3_secret` |
| `endpoint` | `s3_endpoint_url` |
| `bucket` | `s3_bucket` |

```bash
# Na VM — aplicar no site crm.localhost (nao imprimir secret)
# Se (.venv-trino) estiver ativo e quebrado: deactivate  OU  use /usr/bin/python3 abaixo
eval "$(/usr/bin/python3 <<'PY'
import json, shlex, subprocess
raw = subprocess.check_output([
    "gcloud", "secrets", "versions", "access", "latest",
    "--secret=crm-homolog-gcs-hmac", "--project=univesp-201808",
])
d = json.loads(raw)
print(f"export S3_KEY={shlex.quote(d['accessId'])}")
print(f"export S3_SECRET={shlex.quote(d['secret'])}")
print(f"export S3_BUCKET={shlex.quote(d.get('bucket', 'crm-univesp-uploads'))}")
print(f"export S3_ENDPOINT={shlex.quote(d.get('endpoint', 'https://storage.googleapis.com'))}")
PY
)"

cd /var/crm/frappe-bench
sudo -u frappe bench --site crm.localhost set-config file_storage s3
sudo -u frappe bench --site crm.localhost set-config s3_bucket "$S3_BUCKET"
sudo -u frappe bench --site crm.localhost set-config s3_key "$S3_KEY"
sudo -u frappe bench --site crm.localhost set-config s3_secret "$S3_SECRET"
sudo -u frappe bench --site crm.localhost set-config s3_endpoint_url "$S3_ENDPOINT"
sudo -u frappe bench --site crm.localhost set-config s3_signature_version s3v4

cd /var/crm/repository
bash ops/vm/scripts/validate-gcs-site-config.sh crm.localhost
```

Teste funcional: upload de anexo ou mídia na FAQ (Admin). Arquivo deve ir ao bucket, nao ao disco local.

### GCS homolog (SA JSON — opcional)

```bash
gcloud secrets versions access latest \
  --secret=crm-homolog-gcs-sa-key --project=univesp-201808 \
  | sudo tee /run/secrets/gcs-sa-homolog.json >/dev/null
sudo chmod 600 /run/secrets/gcs-sa-homolog.json
```

Para Frappe S3-compat, o par HMAC (`crm-homolog-gcs-hmac`) e suficiente. A SA JSON serve para outros usos (API GCP direta).

`site_config` minimo:

```json
{
  "file_storage": "s3",
  "s3_bucket": "crm-univesp-uploads",
  "s3_key": "<accessId do cofre>",
  "s3_secret": "<secret do cofre>",
  "s3_endpoint_url": "https://storage.googleapis.com",
  "s3_signature_version": "s3v4"
}
```

Ver `docs/ops/gcs-frappe-site-config.example.md`.

### GCS prod

Mesmo padrão com secret `crm-prod-gcs-sa-key` e bucket **`univesp-crm-attachments-prod`**.

### Redis prod

```bash
REDIS_PASS=$(gcloud secrets versions access latest \
  --secret=crm-prod-redis-password --project=univesp-201808)

bench --site crm.univesp.br set-config redis_cache "redis://:${REDIS_PASS}@10.142.0.116:6379/0"
bench --site crm.univesp.br set-config redis_queue "redis://:${REDIS_PASS}@10.142.0.116:6379/1"
bench --site crm.univesp.br set-config redis_socketio "redis://:${REDIS_PASS}@10.142.0.116:6379/2"
```

### Cloud SQL prod

```bash
DB_PASS=$(gcloud secrets versions access latest --secret=crm-prod-db-frappe-password --project=univesp-201808)
ROOT_PASS=$(gcloud secrets versions access latest --secret=crm-prod-db-password --project=univesp-201808)

# bench new-site / restore — host 10.54.1.3, engine MySQL 8.0
```

---

## O que **não** está no Secret Manager (já na VM)

Configurados em **`/var/crm/sso-gateway/.env`** e **`site_config.json`** do site homolog — provisionados antes do retorno TI:

| Tipo | Onde |
|------|------|
| Azure Admin/Acadêmico client secrets | `sso-gateway/.env` |
| Certificado SAML | `sso-gateway/.env` |
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | gateway `.env` |
| `UNIVESP_BFF_SHARED_SECRET` | gateway `.env` + `bench set-config` |
| `SESSION_SECRET`, `JWT_SECRET` | gateway `.env` |

Se faltar algum, conferir `ops/vm/HANDOFF_TI.md` e `sso-gateway/.env.example` — **não** estão no cofre CRM deste chamado.

---

## Endpoints fixos (não estão no cofre)

| Recurso | Valor |
|---------|--------|
| Cloud SQL host | `10.54.1.3` |
| Redis prod | `10.142.0.116:6379` |
| Trino | `https://trino.univesp.br:443` |
| VM app IP externo | `34.138.32.210` |
| VM app IP interno | `10.142.0.98` |

---

## Checklist — secrets lidos e aplicados

```text
[ ] crm-homolog-trino-crm-import → ops/import/.env.trino
[ ] crm-homolog-gcs-hmac → site_config homolog (s3_key, s3_secret, bucket) — **OK VM 2026-08-06**
[ ] crm-homolog-gcs-sa-key → /run/secrets/gcs-sa-homolog.json (opcional)
[ ] crm-prod-gcs-sa-key → /run/secrets/gcs-sa-prod.json + site prod (quando existir)
[ ] crm-prod-redis-password → site prod redis_*
[ ] crm-prod-db-frappe-password → site prod db
[ ] crm-prod-db-password → admin Cloud SQL (uma vez)
[ ] SSO/gateway — conferir .env existente na VM (fora do cofre)
```

---

*Equipe CRM — complemento ao retorno TI 2026-08-06*
