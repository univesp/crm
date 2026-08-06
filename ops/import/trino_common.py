"""Utilitarios compartilhados para imports Trino -> CRM."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


def load_dotenv(path: Path) -> None:
	if not path.exists():
		return
	for line in path.read_text(encoding="utf-8").splitlines():
		line = line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue
		key, value = line.split("=", 1)
		key = key.strip()
		value = value.strip().strip('"').strip("'")
		if key and key not in os.environ:
			os.environ[key] = value


def load_trino_env() -> None:
	root = Path(__file__).resolve().parent
	load_dotenv(root / ".env.trino")
	load_dotenv(root / ".env")


def validate_trino_env() -> dict[str, Any]:
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
		import trino  # noqa: F401

		report["checks"].append({"name": "trino_package", "status": "pass"})
	except ImportError:
		report["ok"] = False
		report["checks"].append({"name": "trino_package", "status": "fail"})
	return report


def trino_connect():
	try:
		import trino
		from trino.auth import BasicAuthentication
	except ImportError as exc:
		raise SystemExit("Instale trino: pip install trino") from exc

	host = os.environ.get("TRINO_HOST", "").strip()
	user = os.environ.get("TRINO_USER", "").strip()
	password = os.environ.get("TRINO_PASSWORD", "")
	port = int(os.environ.get("TRINO_PORT", "443"))
	if not host or not user:
		raise SystemExit("Defina TRINO_HOST e TRINO_USER.")

	auth = BasicAuthentication(user, password) if password else None
	return trino.dbapi.connect(
		host=host,
		port=port,
		user=user,
		http_scheme=os.environ.get("TRINO_HTTP_SCHEME", "https"),
		auth=auth,
	)


def fetch_rows(query: str) -> list[dict[str, Any]]:
	conn = trino_connect()
	cursor = conn.cursor()
	cursor.execute(query)
	columns = [col[0] for col in cursor.description]
	rows = [dict(zip(columns, record, strict=True)) for record in cursor.fetchall()]
	cursor.close()
	conn.close()
	return rows


def run_bench_execute(site: str, method: str, kwargs: dict[str, Any] | None = None) -> dict[str, Any]:
	cmd = ["bench", "--site", site, "execute", method]
	if kwargs is not None:
		cmd.extend(["--kwargs", json.dumps(kwargs, ensure_ascii=False)])
	completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
	if completed.returncode != 0:
		print(completed.stderr or completed.stdout, file=sys.stderr)
		raise SystemExit(completed.returncode)
	try:
		return json.loads(completed.stdout.strip() or "{}")
	except json.JSONDecodeError:
		return {"stdout": completed.stdout.strip()}


def apply_via_bench(site: str, rows: list[dict[str, Any]], *, method: str, batch_size: int = 500) -> dict[str, Any]:
	if not rows:
		return {"created": 0, "updated": 0, "skipped": 0, "total": 0, "batches": 0}

	totals = {"created": 0, "updated": 0, "skipped": 0, "total": 0, "batches": 0}
	for start in range(0, len(rows), batch_size):
		chunk = rows[start : start + batch_size]
		kwargs = json.dumps({"rows": chunk}, ensure_ascii=False)
		cmd = ["bench", "--site", site, "execute", method, "--kwargs", kwargs]
		completed = subprocess.run(cmd, check=False, capture_output=True, text=True)
		if completed.returncode != 0:
			print(completed.stderr or completed.stdout, file=sys.stderr)
			raise SystemExit(completed.returncode)
		try:
			result = json.loads(completed.stdout.strip() or "{}")
		except json.JSONDecodeError:
			result = {"stdout": completed.stdout.strip()}
		for key in ("created", "updated", "skipped", "total"):
			if key in result:
				totals[key] += int(result[key])
		totals["batches"] += 1
		print(f"batch {totals['batches']}: +{len(chunk)} linhas", file=sys.stderr)
	return totals
