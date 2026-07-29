from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict


class KnowledgeMigrationError(ValueError):
	def __init__(self, code, message):
		super().__init__(message)
		self.code = code


def extract_v2_packages(library):
	packages = []
	for entry in (library or {}).get("bundles") or []:
		if not isinstance(entry, dict):
			continue
		workspace = entry.get("workspace") if isinstance(entry.get("workspace"), dict) else {}
		package = workspace.get("draftBundle") or workspace.get("publishedBundle")
		if not isinstance(package, dict):
			continue
		packages.append(
			{
				"legacy_bundle_id": str(entry.get("bundleId") or package.get("faq_id") or "").strip(),
				"title": str(entry.get("title") or (package.get("metadata") or {}).get("title") or "").strip(),
				"package": package,
			}
		)
	return packages


def plan_v2_migration(packages, mappings=None, *, default_routing_pattern="op_then_area"):
	mapping_by_id = {
		str(item.get("legacy_bundle_id") or "").strip(): item
		for item in mappings or []
		if isinstance(item, dict) and str(item.get("legacy_bundle_id") or "").strip()
	}
	grouped = defaultdict(list)
	for entry in packages or []:
		package = entry.get("package") if isinstance(entry, dict) else None
		if not isinstance(package, dict):
			continue
		legacy_id = str(entry.get("legacy_bundle_id") or package.get("faq_id") or "").strip()
		if not legacy_id:
			raise KnowledgeMigrationError("LEGACY_ID_REQUIRED", "Bundle v2 sem identificador.")
		mapping = mapping_by_id.get(legacy_id, {})
		theme_key = _key(
			mapping.get("theme_key")
			or (package.get("metadata") or {}).get("theme_key")
			or _theme_from_package(package)
			or legacy_id
		)
		bundle_key = _key(mapping.get("bundle_key") or theme_key)
		grouped[bundle_key].append({**entry, "mapping": mapping, "theme_key": theme_key})

	plans = []
	for bundle_key, sources in grouped.items():
		plans.append(_merge_group(bundle_key, sources, default_routing_pattern))
	return plans


