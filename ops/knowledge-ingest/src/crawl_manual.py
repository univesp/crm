"""Knowledge ingest pipeline — crawl manual do aluno."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

MANUAL_URL = "https://apps.univesp.br/manual-do-aluno/"
ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config"

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug or "secao"


def fix_mojibake(text: str) -> str:
    """Repara UTF-8 lido como Latin-1 (ex.: ComputaÃ§Ã£o → Computação)."""
    if not text or "Ã" not in text:
        return text
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def normalize_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
    return fix_mojibake(cleaned)


def text_content(element: Tag | None) -> str:
    if not element:
        return ""
    return normalize_text(element.get_text(separator=" ", strip=True))


def markdown_from_section(title: str, element: Tag) -> str:
    lines = [f"# {title}", ""]
    for child in element.find_all(["h3", "h4", "h5", "p", "li", "ul", "ol"], recursive=False):
        name = child.name or ""
        if name in {"h3", "h4", "h5"}:
            level = int(name[1])
            lines.extend(["", f"{'#' * level} {text_content(child)}", ""])
        elif name == "p":
            body = text_content(child)
            if body:
                lines.extend([body, ""])
        elif name in {"ul", "ol"}:
            for idx, li in enumerate(child.find_all("li", recursive=False), start=1):
                prefix = f"{idx}." if name == "ol" else "-"
                lines.append(f"{prefix} {text_content(li)}")
            lines.append("")
    if len(lines) <= 2:
        body = text_content(element)
        if body:
            lines.extend([body, ""])
    return "\n".join(lines).strip()


def fetch_manual_html(url: str = MANUAL_URL, timeout: int = 45) -> str:
    response = requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": "UNIVESP-Knowledge-Ingest/1.0 (+homolog-crm)"},
    )
    response.raise_for_status()
    for encoding in ("utf-8", "utf-8-sig"):
        try:
            return response.content.decode(encoding)
        except UnicodeDecodeError:
            continue
    apparent = response.apparent_encoding or "utf-8"
    return fix_mojibake(response.content.decode(apparent, errors="replace"))


def extract_sections(html: str, source_url: str = MANUAL_URL) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    main = soup.find("main") or soup.find("article") or soup.find("body")
    if not main:
        raise RuntimeError("Não foi possível localizar conteúdo principal do manual.")

    sections: list[dict[str, Any]] = []
    current_h2: Tag | None = None
    current_bucket: list[Tag] = []

    def flush_section() -> None:
        nonlocal current_h2, current_bucket
        if not current_h2:
            current_bucket = []
            return
        title = text_content(current_h2)
        if not title:
            current_bucket = []
            return
        wrapper = soup.new_tag("div")
        for node in current_bucket:
            wrapper.append(node.extract() if isinstance(node, Tag) else node)
        content_md = markdown_from_section(title, wrapper)
        if len(content_md) < 40:
            current_bucket = []
            return
        chunk_id = slugify(title)
        digest = hashlib.sha256(content_md.encode("utf-8")).hexdigest()[:16]
        sections.append(
            {
                "chunk_id": f"{chunk_id}-{digest[:8]}",
                "title": title,
                "source_url": source_url,
                "source_anchor": f"#{slugify(title)}",
                "breadcrumb": title,
                "content_md": content_md,
                "content_hash": digest,
                "word_count": len(content_md.split()),
            }
        )
        current_bucket = []

    for child in main.children:
        if not isinstance(child, Tag):
            continue
        if child.name == "h2":
            flush_section()
            current_h2 = child
            continue
        if current_h2 is not None:
            current_bucket.append(child)

    flush_section()

    if not sections:
        # fallback: split by h3 under page
        for heading in main.find_all("h2"):
            title = text_content(heading)
            if not title:
                continue
            sibling_content: list[str] = []
            for sibling in heading.next_siblings:
                if isinstance(sibling, Tag) and sibling.name == "h2":
                    break
                if isinstance(sibling, Tag):
                    sibling_content.append(text_content(sibling))
            body = "\n\n".join(part for part in sibling_content if part).strip()
            if len(body) < 40:
                continue
            content_md = f"# {title}\n\n{body}"
            digest = hashlib.sha256(content_md.encode("utf-8")).hexdigest()[:16]
            sections.append(
                {
                    "chunk_id": f"{slugify(title)}-{digest[:8]}",
                    "title": title,
                    "source_url": source_url,
                    "source_anchor": f"#{slugify(title)}",
                    "breadcrumb": title,
                    "content_md": content_md,
                    "content_hash": digest,
                    "word_count": len(content_md.split()),
                }
            )

    return sections


def load_theme_config() -> dict[str, Any]:
    return json.loads((CONFIG_DIR / "themes.json").read_text(encoding="utf-8"))


def assign_package(chunk: dict[str, Any], theme_config: dict[str, Any]) -> str:
    haystack = f"{chunk.get('title', '')} {chunk.get('content_md', '')}".lower()
    for package in theme_config.get("intent_packages", []):
        if package.get("id") == "outros":
            continue
        for keyword in package.get("keywords", []):
            if keyword.lower() in haystack:
                return package["id"]
    return "outros"


def build_packages(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    theme_config = load_theme_config()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for chunk in chunks:
        package_id = assign_package(chunk, theme_config)
        grouped.setdefault(package_id, []).append({**chunk, "package_id": package_id})

    packages: list[dict[str, Any]] = []
    for package in theme_config.get("intent_packages", []):
        package_id = package["id"]
        items = grouped.get(package_id, [])
        if package_id == "outros" and not items:
            continue
        packages.append(
            {
                "package_id": package_id,
                "title": package["title"],
                "description": package.get("description", ""),
                "chunk_count": len(items),
                "review_status": "pending",
                "items": [
                    {
                        **item,
                        "item_id": item["chunk_id"],
                        "review": {
                            "status": "pending",
                            "approved": False,
                            "notes": "",
                        },
                    }
                    for item in items
                ],
            }
        )
    return packages


def run_crawl(data_dir: Path, source_url: str = MANUAL_URL) -> dict[str, Any]:
    data_dir.mkdir(parents=True, exist_ok=True)
    html = fetch_manual_html(source_url)
    (data_dir / "raw" / "manual.html").parent.mkdir(parents=True, exist_ok=True)
    (data_dir / "raw" / "manual.html").write_text(html, encoding="utf-8")

    chunks = extract_sections(html, source_url)
    packages = build_packages(chunks)

    manifest = {
        "run_id": data_dir.name,
        "source_url": source_url,
        "crawled_at": now_iso(),
        "chunk_count": len(chunks),
        "package_count": len([p for p in packages if p["chunk_count"] > 0]),
        "steps": {
            "crawl": {"status": "completed", "at": now_iso()},
            "structure_review": {"status": "pending", "at": None},
            "ai_analysis": {"status": "pending", "at": None},
            "consolidate": {"status": "pending", "at": None},
            "studio_review": {"status": "pending", "at": None},
            "export_faq": {"status": "pending", "at": None},
        },
    }

    (data_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (data_dir / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")
    (data_dir / "packages.json").write_text(json.dumps(packages, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest
