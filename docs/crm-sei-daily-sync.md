# Sync diario SEI → CRM (dimensoes aluno + operador)

Job batch **1x/dia** (nao realtime). Mudancas de polo/cargo no SEI sao infrequentes; o CRM usa cache local no MariaDB/Cloud SQL.

## O que sincroniza

| Job | Script | Destino CRM |
|-----|--------|-------------|
| Alunos | `students-from-trino.py --full --apply` | `Univesp Student Directory` (1 linha/e-mail) |
| Operadores polo | `staff-from-trino.py --full --apply --sync-profiles` | `Univesp Staff Directory` + `Univesp Access Profile` (`op`) |

## Regra aluno — duas matriculas AT

Na maioria dos casos ha **uma** linha por e-mail. Quando existem 2+ matriculas AT:

1. **Prioriza graduacao** (licenciatura, bacharelado, tecnologia…) sobre extensao/aperfeicoamento (heuristica pelo nome do curso).
2. Persiste **uma linha** no Directory (`enrollment_track`: `graduacao` | `extensao` | `outro`).
3. O import imprime estatisticas (`multi_active_emails`) para voce auditar excecoes (~138 casos citados no knowledge).

Nao consulta Trino no login — so no batch.

## Regra operador

- Fonte: `funcionario` + `funcionariocargo` + e-mail `@polo.univesp.br`.
- **N linhas** por operador (multi-polo permitido).
- `--sync-profiles` agrega polos em `scopes_json.polos` + filas padrao `atendimento-geral`, `sra`.
- Perfil `op` passa a filtrar tickets por **polo do aluno** (`custom_student_polo`).

## Pre-requisitos

- `ops/import/.env.trino` (conta tecnica read-only)
- `pip install trino` no host do cron (ou `TRINO_PYTHON` apontando para Python com trino)
- `bench migrate` apos deploy (DocTypes Student/Staff Directory)

## Execucao manual

```bash
cd /var/crm/repository
export $(grep -v '^#' ops/import/.env.trino | xargs)

python3 ops/import/students-from-trino.py --dry-run --limit 100
python3 ops/import/staff-from-trino.py --dry-run --limit 50

python3 ops/import/students-from-trino.py --full --apply --site crm.localhost
python3 ops/import/staff-from-trino.py --full --apply --sync-profiles --site crm.localhost
```

## Cron diario (VM)

```bash
chmod +x ops/import/sync-sei-directories.sh

# /etc/cron.d/crm-sei-sync — 03:15 UTC diario
15 3 * * * crmops SYNC_APPLY=1 SYNC_STAFF_PROFILES=1 FRAPPE_SITE_NAME=crm.localhost \
  /var/crm/repository/ops/import/sync-sei-directories.sh
```

Dry-run agendado (relatorio sem gravar): `SYNC_APPLY=0`.

## Vale a pena?

**Sim**, para MVP e producao:

- Desacopla SSO/LDAP do Trino (estavel, rapido, auditavel).
- Operador: cadastro SEI vira fila/polo automaticamente (`--sync-profiles`).
- Aluno: validate pos-login usa Directory local.
- Custo: 1 job/dia + ~91k upserts alunos (batch 500) — aceitavel off-peak.

## Referencias

- Alunos: `docs/crm-import-student-directory.md`
- Operadores: `docs/crm-import-staff-directory.md`
- Analise SEI: knowledge `dim_operador_polo` / `dim_aluno_polo`
