import hashlib
import json

import frappe
from frappe import _
from frappe.utils import get_datetime, now_datetime

from univesp_atendimento.api.v1.common import get_request_context, response


MAX_GOVERNANCE_BYTES = 512 * 1024
MAX_RECORDS = 500


class AreaGovernanceValidationError(frappe.ValidationError):
	http_status_code = 422


class AreaGovernanceConflictError(frappe.ValidationError):
	http_status_code = 409


@frappe.whitelist(methods=["GET"])
def get_area_state(area: str):
	context = get_request_context("view_area_guidance")
	normalized_area = _authorize_area(context, area, write=False)
	doc = _governance_doc(normalized_area)
	return response(_serialize(doc, normalized_area), request_id=context.request_id)


@frappe.whitelist(methods=["PATCH", "POST"])
def update_area_state(payload: dict | str | None = None):
	context = get_request_context("manage_area_scope")
	if context.profile_key not in {"gestor_area", "admin_central"}:
		raise frappe.PermissionError(_("Somente gestor da area ou Admin central pode alterar governanca."))
	data = _payload(payload)
	area = _authorize_area(context, data.get("area"), write=True)
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 5:
		raise AreaGovernanceValidationError(_("Informe um motivo com pelo menos 5 caracteres."))

	rules = data.get("rules")
	availability = data.get("availability")
	_validate_state(area, rules, availability)
	doc = _governance_doc(area)
	current_version = str(doc.modified or "")
	requested_version = str(data.get("version") or "").strip()
	if not doc.is_new() and (not requested_version or requested_version != current_version):
		raise AreaGovernanceConflictError(
			_("A governanca da area foi alterada por outra pessoa. Atualize a tela antes de salvar.")
		)

	before = {"rules": _json_list(doc.rules_json), "availability": _json_list(doc.availability_json)}
	doc.area_label = area
	doc.rules_json = json.dumps(rules, ensure_ascii=False, separators=(",", ":"))
	doc.availability_json = json.dumps(availability, ensure_ascii=False, separators=(",", ":"))
	doc.updated_by_email = context.email
	doc.updated_at = now_datetime()
	doc.save(ignore_permissions=True)
	_write_audit(context, reason, area, before, {"rules": rules, "availability": availability})
	return response(_serialize(doc, area), request_id=context.request_id)


def _authorize_area(context, area, write=False):
	normalized = str(area or "").strip()
	if not normalized:
		raise AreaGovernanceValidationError(_("Area obrigatoria."))
	if context.profile_key == "admin_central":
		if normalized not in _known_areas():
			raise AreaGovernanceValidationError(_("Area desconhecida ou sem perfil institucional ativo."))
		return normalized
	areas = [str(item).strip() for item in (context.scopes.get("areas") or []) if str(item).strip()]
	if normalized not in areas:
		raise frappe.PermissionError(_("Area fora do escopo institucional."))
	if write and context.profile_key != "gestor_area":
		raise frappe.PermissionError(_("Perfil sem permissao para alterar governanca da area."))
	return normalized


def _known_areas():
	rows = frappe.get_all(
		"Univesp Access Profile",
		filters={"active": 1},
		fields=["scopes_json"],
		page_length=500,
	)
	areas = set()
	for row in rows:
		scopes = frappe.parse_json(row.get("scopes_json") or "{}")
		if isinstance(scopes, dict):
			areas.update(str(item).strip() for item in (scopes.get("areas") or []) if str(item).strip())
	return areas


def _governance_doc(area):
	name = frappe.db.exists("Univesp Area Governance", {"area_label": area})
	return frappe.get_doc("Univesp Area Governance", name) if name else frappe.new_doc("Univesp Area Governance")


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value:
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise AreaGovernanceValidationError(_("Corpo JSON invalido.")) from exc
	return {}


