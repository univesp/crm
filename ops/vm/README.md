# VM interim — homolog-crm.univesp.br

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
