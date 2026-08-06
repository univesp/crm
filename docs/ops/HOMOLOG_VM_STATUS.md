# Status homolog VM — handoff operacional

**Atualizado:** 2026-08-06  
**Ambiente:** `https://homolog-crm.univesp.br` na VM `crm-vm` (GCP `univesp-201808`, IAP SSH)  
**Para agentes:** leia junto com `docs/ops/DEPLOY_VM_HOMOLOG.md`, `docs/RETORNO_TI_EQUIPE_CRM.md`, `docs/ops/COFRE_SECRETS_CRM.md`

---

## Fase atual

**Homolog VM operacional — piloto funcional.** Prod (`crm.univesp.br`) compartilha a mesma VM/Frappe/MariaDB até cutover Cloud SQL (`docs/ops/CUTOVER_PROD_MYSQL.md`).

| Camada | Estado |
|--------|--------|
| Frontend Vue | Deploy manual OK — branch `fix/bootstrap-homolog-unblock` |
| Frappe `crm.localhost` | Migrate OK, FAQ v3 DocTypes restaurados |
| SSO Gateway | `:4000` OK |
| Nginx | Upstreams em `/etc/nginx/conf.d/crm-upstreams.conf` (TI) — **único** arquivo |
| Import SEI piloto | ~273 alunos em `Univesp Student Directory` |
| GCS / FAQ mídia | HMAC OK — falta `enable-homolog-features.sh` (flags v3 + upload) |
| Gateway flags | **`ENABLE_CUSTOM_PERMISSION_PROFILES=true`** ausente → FAQ erro "Perfis personalizados" |
| Prod Cloud SQL/Redis | Provisionado, **não ligado** à app |

---

## Branch e deploy

| Uso | Branch |
|-----|--------|
| **Deploy VM homolog** | `fix/bootstrap-homolog-unblock` |
| Cloud Run homolog (CI) | `univesp/cloudrun-homolog` |
| **Não usar na VM** | `codex/crm-ux-simulator-foundation` |

Fluxo: **local → commit → push → VM `git reset --hard` → scripts deploy** — ver `docs/ops/DEPLOY_VM_HOMOLOG.md`.

---

## Infra TI entregue (2026-08-06)

- VM `crm-vm` resize `e2-standard-16`, IAP SSH
- Trino RO: secret `crm-homolog-trino-crm-import`
- GCS homolog: bucket `crm-univesp-uploads`, HMAC `crm-homolog-gcs-hmac`, SA `crm-homolog-gcs-sa-key`
- Prod: Cloud SQL `10.54.1.3`, Redis `10.142.0.116`, GCS `univesp-crm-attachments-prod`
- Snapshot rollback: `crm-vm-pre-prod-20260805`

Detalhe cofre: `docs/ops/COFRE_SECRETS_CRM.md`

---

## Conquistas sessão 2026-08-06

1. SSH IAP + validação conectividade (Trino, Cloud SQL, Redis prod)
2. `.env.trino` montado a partir do Secret Manager
3. Import SEI piloto (Trino → Frappe em lotes via `upsert_rows_from_file`)
4. Correção branch VM (simulator → `fix/bootstrap-homolog-unblock`)
5. Deploy frontend/backend/gateway; nginx upstream duplicado resolvido
6. Runbooks: `DEPLOY_VM_HOMOLOG`, `COFRE_SECRETS`, `CUTOVER_PROD`, `RETORNO_TI`
7. GCS homolog: `crm-homolog-gcs-hmac` → `site_config` (`file_storage=s3`, bucket `crm-univesp-uploads`)

---

## Pendências prioritárias

| # | Item | Responsável |
|---|------|-------------|
| 1 | `git pull` + `sudo bash ops/vm/scripts/enable-homolog-features.sh` | Equipe CRM |
| 2 | Teste FAQ (listar fluxos, salvar rascunho, upload imagem) | Equipe CRM |
| 3 | Import OPs (`staff-from-trino.py` — branch/PR) | Equipe CRM |
| 4 | Cutover prod MySQL + site `crm.univesp.br` | Equipe CRM |
| 5 | Push commits pendentes + VM `git pull` | Equipe CRM |

---

## Paths VM

```text
/var/crm/repository          # git
/var/crm/univesp-frontend    # Vue build → dist/
/var/crm/frappe-bench        # site crm.localhost
/var/crm/sso-gateway         # gateway
/etc/nginx/conf.d/crm-upstreams.conf
```

---

## Comandos smoke rápidos

```bash
# Ativar FAQ v3 + upload + access-groups (após git pull)
sudo bash /var/crm/repository/ops/vm/scripts/enable-homolog-features.sh

curl -sf http://127.0.0.1:4000/health
curl -s --resolve homolog-crm.univesp.br:443:127.0.0.1 \
  https://homolog-crm.univesp.br/index.html | grep -o 'index-[^"]*\.js'
sudo MODE=post-install CRM_ROOT=/var/crm REPO_DIR=/var/crm/repository \
  bash /var/crm/repository/ops/vm/scripts/preflight-atendimento.sh
```

```powershell
.\ops\smoke\mvp-e2e.ps1 -BaseUrl https://homolog-crm.univesp.br
```

---

*Documento vivo — atualizar ao fechar pendências ou mudar branch deploy.*