def migration_checksum(source_ids, payload):
	canonical = json.dumps(
		{"sources": sorted(source_ids), "payload": payload},
		ensure_ascii=False,
		sort_keys=True,
		separators=(",", ":"),
	)
	return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _merge_group(bundle_key, sources, routing_pattern):
	first = sources[0]
	theme_key = first["theme_key"]
	title = (
		str(first.get("mapping", {}).get("title") or first.get("title") or "").strip()
		or bundle_key.replace("-", " ").title()
	)
	nodes_by_key = {}
	edges_by_key = {}
	roots = {"student": None, "public": None, "internal": None}
	report = {"conflicts": [], "orphans": [], "merged": [], "source_bundle_ids": []}
	owner_key = ""
	default_criticality = ""
	default_sla = ""

	for source in sources:
		package = source["package"]
		mapping = source.get("mapping") or {}
		legacy_id = source["legacy_bundle_id"]
		report["source_bundle_ids"].append(legacy_id)
		audience = _audience(mapping.get("audience") or package.get("tipo_faq"))
		node_map = mapping.get("node_map") if isinstance(mapping.get("node_map"), dict) else {}
		legacy_to_stable = {}
		children = set()

		metadata = package.get("metadata") if isinstance(package.get("metadata"), dict) else {}
		owner_key = owner_key or str(
			metadata.get("defaultOwnerId")
			or metadata.get("default_owner_id")
			or (package.get("operational_owner") or {}).get("queueKey")
			or ""
		).strip()
		default_criticality = default_criticality or str(
			metadata.get("default_criticidade") or metadata.get("criticidade_default_key") or ""
		).strip()
		default_sla = default_sla or str(
			metadata.get("default_sla") or metadata.get("sla_policy_key") or ""
		).strip()

		for legacy_node in package.get("nodes") or []:
			if not isinstance(legacy_node, dict):
				continue
			legacy_node_id = str(legacy_node.get("id") or legacy_node.get("node_id") or "").strip()
			if not legacy_node_id:
				report["conflicts"].append(
					{"code": "NODE_ID_REQUIRED", "legacy_bundle_id": legacy_id, "blocking": True}
				)
				continue
			suggested_key = _key(
				node_map.get(legacy_node_id)
				or legacy_node.get("stable_key")
				or legacy_node_id
			)
			matched_key = _match_existing_node(
				nodes_by_key,
				suggested_key,
				legacy_node,
				allow_title_match=bool(mapping.get("match_by_title", True)),
			)
			stable_key = matched_key or suggested_key
			legacy_to_stable[legacy_node_id] = stable_key
			if (
				audience == "internal"
				and stable_key not in nodes_by_key
				and not node_map.get(legacy_node_id)
				and not mapping.get("allow_unmatched_operation")
			):
				report["conflicts"].append(
					{
						"code": "UNMATCHED_OPERATIONAL_NODE",
						"legacy_bundle_id": legacy_id,
						"legacy_node_id": legacy_node_id,
						"suggested_stable_key": stable_key,
						"blocking": True,
					}
				)
			node = nodes_by_key.setdefault(stable_key, _empty_node(stable_key, legacy_node))
			_add_layer(node, legacy_node, audience)
			report["merged"].append(
				{
					"legacy_bundle_id": legacy_id,
					"legacy_node_id": legacy_node_id,
					"stable_key": stable_key,
					"audience": audience,
				}
			)

		for index, legacy_edge in enumerate(package.get("links") or []):
			if not isinstance(legacy_edge, dict) or legacy_edge.get("ativo") is False:
				continue
			parent_key = legacy_to_stable.get(str(legacy_edge.get("parent_node_id") or "").strip())
			child_key = legacy_to_stable.get(str(legacy_edge.get("child_node_id") or "").strip())
			if not parent_key or not child_key:
				report["orphans"].append(
					{
						"code": "EDGE_NODE_MISSING",
						"legacy_bundle_id": legacy_id,
						"edge_id": legacy_edge.get("link_id") or index,
						"blocking": True,
					}
				)
				continue
			children.add(child_key)
			edge_key = (parent_key, child_key)
			edge = edges_by_key.setdefault(
				edge_key,
				{
					"edge_id": _key(legacy_edge.get("link_id") or f"{parent_key}-{child_key}"),
					"parent_node_id": parent_key,
					"child_node_id": child_key,
					"order": int(legacy_edge.get("ordem") or legacy_edge.get("order") or index + 1),
					"active": True,
					"audiences": [],
				},
			)
			if audience not in edge["audiences"]:
				edge["audiences"].append(audience)

		root_candidates = [
			stable_key
			for legacy_id_value, stable_key in legacy_to_stable.items()
			if stable_key not in children and legacy_id_value
		]
		if len(set(root_candidates)) != 1:
			report["orphans"].append(
				{
					"code": "ROOT_AMBIGUOUS",
					"legacy_bundle_id": legacy_id,
					"audience": audience,
					"candidates": sorted(set(root_candidates)),
					"blocking": True,
				}
			)
		elif roots[audience] and roots[audience] != root_candidates[0]:
			report["conflicts"].append(
				{
					"code": "MULTIPLE_AUDIENCE_ROOTS",
					"audience": audience,
					"current": roots[audience],
					"incoming": root_candidates[0],
					"blocking": True,
				}
			)
		else:
			roots[audience] = root_candidates[0]

	audiences = {audience for node in nodes_by_key.values() for audience in node["audiences"]}
	profile = (
		"mixed"
		if {"student", "public"}.issubset(audiences)
		else "public"
		if "public" in audiences
		else "student"
		if "student" in audiences
		else "internal"
	)
	payload = {
		"schema_version": "3.0.0",
		"bundle_key": bundle_key,
		"theme_key": theme_key,
		"metadata": {
			"title": title,
			"audience_profile": profile,
			"operational_owner": {
				"owner_type": "queue",
				"owner_key": owner_key or "atendimento-geral",
			},
			"criticidade_default_key": default_criticality or "media",
			"sla_policy_key": default_sla or "48h",
		},
		"routing_policy": {
			"pattern_key": routing_pattern,
			"bpo_enabled": False,
			"institutional_exceptions": [],
		},
		"graph": {
			"student_root_node_id": roots["student"],
			"public_root_node_id": roots["public"],
			"internal_root_node_id": roots["internal"],
		},
		"nodes": list(nodes_by_key.values()),
		"edges": list(edges_by_key.values()),
		"calendar_highlights": [],
	}
	checksum = migration_checksum(report["source_bundle_ids"], payload)
	return {
		"bundle_key": bundle_key,
		"theme_key": theme_key,
		"title": title,
		"audience_profile": profile,
		"legacy_bundle_ids": report["source_bundle_ids"],
		"migration_idempotency_key": f"v2:{bundle_key}:{checksum}",
		"payload": payload,
		"report": report,
		"blocking": any(
			item.get("blocking")
			for collection in ("conflicts", "orphans")
			for item in report[collection]
		),
	}


