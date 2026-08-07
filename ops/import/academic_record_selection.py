"""Regras de escolha da matricula primaria (1 linha por aluno no Directory)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

# Cursos de extensao / aperfeicoamento nao sao o vinculo principal de atendimento.
EXTENSION_KEYWORDS = (
	"extens",
	"aperfei",
	"aperfeico",
	"curta duracao",
	"curta duração",
	"capacitacao",
	"capacitação",
)

GRADUATION_KEYWORDS = (
	"licenciatura",
	"bacharelado",
	"tecnologia em",
	"tecnologia",
	"gradua",
	"curso superior",
)


def course_track_rank(curso: str) -> int:
	"""Menor rank = maior prioridade. 0 graduacao, 1 indefinido, 2 extensao."""
	name = str(curso or "").strip().lower()
	if any(keyword in name for keyword in EXTENSION_KEYWORDS):
		return 2
	if any(keyword in name for keyword in GRADUATION_KEYWORDS):
		return 0
	return 1


def enrollment_track_label(curso: str) -> str:
	rank = course_track_rank(curso)
	if rank == 0:
		return "graduacao"
	if rank == 2:
		return "extensao"
	return "outro"


def pick_primary_enrollment(rows: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, dict[str, int]]:
	stats = {"candidates": len(rows), "multi_active": 0, "extension_skipped": 0}
	if not rows:
		return None, stats
	if len(rows) == 1:
		primary = dict(rows[0])
		primary["enrollment_track"] = enrollment_track_label(primary.get("curso"))
		return primary, stats

	stats["multi_active"] = 1
	ranked = sorted(
		rows,
		key=lambda row: (
			course_track_rank(str(row.get("curso") or "")),
			str(row.get("matricula_codigo") or row.get("ra") or ""),
		),
	)
	primary = dict(ranked[0])
	primary["enrollment_track"] = enrollment_track_label(primary.get("curso"))
	stats["extension_skipped"] = sum(
		1 for row in rows if row is not ranked[0] and course_track_rank(str(row.get("curso") or "")) >= 2
	)
	return primary, stats


def collapse_students_by_email(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
	"""Uma linha por e-mail institucional, priorizando graduacao AT."""
	grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
	for row in rows:
		email = str(row.get("email") or "").strip().lower()
		if not email:
			continue
		grouped[email].append(row)

	selected: list[dict[str, Any]] = []
	report = {
		"raw_rows": len(rows),
		"emails": 0,
		"multi_active_emails": 0,
		"extension_demoted_rows": 0,
	}

	for email in sorted(grouped):
		primary, stats = pick_primary_enrollment(grouped[email])
		if not primary:
			continue
		report["emails"] += 1
		if stats["multi_active"]:
			report["multi_active_emails"] += 1
		report["extension_demoted_rows"] += stats["extension_skipped"]
		selected.append(primary)

	return selected, report
