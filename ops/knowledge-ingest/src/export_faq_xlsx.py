"""Export curated packages to FAQ Builder XLSX."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from openpyxl import Workbook


FAQ_COLUMNS = [
    "node_id",
    "short_title",
    "node_type",
    "parent_id",
    "response_content",
    "closing_action",
    "response_mode",
    "child_order",
    "theme",
    "subtheme",
    "status",
    "internal_note",
    "queue_destination",
    "criticality",
    "sla",
    "slug",
    "tags",
]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def slugify(value: str) -> str:
    import re
    import unicodedata

    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-") or "no"


def item_to_rows(item: dict[str, Any], package: dict[str, Any]) -> list[dict[str, Any]]:
    item_id = item.get("candidate_id") or item.get("item_id")
    title = item.get("suggested_title") or item.get("question") or item.get("title")
    answer = item.get("suggested_answer") or ""
    node_kind = item.get("suggested_node_kind") or "final"
    node_type = "path" if node_kind in {"path", "branch", "theme"} else "final"
    theme = package.get("title", "Geral")
    subtheme = item.get("title", theme)
    media = item.get("media_recommendation") or {}
    internal_note_parts = []
    if media.get("type"):
        internal_note_parts.append(f"midia:{media.get('type')}")
    if item.get("ai_checklist"):
        internal_note_parts.append("checklist_ia=" + "; ".join(item["ai_checklist"][:3]))
    if item.get("review", {}).get("notes"):
        internal_note_parts.append(item["review"]["notes"])

    root_row = {
        "node_id": item_id,
        "short_title": title,
        "node_type": node_type,
        "parent_id": f"{package['package_id']}-root",
        "response_content": answer if node_type == "final" else "",
        "closing_action": "mostrar_resposta" if node_type == "final" else "ir_para_subniveis",
        "response_mode": "informational",
        "child_order": 1,
        "theme": theme,
        "subtheme": subtheme,
        "status": "draft",
        "internal_note": " | ".join(internal_note_parts),
        "queue_destination": "atendimento-geral",
        "criticality": "media",
        "sla": "24h",
        "slug": slugify(title),
        "tags": package["package_id"],
    }
    return [root_row]


def export_faq_xlsx(data_dir: Path) -> Path:
    packages = load_json(data_dir / "packages.json")
    export_dir = data_dir / "export"
    export_dir.mkdir(parents=True, exist_ok=True)

    for package in packages:
        if package.get("chunk_count", 0) == 0:
            continue
        rows: list[dict[str, Any]] = [
            {
                "node_id": f"{package['package_id']}-root",
                "short_title": package["title"],
                "node_type": "path",
                "parent_id": "",
                "response_content": "",
                "closing_action": "ir_para_subniveis",
                "response_mode": "informational",
                "child_order": 1,
                "theme": package["title"],
                "subtheme": package["title"],
                "status": "draft",
                "internal_note": "gerado pelo knowledge-ingest",
                "queue_destination": "nao_aplicavel",
                "criticality": "baixa",
                "sla": "24h",
                "slug": package["package_id"],
                "tags": "import,knowledge-studio",
            }
        ]

        order = 1
        candidates = package.get("faq_candidates") or package.get("items") or []
        for item in candidates:
            if not item.get("review", {}).get("approved"):
                continue
            for row in item_to_rows(item, package):
                row["child_order"] = order
                rows.append(row)
                order += 1

        if len(rows) <= 1:
            continue

        wb = Workbook()
        ws = wb.active
        ws.title = "faq_import"
        ws.append(FAQ_COLUMNS)
        for row in rows:
            ws.append([row.get(col, "") for col in FAQ_COLUMNS])
        output = export_dir / f"faq-{package['package_id']}.xlsx"
        wb.save(output)

    manifest = load_json(data_dir / "manifest.json")
    manifest.setdefault("steps", {})["export_faq"] = {"status": "completed"}
    (data_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return export_dir
