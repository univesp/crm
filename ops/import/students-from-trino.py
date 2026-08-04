#!/usr/bin/env python3
"""Import alunos SEI → Univesp Student Directory (1 linha por e-mail @aluno.univesp.br).

Fonte: pessoaemailinstitucional + matricula AT (prioriza graduacao sobre extensao).

Uso:
  python ops/import/students-from-trino.py --validate-env
  python ops/import/students-from-trino.py --dry-run --limit 100
  python ops/import/students-from-trino.py --apply --site crm.localhost --full
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from academic_record_selection import collapse_students_by_email
from trino_common import apply_via_bench, fetch_rows, load_trino_env, parse_situacoes, validate_trino_env

STUDENT_QUERY = """
SELECT
  LOWER(TRIM(pe.email)) AS email,
  REGEXP_REPLACE(p.cpf, '[^0-9]', '') AS cpf,
  TRIM(COALESCE(NULLIF(TRIM(p.registroacademico), ''), m.matricula)) AS ra,
  TRIM(m.matricula) AS matricula_codigo,
  TRIM(p.nome) AS nome,
  p.codigo AS pessoa_codigo,
  CAST(ue.codigo AS VARCHAR) AS polo_id,
  ue.nome AS polo_nome,
  c.nome AS curso,
  UPPER(TRIM(m.situacao)) AS situacao
FROM "postgresql-sei".public.pessoaemailinstitucional pe
JOIN "postgresql-sei".public.pessoa p
  ON p.codigo = pe.pessoa
JOIN "postgresql-sei".public.matricula m
  ON m.aluno = p.codigo
JOIN "postgresql-sei".public.unidadeensino ue
  ON ue.codigo = m.unidadeensino
LEFT JOIN "postgresql-sei".public.curso c
  ON c.codigo = m.curso
WHERE LOWER(pe.email) LIKE '%@aluno.univesp.br'
  AND p.cpf IS NOT NULL
  AND m.unidadeensino IS NOT NULL
  AND UPPER(TRIM(m.situacao)) IN ({situacoes})
"""


def normalize_cpf(value: str) -> str:
	return re.sub(r"[^0-9]", "", str(value or ""))


def build_query(*, polo_ids: list[str], limit: int | None, situacoes: list[str]) -> str:
	quoted_situacoes = ", ".join(f"'{code}'" for code in situacoes)
	query = STUDENT_QUERY.format(situacoes=quoted_situacoes)
	if polo_ids:
		ids = ", ".join(f"'{pid}'" for pid in polo_ids)
		query += f"\n  AND CAST(ue.codigo AS VARCHAR) IN ({ids})"
	if limit:
		query += f"\nLIMIT {int(limit)}"
	return query


def sanitize_rows(raw_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
	rows: list[dict[str, Any]] = []
	for item in raw_rows:
		cpf = normalize_cpf(item.get("cpf"))
		email = str(item.get("email") or "").strip().lower()
		ra = str(item.get("ra") or "").strip()
		polo_id = str(item.get("polo_id") or "").strip()
		if len(cpf) != 11 or not email or not ra or not polo_id:
			continue
		rows.append(
			{
				"email": email,
				"cpf": cpf,
				"ra": ra,
				"matricula_codigo": str(item.get("matricula_codigo") or "").strip(),
				"nome": str(item.get("nome") or email).strip(),
				"polo_id": polo_id,
				"polo_nome": str(item.get("polo_nome") or "").strip(),
				"curso": str(item.get("curso") or "").strip(),
				"situacao": str(item.get("situacao") or "").strip(),
				"pessoa_codigo": str(item.get("pessoa_codigo") or "").strip(),
			}
		)
	return rows


def main() -> int:
	load_trino_env()
	parser = argparse.ArgumentParser(description="Import alunos via Trino (SEI → Student Directory)")
	parser.add_argument("--limit", type=int, default=None, help="Limite SQL bruto (omitir com --full)")
	parser.add_argument("--full", action="store_true", help="Import completo (sem LIMIT SQL)")
	parser.add_argument("--polo-id", action="append", default=[], dest="polo_ids")
	parser.add_argument("--situacoes", default=None, help="CSV de situacoes SEI (default env STUDENT_SITUACOES=AT)")
	parser.add_argument("--dry-run", action="store_true")
	parser.add_argument("--apply", action="store_true", help="Upsert via bench execute no Frappe")
	parser.add_argument("--validate-env", action="store_true", help="Valida env sem conectar ao Trino")
	parser.add_argument("--batch-size", type=int, default=500)
	parser.add_argument("--site", default=os.environ.get("FRAPPE_SITE_NAME", "homolog-crm.univesp.br"))
	args = parser.parse_args()

	if args.validate_env:
		report = validate_trino_env()
		print(json.dumps(report, ensure_ascii=False, indent=2))
		return 0 if report["ok"] else 1

	situacoes = parse_situacoes(args.situacoes)
	limit = None if args.full else (args.limit or 100)
	query = build_query(polo_ids=args.polo_ids, limit=limit, situacoes=situacoes)
	raw_rows = fetch_rows(query)
	clean_rows = sanitize_rows(raw_rows)
	rows, selection_report = collapse_students_by_email(clean_rows)

	print(json.dumps({"selection": selection_report, "import_rows": len(rows)}, ensure_ascii=False, indent=2))

	if args.dry_run:
		for row in rows[:5]:
			masked = {**row, "cpf": f"***{row['cpf'][-4:]}"}
			print(masked)
		return 0

	if args.apply:
		if not rows:
			print("Nenhuma linha para importar.")
			return 1
		result = apply_via_bench(
			args.site,
			rows,
			method="univesp_atendimento.import_students.upsert_rows",
			batch_size=max(args.batch_size, 1),
		)
		print(json.dumps(result, ensure_ascii=False, indent=2))
		return 0

	print("Use --apply --site SITE para gravar no Frappe (requer bench no PATH).")
	return 0


if __name__ == "__main__":
	sys.exit(main())
