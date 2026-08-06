from urllib.parse import urlparse

import frappe

INSTITUTIONAL_HOST_SUFFIX = ".univesp.br"


def is_institutional_host(hostname: str | None) -> bool:
	host = str(hostname or "").strip().lower().split(":")[0]
	return host == "univesp.br" or host.endswith(INSTITUTIONAL_HOST_SUFFIX)


def normalize_institutional_block_url(url: str) -> str:
	"""Converte /files/ relativos e hosts institucionais para HTTPS público."""
	value = str(url or "").strip()
	if not value:
		return value

	parsed = urlparse(value)
	if parsed.scheme in {"http", "https"}:
		if parsed.hostname in {"127.0.0.1", "localhost", "::1"} or is_institutional_host(parsed.hostname):
			return resolve_institutional_file_url(value)
		return value
	if value.startswith("/files/"):
		return resolve_institutional_file_url(value)
	return value


def normalize_payload_media_urls(payload: dict | None) -> None:
	if not isinstance(payload, dict):
		return
	for node in payload.get("nodes") or []:
		if not isinstance(node, dict):
			continue
		content = node.get("content") or {}
		for layer in ("student", "public"):
			layer_content = content.get(layer)
			if not isinstance(layer_content, dict):
				continue
			for block in layer_content.get("blocks") or []:
				if not isinstance(block, dict):
					continue
				url = str(block.get("url") or "").strip()
				if url:
					block["url"] = normalize_institutional_block_url(url)
				captions_url = str(block.get("captions_url") or "").strip()
				if captions_url:
					block["captions_url"] = normalize_institutional_block_url(captions_url)


def resolve_institutional_file_url(file_url: str) -> str:
	"""Normaliza file_url do Frappe para HTTPS público (evita 127.0.0.1 na FAQ)."""
	url = str(file_url or "").strip()
	if not url:
		return url

	parsed = urlparse(url)
	if parsed.scheme == "https" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
		return url

	domain = _public_site_domain()
	if not domain:
		return url

	path = parsed.path if parsed.scheme in {"http", "https"} else url
	if not path.startswith("/"):
		path = f"/{path}"
	return f"https://{domain}{path}"


def _public_site_domain() -> str:
	for key in ("public_reply_domain", "host_name"):
		value = str(frappe.conf.get(key) or "").strip()
		if not value:
			continue
		value = value.removeprefix("https://").removeprefix("http://").strip("/")
		if value and value not in {"127.0.0.1", "localhost"}:
			return value
	return ""
