#!/usr/bin/env python3
"""Importa operadores de polo SEI para o Staff Directory."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from trino_common import apply_via_bench, fetch_rows, load_trino_env, run_bench_execute, validate_trino_env

STAFF_QUERY = """
SELECT DISTINCT
  LOWER(TRIM(p.email)) AS email,
  TRIM(p.nome) AS nome,
  CAST(fc.unidadeensino AS VARCHAR) AS polo_id,
  ue.nome AS polo_nome,
  CAST(p.codigo AS VARCHAR) AS pessoa_codigo,
  CASE WHEN COALESCE(fc.ativo, true) THEN '1' ELSE '0' END AS cargo_ativo
FROM "postgresql-sei".public.pessoa p
JOIN "postgresql-sei".public.funcionario f ON f.pessoa = p.codigo
JOIN "postgresql-sei".public.funcionariocargo fc ON fc.funcionario = f.codigo
JOIN "postgresql-sei".public.unidadeensino ue ON ue.codigo = fc.unidadeensino
WHERE LOWER(p.email) LIKE '%@polo.univesp.br'
  AND fc.unidadeensino IS NOT NULL
"""


def build_query(*, polo_ids: list[str], limit: int | None, active_only: bool) -> str:
	query = STAFF_QUERY
	if active_only:
		query += "\n  AND COALESCE(fc.ativo, true) = true"
	if polo_ids:
		ids = ", ".join(f"'{pid}'" for pid in polo_ids)
		query += f"\n  AND CAST(fc.unidadeensino AS VARCHAR) IN ({ids})"
	if limit:
		query += f"\nLIMIT {int(limit)}"
	return query


def sanitize_rows(raw_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
	rows: list[dict[str, Any]] = []
	seen: set[tuple[str, str]] = set()
	for item in raw_rows:
		email = str(item.get("email") or "").strip().lower()
		polo_id = str(item.get("polo_id") or "").strip()
		if not email or not polo_id:
			continue
		key = (email, polo_id)
		if key in seen:
			continue
		seen.add(key)
		rows.append(
			{
				"email": email,
				"nome": str(item.get("nome") or email).strip(),
				"polo_id": polo_id,
				"polo_nome": str(item.get("polo_nome") or "").strip(),
				"pessoa_codigo": str(item.get("pessoa_codigo") or "").strip(),
				"cargo_ativo": 1 if str(item.get("cargo_ativo") or "1") in {"1", "true", "True"} else 0,
			}
		)
	return rows


def main() -> int:
	load_trino_env()
	parser = argparse.ArgumentParser(description="Importa operadores polo via Trino")
	parser.add_argument("--limit", type=int, default=None)
	parser.add_argument("--full", action="store_true")
	parser.add_argument("--polo-id", action="append", default=[], dest="polo_ids")
	parser.add_argument("--include-inactive", action="store_true")
	parser.add_argument("--dry-run", action="store_true")
	parser.add_argument("--apply", action="store_true")
	parser.add_argument("--sync-profiles", action="store_true")
	parser.add_argument("--validate-env", action="store_true")
	parser.add_argument("--batch-size", type=int, default=500)
	parser.add_argument("--site", default=os.environ.get("FRAPPE_SITE_NAME", "crm.localhost"))
	args = parser.parse_args()

	if args.validate_env:
		report = validate_trino_env()
		print(json.dumps(report, ensure_ascii=False, indent=2))
		return 0 if report["ok"] else 1

	limit = None if args.full else (args.limit or 50)
	rows = sanitize_rows(fetch_rows(build_query(
		polo_ids=args.polo_ids,
		limit=limit,
		active_only=not args.include_inactive,
	)))
	print(json.dumps({"staff_rows": len(rows), "unique_emails": len({row["email"] for row in rows})}, ensure_ascii=False))
	if args.dry_run:
		return 0
	if not args.apply:
		print("Use --apply --site SITE para gravar no Frappe.")
		return 0
	if not rows:
		print("Nenhuma linha para importar.")
		return 1
	result = apply_via_bench(args.site, rows, method="univesp_atendimento.import_staff.upsert_rows", batch_size=max(args.batch_size, 1))
	print(json.dumps(result, ensure_ascii=False))
	if args.sync_profiles:
		sync = run_bench_execute(args.site, "univesp_atendimento.import_staff.sync_access_profiles_from_staff_directory")
		print(json.dumps({"sync_profiles": sync}, ensure_ascii=False))
	return 0


if __name__ == "__main__":
	sys.exit(main())
