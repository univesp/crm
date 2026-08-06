# Runbook — deploy homolog na VM (`crm-vm`)

**Objetivo:** publicar mudanças de código (Vue, Frappe, gateway) em `https://homolog-crm.univesp.br` de forma repetível.

**Não confundir com Cloud Run:** o pipeline `univesp/cloudrun-homolog` (GitHub Actions) **não** atualiza a VM. Homolog na VM é deploy **manual** via scripts em `ops/vm/scripts/`.

---

## Estado operacional (2026-08-06)

| Item | Status |
|------|--------|
| VM | `crm-vm` — IAP SSH, projeto `univesp-201808` |
| Domínio homolog | `https://homolog-crm.univesp.br` |
| Site Frappe | `crm.localhost` (MariaDB local) |
| Branch deploy VM | **`fix/bootstrap-homolog-unblock`** |
| Branch **não** usar na VM | `codex/crm-ux-simulator-foundation` (simulador antigo) |
| Import SEI piloto | ~273 alunos em `Univesp Student Directory` |
| GCS / FAQ mídia | **Bloqueado** — aguarda par HMAC da TI |
| Prod (`crm.univesp.br`) | Mesma VM; Cloud SQL/Redis existem mas **cutover pendente** |

Referências: `docs/RETORNO_TI_EQUIPE_CRM.md`, `docs/ops/COFRE_SECRETS_CRM.md`, `docs/ops/CUTOVER_PROD_MYSQL.md`.

---

## Layout na VM

| Caminho | Função |
|---------|--------|
| `/var/crm/repository` | Git clone — scripts, apps, nginx |
| `/var/crm/univesp-frontend` | Cópia do Vue — **build** → `dist/` |
| `/var/crm/frappe-bench` | Frappe bench — site `crm.localhost` |
| `/var/crm/sso-gateway` | BFF/gateway — porta `4000` |
| `/etc/nginx/conf.d/crm-upstreams.conf` | Upstreams compartilhados (TI) — **único** arquivo com `upstream` |

**Nginx:** `conf.d/*.conf` já é carregado globalmente. **Não** duplicar upstream em `sites-available` nem criar segundo arquivo em `conf.d/`.

---

## Fluxo de trabalho (local → homolog)

```text
1. Desenvolver no PC (branch fix/bootstrap-homolog-unblock ou feature → merge)
2. git commit + git push
3. SSH na VM (IAP)
4. git fetch + reset na branch deploy
5. Deploy do componente que mudou (tabela abaixo)
6. Smoke + hard refresh no browser (Ctrl+Shift+R)
```

### Local (PC)

```powershell
cd C:\Users\bruno.miyasato\Documents\Codex\2026-07-02\es\crm
git checkout fix/bootstrap-homolog-unblock
git pull origin fix/bootstrap-homolog-unblock
# ... editar ...
git add <arquivos>
git commit -m "fix(ux): descrição"
git push origin fix/bootstrap-homolog-unblock
```

**Nunca commitar:** `ops/import/.env.trino`, `.venv-trino/`, secrets, `.env.vm`.

### SSH (Windows → VM)

```powershell
# Terminal 1 — túnel
gcloud compute start-iap-tunnel crm-vm 22 --local-host-port=localhost:2222 --zone=us-east1-b --project=univesp-201808

# Terminal 2
ssh -i $env:USERPROFILE\.ssh\univesp_bruno -p 2222 bruno.miyasato@127.0.0.1
```

---

## Atualizar código na VM

```bash
cd /var/crm/repository
git remote prune origin
git fetch origin fix/bootstrap-homolog-unblock
git checkout -B fix/bootstrap-homolog-unblock FETCH_HEAD
git reset --hard origin/fix/bootstrap-homolog-unblock
git log -1 --oneline
```

Se `git fetch origin` falhar por ref remota fantasma:

```bash
git update-ref -d refs/remotes/origin/codex/atendimento-homolog-release 2>/dev/null || true
git fetch origin fix/bootstrap-homolog-unblock
```

---

## Deploy por componente

### Frontend (`univesp-frontend/`)

```bash
sudo rsync -a --delete --exclude node_modules --exclude dist \
  /var/crm/repository/univesp-frontend/ /var/crm/univesp-frontend/

sudo REPO_ROOT=/var/crm/repository VUE_APP_DIR=/var/crm/univesp-frontend \
  bash /var/crm/repository/ops/vm/scripts/apply-frontdoor.sh
```

