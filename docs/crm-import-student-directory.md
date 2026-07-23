# Import Trino — Base Cadastro Aluno

Fonte de metadados: projeto `catalogo-dados-univesp` (`postgresql-sei.public`).

## Join path

```
pessoa → matricula (aluno) → unidadeensino (polo)
                            → curso
```

## Script

[`ops/import/students-from-trino.py`](../ops/import/students-from-trino.py)

- Colunas explicitas (sem `SELECT *`)
- Piloto: `--limit 100 --polo-id <codigo> --dry-run`
- Gravar no Frappe: `--apply --site homolog-crm.univesp.br` (requer `bench` no PATH)

## Upsert Frappe

Modulo: `univesp_atendimento.import_students.upsert_rows`

```bash
bench --site homolog-crm.univesp.br execute univesp_atendimento.import_students.upsert_rows --kwargs '{"rows":[...]}'
```

## DocType destino

`Univesp Student Directory` — upsert por `email` (autoname).

## Validacao pos-SSO

`POST /api/app/v1/students/validate` — match por CPF/email/RA apos login SAML.

## LGPD

- Nao commitar CSV/JSON com PII
- Reutilizar credenciais Trino do catalogo-dados (`.env` local)
- Confirmar filtro `situacao` ativa antes de import completo

## Referencias catalogo-dados

- `docs/13_mapa_funcional_p0_essencial.md`
- `docs/validacoes/01_fluxo_aluno_real.md`
- `docs/14_glossario_status_codigos.md`
