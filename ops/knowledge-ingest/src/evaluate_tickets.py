#!/usr/bin/env python3
"""Avalia cobertura FAQ contra base histórica de chamados (assunto)."""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"


def normalize(text: str) -> str:
	value = unicodedata.normalize("NFKD", text or "")
	value = value.encode("ascii", "ignore").decode("ascii").lower()
	return re.sub(r"\s+", " ", value).strip()


def load_faq_corpus(run_dir: Path) -> list[dict[str, Any]]:
	packages = json.loads((run_dir / "packages.json").read_text(encoding="utf-8"))
	corpus: list[dict[str, Any]] = []
	for package in packages:
		for item in package.get("items", []):
			corpus.append(
				{
					"package_id": package["package_id"],
					"package_title": package["title"],
					"item_id": item.get("item_id"),
					"title": item.get("suggested_title") or item.get("title"),
					"answer": item.get("suggested_answer") or "",
					"text": normalize(
						" ".join(
							[
								str(item.get("title") or ""),
								str(item.get("suggested_title") or ""),
								str(item.get("suggested_answer") or ""),
								str(item.get("content_md") or "")[:1200],
								str(package.get("title") or ""),
							]
						)
					),
				}
			)
	return corpus


def score_match(subject: str, entry: dict[str, Any]) -> float:
	subject_norm = normalize(subject)
	if not subject_norm:
		return 0.0
	title_norm = normalize(entry.get("title") or "")
	if subject_norm == title_norm:
		return 1.0
	if subject_norm in entry.get("text", ""):
		return 0.85
	subject_tokens = set(subject_norm.split())
	text_tokens = set(entry.get("text", "").split())
	if not subject_tokens:
		return 0.0
	overlap = len(subject_tokens & text_tokens) / len(subject_tokens)
	return round(overlap, 4)


def best_match(subject: str, corpus: list[dict[str, Any]], threshold: float) -> dict[str, Any] | None:
	ranked = sorted(
		((score_match(subject, entry), entry) for entry in corpus), reverse=True, key=lambda x: x[0]
	)
	if not ranked:
		return None
	score, entry = ranked[0]
	if score < threshold:
		return None
	return {"score": score, **entry}


def read_subjects(csv_path: Path, column: str) -> list[str]:
	subjects: list[str] = []
	with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
		reader = csv.DictReader(handle)
		if column not in (reader.fieldnames or []):
			raise ValueError(f"Coluna '{column}' não encontrada. Colunas: {reader.fieldnames}")
		for row in reader:
			subject = (row.get(column) or "").strip()
			if subject:
				subjects.append(subject)
	return subjects


def evaluate(subjects: list[str], corpus: list[dict[str, Any]], threshold: float) -> dict[str, Any]:
	matched = 0
	unmatched_subjects: Counter[str] = Counter()
	package_hits: Counter[str] = Counter()
	samples: list[dict[str, Any]] = []

	for subject in subjects:
		hit = best_match(subject, corpus, threshold)
		if hit:
			matched += 1
			package_hits[hit["package_id"]] += 1
		else:
			unmatched_subjects[subject] += 1

	for subject, count in unmatched_subjects.most_common(30):
		samples.append({"subject": subject, "count": count, "matched": False})

	return {
		"total_tickets": len(subjects),
		"matched": matched,
		"unmatched": len(subjects) - matched,
		"coverage_pct": round((matched / len(subjects)) * 100, 2) if subjects else 0.0,
		"threshold": threshold,
		"top_unmatched": samples,
		"top_packages": package_hits.most_common(20),
	}


def main() -> int:
	parser = argparse.ArgumentParser(description="Avalia assuntos de tickets vs FAQ gerada")
	parser.add_argument("--csv", required=True, help="CSV com coluna de assunto")
	parser.add_argument("--column", default="assunto", help="Nome da coluna de assunto")
	parser.add_argument("--run-dir", required=True, help="Diretório da execução do knowledge-ingest")
	parser.add_argument("--threshold", type=float, default=0.35, help="Score mínimo para considerar match")
	parser.add_argument("--output", help="Arquivo JSON de saída")
	parser.add_argument("--sample-size", type=int, default=0, help="Limitar N tickets (0 = todos)")
	args = parser.parse_args()

	subjects = read_subjects(Path(args.csv), args.column)
	if args.sample_size > 0:
		subjects = subjects[: args.sample_size]

	corpus = load_faq_corpus(Path(args.run_dir))
	report = evaluate(subjects, corpus, args.threshold)
	payload = json.dumps(report, ensure_ascii=False, indent=2)
	print(payload)
	if args.output:
		Path(args.output).write_text(payload, encoding="utf-8")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
