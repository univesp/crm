import json

import frappe
from frappe import _

from univesp_atendimento.api.v1.common import get_request_context, response
from univesp_atendimento.api.v1.knowledge import _build_published_faq_entries
from univesp_atendimento.routing_engine import (
	RoutingDecision,
	RoutingResolutionError,
	resolve_route,
)


class RoutingValidationError(frappe.ValidationError):
	http_status_code = 422


@frappe.whitelist(methods=["POST"])
def preview(payload: dict | str | None = None):
	context = get_request_context("view_routing_preview")
	data = _payload(payload)
	version = _version(data.get("bundle_version_id"))
	canonical = json.loads(version.payload_json)
	decision = _resolve_v3(
		canonical,
		data.get("node_id"),
		{
			"polo_key": data.get("polo_key"),
			"region_key": data.get("region_key"),
		},
	)
	return response(
		{**decision.as_dict(), "preview_only": True},
		request_id=context.request_id,
	)


def resolve_ticket_route(
	*,
	session_record: dict | None,
	knowledge: dict,
	student: dict,
	context=None,
	manual_routing_key: str = "",
) -> dict:
	if session_record:
		version = _version(session_record["bundle_version_id"])
		canonical = json.loads(version.payload_json)
		trusted = _trusted_student_context(student, context)
		decision = _resolve_v3(canonical, session_record["path"][-1], trusted)
		return decision.as_dict()

	if knowledge:
		v3_bundle = frappe.db.get_value(
			"Univesp Knowledge Bundle",
			{"bundle_key": str(knowledge.get("bundle_id") or "").strip()},
			["name", "published_version"],
			as_dict=True,
		)
		if v3_bundle:
			version = _version(knowledge.get("bundle_version_id"))
			if version.name != v3_bundle.published_version:
				raise RoutingValidationError(_("Versão não é a publicação vigente do fluxo."))
			canonical = json.loads(version.payload_json)
			node_id = str(knowledge.get("node_id") or "").strip()
			node = next(
				(
					item
					for item in canonical.get("nodes") or []
					if isinstance(item, dict) and str(item.get("node_id") or "").strip() == node_id
				),
				None,
			)
			if not node or "public" not in set(node.get("audiences") or []):
				raise RoutingValidationError(_("Nó não pertence à jornada pública vigente."))
			return _resolve_v3(
				canonical,
				node_id,
				_trusted_student_context(student, context),
			).as_dict()
		return _resolve_v2_knowledge(knowledge)

	return _resolve_manual(manual_routing_key, context).as_dict()


def validate_payload_routing(payload: dict, pattern) -> None:
	allowed = {
		str(key or "").strip()
		for key in frappe.parse_json(pattern.allowed_routing_keys_json or "[]")
		if str(key or "").strip()
	}
	keys = set()
	metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
	owner = metadata.get("operational_owner") if isinstance(metadata.get("operational_owner"), dict) else {}
	if owner.get("owner_type") == "queue" and str(owner.get("owner_key") or "").strip():
		keys.add(str(owner["owner_key"]).strip())
	policy = payload.get("routing_policy") if isinstance(payload.get("routing_policy"), dict) else {}
	if str(policy.get("default_routing_key") or "").strip():
		keys.add(str(policy["default_routing_key"]).strip())
	for node in payload.get("nodes") or []:
		operational = node.get("operational") if isinstance(node.get("operational"), dict) else {}
		for fieldname in ("routing_override", "routing_key"):
			if str(operational.get(fieldname) or "").strip():
				keys.add(str(operational[fieldname]).strip())

	invalid = sorted(key for key in keys if key not in allowed)
	if invalid:
		raise RoutingValidationError(
			_("Chaves de roteamento fora do padrão: {0}.").format(", ".join(invalid))
		)
	inactive = sorted(key for key in keys if not _queue_exists(key))
	if inactive:
		raise RoutingValidationError(
			_("Filas de roteamento inexistentes ou inativas: {0}.").format(", ".join(inactive))
		)
	if "atendimento-geral" not in allowed or not _queue_exists("atendimento-geral"):
		raise RoutingValidationError(_("Fallback institucional atendimento-geral indisponível."))


def _resolve_v3(canonical: dict, node_id, trusted_context: dict) -> RoutingDecision:
	policy = canonical.get("routing_policy") if isinstance(canonical.get("routing_policy"), dict) else {}
	pattern = _pattern(policy.get("pattern_key"))
	try:
		return resolve_route(
			pattern=pattern,
			bundle_payload=canonical,
			node_id=str(node_id or "").strip(),
			context=trusted_context,
			queue_exists=_queue_exists,
		)
	except RoutingResolutionError as exc:
		raise RoutingValidationError(str(exc)) from exc


