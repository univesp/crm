# Import piloto — Base Cadastro Aluno via Trino

Handoff para TI: credenciais, dry-run, apply e rollback.

## Pre-requisitos

1. Python 3.10+ com `pip install trino`
2. Variaveis de ambiente (copie `.env.trino.example` para `.env.trino` — **nao commitar**)
3. Bench Frappe no PATH com site alvo migrado
4. Doctype `Univesp Student Directory` instalado

## Validar ambiente (sem conectar ao Trino)

```bash
python ops/import/students-from-trino.py --validate-env
```

Verifica presenca de `TRINO_HOST`, `TRINO_USER`, `TRINO_PASSWORD` (opcional em homolog interno) e dependencia `trino`.

## Dry-run (amostra mascarada)

```bash
export $(grep -v '^#' .env.trino | xargs)   # bash
python ops/import/students-from-trino.py --dry-run --limit 10 --polo-id 237
```

Imprime ate 5 linhas com CPF mascarado. Nenhuma gravacao.

## Apply (upsert no Frappe)

```bash
python ops/import/students-from-trino.py --apply --site homolog-crm.univesp.br --limit 100 --polo-id 237
```

Executa `bench execute univesp_atendimento.import_students.upsert_rows`.

## Rollback

- Import piloto: remover linhas importadas via Desk ou script inverso por `ra`/`email`
- Homolog sintetico: `bench --site SITE execute univesp_atendimento.homolog_seed.upsert_homolog_student_directory` (idempotente)

## Variaveis

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `TRINO_HOST` | sim | Host Trino institucional |
| `TRINO_USER` | sim | Usuario |
| `TRINO_PASSWORD` | recomendado | Senha |
| `TRINO_PORT` | nao (443) | Porta HTTPS |
| `TRINO_CATALOG` | nao | Default `postgresql-sei` |
| `FRAPPE_SITE_NAME` | apply | Site bench alvo |

## Smoke pos-import

```bash
curl -X POST "$APP_BASE_URL/api/app/v1/students/validate" \
  -H "Cookie: crm_session=..." \
  -H "Content-Type: application/json" \
  -d '{"cpf":"11144477735","email":"teste@aluno.univesp.br"}'
```

Ver tambem `docs/MVP_CLOSURE_CHECKLIST.md` (Trilha D).
