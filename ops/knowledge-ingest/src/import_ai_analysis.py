"""Import external AI analysis JSON files back into packages."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def merge_candidate_analysis(candidate: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    merged = {**candidate}
    analyses = candidate.get("ai", {}).get("analyses", []) + [analysis]
    merged["ai"] = {"analyses": analyses, "latest": analysis}

    if analysis.get("suggested_title"):
        merged["suggested_title"] = analysis["suggested_title"]
        merged["question"] = analysis["suggested_title"]
    if analysis.get("suggested_answer"):
        merged["suggested_answer"] = analysis["suggested_answer"]
    if analysis.get("suggested_node_kind"):
        merged["suggested_node_kind"] = analysis["suggested_node_kind"]
    if analysis.get("media_recommendation"):
        merged["media_recommendation"] = analysis["media_recommendation"]
    if analysis.get("checklist"):
        existing = merged.get("ai_checklist") or []
        merged["ai_checklist"] = list(dict.fromkeys(existing + analysis["checklist"]))
    if analysis.get("tree_hints"):
        merged["tree_hints"] = analysis["tree_hints"]
    if analysis.get("placements"):
        merged["media_placements"] = (merged.get("media_placements") or []) + analysis["placements"]

    review = merged.setdefault("review", {})
    review["ai_ready"] = True
    return merged


def merge_item_analysis(item: dict[str, Any], analysis: dict[str, Any]) -> dict[str, Any]:
    return merge_candidate_analysis(item, analysis)


def index_analyses(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for entry in payload.get("items", []):
        item_id = entry.get("item_id")
        if item_id:
            indexed[item_id] = entry
    return indexed


def import_ai_analysis(data_dir: Path) -> dict[str, Any]:
    packages = load_json(data_dir / "packages.json")
    jobs_root = data_dir / "ai_jobs"
    imported_files: list[str] = []

    analysis_files = sorted(jobs_root.glob("**/analysis*.json")) if jobs_root.exists() else []
    if not analysis_files:
        raise FileNotFoundError("Nenhum arquivo analysis*.json encontrado em ai_jobs/.")

    for analysis_file in analysis_files:
        payload = load_json(analysis_file)
        package_id = payload.get("package_id") or analysis_file.parent.name
        by_item = index_analyses(payload)
        for package in packages:
            if package["package_id"] != package_id:
                continue
            candidates = package.get("faq_candidates") or package.get("items") or []
            updated_candidates = []
            for candidate in candidates:
                key = candidate.get("candidate_id") or candidate.get("item_id")
                if key in by_item:
                    updated_candidates.append(merge_candidate_analysis(candidate, by_item[key]))
                else:
                    updated_candidates.append(candidate)
            for item_id, analysis in by_item.items():
                if not any((c.get("candidate_id") or c.get("item_id")) == item_id for c in updated_candidates):
                    updated_candidates.append(
                        merge_candidate_analysis(
                            {
                                "candidate_id": item_id,
                                "question": analysis.get("suggested_title") or item_id,
                                "suggested_title": analysis.get("suggested_title") or item_id,
                                "suggested_answer": analysis.get("suggested_answer") or "",
                                "origin": "ai_new",
                                "review": {"status": "pending", "approved": False, "notes": ""},
                            },
                            analysis,
                        )
                    )
            package["faq_candidates"] = updated_candidates
            package["faq_candidate_count"] = len(updated_candidates)
            package.pop("items", None)
            package["ai_analysis_files"] = sorted(
                set(package.get("ai_analysis_files", []) + [analysis_file.name])
            )
        imported_files.append(str(analysis_file.relative_to(data_dir)))

    write_json(data_dir / "packages.json", packages)
    manifest = load_json(data_dir / "manifest.json")
    manifest.setdefault("steps", {})["ai_analysis"] = {
        "status": "completed",
        "imported_files": imported_files,
    }
    manifest.setdefault("steps", {})["consolidate"] = {"status": "completed"}
    write_json(data_dir / "manifest.json", manifest)
    return {"imported_files": imported_files, "file_count": len(imported_files)}
