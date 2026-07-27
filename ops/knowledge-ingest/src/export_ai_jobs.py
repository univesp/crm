"""Export AI job packs for external analysis (Cursor, ChatGPT, Gemini, etc.)."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PROMPTS_DIR = ROOT / "prompts"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def build_job_input(package: dict[str, Any]) -> dict[str, Any]:
    return {
        "package_id": package["package_id"],
        "package_title": package["title"],
        "instructions": {
            "language": "pt-BR",
            "tone": "direto, voz ativa, pronome você",
            "first_sentence_must_answer": True,
            "max_root_intents": 6,
        },
        "items": [
            {
                "item_id": item["item_id"],
                "title": item["title"],
                "source_url": item.get("source_url"),
                "source_anchor": item.get("source_anchor"),
                "content_md": item.get("content_md"),
            }
            for item in package.get("items", [])
        ],
    }


def export_ai_jobs(data_dir: Path, job_types: list[str] | None = None) -> Path:
    packages = load_json(data_dir / "packages.json")
    jobs_root = data_dir / "ai_jobs"
    if jobs_root.exists():
        shutil.rmtree(jobs_root)
    jobs_root.mkdir(parents=True, exist_ok=True)

    selected = job_types or ["simplify_and_tree", "media_audit"]
    prompt_map = {
        "simplify_and_tree": PROMPTS_DIR / "01_simplify_and_tree.md",
        "media_audit": PROMPTS_DIR / "02_media_audit.md",
        "media_placement": PROMPTS_DIR / "03_media_placement.md",
    }

    for package in packages:
        if package.get("chunk_count", 0) == 0:
            continue
        package_dir = jobs_root / package["package_id"]
        package_dir.mkdir(parents=True, exist_ok=True)
        job_input = build_job_input(package)
        write_text(package_dir / "input.json", json.dumps(job_input, ensure_ascii=False, indent=2))

        readme_lines = [
            f"# AI Jobs — {package['title']}",
            "",
            "1. Abra `input.json` neste pacote.",
            "2. Escolha um job abaixo e copie o prompt correspondente.",
            "3. Cole o conteúdo de `input.json` após o prompt (ou anexe o arquivo).",
            "4. Salve a resposta como `analysis_<seu_nome>.json` nesta pasta.",
            "5. No Knowledge Studio, importe os arquivos JSON.",
            "",
            "## Jobs disponíveis",
        ]
        for job_type in selected:
            prompt_path = prompt_map[job_type]
            prompt_copy = package_dir / f"prompt_{job_type}.md"
            if prompt_path.exists():
                shutil.copy2(prompt_path, prompt_copy)
            readme_lines.append(f"- `{prompt_copy.name}` → resposta: `analysis_{job_type}_SEU_NOME.json`")
        write_text(package_dir / "README.md", "\n".join(readme_lines) + "\n")

    from datetime import datetime, timezone

    manifest = load_json(data_dir / "manifest.json")
    exported_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    manifest.setdefault("steps", {})["ai_analysis"] = {
        "status": "in_progress",
        "at": manifest.get("steps", {}).get("ai_analysis", {}).get("at"),
        "jobs_exported_at": exported_at,
    }
    write_text(data_dir / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    return jobs_root


def export_media_placement_job(data_dir: Path, package_id: str, media_manifest: dict[str, Any]) -> Path:
    jobs_root = data_dir / "ai_jobs" / package_id
    jobs_root.mkdir(parents=True, exist_ok=True)
    write_text(jobs_root / "media_input.json", json.dumps(media_manifest, ensure_ascii=False, indent=2))
    prompt_src = PROMPTS_DIR / "03_media_placement.md"
    if prompt_src.exists():
        write_text(jobs_root / "prompt_media_placement.md", prompt_src.read_text(encoding="utf-8"))
    return jobs_root
