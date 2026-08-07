# Import SEI → CRM (Trino batch)

Scripts de sincronizacao **batch** (nao realtime). Ver [`docs/crm-sei-daily-sync.md`](../docs/crm-sei-daily-sync.md).

## Alunos

```bash
python ops/import/students-from-trino.py --validate-env
python ops/import/students-from-trino.py --dry-run --limit 100
python ops/import/students-from-trino.py --full --apply --site crm.localhost
```

Documentacao: [`docs/crm-import-student-directory.md`](../docs/crm-import-student-directory.md)

## Operadores de polo

```bash
python ops/import/staff-from-trino.py --dry-run --limit 50
python ops/import/staff-from-trino.py --full --apply --sync-profiles --site crm.localhost
```

Documentacao: [`docs/crm-import-staff-directory.md`](../docs/crm-import-staff-directory.md)

## Cron diario

```bash
chmod +x ops/import/sync-sei-directories.sh
SYNC_APPLY=1 FRAPPE_SITE_NAME=crm.localhost ops/import/sync-sei-directories.sh
```

## Variaveis

| Variavel | Default | Descricao |
|----------|---------|-----------|
| `TRINO_HOST` / `TRINO_USER` / `TRINO_PASSWORD` | — | Credenciais (conta tecnica) |
| `STUDENT_SITUACOES` | `AT` | Situacoes SEI importadas |
| `FRAPPE_SITE_NAME` | — | Site bench alvo |
| `SYNC_APPLY` | `1` | `0` = dry-run no shell sync |
| `SYNC_STAFF_PROFILES` | `1` | Sync Access Profile apos staff import |

Copie `.env.trino.example` → `.env.trino` (**nao commitar**).
