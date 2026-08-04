# Import Trino — Base Cadastro Aluno

Fonte de metadados: projeto `catalogo-dados-univesp` (`postgresql-sei.public`).

## Join path (atualizado)

```
pessoaemailinstitucional → pessoa → matricula (AT) → unidadeensino (polo)
                                              → curso
```

**Chave de e-mail:** `pessoaemailinstitucional.email` (`@aluno.univesp.br`), nao `pessoa.email`.

**RA:** `pessoa.registroacademico`, fallback `matricula.matricula`.

## Selecao de matricula (multi AT)

Import gera **1 linha por e-mail**. Se houver graduacao + extensao AT, **prioriza graduacao** (heuristica pelo nome do curso). Campos:

- `enrollment_track`: `graduacao` | `extensao` | `outro`
- `matricula_codigo`: codigo SEI da matricula escolhida

Auditar excecoes via relatorio `multi_active_emails` no stdout do script.

## Script

[`ops/import/students-from-trino.py`](../ops/import/students-from-trino.py)

- `--situacoes AT` (default) ou env `STUDENT_SITUACOES=AT,FO`
- `--full --apply` para carga completa (batch 500)
- Piloto: `--limit 100 --polo-id 237 --dry-run`

## Upsert Frappe

Modulo: `univesp_atendimento.import_students.upsert_rows`

## DocType destino

`Univesp Student Directory` — upsert por `email` (autoname).

## Validacao pos-SSO

`POST /api/app/v1/students/validate` — match por CPF/email/RA apos login SAML.

## Rotina diaria

Ver [`crm-sei-daily-sync.md`](crm-sei-daily-sync.md).

## LGPD

- Nao commitar CSV/JSON com PII
- Conta Trino tecnica read-only (`crm-import`)
- Confirmar filtro `situacao` antes de import completo