def _resolve_v2_knowledge(knowledge: dict) -> dict:
	bundle_id = str(knowledge.get("bundle_id") or "").strip()
	node_id = str(knowledge.get("node_id") or knowledge.get("flow_id") or "").strip()
	if not bundle_id or not node_id:
		raise RoutingValidationError(_("Lineage da FAQ está incompleto."))
	for faq_type in ("aluno", "op", "publico"):
		entries, _doc = _build_published_faq_entries(faq_type)
		for entry in entries:
			if str(entry.get("bundle_id") or "").strip() != bundle_id:
				continue
			package = entry.get("package") if isinstance(entry.get("package"), dict) else {}
			node = next(
				(
					item
					for item in package.get("nodes") or []
					if isinstance(item, dict) and str(item.get("id") or "").strip() == node_id
				),
				None,
			)
			if not node:
				raise RoutingValidationError(_("Nó não pertence ao bundle publicado."))
			queue = str(node.get("fila_destino") or "").strip() or "atendimento-geral"
			if not _queue_exists(queue):
				raise RoutingValidationError(_("Fila publicada não existe ou está inativa."))
			return {
				"routing_key": queue,
				"resolved_queue": queue,
				"resolved_area": str(node.get("owner_area") or "").strip(),
				"pattern_key": "legacy_v2",
				"path_labels": ["Fila publicada"],
				"applied_rules": ["published_v2_node"],
			}
	raise RoutingValidationError(_("Bundle informado não está publicado."))


def _resolve_manual(routing_key, context) -> RoutingDecision:
	key = str(routing_key or "").strip() or "atendimento-geral"
	if key != "atendimento-geral":
		actions = set(getattr(context, "actions", ()) or ())
		if not actions.intersection({"assign_ticket", "manager_override_route"}):
			raise frappe.PermissionError(_("Seu perfil não pode escolher uma rota manual."))
	if key not in _catalog_routing_keys() or not _queue_exists(key):
		raise RoutingValidationError(_("Chave manual não pertence ao catálogo ativo."))
	return RoutingDecision(
		routing_key=key,
		resolved_queue=key,
		resolved_area="",
		pattern_key="manual",
		path_labels=("Rota manual autorizada",),
		applied_rules=("manual_catalog_authorized",),
	)


def _trusted_student_context(student: dict, context) -> dict:
	ra = str(
		(getattr(context, "ra", "") if getattr(context, "profile_key", "") == "aluno" else "")
		or student.get("ra")
		or ""
	).strip()
	if not ra:
		return {}
	row = frappe.db.get_value(
		"Univesp Student Directory",
		{"ra": ra},
		["polo_id"],
		as_dict=True,
	)
	return {"polo_key": str(row.polo_id or "").strip()} if row else {}


def _pattern(pattern_key) -> dict:
	key = str(pattern_key or "").strip()
	row = frappe.db.get_value(
		"Univesp Knowledge Routing Pattern",
		{"pattern_key": key, "active": 1},
		[
			"pattern_key",
			"steps_json",
			"allowed_routing_keys_json",
			"institutional_exceptions_json",
		],
		as_dict=True,
	)
	if not row:
		raise RoutingValidationError(_("Padrão de roteamento não está ativo."))
	return {
		"pattern_key": row.pattern_key,
		"steps": frappe.parse_json(row.steps_json or "[]"),
		"allowed_routing_keys": frappe.parse_json(row.allowed_routing_keys_json or "[]"),
		"institutional_exceptions": frappe.parse_json(row.institutional_exceptions_json or "[]"),
	}


def _version(version_id):
	key = str(version_id or "").strip()
	if not key:
		raise RoutingValidationError(_("Versão da FAQ é obrigatória."))
	name = frappe.db.get_value("Univesp Knowledge Version", {"version_id": key}, "name") or key
	version = frappe.get_doc("Univesp Knowledge Version", name)
	if version.lifecycle_state not in {"approved", "published", "superseded"}:
		raise RoutingValidationError(_("Versão não está apta para roteamento."))
	return version


def _catalog_routing_keys() -> set[str]:
	keys = set()
	for row in frappe.get_all(
		"Univesp Knowledge Routing Pattern",
		filters={"active": 1},
		fields=["allowed_routing_keys_json"],
	):
		keys.update(frappe.parse_json(row.allowed_routing_keys_json or "[]"))
	return {str(key or "").strip() for key in keys if str(key or "").strip()}


def _queue_exists(queue_key: str) -> bool:
	return bool(
		frappe.db.get_value(
			"HD Team",
			{"name": str(queue_key or "").strip(), "enabled": 1},
			"name",
		)
	)


def _payload(payload):
	if isinstance(payload, str):
		try:
			payload = json.loads(payload)
		except json.JSONDecodeError as exc:
			raise RoutingValidationError(_("Payload JSON inválido.")) from exc
	if payload is None:
		return {}
	if not isinstance(payload, dict):
		raise RoutingValidationError(_("Payload deve ser objeto JSON."))
	return payload