Se `nginx -t` falhar com `duplicate upstream`, ver seção [Nginx](#nginx-upstreams) abaixo.

### Backend Frappe (`univesp_atendimento_app/`)

```bash
BENCH_OWNER="$(stat -c '%U' /var/crm/frappe-bench)"
sudo -u "$BENCH_OWNER" CRM_ROOT=/var/crm REPO_ROOT=/var/crm/repository \
  bash /var/crm/repository/ops/vm/scripts/install-atendimento-backend.sh
```

**Atenção:** o script roda seeds homolog. Após import SEI real, **não** reexecutar `upsert_homolog_student_directory` manualmente (preserva diretório de alunos). Se seed de perfis falhar por escopo vazio em `admin_central`, o seed exige `scopes_json.areas` — ver `homolog_seed.py`.

### SSO Gateway (`sso-gateway/`)

```bash
sudo CRM_ROOT=/var/crm \
  bash /var/crm/repository/ops/vm/scripts/deploy-sso-gateway.sh
```

---

## Nginx upstreams

Upstreams válidos **somente** em:

```text
/etc/nginx/conf.d/crm-upstreams.conf
```

**Não** criar `univesp-upstreams.conf` em paralelo. **Não** adicionar `include` explícito de `conf.d` nos site configs (já carregam automaticamente).

Verificar:

```bash
sudo grep -rn "upstream univesp_sso_gateway" /etc/nginx/
sudo nginx -t && sudo systemctl reload nginx
```

Deve listar **apenas** `crm-upstreams.conf`.

---

## Validação pós-deploy

### Na VM

```bash
# Hash do bundle JS (bypass Cloudflare)
curl -s --resolve homolog-crm.univesp.br:443:127.0.0.1 \
  https://homolog-crm.univesp.br/index.html | grep -o 'index-[^"]*\.js'

grep -o 'index-[^"]*\.js' /var/crm/univesp-frontend/dist/index.html
# Os dois hashes devem ser iguais

curl -sf http://127.0.0.1:4000/health && echo " gateway OK"
sudo supervisorctl status sso-gateway 'frappe-bench:*'

sudo MODE=post-install CRM_ROOT=/var/crm REPO_DIR=/var/crm/repository \
  bash /var/crm/repository/ops/vm/scripts/preflight-atendimento.sh
```

### No PC

```powershell
.\ops\smoke\mvp-e2e.ps1 -BaseUrl https://homolog-crm.univesp.br
```

Browser: **Ctrl+Shift+R** ou aba anônima.

---

## Ativar features homolog (FAQ, upload, access-groups)

Após GCS/gateway OK, se FAQ mostrar **"Perfis personalizados indisponíveis"** ou upload de mídia falhar:

```bash
cd /var/crm/repository
git fetch origin fix/bootstrap-homolog-unblock
git checkout -B fix/bootstrap-homolog-unblock FETCH_HEAD
git reset --hard origin/fix/bootstrap-homolog-unblock

sudo bash ops/vm/scripts/enable-homolog-features.sh
```

Validação rápida:

```bash
curl -sf http://127.0.0.1:4000/api/public/v1/runtime/flags | head -c 200; echo
curl -sS -w "\nHTTP %{http_code}\n" -H "Cookie: crm_session=SESSAO" \
  http://127.0.0.1:4000/api/app/v1/knowledge/v3/bundles | tail -3
```

Diagnóstico 502: `bash ops/vm/scripts/diagnose-api-502.sh`

---

Pré-requisitos: `ops/import/.env.trino` (Secret Manager), venv Python:

```bash
cd /var/crm/repository
python3 -m venv .venv-trino && source .venv-trino/bin/activate
pip install trino
export $(sudo grep -v '^#' ops/import/.env.trino | xargs)
python ops/import/students-from-trino.py --dry-run --limit 5
```

Apply em lotes via `upsert_rows_from_file` (ver sessão 2026-08-06 ou `ops/import/README.md`). Site: **`crm.localhost`**.

Catálogo Trino: `"postgresql-sei"` (com aspas na SQL).

---

## Matriz rápida

| Mudou | Deploy |
|-------|--------|
| Telas Vue | rsync + `apply-frontdoor.sh` |
| API Python / DocTypes | `install-atendimento-backend.sh` |
| Gateway / SSO | `deploy-sso-gateway.sh` |
| Só docs | Nada na VM |
| Secrets / cofre | Montar na VM — `docs/ops/COFRE_SECRETS_CRM.md` |

---

## Próximas fases (fora do deploy diário)

| Fase | Runbook |
|------|---------|
| GCS homolog (FAQ mídia) | TI: par HMAC → `docs/ops/COFRE_SECRETS_CRM.md` |
| Import SEI AT completo | `ops/import/students-from-trino.py` + filtro `situacao=AT` |
| Import OPs | PR/branch com `staff-from-trino.py` |
| Cutover prod | `docs/ops/CUTOVER_PROD_MYSQL.md` |
| VM homolog separada | Pós go-live prod |

---

## Rollback

- **Frontend:** rebuild de commit anterior (`git reset --hard` + `apply-frontdoor.sh`)
- **Backend:** backup em `/var/crm/backups` ou snapshot TI `crm-vm-pre-prod-20260805`
- **Gateway:** `deploy-sso-gateway.sh` após `git reset` (`.env` preservado)
- **Nginx:** restaurar `.conf` anterior em `/etc/nginx/sites-available`

---

*Equipe CRM — runbook VM homolog. Atualizar após mudança de branch deploy ou layout nginx.*
