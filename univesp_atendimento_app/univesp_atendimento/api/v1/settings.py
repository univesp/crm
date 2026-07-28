import json

import frappe
from frappe import _
from frappe.utils import now_datetime

from univesp_atendimento.api.v1.common import get_request_context, response


MAX_SETTINGS_BYTES = 262_144
REQUIRED_COLLECTIONS = ("criticalityLevels", "slaLevels", "applicationRules")


class RuntimeSettingsValidationError(frappe.ValidationError):
	http_status_code = 422


class RuntimeSettingsConflictError(frappe.ValidationError):
	http_status_code = 409


@frappe.whitelist(methods=["GET"])
def get_settings():
	context = _settings_context()
	doc = frappe.get_single("Univesp Runtime Settings")
	return response(_serialize(doc), request_id=context.request_id)


@frappe.whitelist(methods=["PATCH", "POST"])
def update_settings(payload: dict | str | None = None):
	context = _settings_context()
	data = _payload(payload)
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 5:
		raise RuntimeSettingsValidationError(_("Informe um motivo com pelo menos 5 caracteres."))
	parameters = data.get("parameters")
	_validate_parameters(parameters)
	knowledge = data.get("knowledge") if isinstance(data.get("knowledge"), dict) else {}
	_validate_knowledge_settings(knowledge)

	doc = frappe.get_single("Univesp Runtime Settings")
	current_version = str(doc.modified or "")
	requested_version = str(data.get("version") or "").strip()
	if doc.parameters_json and (not requested_version or requested_version != current_version):
		raise RuntimeSettingsConflictError(
			_("Os parametros foram alterados por outra pessoa. Atualize a tela antes de salvar.")
		)

	before = {"parameters": _parameters(doc), "knowledge": _knowledge_settings(doc)}
	doc.parameters_json = json.dumps(parameters, ensure_ascii=False, separators=(",", ":"))
	if knowledge:
		doc.institutional_timezone = knowledge.get("institutional_timezone") or doc.institutional_timezone
		doc.knowledge_session_ttl_seconds = (
			knowledge.get("knowledge_session_ttl_seconds") or doc.knowledge_session_ttl_seconds
		)
		doc.default_suggestion_sla_hours = (
			knowledge.get("default_suggestion_sla_hours") or doc.default_suggestion_sla_hours
		)
		for fieldname in ("knowledge_v3_read", "knowledge_v3_write", "routing_server_authority"):
			if fieldname in knowledge:
				doc.set(fieldname, int(bool(knowledge[fieldname])))
	doc.updated_by_email = context.email
	doc.updated_at = now_datetime()
	doc.save(ignore_permissions=True)
	_write_audit(
		context,
		reason,
		before,
		{"parameters": parameters, "knowledge": _knowledge_settings(doc)},
	)
	return response(_serialize(doc), request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def health():
	context = get_request_context()
	states = {"frappe": "saudavel", "database": "indisponivel", "redis": "indisponivel"}
	try:
		frappe.db.sql("select 1")
		states["database"] = "saudavel"
	except Exception:
		pass
	try:
		frappe.cache.ping()
		states["redis"] = "saudavel"
	except Exception:
		pass
	return response(states, request_id=context.request_id)


def _settings_context():
	context = get_request_context("edit_parameters")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode alterar parametros."))
	return context


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value:
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise RuntimeSettingsValidationError(_("Corpo JSON invalido.")) from exc
	return {}


def _validate_parameters(parameters):
	if not isinstance(parameters, dict):
		raise RuntimeSettingsValidationError(_("Parametros devem ser um objeto JSON."))
	encoded = json.dumps(parameters, ensure_ascii=False).encode("utf-8")
	if len(encoded) > MAX_SETTINGS_BYTES:
		raise RuntimeSettingsValidationError(_("Parametros excedem o limite de 256 KiB."))
	limits = {"criticalityLevels": 50, "slaLevels": 50, "applicationRules": 500}
	identity_fields = {"criticalityLevels": "key", "slaLevels": "key", "applicationRules": "id"}
	for collection in REQUIRED_COLLECTIONS:
		items = parameters.get(collection)
		if not isinstance(items, list):
			raise RuntimeSettingsValidationError(
				_("Colecao obrigatoria ausente ou invalida: {0}.").format(collection)
			)
		if len(items) > limits[collection]:
			raise RuntimeSettingsValidationError(_("Colecao excede o limite: {0}.").format(collection))
		identity_field = identity_fields[collection]
		identities = []
		for item in items:
			if not isinstance(item, dict) or not str(item.get(identity_field) or "").strip():
				raise RuntimeSettingsValidationError(
					_("Item invalido em {0}; campo {1} obrigatorio.").format(collection, identity_field)
				)
			identities.append(str(item[identity_field]).strip())
		if len(identities) != len(set(identities)):
			raise RuntimeSettingsValidationError(_("Identificadores duplicados em {0}.").format(collection))


def _validate_knowledge_settings(knowledge):
	if not knowledge:
		return
	if int(knowledge.get("knowledge_session_ttl_seconds") or 300) < 300:
		raise RuntimeSettingsValidationError(_("Sessão FAQ deve durar ao menos 300 segundos."))
	if int(knowledge.get("default_suggestion_sla_hours") or 1) < 1:
		raise RuntimeSettingsValidationError(_("SLA de sugestões deve ser maior que zero."))
	timezone = str(knowledge.get("institutional_timezone") or "America/Sao_Paulo").strip()
	if timezone != "America/Sao_Paulo":
		raise RuntimeSettingsValidationError(_("Fuso institucional suportado: America/Sao_Paulo."))


def _parameters(doc):
	if not doc.parameters_json:
		return {}
	value = frappe.parse_json(doc.parameters_json)
	return value if isinstance(value, dict) else {}


def _serialize(doc):
	return {
		"parameters": _parameters(doc),
		"knowledge": _knowledge_settings(doc),
		"version": str(doc.modified or ""),
		"updated_by": doc.updated_by_email or "",
		"updated_at": doc.updated_at,
	}


def _knowledge_settings(doc):
	return {
		"institutional_timezone": doc.institutional_timezone or "America/Sao_Paulo",
		"knowledge_session_ttl_seconds": int(doc.knowledge_session_ttl_seconds or 7200),
		"default_suggestion_sla_hours": int(doc.default_suggestion_sla_hours or 72),
		"knowledge_v3_read": bool(doc.knowledge_v3_read),
		"knowledge_v3_write": bool(doc.knowledge_v3_write),
		"routing_server_authority": bool(doc.routing_server_authority),
	}


def _write_audit(context, reason, before, after):
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": context.email,
			"target_email": context.email,
			"operation": "runtime_settings_updated",
			"reason": reason,
			"before_json": json.dumps(before, ensure_ascii=False, default=str),
			"after_json": json.dumps(after, ensure_ascii=False, default=str),
			"request_id": context.request_id,
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)
