"""Build FAQ candidates from tickets + starter intents — NOT manual copy."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug or "pergunta"


def normalize_subject(text: str) -> str:
    value = unicodedata.normalize("NFKD", text or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def assign_package_id(text: str, theme_config: dict[str, Any]) -> str:
    haystack = text.lower()
    for package in theme_config.get("intent_packages", []):
        if package.get("id") == "outros":
            continue
        for keyword in package.get("keywords", []):
            if keyword.lower() in haystack:
                return package["id"]
    return "outros"


def read_ticket_subjects(csv_path: Path, column: str = "assunto") -> list[str]:
    subjects: list[str] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        col = column if column in fields else fields[0] if fields else column
        has_count = "count" in fields
        for row in reader:
            subject = normalize_subject(row.get(col) or "")
            if not subject:
                continue
            if has_count:
                try:
                    repeat = max(1, int(float(row.get("count") or 1)))
                except ValueError:
                    repeat = 1
                subjects.extend([subject] * repeat)
            else:
                subjects.append(subject)
    return subjects


def candidate_id(question: str, package_id: str) -> str:
    digest = hashlib.sha256(f"{package_id}:{question}".encode("utf-8")).hexdigest()[:10]
    return f"{package_id}-{slugify(question)[:40]}-{digest}"


def link_sources(question: str, source_items: list[dict[str, Any]], limit: int = 3) -> list[str]:
    tokens = set(re.findall(r"[a-záàâãéêíóôõúç0-9]{4,}", question.lower()))
    scored: list[tuple[int, str]] = []
    for item in source_items:
        haystack = f"{item.get('title', '')} {item.get('content_md', '')}".lower()
        score = sum(1 for token in tokens if token in haystack)
        if score:
            scored.append((score, item["item_id"]))
    scored.sort(reverse=True)
    return [item_id for _, item_id in scored[:limit]]


def build_ticket_candidates(
    subjects: list[str],
    theme_config: dict[str, Any],
    top_n: int = 25,
) -> dict[str, list[tuple[str, int]]]:
    grouped: dict[str, Counter[str]] = defaultdict(Counter)
    for subject in subjects:
        package_id = assign_package_id(subject, theme_config)
        grouped[package_id][subject] += 1
    result: dict[str, list[tuple[str, int]]] = {}
    for package_id, counter in grouped.items():
        result[package_id] = counter.most_common(top_n)
    return result


def make_candidate(
    question: str,
    package_id: str,
    source_items: list[dict[str, Any]],
    origin: str,
    ticket_count: int = 0,
) -> dict[str, Any]:
    return {
        "candidate_id": candidate_id(question, package_id),
        "question": question,
        "suggested_title": question,
        "suggested_answer": "",
        "suggested_node_kind": "final",
        "origin": origin,
        "ticket_count": ticket_count,
        "source_refs": link_sources(question, source_items),
        "document_refs": [],
        "review": {
            "status": "pending",
            "approved": False,
            "notes": "",
        },
    }


def build_faq_candidates(
    packages: list[dict[str, Any]],
    tickets_csv: Path | None = None,
    ticket_column: str = "assunto",
    top_n: int = 25,
) -> list[dict[str, Any]]:
    theme_config = load_json(CONFIG_DIR / "themes.json")
    starter = load_json(CONFIG_DIR / "starter_intents.json").get("intents_by_package", {})

    ticket_map: dict[str, list[tuple[str, int]]] = {}
    if tickets_csv and tickets_csv.exists():
        subjects = read_ticket_subjects(tickets_csv, ticket_column)
        ticket_map = build_ticket_candidates(subjects, theme_config, top_n=top_n)

    updated: list[dict[str, Any]] = []
    for package in packages:
        package_id = package["package_id"]
        source_items = package.get("source_items") or package.get("items") or []
        documents = package.get("documents") or []

        candidates: list[dict[str, Any]] = []
        seen_questions: set[str] = set()

        for question, count in ticket_map.get(package_id, []):
            key = question.lower()
            if key in seen_questions:
                continue
            seen_questions.add(key)
            candidates.append(
                make_candidate(question, package_id, source_items, "ticket", ticket_count=count)
            )

        if not candidates:
            for question in starter.get(package_id, []):
                key = question.lower()
                if key in seen_questions:
                    continue
                seen_questions.add(key)
                candidates.append(make_candidate(question, package_id, source_items, "starter_intent"))

        for candidate in candidates:
            doc_refs: list[str] = []
            q_tokens = set(re.findall(r"[a-záàâãéêíóôõúç0-9]{4,}", candidate["question"].lower()))
            for doc in documents:
                label = f"{doc.get('label', '')} {doc.get('url', '')}".lower()
                if any(token in label for token in q_tokens):
                    doc_refs.append(doc["doc_id"])
            candidate["document_refs"] = doc_refs[:5]

        package_copy = {**package}
        package_copy["source_items"] = source_items
        package_copy["faq_candidates"] = candidates
        package_copy["faq_candidate_count"] = len(candidates)
        package_copy.pop("items", None)
        updated.append(package_copy)

    return updated


def run_build_candidates(data_dir: Path, tickets_csv: Path | None = None, ticket_column: str = "assunto") -> dict[str, Any]:
    packages_path = data_dir / "packages.json"
    packages = load_json(packages_path)

    csv_path = tickets_csv
    if csv_path is None:
        default_csv = data_dir / "tickets" / "subjects.csv"
        if default_csv.exists():
            csv_path = default_csv

    packages = build_faq_candidates(packages, csv_path, ticket_column=ticket_column)
    write_json(packages_path, packages)

    manifest_path = data_dir / "manifest.json"
    manifest = load_json(manifest_path)
    total_candidates = sum(p.get("faq_candidate_count", 0) for p in packages)
    manifest["faq_candidate_count"] = total_candidates
    manifest["tickets_imported"] = bool(csv_path and csv_path.exists())
    manifest.setdefault("steps", {})["faq_candidates"] = {
        "status": "completed",
        "ticket_source": str(csv_path) if csv_path else None,
        "count": total_candidates,
    }
    write_json(manifest_path, manifest)

    return {
        "faq_candidate_count": total_candidates,
        "tickets_csv": str(csv_path) if csv_path else None,
    }
