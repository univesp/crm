# Import piloto — Base Cadastro Aluno via Trino

Handoff para TI: credenciais, dry-run, apply e rollback.

**Deploy VM:** `docs/ops/DEPLOY_VM_HOMOLOG.md` · **Cofre:** `docs/ops/COFRE_SECRETS_CRM.md`

## Pre-requisitos

1. Python 3.10+ — na VM Debian use **venv** (`python3 -m venv .venv-trino`)
2. `pip install trino` dentro do venv
3. Variaveis em `ops/import/.env.trino` (copie `.env.trino.example` — **nao commitar**)
4. Site Frappe alvo: **`crm.localhost`** (nao o dominio publico)
5. Doctype `Univesp Student Directory` instalado

Montar `.env.trino` a partir do Secret Manager `crm-homolog-trino-crm-import` — ver cofre.

## Validar ambiente (sem conectar ao Trino)

```bash
source .venv-trino/bin/activate
export $(sudo grep -v '^#' ops/import/.env.trino | xargs)
python ops/import/students-from-trino.py --validate-env
```

## Dry-run (amostra mascarada)

```bash
python ops/import/students-from-trino.py --dry-run --limit 10
python ops/import/students-from-trino.py --dry-run --limit 10 --polo-id 237
```

Catálogo Trino `postgresql-sei` exige **aspas duplas** na SQL (`"postgresql-sei".public...`).

Filtro opcional: `STUDENT_SITUACOES=AT` no `.env.trino`.

## Apply (upsert no Frappe)

**Site:** `--site crm.localhost`

Para lotes grandes, usar apply em batches (script usa `upsert_rows_from_file` via bench) ou helper documentado em `docs/ops/HOMOLOG_VM_STATUS.md`.

Apply direto (poucas linhas):

```bash
python ops/import/students-from-trino.py --apply --site crm.localhost --limit 100 --batch-size 50
```

**Nao** reexecutar `homolog_seed.upsert_homolog_student_directory` apos import SEI real.

## Rollback

- Import piloto: remover linhas via Desk ou script inverso por `ra`/`email`
- Homolog sintetico: `bench --site crm.localhost execute univesp_atendimento.homolog_seed.upsert_homolog_student_directory`

## Variaveis

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `TRINO_HOST` | sim | Host Trino institucional |
| `TRINO_USER` | sim | Usuario |
| `TRINO_PASSWORD` | recomendado | Senha |
| `TRINO_PORT` | nao (443) | Porta HTTPS |
| `TRINO_CATALOG` | nao | Default `postgresql-sei` |
| `STUDENT_SITUACOES` | nao | Default `AT` (filtro SQL) |
| `FRAPPE_SITE_NAME` | apply | Site bench alvo (`crm.localhost`) |
| `FRAPPE_BENCH` | apply lote | Default `/var/crm/frappe-bench` |

## Smoke pos-import

```bash
curl -X POST "$APP_BASE_URL/api/app/v1/students/validate" \
  -H "Cookie: crm_session=..." \
  -H "Content-Type: application/json" \
  -d '{"cpf":"11144477735","email":"teste@aluno.univesp.br"}'
```

Ver tambem `docs/MVP_CLOSURE_CHECKLIST.md` (Trilha D) e `docs/ops/HOMOLOG_VM_STATUS.md`.
