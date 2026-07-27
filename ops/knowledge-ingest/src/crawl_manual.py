"""Knowledge ingest pipeline — crawl manual do aluno."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

MANUAL_URL = "https://apps.univesp.br/manual-do-aluno/"
MANUAL_HOST = "apps.univesp.br"
MAX_LINKED_PAGES = 12
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
        linked_documents = extract_links_from_element(wrapper, source_url, title)
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
                "linked_documents": linked_documents,
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


def classify_link(url: str) -> str:
    lower = url.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if any(token in lower for token in (".doc", ".docx", ".xls", ".xlsx", "drive.google", "docs.google")):
        return "document"
    if MANUAL_HOST in lower:
        return "manual_page"
    return "external"


def extract_links_from_element(element: Tag, source_url: str, section_title: str = "") -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    seen: set[str] = set()
    for anchor in element.find_all("a", href=True):
        href = urljoin(source_url, anchor["href"].strip())
        if href.startswith("#") or href in seen:
            continue
        label = text_content(anchor)
        if len(label) < 2:
            continue
        seen.add(href)
        documents.append(
            {
                "doc_id": slugify(f"{label}-{href}")[:48],
                "label": label,
                "url": href,
                "type": classify_link(href),
                "section_title": section_title,
                "source_url": source_url,
            }
        )
    return documents


def extract_documents(html: str, source_url: str, section_title: str = "") -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    main = soup.find("main") or soup.find("article") or soup.find("body")
    if not main:
        return []
    return extract_links_from_element(main, source_url, section_title)


def discover_manual_links(html: str, source_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    links: list[str] = []
    seen: set[str] = {source_url.rstrip("/")}
    for anchor in soup.find_all("a", href=True):
        href = urljoin(source_url, anchor["href"].strip())
        parsed = urlparse(href)
        if parsed.netloc != MANUAL_HOST:
            continue
        if "/manual-do-aluno" not in parsed.path and parsed.path not in ("", "/"):
            continue
        normalized = href.split("#")[0].rstrip("/")
        if normalized in seen:
            continue
        seen.add(normalized)
        links.append(href.split("#")[0])
    return links[:MAX_LINKED_PAGES]


def crawl_manual_site(source_url: str = MANUAL_URL) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    visited: set[str] = set()
    queue = [source_url.rstrip("/")]
    all_chunks: list[dict[str, Any]] = []
    all_documents: list[dict[str, Any]] = []
    pages_crawled: list[str] = []

    while queue and len(pages_crawled) < MAX_LINKED_PAGES + 1:
        url = queue.pop(0).rstrip("/")
        if url in visited:
            continue
        visited.add(url)
        html = fetch_manual_html(url if url.endswith("/") else f"{url}/")
        pages_crawled.append(url)
        page_docs = extract_documents(html, url)
        all_documents.extend(page_docs)
        for link in discover_manual_links(html, url):
            if link.rstrip("/") not in visited and link.rstrip("/") not in queue:
                queue.append(link.rstrip("/"))
        sections = extract_sections(html, url)
        for section in sections:
            all_documents.extend(section.get("linked_documents") or [])
        all_chunks.extend(sections)

    dedup_docs: dict[str, dict[str, Any]] = {}
    for doc in all_documents:
        dedup_docs[doc["url"]] = doc
    return all_chunks, list(dedup_docs.values()), pages_crawled


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


def build_packages(chunks: list[dict[str, Any]], documents: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    theme_config = load_theme_config()
    grouped: dict[str, list[dict[str, Any]]] = {}
    docs_by_package: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for chunk in chunks:
        package_id = assign_package(chunk, theme_config)
        grouped.setdefault(package_id, []).append({**chunk, "package_id": package_id})
        for doc in chunk.get("linked_documents") or []:
            docs_by_package[package_id].append(doc)

    if documents:
        for doc in documents:
            package_id = assign_package({"title": doc.get("label", ""), "content_md": doc.get("url", "")}, theme_config)
            docs_by_package[package_id].append(doc)

    packages: list[dict[str, Any]] = []
    for package in theme_config.get("intent_packages", []):
        package_id = package["id"]
        source_items = grouped.get(package_id, [])
        if package_id == "outros" and not source_items:
            continue
        pkg_docs: dict[str, dict[str, Any]] = {}
        for doc in docs_by_package.get(package_id, []):
            pkg_docs[doc["url"]] = doc
        packages.append(
            {
                "package_id": package_id,
                "title": package["title"],
                "description": package.get("description", ""),
                "chunk_count": len(source_items),
                "document_count": len(pkg_docs),
                "review_status": "pending",
                "documents": list(pkg_docs.values()),
                "source_items": [
                    {
                        **item,
                        "item_id": item["chunk_id"],
                        "role": "source_reference",
                    }
                    for item in source_items
                ],
            }
        )
    return packages


def run_crawl(data_dir: Path, source_url: str = MANUAL_URL) -> dict[str, Any]:
    from build_faq_candidates import run_build_candidates

    data_dir.mkdir(parents=True, exist_ok=True)
    chunks, documents, pages = crawl_manual_site(source_url)
    (data_dir / "raw" / "manual.html").parent.mkdir(parents=True, exist_ok=True)
    if pages:
        first_html = fetch_manual_html(pages[0] if pages[0].endswith("/") else f"{pages[0]}/")
        (data_dir / "raw" / "manual.html").write_text(first_html, encoding="utf-8")

    packages = build_packages(chunks, documents)
    (data_dir / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")
    (data_dir / "documents.json").write_text(json.dumps(documents, ensure_ascii=False, indent=2), encoding="utf-8")
    (data_dir / "packages.json").write_text(json.dumps(packages, ensure_ascii=False, indent=2), encoding="utf-8")

    candidate_stats = run_build_candidates(data_dir)

    manifest = {
        "run_id": data_dir.name,
        "source_url": source_url,
        "crawled_at": now_iso(),
        "pages_crawled": pages,
        "chunk_count": len(chunks),
        "document_count": len(documents),
        "package_count": len([p for p in packages if p.get("chunk_count", 0) > 0]),
        "faq_candidate_count": candidate_stats.get("faq_candidate_count", 0),
        "steps": {
            "crawl": {"status": "completed", "at": now_iso(), "pages": len(pages)},
            "faq_candidates": {"status": "completed", "at": now_iso()},
            "structure_review": {"status": "pending", "at": None},
            "ai_analysis": {"status": "pending", "at": None},
            "consolidate": {"status": "pending", "at": None},
            "studio_review": {"status": "pending", "at": None},
            "export_faq": {"status": "pending", "at": None},
        },
    }

    (data_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest
