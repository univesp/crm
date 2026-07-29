"""Leitura documental das chaves GCS esperadas no site_config (A0b)."""

from __future__ import annotations

import os
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
	mounted_bucket = str(os.getenv("GCS_BUCKET") or "").strip()
	mounted = str(os.getenv("GCS_MOUNTED_STORAGE") or "").strip().lower() in {"1", "true", "yes"} and bool(
		mounted_bucket
	)
	return {
		"ok": mounted or all(present.values()),
		"mode": "mounted_gcs" if mounted else "s3_compat",
		"bucket_configured": bool(mounted_bucket or conf.get("s3_bucket")),
		"present": present,
		"expected": list(EXPECTED_GCS_KEYS),
		"doc": "docs/ops/gcs-frappe-site-config.example.md",
	}
