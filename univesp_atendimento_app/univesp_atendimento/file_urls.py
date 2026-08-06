from urllib.parse import urlparse

import frappe


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
