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
import tempfile
from typing import Any

def trino_catalog() -> str:
	"""Catalog names with hyphens must be double-quoted in Trino SQL."""
	catalog = os.environ.get("TRINO_CATALOG", "postgresql-sei").strip() or "postgresql-sei"
	return f'"{catalog}"'


def student_situacoes() -> list[str]:
	raw = os.environ.get("STUDENT_SITUACOES", "AT").strip()
	return [part.strip() for part in raw.split(",") if part.strip()]


def build_student_query() -> str:
	catalog = trino_catalog()
	situacoes = student_situacoes()
	situacao_filter = ""
	if situacoes:
		quoted = ", ".join(f"'{code}'" for code in situacoes)
		situacao_filter = f"\n  AND m.situacao IN ({quoted})"
	return f"""
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
FROM {catalog}.public.pessoa p
JOIN {catalog}.public.matricula m
  ON m.aluno = p.codigo
JOIN {catalog}.public.unidadeensino ue
  ON ue.codigo = m.unidadeensino
LEFT JOIN {catalog}.public.curso c
  ON c.codigo = m.curso
WHERE p.email IS NOT NULL
  AND p.cpf IS NOT NULL
  AND m.unidadeensino IS NOT NULL
  AND m.situacao IS NOT NULL{situacao_filter}
"""


def normalize_cpf(value: str) -> str:
	return re.sub(r"[^0-9]", "", str(value or ""))


def is_valid_email(value: str) -> bool:
	email = str(value or "").strip().lower()
	return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def build_query(polo_ids: list[str], limit: int) -> str:
	query = build_student_query()
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
		if len(cpf) != 11 or not email or not is_valid_email(email):
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


def resolve_frappe_paths() -> tuple[str, str]:
	"""Resolve bench root and its Python binary (bench CLI may not exist on PATH)."""
	candidates = [
		os.environ.get("FRAPPE_BENCH", "").strip(),
		"/var/crm/frappe-bench",
		"/home/frappe/frappe-bench",
	]
	for bench_root in candidates:
		if not bench_root:
			continue
		python_bin = os.path.join(bench_root, "env", "bin", "python")
		if os.path.isfile(python_bin):
			return bench_root, python_bin
	raise SystemExit(
		"Python do bench nao encontrado. Defina FRAPPE_BENCH (ex.: /var/crm/frappe-bench)."
	)


def apply_via_bench(site: str, rows: list[dict[str, Any]], batch_size: int = 50) -> dict[str, Any]:
	"""Grava via Frappe Python + arquivo temporario (evita limite de argv do bench --kwargs)."""
	bench_root, python_bin = resolve_frappe_paths()
	bench_user = os.environ.get("BENCH_USER", "frappe").strip() or "frappe"
	totals = {"created": 0, "updated": 0, "skipped": 0, "total": len(rows), "batches": 0}

	for offset in range(0, len(rows), batch_size):
		chunk = rows[offset : offset + batch_size]
		payload_path = ""
		try:
			with tempfile.NamedTemporaryFile(
				mode="w",
				suffix=".json",
				delete=False,
				dir="/tmp",
				encoding="utf-8",
			) as handle:
				json.dump(chunk, handle, ensure_ascii=False)
				payload_path = handle.name
			os.chmod(payload_path, 0o644)

			py_code = f"""
import json
import frappe

frappe.init(site={json.dumps(site)})
frappe.connect()
from univesp_atendimento.import_students import upsert_rows

with open({json.dumps(payload_path)}, encoding="utf-8") as handle:
    payload = json.load(handle)
print(json.dumps(upsert_rows(payload), ensure_ascii=False))
frappe.db.commit()
frappe.destroy()
"""
			batch_no = (offset // batch_size) + 1
			print(f"Executando import lote {batch_no} ({len(chunk)} linhas)...")
			cmd = ["sudo", "-u", bench_user, python_bin, "-c", py_code]
			completed = subprocess.run(cmd, check=False, capture_output=True, text=True, cwd=bench_root)
			if completed.returncode != 0:
				print(completed.stderr or completed.stdout, file=sys.stderr)
				raise SystemExit(completed.returncode)
			try:
				result = json.loads(completed.stdout.strip() or "{}")
			except json.JSONDecodeError:
				print(completed.stdout)
				result = {"stdout": completed.stdout.strip()}
			for key in ("created", "updated", "skipped"):
				totals[key] += int(result.get(key) or 0)
			totals["batches"] += 1
		finally:
			if payload_path:
				try:
					os.remove(payload_path)
				except OSError:
					pass

	return totals


def main() -> int:
	parser = argparse.ArgumentParser(description="Import piloto alunos via Trino")
	parser.add_argument("--limit", type=int, default=100)
	parser.add_argument("--polo-id", action="append", default=[], dest="polo_ids")
	parser.add_argument("--dry-run", action="store_true")
	parser.add_argument("--apply", action="store_true", help="Upsert via bench execute no Frappe")
	parser.add_argument("--batch-size", type=int, default=50, help="Linhas por lote no bench execute")
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
		result = apply_via_bench(args.site, rows, batch_size=max(1, args.batch_size))
		print(json.dumps(result, ensure_ascii=False))
		return 0

	print("Use --apply --site SITE para gravar no Frappe (requer bench no PATH).")
	return 0


if __name__ == "__main__":
	sys.exit(main())
