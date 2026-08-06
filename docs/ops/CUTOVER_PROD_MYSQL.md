# Runbook — estrutura prod pronta (MySQL Cloud SQL)

**Objetivo:** homolog continua no MariaDB local; site prod já aponta para Cloud SQL MySQL 8.0 + Redis dedicado. Virada = restore de dados + smoke, sem remontar infra.

**Referências:**

- Infra + cofre (nomes das entradas): `docs/RETORNO_TI_EQUIPE_CRM.md`
- **Como montar cada secret na app:** `docs/ops/COFRE_SECRETS_CRM.md`

---

## Arquitetura alvo

```text
homolog-crm.univesp.br  →  site crm.localhost (homolog)
                            MariaDB local (127.0.0.1)
                            Redis local / 10.122.225.195

crm.univesp.br          →  site crm.univesp.br (prod)  [criar]
                            Cloud SQL MySQL 8.0  10.54.1.3
                            Redis prod           10.142.0.116
                            GCS univesp-crm-attachments-prod
```

**Importante (TI):** nginx `snippets/crm-app.conf` é compartilhado — editar rotas afeta os dois domínios até separar VM homolog.

---

## Pré-requisitos

| Recurso | Valor |
|---------|--------|
| SSH | `gcloud compute ssh bruno.miyasato@crm-vm --project=univesp-201808 --zone=us-east1-b --tunnel-through-iap` |
| Cloud SQL | `10.54.1.3` — MySQL 8.0 (`crm-prod-db`) |
| Redis prod | `10.142.0.116:6379` |
| Cofre (Secret Manager) | Ver tabela em `docs/ops/COFRE_SECRETS_CRM.md` |
| GCS homolog | Bucket **`crm-univesp-uploads`** · secret `crm-homolog-gcs-sa-key` |
| GCS prod | Bucket **`univesp-crm-attachments-prod`** · secret `crm-prod-gcs-sa-key` |
| Snapshot rollback | `crm-vm-pre-prod-20260805` |

Ler secrets: `docs/ops/COFRE_SECRETS_CRM.md` (comandos `gcloud` + onde montar na VM).

---

## Fase 0 — Validar conectividade (sem alterar app)

Na `crm-vm`:

```bash
# portas abertas (TI já validou — repetir após mudanças de firewall)
nc -zv 10.54.1.3 3306
nc -zv 10.142.0.116 6379
curl -sS -o /dev/null -w '%{http_code}\n' https://trino.univesp.br/v1/info

# preflight homolog (modo post-install se apps já instalados)
sudo CRM_ROOT=/var/crm REPO_DIR=/var/crm/repository MODE=post-install \
  bash /var/crm/repository/ops/vm/scripts/preflight-atendimento.sh
```

Smoke anônimo (qualquer máquina):

```powershell
.\ops\smoke\mvp-e2e.ps1 -BaseUrl https://homolog-crm.univesp.br
.\ops\smoke\mvp-e2e.ps1 -BaseUrl https://crm.univesp.br
```

---

## Fase 1 — Criar site prod (Cloud SQL vazio)

```bash
cd /var/crm/frappe-bench

# senhas do cofre
DB_PASS=$(gcloud secrets versions access latest --secret=crm-prod-db-frappe-password --project=univesp-201808)
ROOT_PASS=$(gcloud secrets versions access latest --secret=crm-prod-db-password --project=univesp-201808)
REDIS_PASS=$(gcloud secrets versions access latest --secret=crm-prod-redis-password --project=univesp-201808)

# criar DB no Cloud SQL (uma vez) — via mysql client na VM ou Cloud SQL Auth Proxy
mysql -h 10.54.1.3 -u root -p"$ROOT_PASS" -e "
  CREATE DATABASE IF NOT EXISTS crm_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'frappe'@'%' IDENTIFIED BY '$DB_PASS';
  GRANT ALL ON crm_prod.* TO 'frappe'@'%';
  FLUSH PRIVILEGES;
"

# novo site Frappe (não tocar crm.localhost)
bench new-site crm.univesp.br \
  --db-type mariadb \
  --db-host 10.54.1.3 \
  --db-name crm_prod \
  --db-password "$DB_PASS" \
  --admin-password '<senha-admin-prod-cofre>'

bench --site crm.univesp.br install-app telephony helpdesk univesp_atendimento
bench --site crm.univesp.br migrate
```

> **Nota MySQL vs MariaDB:** Frappe usa driver compatível; `--db-type mariadb` no bench continua válido para MySQL 8.0. Se `new-site` falhar, usar `--db-type mysql` conforme versão do bench.

Redis prod no site prod:

