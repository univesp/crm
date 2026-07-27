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

from crawl_manual import run_crawl  # noqa: E402
from export_ai_jobs import export_ai_jobs  # noqa: E402
from export_faq_xlsx import export_faq_xlsx  # noqa: E402
from import_ai_analysis import import_ai_analysis  # noqa: E402
from build_faq_candidates import run_build_candidates  # noqa: E402

SCRIPTS = ROOT / "scripts"


def default_run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def resolve_data_dir(base: Path, run_id: str | None) -> Path:
    rid = run_id or default_run_id()
    return base / rid


def cmd_crawl(args: argparse.Namespace) -> int:
    data_dir = resolve_data_dir(Path(args.data_dir), args.run_id)
    manifest = run_crawl(data_dir, args.url)
    print(json.dumps({"ok": True, "data_dir": str(data_dir), "manifest": manifest}, ensure_ascii=False, indent=2))
    return 0


def cmd_export_jobs(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    jobs_root = export_ai_jobs(data_dir, args.job_types.split(",") if args.job_types else None)
    print(json.dumps({"ok": True, "jobs_root": str(jobs_root)}, ensure_ascii=False, indent=2))
    return 0


def cmd_import_analysis(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    result = import_ai_analysis(data_dir)
    print(json.dumps({"ok": True, **result}, ensure_ascii=False, indent=2))
    return 0


def cmd_export_xlsx(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    export_dir = export_faq_xlsx(data_dir)
    print(json.dumps({"ok": True, "export_dir": str(export_dir)}, ensure_ascii=False, indent=2))
    return 0


def cmd_build_candidates(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    tickets = Path(args.tickets_csv) if args.tickets_csv else None
    result = run_build_candidates(data_dir, tickets, ticket_column=args.ticket_column)
    print(json.dumps({"ok": True, **result}, ensure_ascii=False, indent=2))
    return 0


def cmd_export_protocol_subjects(args: argparse.Namespace) -> int:
    import subprocess

    script = SCRIPTS / "export_protocolo_subjects.py"
    output = Path(args.output)
    cmd = [
        sys.executable,
        str(script),
        args.xlsx,
        "--output",
        str(output),
        "--sheet",
        args.sheet,
        "--column",
        args.column,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        return proc.returncode
    print(json.dumps({"ok": True, "output": str(output), "message": proc.stdout.strip()}, ensure_ascii=False, indent=2))
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
    jobs.set_defaults(func=lambda args: setattr(args, "data_dir", args.run_path) or cmd_export_jobs(args))

    imp = sub.add_parser("import-ai-analysis", help="Import analysis JSON files")
    imp.add_argument("run_path")
    imp.set_defaults(func=lambda args: setattr(args, "data_dir", args.run_path) or cmd_import_analysis(args))

    xlsx = sub.add_parser("export-xlsx", help="Export FAQ Builder XLSX")
    xlsx.add_argument("run_path")
    xlsx.set_defaults(func=lambda args: setattr(args, "data_dir", args.run_path) or cmd_export_xlsx(args))

    candidates = sub.add_parser("build-candidates", help="Rebuild FAQ candidates from tickets CSV")
    candidates.add_argument("run_path")
    candidates.add_argument("--tickets-csv")
    candidates.add_argument("--ticket-column", default="assunto")
    candidates.set_defaults(func=lambda args: setattr(args, "data_dir", args.run_path) or cmd_build_candidates(args))

    proto = sub.add_parser("export-protocol-subjects", help="Export Motivo_Normalizado from protocol XLSX to CSV")
    proto.add_argument("xlsx")
    proto.add_argument("--output", required=True)
    proto.add_argument("--sheet", default="PROTOCOLOS_STATUS")
    proto.add_argument("--column", default="Motivo_Normalizado")
    proto.set_defaults(func=cmd_export_protocol_subjects)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
