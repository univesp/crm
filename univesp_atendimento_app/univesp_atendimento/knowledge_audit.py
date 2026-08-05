"""Read-only audits for FAQ governance readiness.

The audit reports legacy area fallbacks without changing content. It is meant
to run before real data is enabled, so the result contains no student or user
personal data.
"""

from __future__ import annotations

import json


def audit_payload_area_keys(payload: dict, *, bundle_key: str = "") -> list[dict]:
	"""Return findings for final nodes that lack an explicit area key.

	A metadata-level ``operational_owner`` with ``owner_type=area`` remains a
	backward-compatible effective area, but it is reported as a warning because
	new governance requires the area on each final answer.
	"""
	if not isinstance(payload, dict):
		return [
			{
				"severity": "blocking",
				"code": "invalid_payload",
				"bundle_key": bundle_key,
				"node_id": "",
				"message": "Payload da versão publicada não é um objeto JSON válido.",
			}
		]

	metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
	owner = metadata.get("operational_owner") if isinstance(metadata.get("operational_owner"), dict) else {}
	owner_area = ""
	if str(owner.get("owner_type") or "").strip() == "area":
		owner_area = str(owner.get("owner_key") or "").strip()

	findings = []
	for node in payload.get("nodes") or []:
		if not isinstance(node, dict) or str(node.get("node_kind") or "").strip() != "final":
			continue
		node_id = str(node.get("node_id") or node.get("stable_key") or "").strip()
		operational = node.get("operational") if isinstance(node.get("operational"), dict) else {}
		explicit_area = str(operational.get("area_key") or "").strip()
		if explicit_area:
			continue
		if owner_area:
			findings.append(
				{
					"severity": "warning",
					"code": "missing_explicit_area_key",
					"bundle_key": bundle_key,
					"node_id": node_id,
					"effective_area": owner_area,
					"message": "Nó usa a área do responsável operacional legado; preencher operational.area_key.",
				}
			)
			continue
		findings.append(
			{
				"severity": "blocking",
				"code": "missing_effective_area",
				"bundle_key": bundle_key,
				"node_id": node_id,
				"effective_area": "",
				"message": "Resposta final sem área responsável efetiva para roteamento.",
			}
		)
	return findings


def audit_published_bundle_area_keys() -> dict:
	"""Audit all published bundle payloads using the current Frappe site.

	This function is intentionally read-only and can be run with ``bench
	execute``. It does not repair bundles or publish anything.
	"""
	import frappe

	rows = frappe.get_all(
		"Univesp Knowledge Bundle",
		filters={"published_version": ["is", "set"]},
		fields=["name", "bundle_key", "published_version"],
		order_by="modified desc",
		page_length=0,
	)
	findings = []
	final_nodes_scanned = 0
	for row in rows:
		version_name = row.get("published_version")
		raw_payload = frappe.db.get_value("Univesp Knowledge Version", version_name, "payload_json")
		try:
			payload = json.loads(raw_payload or "{}")
		except (TypeError, json.JSONDecodeError):
			payload = None
		if isinstance(payload, dict):
			final_nodes_scanned += sum(
				1
				for node in payload.get("nodes") or []
				if isinstance(node, dict) and str(node.get("node_kind") or "").strip() == "final"
			)
		findings.extend(
			audit_payload_area_keys(
				payload,
				bundle_key=str(row.get("bundle_key") or row.get("name") or "").strip(),
			)
		)

	return {
		"bundles_scanned": len(rows),
		"bundles_with_issues": len({item["bundle_key"] for item in findings}),
		"final_nodes_scanned": final_nodes_scanned,
		"missing_area_key": sum(item["code"] == "missing_explicit_area_key" for item in findings),
		"blocking_nodes": sum(item["severity"] == "blocking" for item in findings),
		"findings": findings,
	}