```bash
bench --site crm.univesp.br set-config redis_cache "redis://:${REDIS_PASS}@10.142.0.116:6379/0"
bench --site crm.univesp.br set-config redis_queue "redis://:${REDIS_PASS}@10.142.0.116:6379/1"
bench --site crm.univesp.br set-config redis_socketio "redis://:${REDIS_PASS}@10.142.0.116:6379/2"
```

Gateway prod — variável `FRAPPE_SITE_NAME=crm.univesp.br` no server block prod (nginx já tem server block; conferir upstream).

---

## Fase 2 — GCS

Homolog (bucket **`crm-univesp-uploads`** — nome confirmado pela TI):

```bash
gcloud secrets versions access latest --secret=crm-homolog-gcs-sa-key --project=univesp-201808 \
  | sudo tee /run/secrets/gcs-sa-homolog.json >/dev/null
sudo chmod 600 /run/secrets/gcs-sa-homolog.json

# site_config homolog — ver docs/ops/gcs-frappe-site-config.example.md
bench --site crm.localhost set-config file_storage s3
bench --site crm.localhost set-config s3_bucket crm-univesp-uploads
# ... s3_key, s3_secret, s3_endpoint_url
```

Prod (`univesp-crm-attachments-prod`) — idem no site `crm.univesp.br` com secret `crm-prod-gcs-sa-key`.

Validar:

```bash
./ops/vm/scripts/validate-gcs-site-config.sh crm.localhost
./ops/vm/scripts/validate-gcs-site-config.sh crm.univesp.br
```

---

## Fase 3 — Trino / import SEI (homolog)

```bash
# montar ops/import/.env.trino a partir de crm-homolog-trino-crm-import
cd /var/crm/repository
python3 ops/import/students-from-trino.py --validate-env
python3 ops/import/students-from-trino.py --dry-run --limit 100
python3 ops/import/students-from-trino.py --full --apply --site crm.localhost
python3 ops/import/staff-from-trino.py --full --apply --sync-profiles --site crm.localhost
```

---

## Fase 4 — Dry-run restore homolog → prod (MySQL)

Valida MariaDB → MySQL **antes** do go-live:

```bash
cd /var/crm/frappe-bench

bench --site crm.localhost backup --with-files

# restore no site prod (Cloud SQL)
bench --site crm.univesp.br restore /var/crm/frappe-bench/sites/crm.localhost/private/backups/<arquivo>.sql.gz
bench --site crm.univesp.br migrate

# smoke prod
curl -sS -o /dev/null -w '%{http_code}\n' https://crm.univesp.br/healthz
# login SSO real + FAQ + protocolo
```

**Collation:** se restore falhar, exportar com `--single-transaction` e conferir `utf8mb4_unicode_ci`. TI oferece VM MariaDB se MySQL for bloqueante.

---

## Fase 5 — Go-live

1. Comunicar janela (~3 min se resize; aqui só tráfego).
2. Backup final homolog: `bench --site crm.localhost backup --with-files`
3. Restore em `crm.univesp.br` (Fase 4 com backup final).
4. Smoke homolog + prod.
5. Stress/carga em `crm.univesp.br` (infra prod real).
6. Monitorar Cloud SQL / Redis / CPU.

---

## Fase 6 — Separar homolog (depois prod estável)

Pedir à TI VM homolog menor (`e2-standard-4`). Migrar site `crm.localhost` para ela; `crm-vm` fica só prod.

---

## Rollback

| Cenário | Ação |
|---------|------|
| Site prod quebrado | Não restaurar homolog; re-restore backup anterior em prod ou recriar site vazio |
| VM corrompida | Snapshot `crm-vm-pre-prod-20260805` |
| Cloud SQL | Backup diário 03h, retenção 7d (TI) |

Homolog (`crm.localhost`) **não é alterado** nas fases 1–3 — rollback de prod não derruba homolog.

---

## Checklist rápido

```text
[ ] Fase 0 — conectividade Cloud SQL / Redis / Trino da VM
[ ] Fase 1 — site crm.univesp.br criado + migrate
[ ] Fase 2 — GCS homolog + prod configurados
[ ] Fase 3 — import SEI homolog
[ ] Fase 4 — dry-run restore homolog → prod MySQL OK
[ ] Fase 5 — go-live + stress
[ ] Fase 6 — VM homolog separada (pós-estabilização)
[ ] Token Cloudflare certbot prod rotacionado (TI — nov/2026)
```

---

## MySQL vs MariaDB — decisão

| | Homolog (crm.localhost) | Prod (crm.univesp.br) |
|--|-------------------------|------------------------|
| Engine | MariaDB local | **MySQL 8.0 Cloud SQL** |
| Motivo | Já funciona; testes rápidos | Única opção gerenciada GCP |
| Risco | — | Validar na **Fase 4** (dry-run restore) |

Não migrar homolog para MySQL no dia a dia — basta **um restore de prova** para prod antes do stress.

---

*Equipe CRM — 2026-08-06*
