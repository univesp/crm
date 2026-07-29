#!/usr/bin/env python3
"""Import piloto da Base Cadastro Aluno via Trino (postgresql-sei).

Requisitos: pip install trino (ou use venv do catalogo-dados-univesp).
Nunca commitar dumps com PII. Rode com LIMIT e filtro de polos no piloto.

Uso:
  export TRINO_HOST=... TRINO_USER=... TRINO_PASSWORD=...
  python ops/import/students-from-trino.py --limit 100 --polo-id 237
  python ops/import/students-from-trino.py --limit 100 --polo-id 237 --apply --site homolog-crm.univesp.br
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from typing import Any

STUDENT_QUERY = """
SELECT
  LOWER(TRIM(p.email)) AS email,
  REGEXP_REPLACE(p.cpf, '[^0-9]', '') AS cpf,
  TRIM(m.matricula) AS ra,
  TRIM(p.nome) AS nome,
  p.codigo AS pessoa_codigo,
  CAST(ue.codigo AS VARCHAR) AS polo_id,
  ue.nome AS polo_nome,
  c.nome AS curso,
  m.situacao AS situacao
FROM postgresql-sei.public.pessoa p
JOIN postgresql-sei.public.matricula m
  ON m.aluno = p.codigo
JOIN postgresql-sei.public.unidadeensino ue
  ON ue.codigo = m.unidadeensino
LEFT JOIN postgresql-sei.public.curso c
  ON c.codigo = m.curso
WHERE p.email IS NOT NULL
  AND p.cpf IS NOT NULL
  AND m.unidadeensino IS NOT NULL
  AND m.situacao IS NOT NULL
"""


def normalize_cpf(value: str) -> str:
	return re.sub(r"[^0-9]", "", str(value or ""))


def build_query(polo_ids: list[str], limit: int) -> str:
	query = STUDENT_QUERY
	if polo_ids:
		ids = ", ".join(f"'{pid}'" for pid in polo_ids)
		query += f"\n  AND CAST(ue.codigo AS VARCHAR) IN ({ids})"
	query += f"\nLIMIT {int(limit)}"
	return query


def validate_env() -> dict[str, Any]:
	"""Checa variaveis e dependencia trino sem conectar."""
	report: dict[str, Any] = {"ok": True, "checks": []}
	for name in ("TRINO_HOST", "TRINO_USER"):
		value = os.environ.get(name, "").strip()
		status = "pass" if value else "fail"
		if status == "fail":
			report["ok"] = False
		report["checks"].append({"name": name, "status": status})
	password = os.environ.get("TRINO_PASSWORD", "")
	report["checks"].append({"name": "TRINO_PASSWORD", "status": "pass" if password else "warn"})
	try:
		import trino

		report["checks"].append({"name": "trino_package", "status": "pass"})
	except ImportError:
		report["ok"] = False
		report["checks"].append({"name": "trino_package", "status": "fail"})
	return report


def fetch_rows(query: str) -> list[dict[str, Any]]:
	try:
		import trino
	except ImportError as exc:
		raise SystemExit("Instale trino: pip install trino") from exc

	host = os.environ.get("TRINO_HOST", "").strip()
	user = os.environ.get("TRINO_USER", "").strip()
	password = os.environ.get("TRINO_PASSWORD", "")
	port = int(os.environ.get("TRINO_PORT", "443"))
	if not host or not user:
		raise SystemExit("Defina TRINO_HOST e TRINO_USER.")

	conn = trino.dbapi.connect(
		host=host,
		port=port,
		user=user,
		http_scheme=os.environ.get("TRINO_HTTP_SCHEME", "https"),
		auth=trino.auth.BasicAuthentication(user, password) if password else None,
	)
	cursor = conn.cursor()
	cursor.execute(query)
	columns = [col[0] for col in cursor.description]
	rows = []
	for record in cursor.fetchall():
		item = dict(zip(columns, record, strict=True))
		cpf = normalize_cpf(item.get("cpf"))
		email = str(item.get("email") or "").strip().lower()
		if len(cpf) != 11 or not email:
			continue
		rows.append(
			{
				"email": email,
				"cpf": cpf,
				"ra": str(item.get("ra") or "").strip(),
				"nome": str(item.get("nome") or email).strip(),
				"polo_id": str(item.get("polo_id") or "").strip(),
				"polo_nome": str(item.get("polo_nome") or "").strip(),
				"curso": str(item.get("curso") or "").strip(),
				"situacao": str(item.get("situacao") or "").strip(),
				"pessoa_codigo": str(item.get("pessoa_codigo") or "").strip(),
			}
		)
	return rows


def apply_via_bench(site: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
	kwargs = json.dumps({"rows": rows}, ensure_ascii=False)
	cmd = [
		"bench",
		"--site",
		site,
		"execute",
		"univesp_atendimento.import_students.upsert_rows",
		"--kwargs",
		kwargs,
	]
	print(f"Executando bench execute ({len(rows)} linhas)...")
	completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
	if completed.returncode != 0:
		print(completed.stderr or completed.stdout, file=sys.stderr)
		raise SystemExit(completed.returncode)
	try:
		return json.loads(completed.stdout.strip() or "{}")
	except json.JSONDecodeError:
		print(completed.stdout)
		return {"stdout": completed.stdout.strip()}


def main() -> int:
	parser = argparse.ArgumentParser(description="Import piloto alunos via Trino")
	parser.add_argument("--limit", type=int, default=100)
	parser.add_argument("--polo-id", action="append", default=[], dest="polo_ids")
	parser.add_argument("--dry-run", action="store_true")
	parser.add_argument("--apply", action="store_true", help="Upsert via bench execute no Frappe")
	parser.add_argument("--validate-env", action="store_true", help="Valida env sem conectar ao Trino")
	parser.add_argument("--site", default=os.environ.get("FRAPPE_SITE_NAME", "homolog-crm.univesp.br"))
	args = parser.parse_args()

	if args.validate_env:
		report = validate_env()
		print(json.dumps(report, ensure_ascii=False, indent=2))
		return 0 if report["ok"] else 1

	query = build_query(args.polo_ids, args.limit)
	rows = fetch_rows(query)
	print(f"Linhas validas: {len(rows)}")
	if args.dry_run:
		for row in rows[:5]:
			masked = {**row, "cpf": f"***{row['cpf'][-4:]}"}
			print(masked)
		return 0

	if args.apply:
		if not rows:
			print("Nenhuma linha para importar.")
			return 1
		result = apply_via_bench(args.site, rows)
		print(json.dumps(result, ensure_ascii=False))
		return 0

	print("Use --apply --site SITE para gravar no Frappe (requer bench no PATH).")
	return 0


if __name__ == "__main__":
	sys.exit(main())
