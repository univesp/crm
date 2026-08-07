# Import Trino — Operadores de polo (Staff Directory)

Fonte: `postgresql-sei.public` — `funcionario` + `funcionariocargo`.

## Join path

```
pessoa (@polo.univesp.br) → funcionario → funcionariocargo → unidadeensino (polo)
```

## Script

[`ops/import/staff-from-trino.py`](../ops/import/staff-from-trino.py)

- `--dry-run --limit 50`
- `--full --apply --site SITE`
- `--sync-profiles` — agrega polos em `Univesp Access Profile` (`profile_key=op`)

## DocType destino

`Univesp Staff Directory` — chave `email|polo_id` (multi-polo por operador).

## Sync perfis OP

`bench --site SITE execute univesp_atendimento.import_staff.sync_access_profiles_from_staff_directory`

Escopos gerados:

```json
{
  "polos": ["237", "238"],
  "queues": ["atendimento-geral", "sra"]
}
```

Nao sobrescreve perfis `admin_central` ou `op_externo`.

## Rotina diaria

Ver [`crm-sei-daily-sync.md`](crm-sei-daily-sync.md).