def _empty_node(stable_key, legacy):
	kind = "final" if str(legacy.get("node_kind") or "").lower() in {"leaf", "final"} else "path"
	return {
		"node_id": stable_key,
		"stable_key": stable_key,
		"node_kind": kind,
		"audiences": [],
		"display": {
			"title": str(
				legacy.get("titulo_exibido")
				or legacy.get("pergunta_exibida")
				or legacy.get("title")
				or stable_key
			).strip()
		},
		"content": {"student": None, "public": None},
		"playbooks": {"op": None, "bpo": None, "analyst": None},
		"operational": {
			"routing_override": str(legacy.get("fila_destino") or "").strip() or None,
			"criticidade": str(legacy.get("criticidade") or "").strip() or None,
			"sla_policy_key": str(legacy.get("sla_policy_key") or legacy.get("sla") or "").strip()
			or None,
		},
		"document_policy": {"mode": "disabled"} if kind == "final" else None,
		"media_refs": _legacy_media(legacy, stable_key),
	}


def _add_layer(node, legacy, audience):
	if audience not in node["audiences"]:
		node["audiences"].append(audience)
	body = str(legacy.get("resposta") or legacy.get("orientacao") or "").strip()
	if audience in {"student", "public"}:
		node["content"][audience] = {
			"blocks": (
				[
					{
						"block_id": f"{node['stable_key']}-{audience}-text",
						"type": "text",
						"body": body,
					}
				]
				if body
				else []
			),
			"outcome_key": str(legacy.get("acao") or "").strip(),
		}
		return
	node["playbooks"]["op"] = {
		"objective": str(
			legacy.get("objetivo")
			or legacy.get("descricao_interna")
			or legacy.get("titulo_exibido")
			or ""
		).strip(),
		"checklist": _structured(
			legacy.get("checklist_op") or [],
			"checklist_item_id",
			"text",
			f"{node['stable_key']}-op-check",
		),
		"systems": _structured(
			legacy.get("sistemas_a_consultar") or [],
			"system_ref_id",
			"system_key",
			f"{node['stable_key']}-op-system",
		),
		"documents_to_request": _structured(
			legacy.get("documentos_solicitar") or [],
			"document_ref_id",
			"document_type_key",
			f"{node['stable_key']}-op-document",
		),
		"suggested_reply": str(legacy.get("resposta_sugerida") or body).strip(),
		"allowed_actions": _structured(
			legacy.get("acoes_permitidas") or [],
			"action_id",
			"action_key",
			f"{node['stable_key']}-op-action",
		),
		"escalation_criteria": str(legacy.get("criterio_escalonamento") or "").strip(),
		"escalation_reason_template": str(legacy.get("motivo_escalonamento") or "").strip(),
		"possible_outcomes": _structured(
			legacy.get("resultados_possiveis") or [],
			"outcome_id",
			"outcome_key",
			f"{node['stable_key']}-op-outcome",
		),
	}
	node["playbooks"]["bpo"] = None


def _structured(values, id_field, value_field, prefix):
	if isinstance(values, str):
		values = [item.strip() for item in values.splitlines() if item.strip()]
	result = []
	for index, item in enumerate(values if isinstance(values, list) else []):
		if isinstance(item, dict):
			label = str(item.get(value_field) or item.get("label") or item.get("text") or "").strip()
			entry = dict(item)
		else:
			label = str(item or "").strip()
			entry = {}
		if not label:
			continue
		entry[id_field] = str(entry.get(id_field) or f"{prefix}-{index + 1}")
		entry[value_field] = label
		entry["label"] = label
		result.append(entry)
	return result


def _legacy_media(legacy, stable_key):
	result = []
	for index, item in enumerate(legacy.get("media") or []):
		if not isinstance(item, dict):
			continue
		url = str(item.get("url") or item.get("source_url") or "").strip()
		if not url:
			continue
		result.append(
			{
				"asset_id": f"{stable_key}-media-{index + 1}",
				"type": str(item.get("type") or item.get("media_type") or "image").strip(),
				"url": url,
			}
		)
	return result


def _match_existing_node(nodes_by_key, suggested_key, legacy, *, allow_title_match):
	if suggested_key in nodes_by_key:
		return suggested_key
	if not allow_title_match:
		return ""
	title_key = _key(
		legacy.get("titulo_exibido") or legacy.get("pergunta_exibida") or legacy.get("title") or ""
	)
	matches = [
		key
		for key, node in nodes_by_key.items()
		if _key((node.get("display") or {}).get("title")) == title_key
	]
	return matches[0] if len(matches) == 1 else ""


def _theme_from_package(package):
	nodes = [node for node in package.get("nodes") or [] if isinstance(node, dict)]
	return next((node.get("tema") for node in nodes if node.get("tema")), None) or (
		package.get("metadata") or {}
	).get("title")


def _audience(value):
	normalized = str(value or "aluno").strip().lower()
	return {"aluno": "student", "student": "student", "publico": "public", "public": "public"}.get(
		normalized,
		"internal",
	)


def _key(value):
	normalized = unicodedata.normalize("NFD", str(value or "").strip())
	ascii_value = "".join(character for character in normalized if unicodedata.category(character) != "Mn")
	return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()))[:140]