def _validate_state(area, rules, availability):
	if not isinstance(rules, list) or not isinstance(availability, list):
		raise AreaGovernanceValidationError(_("Regras e disponibilidade devem ser listas."))
	if len(rules) > MAX_RECORDS or len(availability) > MAX_RECORDS:
		raise AreaGovernanceValidationError(_("Governanca excede 500 registros por colecao."))
	encoded = json.dumps({"rules": rules, "availability": availability}, ensure_ascii=False).encode("utf-8")
	if len(encoded) > MAX_GOVERNANCE_BYTES:
		raise AreaGovernanceValidationError(_("Governanca da area excede 512 KiB."))

	member_names = _known_area_member_names(area)
	rule_ids = []
	for rule in rules:
		if not isinstance(rule, dict):
			raise AreaGovernanceValidationError(_("Regra de assunto invalida."))
		rule_id = str(rule.get("id") or "").strip()
		if not rule_id or str(rule.get("areaLabel") or area).strip() != area:
			raise AreaGovernanceValidationError(_("Regra sem id ou fora da area."))
		mode = str(rule.get("accessMode") or "team").strip()
		if mode not in {"team", "restricted"}:
			raise AreaGovernanceValidationError(_("Modo de acesso invalido."))
		allowed = rule.get("allowedAnalysts") or []
		if not isinstance(allowed, list) or any(str(name).strip() not in member_names for name in allowed):
			raise AreaGovernanceValidationError(_("Regra referencia analista fora da area."))
		rule_ids.append(rule_id)
	if len(rule_ids) != len(set(rule_ids)):
		raise AreaGovernanceValidationError(_("Regra de assunto duplicada."))

	availability_ids = []
	for record in availability:
		if not isinstance(record, dict):
			raise AreaGovernanceValidationError(_("Janela de disponibilidade invalida."))
		record_id = str(record.get("id") or "").strip()
		user_name = str(record.get("userName") or "").strip()
		if not record_id or user_name not in member_names:
			raise AreaGovernanceValidationError(_("Disponibilidade sem id ou pessoa fora da area."))
		if str(record.get("areaLabel") or "").strip() not in {"", area}:
			raise AreaGovernanceValidationError(_("Disponibilidade fora da area."))
		status = str(record.get("statusCode") or "").strip()
		if status not in {"available", "reduced_capacity", "unavailable"}:
			raise AreaGovernanceValidationError(_("Estado de disponibilidade invalido."))
		try:
			if get_datetime(record.get("startsAt")) >= get_datetime(record.get("endsAt")):
				raise AreaGovernanceValidationError(_("Fim da disponibilidade deve ser posterior ao inicio."))
		except (TypeError, ValueError) as exc:
			raise AreaGovernanceValidationError(_("Janela de disponibilidade invalida.")) from exc
		availability_ids.append(record_id)
	if len(availability_ids) != len(set(availability_ids)):
		raise AreaGovernanceValidationError(_("Disponibilidade duplicada."))


def _known_area_member_names(area):
	rows = frappe.get_all(
		"Univesp Access Profile",
		filters={"active": 1, "profile_key": ["in", ["analista_area", "gestor_area"]]},
		fields=["display_name", "scopes_json"],
		page_length=500,
	)
	return {
		str(row.get("display_name") or "").strip()
		for row in rows
		if area in (frappe.parse_json(row.get("scopes_json") or "{}").get("areas") or [])
	}


def _json_list(value):
	parsed = frappe.parse_json(value or "[]")
	return parsed if isinstance(parsed, list) else []


def _serialize(doc, area):
	return {
		"area": area,
		"rules": _json_list(doc.rules_json),
		"availability": _json_list(doc.availability_json),
		"version": "" if doc.is_new() else str(doc.modified or ""),
		"updated_by": doc.updated_by_email or "",
		"updated_at": doc.updated_at,
	}


def _summary(value):
	encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
	return {
		"sha256": hashlib.sha256(encoded).hexdigest(),
		"bytes": len(encoded),
		"rules": len(value.get("rules") or []),
		"availability": len(value.get("availability") or []),
	}


def _write_audit(context, reason, area, before, after):
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": context.email,
			"target_email": context.email,
			"operation": "area_governance_updated",
			"reason": f"{area}: {reason}",
			"before_json": json.dumps(_summary(before), ensure_ascii=False),
			"after_json": json.dumps(_summary(after), ensure_ascii=False),
			"request_id": context.request_id,
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)