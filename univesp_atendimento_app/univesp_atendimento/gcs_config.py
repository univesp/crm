"""Leitura documental das chaves GCS esperadas no site_config (A0b)."""

from __future__ import annotations

from typing import Any

EXPECTED_GCS_KEYS = (
	"file_storage",
	"s3_bucket",
	"s3_key",
	"s3_secret",
	"s3_endpoint_url",
)


def inspect_gcs_site_config() -> dict[str, Any]:
	"""Bench execute — univesp_atendimento.gcs_config.inspect_gcs_site_config"""
	import frappe

	conf = frappe.local.conf if hasattr(frappe.local, "conf") else frappe.conf
	present = {key: bool(str(conf.get(key) or "").strip()) for key in EXPECTED_GCS_KEYS}
	return {
		"ok": all(present.values()),
		"present": present,
		"expected": list(EXPECTED_GCS_KEYS),
		"doc": "docs/ops/gcs-frappe-site-config.example.md",
	}
