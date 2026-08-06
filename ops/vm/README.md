# VM homolog — homolog-crm.univesp.br

**Runbook deploy:** `docs/ops/DEPLOY_VM_HOMOLOG.md` · **Status:** `docs/ops/HOMOLOG_VM_STATUS.md`  
Branch deploy: `fix/bootstrap-homolog-unblock`

## Subir stack (BFF + frontend + Redis)

```bash
cp env.vm.example .env.vm
# editar secrets
./ops/vm/bootstrap.sh
```

Frappe bench deve rodar no host (`FRAPPE_ORIGIN`, padrao `host.docker.internal:8000`).

## Pos-migrate

```bash
bench --site homolog-crm.univesp.br migrate
bench --site crm.localhost execute univesp_atendimento.homolog_seed.upsert_homolog_access_profiles
bench --site crm.localhost execute univesp_atendimento.homolog_seed.upsert_homolog_student_directory
```

Ou na VM: `sudo ./ops/vm/scripts/install-atendimento-backend.sh`

## Segredos gateway (homolog)

```bash
sudo ./ops/vm/set-edge-secret.sh      # BFF ↔ Frappe
sudo ./ops/vm/set-ingress-secret.sh   # webhooks omnichannel (X-Univesp-Ingress-Secret)
```

## Import alunos (piloto)

```bash
python ops/import/students-from-trino.py --dry-run --limit 10 --polo-id 237
python ops/import/students-from-trino.py --apply --limit 100 --polo-id 237
```

## Backup

```bash
FRAPPE_SITE_NAME=homolog-crm.univesp.br ./ops/vm/backup.sh
```

## GCS anexos

Ver [docs/ops/gcs-frappe-site-config.example.md](../docs/ops/gcs-frappe-site-config.example.md).

## Smoke MVP

```powershell
.\ops\smoke\mvp-e2e.ps1 -BaseUrl https://homolog-crm.univesp.br
```

Fluxos manuais (dev bypass, FAQ → protocolo, BPO): [ops/smoke/mvp-e2e.md](../smoke/mvp-e2e.md).
