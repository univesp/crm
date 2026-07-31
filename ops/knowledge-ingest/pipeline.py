#!/usr/bin/env python3
"""CLI for knowledge ingest pipeline."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))

from crawl_manual import run_crawl
from export_ai_jobs import export_ai_jobs
from export_faq_xlsx import export_faq_xlsx
from import_ai_analysis import import_ai_analysis


def default_run_id() -> str:
	return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def resolve_data_dir(base: Path, run_id: str | None) -> Path:
	rid = run_id or default_run_id()
	return base / rid


def cmd_crawl(options: argparse.Namespace) -> int:
	data_dir = resolve_data_dir(Path(options.data_dir), options.run_id)
	manifest = run_crawl(data_dir, options.url)
	print(
		json.dumps(
			{"ok": True, "data_dir": str(data_dir), "manifest": manifest}, ensure_ascii=False, indent=2
		)
	)
	return 0


def cmd_export_jobs(options: argparse.Namespace) -> int:
	data_dir = Path(options.data_dir)
	jobs_root = export_ai_jobs(
		data_dir,
		options.job_types.split(",") if options.job_types else None,
	)
	print(json.dumps({"ok": True, "jobs_root": str(jobs_root)}, ensure_ascii=False, indent=2))
	return 0


def cmd_import_analysis(options: argparse.Namespace) -> int:
	data_dir = Path(options.data_dir)
	result = import_ai_analysis(data_dir)
	print(json.dumps({"ok": True, **result}, ensure_ascii=False, indent=2))
	return 0


def cmd_export_xlsx(options: argparse.Namespace) -> int:
	data_dir = Path(options.data_dir)
	export_dir = export_faq_xlsx(data_dir)
	print(json.dumps({"ok": True, "export_dir": str(export_dir)}, ensure_ascii=False, indent=2))
	return 0


def main() -> int:
	default_data = ROOT.parent.parent / "tools" / "knowledge-studio" / "data" / "runs"
	parser = argparse.ArgumentParser(description="UNIVESP knowledge ingest pipeline")
	parser.add_argument("--data-dir", default=str(default_data))
	sub = parser.add_subparsers(dest="command", required=True)

	crawl = sub.add_parser("crawl", help="Crawl manual do aluno")
	crawl.add_argument("--run-id")
	crawl.add_argument("--url", default="https://apps.univesp.br/manual-do-aluno/")
	crawl.set_defaults(func=cmd_crawl)

	jobs = sub.add_parser("export-ai-jobs", help="Export AI job packs")
	jobs.add_argument("run_path", help="Path to run directory")
	jobs.add_argument("--job-types", default="simplify_and_tree,media_audit")
	jobs.set_defaults(
		func=lambda options: setattr(options, "data_dir", options.run_path) or cmd_export_jobs(options)
	)

	imp = sub.add_parser("import-ai-analysis", help="Import analysis JSON files")
	imp.add_argument("run_path")
	imp.set_defaults(
		func=lambda options: setattr(options, "data_dir", options.run_path) or cmd_import_analysis(options)
	)

	xlsx = sub.add_parser("export-xlsx", help="Export FAQ Builder XLSX")
	xlsx.add_argument("run_path")
	xlsx.set_defaults(
		func=lambda options: setattr(options, "data_dir", options.run_path) or cmd_export_xlsx(options)
	)

	args = parser.parse_args()
	return args.func(args)


if __name__ == "__main__":
	raise SystemExit(main())
