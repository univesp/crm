import json

import frappe
from frappe import _
from frappe.utils import cint, now_datetime

from univesp_atendimento.access_control import profile_catalog
from univesp_atendimento.api.v1.common import get_request_context, response


PROFILE_FIELDS = [
	"name",
	"user_email",
	"display_name",
	"ra",
	"profile_key",
	"active",
	"provisioning_source",
	"approved_by",
	"approved_at",
	"first_login_at",
	"last_login_at",
	"scopes_json",
	"actions_json",
	"creation",
	"modified",
]


class UnivespValidationError(frappe.ValidationError):
	http_status_code = 422


class UnivespConflictError(frappe.ValidationError):
	http_status_code = 409


@frappe.whitelist(methods=["GET"])
def list_users(
	page: int | str = 1,
	page_size: int | str = 25,
	search: str | None = None,
	profile: str | None = None,
	status: str | None = None,
	scope: str | None = None,
):
	context = _admin_context()
	page = max(cint(page), 1)
	page_size = min(max(cint(page_size), 1), 100)
	filters = {}
	if profile:
		filters["profile_key"] = str(profile)
	if str(status or "").lower() in {"active", "ativo"}:
		filters["active"] = 1
	elif str(status or "").lower() in {"inactive", "inativo", "disabled"}:
		filters["active"] = 0
	if scope:
		filters["scopes_json"] = ["like", f"%{str(scope).strip()}%"]
	or_filters = None
	if search:
		term = f"%{str(search).strip()}%"
		or_filters = {"user_email": ["like", term], "display_name": ["like", term]}

	all_names = frappe.get_all(
		"Univesp Access Profile", filters=filters, or_filters=or_filters, pluck="name", limit_page_length=0
	)
	rows = frappe.get_all(
		"Univesp Access Profile",
		filters=filters,
		or_filters=or_filters,
		fields=PROFILE_FIELDS,
		order_by="modified desc",
		start=(page - 1) * page_size,
		page_length=page_size,
	)
	return response(
		[_serialize_profile(row) for row in rows],
		meta={"page": page, "page_size": page_size, "total": len(all_names)},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def get_user(email: str):
	context = _admin_context()
	doc = _get_profile(email)
	data = _serialize_profile(doc)
	data["audit"] = _audit_rows(target_email=doc.user_email, page_size=50)
	return response(data, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def create_user(payload: dict | str | None = None):
	context = _admin_context()
	data = _payload(payload)
	reason = _required_reason(data)
	email = _email(data.get("email"))
	if frappe.db.exists("Univesp Access Profile", email):
		raise UnivespConflictError(_("Usuario ja cadastrado."))

	doc = frappe.get_doc(
		{
			"doctype": "Univesp Access Profile",
			"user_email": email,
			"display_name": str(data.get("display_name") or data.get("name") or email).strip(),
			"ra": str(data.get("ra") or "").strip(),
			"profile_key": str(data.get("profile_key") or "").strip(),
			"active": cint(data.get("active", 1)),
			"provisioning_source": "manual",
			"approved_by": context.email,
			"approved_at": now_datetime(),
			"scopes_json": json.dumps(data.get("scopes") or {}),
			"actions_json": "[]",
		}
	).insert(ignore_permissions=True)
	_resolve_request(email, "Approved", context, reason)
	_write_audit(context, email, "user_created", reason, None, _profile_snapshot(doc))
	return response(_serialize_profile(doc), request_id=context.request_id)


@frappe.whitelist(methods=["PATCH", "POST"])
def update_user(email: str, payload: dict | str | None = None):
	context = _admin_context()
	data = _payload(payload)
	reason = _required_reason(data)
	doc = _get_profile(email)
	version = str(data.get("version") or "").strip()
	if not version:
		raise UnivespValidationError(_("Versao atual do usuario obrigatoria."))
	if version != str(doc.modified):
		raise UnivespConflictError(_("O usuario foi alterado por outra pessoa. Atualize a tela."))

	before = _profile_snapshot(doc)
	next_profile = str(data.get("profile_key", doc.profile_key) or "").strip()
	next_active = cint(data.get("active", doc.active))
	_protect_admin_change(context, doc, next_profile, next_active)
	doc.display_name = str(data.get("display_name", doc.display_name) or "").strip()
	doc.ra = str(data.get("ra", doc.ra) or "").strip()
	doc.profile_key = next_profile
	doc.active = next_active
	doc.scopes_json = json.dumps(data.get("scopes", frappe.parse_json(doc.scopes_json or "{}")))
	doc.save(ignore_permissions=True)
	after = _profile_snapshot(doc)
	operation = "user_deactivated" if before["active"] and not after["active"] else "user_updated"
	_write_audit(context, doc.user_email, operation, reason, before, after)
	return response(_serialize_profile(doc), request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def list_access_requests(
	page: int | str = 1,
	page_size: int | str = 25,
	status: str | None = None,
	search: str | None = None,
):
	context = _admin_context()
	page = max(cint(page), 1)
	page_size = min(max(cint(page_size), 1), 100)
	filters = {}
	if status:
		filters["status"] = str(status).strip().title()
	or_filters = None
	if search:
		term = f"%{str(search).strip()}%"
		or_filters = {"user_email": ["like", term], "display_name": ["like", term]}
	all_names = frappe.get_all(
		"Univesp Access Request", filters=filters, or_filters=or_filters, pluck="name", limit_page_length=0
	)
	rows = frappe.get_all(
		"Univesp Access Request",
		filters=filters,
		or_filters=or_filters,
		fields=[
			"name",
			"user_email",
			"display_name",
			"ra",
			"identity_flow",
			"status",
			"first_seen_at",
			"last_seen_at",
			"attempt_count",
			"resolved_by",
			"resolved_at",
			"modified",
		],
		order_by="last_seen_at desc",
		start=(page - 1) * page_size,
		page_length=page_size,
	)
	return response(
		[_serialize_request(row) for row in rows],
		meta={"page": page, "page_size": page_size, "total": len(all_names)},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def approve_access_request(
	access_request_id: str,
	payload: dict | str | None = None,
):
	context = _admin_context()
	data = _payload(payload)
	reason = _required_reason(data)
	request_doc = _get_request(access_request_id)
	if frappe.db.exists("Univesp Access Profile", request_doc.user_email):
		raise UnivespConflictError(_("Ja existe um usuario para esta solicitacao."))
	doc = frappe.get_doc(
		{
			"doctype": "Univesp Access Profile",
			"user_email": request_doc.user_email,
			"display_name": str(data.get("display_name") or request_doc.display_name).strip(),
			"ra": str(data.get("ra") or request_doc.ra or "").strip(),
			"profile_key": str(data.get("profile_key") or "").strip(),
			"active": 1,
			"provisioning_source": "access_request",
			"approved_by": context.email,
			"approved_at": now_datetime(),
			"scopes_json": json.dumps(data.get("scopes") or {}),
			"actions_json": "[]",
		}
	).insert(ignore_permissions=True)
	_resolve_request(request_doc.name, "Approved", context, reason)
	_write_audit(
		context,
		doc.user_email,
		"access_request_approved",
		reason,
		_request_snapshot(request_doc),
		_profile_snapshot(doc),
	)
	return response(_serialize_profile(doc), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def reject_access_request(
	access_request_id: str,
	payload: dict | str | None = None,
):
	context = _admin_context()
	data = _payload(payload)
	reason = _required_reason(data)
	request_doc = _get_request(access_request_id)
	if frappe.db.exists("Univesp Access Profile", request_doc.user_email):
		raise UnivespConflictError(_("Nao e possivel rejeitar uma solicitacao com usuario cadastrado."))
	before = _request_snapshot(request_doc)
	_resolve_request(request_doc.name, "Rejected", context, reason)
	request_doc.reload()
	_write_audit(
		context,
		request_doc.user_email,
		"access_request_rejected",
		reason,
		before,
		_request_snapshot(request_doc),
	)
	return response(_serialize_request(request_doc), request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def catalogs():
	context = _admin_context()
	queues = frappe.get_all(
		"HD Team", filters={"enabled": 1}, fields=["name", "team_name"], order_by="team_name asc"
	)
	polos = _distinct_ticket_values("custom_student_polo", "polos")
	areas = _distinct_ticket_values("custom_univesp_area", "areas")
	return response(
		{
			"profiles": profile_catalog(),
			"queues": [{"value": row.name, "label": row.team_name or row.name} for row in queues],
			"polos": [{"value": value, "label": value} for value in polos],
			"areas": [{"value": value, "label": value} for value in areas],
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def list_audit(
	page: int | str = 1,
	page_size: int | str = 25,
	target_email: str | None = None,
	operation: str | None = None,
):
	context = _admin_context()
	page = max(cint(page), 1)
	page_size = min(max(cint(page_size), 1), 100)
	filters = {}
	if target_email:
		filters["target_email"] = _email(target_email)
	if operation:
		filters["operation"] = str(operation).strip()
	total = frappe.db.count("Univesp Access Audit", filters=filters)
	rows = _audit_rows(filters=filters, start=(page - 1) * page_size, page_size=page_size)
	return response(
		rows,
		meta={"page": page, "page_size": page_size, "total": total},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def list_permission_profiles():
	context = _permissions_context()
	rows = frappe.get_all(
		"Univesp Permission Profile",
		fields=[
			"name",
			"profile_key",
			"label",
			"base_persona",
			"scope_type",
			"capabilities_json",
			"active",
			"system_profile",
			"external_id",
			"modified",
		],
		order_by="system_profile desc, label asc",
		limit_page_length=0,
	)
	return response([_serialize_permission_profile(row) for row in rows], request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def create_permission_profile(payload: dict | str | None = None):
	context = _permissions_context()
	data = _payload(payload)
	reason = _required_reason(data)
	key = frappe.scrub(str(data.get("profile_key") or data.get("label") or ""))[:80]
	if not key:
		raise UnivespValidationError(_("Informe o nome do perfil."))
	if frappe.db.exists("Univesp Permission Profile", key):
		raise UnivespConflictError(_("Ja existe um perfil com este identificador."))
	persona, capabilities = _permission_profile_values(data)
	doc = frappe.get_doc(
		{
			"doctype": "Univesp Permission Profile",
			"profile_key": key,
			"label": str(data.get("label") or key).strip()[:140],
			"base_persona": persona,
			"scope_type": str(data.get("scope_type") or "").strip(),
			"capabilities_json": json.dumps(capabilities),
			"active": cint(data.get("active", 1)),
			"system_profile": 0,
			"external_id": str(data.get("external_id") or "").strip()[:140],
		}
	).insert(ignore_permissions=True)
	_write_audit(context, context.email, "permission_profile_created", reason, None, {"profile_key": key})
	return response(_serialize_permission_profile(doc), request_id=context.request_id)


@frappe.whitelist(methods=["PATCH", "POST"])
def update_permission_profile(profile_id: str, payload: dict | str | None = None):
	context = _permissions_context()
	data = _payload(payload)
	reason = _required_reason(data)
	doc = frappe.get_doc("Univesp Permission Profile", str(profile_id))
	if str(data.get("version") or "") != str(doc.modified):
		raise UnivespConflictError(_("O perfil foi alterado. Atualize a tela."))
	if doc.system_profile:
		raise UnivespValidationError(_("Perfis do sistema nao podem ser alterados."))
	persona, capabilities = _permission_profile_values(data, doc)
	doc.label = str(data.get("label", doc.label) or "").strip()[:140]
	doc.base_persona = persona
	doc.scope_type = str(data.get("scope_type", doc.scope_type) or "").strip()
	doc.capabilities_json = json.dumps(capabilities)
	doc.active = cint(data.get("active", doc.active))
	doc.external_id = str(data.get("external_id", doc.external_id) or "").strip()[:140]
	doc.save(ignore_permissions=True)
	_write_audit(
		context,
		context.email,
		"permission_profile_updated",
		reason,
		{"profile_key": doc.name},
		{"active": bool(doc.active)},
	)
	return response(_serialize_permission_profile(doc), request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def list_access_groups():
	context = _permissions_context()
	rows = frappe.get_all(
		"Univesp Access Group",
		fields=[
			"name",
			"group_key",
			"label",
			"permission_profile",
			"scopes_json",
			"members_json",
			"external_id",
			"active",
			"modified",
		],
		order_by="label asc",
		limit_page_length=0,
	)
	return response([_serialize_group(row) for row in rows], request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def create_access_group(payload: dict | str | None = None):
	context = _permissions_context()
	data = _payload(payload)
	reason = _required_reason(data)
	key = frappe.scrub(str(data.get("group_key") or data.get("label") or ""))[:80]
	if not key or frappe.db.exists("Univesp Access Group", key):
		raise UnivespConflictError(_("Identificador de grupo ausente ou ja utilizado."))
	profile = str(data.get("permission_profile") or "").strip()
	if not frappe.db.exists("Univesp Permission Profile", {"name": profile, "active": 1}):
		raise UnivespValidationError(_("Perfil de acesso invalido."))
	members = _member_emails(data.get("members"))
	doc = frappe.get_doc(
		{
			"doctype": "Univesp Access Group",
			"group_key": key,
			"label": str(data.get("label") or key).strip()[:140],
			"permission_profile": profile,
			"scopes_json": json.dumps(data.get("scopes") if isinstance(data.get("scopes"), dict) else {}),
			"members_json": json.dumps(members),
			"external_id": str(data.get("external_id") or "").strip()[:140],
			"active": cint(data.get("active", 1)),
		}
	).insert(ignore_permissions=True)
	_write_audit(
		context,
		context.email,
		"access_group_created",
		reason,
		None,
		{"group_key": key, "member_count": len(members)},
	)
	return response(_serialize_group(doc), request_id=context.request_id)


@frappe.whitelist(methods=["PATCH", "POST"])
def update_access_group(group_id: str, payload: dict | str | None = None):
	context = _permissions_context()
	data = _payload(payload)
	reason = _required_reason(data)
	doc = frappe.get_doc("Univesp Access Group", str(group_id))
	if str(data.get("version") or "") != str(doc.modified):
		raise UnivespConflictError(_("O grupo foi alterado. Atualize a tela."))
	members = _member_emails(data.get("members", frappe.parse_json(doc.members_json or "[]")))
	doc.label = str(data.get("label", doc.label) or "").strip()[:140]
	doc.permission_profile = str(data.get("permission_profile", doc.permission_profile) or "").strip()
	doc.scopes_json = json.dumps(data.get("scopes", frappe.parse_json(doc.scopes_json or "{}")))
	doc.members_json = json.dumps(members)
	doc.external_id = str(data.get("external_id", doc.external_id) or "").strip()[:140]
	doc.active = cint(data.get("active", doc.active))
	doc.save(ignore_permissions=True)
	_write_audit(
		context,
		context.email,
		"access_group_updated",
		reason,
		{"group_key": doc.name},
		{"member_count": len(members), "active": bool(doc.active)},
	)
	return response(_serialize_group(doc), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def create_profile_assignment(payload: dict | str | None = None):
	context = _permissions_context()
	data = _payload(payload)
	reason = _required_reason(data)
	subject_type = str(data.get("subject_type") or "").strip().lower()
	subject_id = str(data.get("subject_id") or "").strip().lower()
	profile = str(data.get("permission_profile") or "").strip()
	if subject_type not in {"person", "group"} or not subject_id:
		raise UnivespValidationError(_("Pessoa ou grupo invalido."))
	if not frappe.db.exists("Univesp Permission Profile", {"name": profile, "active": 1}):
		raise UnivespValidationError(_("Perfil de acesso invalido."))
	if subject_type == "person" and not frappe.db.exists(
		"Univesp Access Profile", {"user_email": subject_id, "active": 1}
	):
		raise UnivespValidationError(_("Pessoa nao cadastrada ou inativa."))
	if subject_type == "group" and not frappe.db.exists(
		"Univesp Access Group", {"name": subject_id, "active": 1}
	):
		raise UnivespValidationError(_("Grupo nao cadastrado ou inativo."))
	doc = frappe.get_doc(
		{
			"doctype": "Univesp Permission Assignment",
			"subject_type": subject_type,
			"subject_id": subject_id,
			"permission_profile": profile,
			"scopes_json": json.dumps(data.get("scopes") if isinstance(data.get("scopes"), dict) else {}),
			"valid_from": data.get("valid_from"),
			"valid_until": data.get("valid_until"),
			"justification": reason,
			"active": 1,
		}
	).insert(ignore_permissions=True)
	_write_audit(
		context,
		context.email,
		"permission_assignment_created",
		reason,
		None,
		{"assignment_id": doc.name, "subject_reference": _subject_reference(subject_id)},
	)
	return response({"id": doc.name, "active": True}, request_id=context.request_id)


@frappe.whitelist(methods=["DELETE", "POST"])
def delete_profile_assignment(assignment_id: str):
	context = _permissions_context()
	doc = frappe.get_doc("Univesp Permission Assignment", str(assignment_id))
	doc.active = 0
	doc.save(ignore_permissions=True)
	_write_audit(
		context,
		context.email,
		"permission_assignment_revoked",
		"Revogacao administrativa",
		{"assignment_id": doc.name},
		{"active": False},
	)
	return response({"id": doc.name, "active": False}, request_id=context.request_id)


def _permissions_context():
	context = get_request_context("manage_permission_profiles")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode gerenciar perfis."))
	return context


def _permission_profile_values(data, current=None):
	persona = str(data.get("base_persona", getattr(current, "base_persona", "")) or "").strip()
	if persona not in {item["key"] for item in profile_catalog()}:
		raise UnivespValidationError(_("Perfil base invalido."))
	capabilities = data.get("capabilities")
	if capabilities is None and current:
		capabilities = frappe.parse_json(current.capabilities_json or "[]")
	if not isinstance(capabilities, list) or len(capabilities) > 100:
		raise UnivespValidationError(_("Lista de capacidades invalida."))
	normalized = list(dict.fromkeys(str(item).strip() for item in capabilities if str(item).strip()))
	if any(len(item) > 80 or not item.replace("_", "").isalnum() for item in normalized):
		raise UnivespValidationError(_("Capacidade invalida."))
	return persona, normalized


def _member_emails(value):
	if not isinstance(value, list) or len(value) > 500:
		raise UnivespValidationError(_("A lista de membros deve conter no maximo 500 pessoas."))
	return list(dict.fromkeys(_email(item) for item in value))


def _serialize_permission_profile(value):
	row = value.as_dict() if hasattr(value, "as_dict") else value
	return {
		"id": row.get("name"),
		"profile_key": row.get("profile_key"),
		"label": row.get("label"),
		"base_persona": row.get("base_persona"),
		"scope_type": row.get("scope_type") or "",
		"capabilities": frappe.parse_json(row.get("capabilities_json") or "[]"),
		"active": bool(row.get("active")),
		"system_profile": bool(row.get("system_profile")),
		"external_id": row.get("external_id") or "",
		"version": str(row.get("modified") or ""),
	}


def _serialize_group(value):
	row = value.as_dict() if hasattr(value, "as_dict") else value
	return {
		"id": row.get("name"),
		"group_key": row.get("group_key"),
		"label": row.get("label"),
		"permission_profile": row.get("permission_profile"),
		"scopes": frappe.parse_json(row.get("scopes_json") or "{}"),
		"members": frappe.parse_json(row.get("members_json") or "[]"),
		"member_count": len(frappe.parse_json(row.get("members_json") or "[]")),
		"external_id": row.get("external_id") or "",
		"active": bool(row.get("active")),
		"version": str(row.get("modified") or ""),
	}


SIMULATION_CAPABILITIES = {
	("aluno", "generic"): "simulate_student_generic",
	("aluno", "person"): "simulate_student_real",
	("op", "generic"): "simulate_op_generic",
	("op", "person"): "simulate_op_real",
}


@frappe.whitelist(methods=["GET"])
def list_simulation_targets(search: str | None = None, persona: str | None = None):
	context = _admin_context()
	term = str(search or "").strip()
	if len(term) < 3:
		raise UnivespValidationError(_("Informe ao menos 3 caracteres para pesquisar."))
	persona = str(persona or "").strip().lower()
	if persona not in {"aluno", "op"}:
		raise UnivespValidationError(_("Selecione Aluno ou OP."))

	like = f"%{term}%"
	rows = frappe.get_all(
		"Univesp Access Profile",
		filters={"profile_key": persona, "active": 1},
		or_filters={"user_email": ["like", like], "display_name": ["like", like], "ra": ["like", like]},
		fields=["name", "user_email", "display_name", "ra", "profile_key", "scopes_json"],
		order_by="display_name asc",
		page_length=20,
	)
	return response(
		[
			{
				"id": row.name,
				"reference": _subject_reference(row.user_email),
				"display_name": row.display_name or row.user_email,
				"email": row.user_email,
				"ra": row.ra or "",
				"persona": row.profile_key,
				"scopes": frappe.parse_json(row.scopes_json or "{}"),
			}
			for row in rows
		],
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def authorize_simulation_session(payload: dict | str | None = None):
	context = _admin_context()
	data = _payload(payload)
	mode = str(data.get("mode") or "").strip().lower()
	persona = str(data.get("persona") or "").strip().lower()
	reason_code = str(data.get("reason_code") or "").strip().lower()
	if mode not in {"generic", "person"} or persona not in {"aluno", "op"}:
		raise UnivespValidationError(_("Modo ou perfil de simulacao invalido."))
	if reason_code not in {"suporte", "validacao", "reclamacao", "auditoria"}:
		raise UnivespValidationError(_("Selecione um motivo valido para a simulacao."))

	capability = SIMULATION_CAPABILITIES[(persona, mode)]
	if capability not in context.actions:
		raise frappe.PermissionError(_("Seu perfil nao permite esta simulacao."))

	target_internal_id = ""
	target_reference = ""
	scope = data.get("scope") if isinstance(data.get("scope"), dict) else {}
	if mode == "person":
		target_id = str(data.get("target_id") or "").strip()
		name = frappe.db.get_value(
			"Univesp Access Profile",
			{"name": target_id, "profile_key": persona, "active": 1},
			"name",
		)
		if not name:
			raise frappe.DoesNotExistError(_("Pessoa nao encontrada para este perfil."))
		target = frappe.get_doc("Univesp Access Profile", name)
		target_internal_id = target.user_email
		target_reference = _subject_reference(target.user_email)
		scope = frappe.parse_json(target.scopes_json or "{}")

	_write_audit(
		context,
		context.email,
		"simulation_started",
		reason_code,
		None,
		{"target_reference": target_reference, "mode": mode, "persona": persona},
	)
	return response(
		{
			"mode": mode,
			"persona": persona,
			"reason_code": reason_code,
			"target_internal_id": target_internal_id,
			"target_reference": target_reference,
			"scope": scope,
			"capabilities": sorted(context.actions),
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def list_simulation_audit(page: int | str = 1, page_size: int | str = 25):
	context = _admin_context()
	filters = {"operation": ["like", "simulation_%"]}
	page = max(cint(page), 1)
	page_size = min(max(cint(page_size), 1), 100)
	rows = _audit_rows(filters=filters, start=(page - 1) * page_size, page_size=page_size)
	return response(
		rows,
		meta={
			"page": page,
			"page_size": page_size,
			"total": frappe.db.count("Univesp Access Audit", filters),
		},
		request_id=context.request_id,
	)


def _subject_reference(email):
	secret = str(frappe.conf.get("univesp_bff_shared_secret") or frappe.local.site)
	return (
		__import__("hmac")
		.new(
			secret.encode("utf-8"),
			str(email or "").strip().lower().encode("utf-8"),
			__import__("hashlib").sha256,
		)
		.hexdigest()[:24]
	)


def _admin_context():
	context = get_request_context("manage_users")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode gerenciar usuarios."))
	return context


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value:
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise UnivespValidationError(_("Corpo JSON invalido.")) from exc
	return {}


def _required_reason(data):
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 5:
		raise UnivespValidationError(_("Informe um motivo com pelo menos 5 caracteres."))
	return reason


def _email(value):
	email = str(value or "").strip().lower()
	if not email or "@" not in email:
		raise UnivespValidationError(_("Email institucional invalido."))
	return email


def _get_profile(email):
	name = frappe.db.get_value("Univesp Access Profile", {"user_email": _email(email)}, "name")
	if not name:
		raise frappe.DoesNotExistError(_("Usuario nao encontrado."))
	return frappe.get_doc("Univesp Access Profile", name)


def _get_request(value):
	name = frappe.db.get_value("Univesp Access Request", {"name": str(value)}, "name")
	if not name:
		raise frappe.DoesNotExistError(_("Solicitacao de acesso nao encontrada."))
	return frappe.get_doc("Univesp Access Request", name)


def _protect_admin_change(context, doc, next_profile, next_active):
	removes_admin = (
		doc.profile_key == "admin_central"
		and doc.active
		and (next_profile != "admin_central" or not next_active)
	)
	if doc.user_email == context.email and removes_admin:
		raise UnivespValidationError(_("Voce nao pode remover o proprio acesso administrativo."))
	if (
		removes_admin
		and frappe.db.count("Univesp Access Profile", filters={"profile_key": "admin_central", "active": 1})
		<= 1
	):
		raise UnivespValidationError(_("O ultimo Admin central ativo nao pode ser removido."))


def _serialize_profile(value):
	row = value.as_dict() if hasattr(value, "as_dict") else value
	return {
		"id": row.get("name"),
		"email": row.get("user_email"),
		"display_name": row.get("display_name"),
		"ra": row.get("ra") or "",
		"profile_key": row.get("profile_key"),
		"active": bool(row.get("active")),
		"status": "active" if row.get("active") else "inactive",
		"provisioning_source": row.get("provisioning_source") or "manual",
		"scopes": frappe.parse_json(row.get("scopes_json") or "{}"),
		"actions": frappe.parse_json(row.get("actions_json") or "[]"),
		"approved_by": row.get("approved_by"),
		"approved_at": row.get("approved_at"),
		"first_login_at": row.get("first_login_at"),
		"last_login_at": row.get("last_login_at"),
		"created_at": row.get("creation"),
		"updated_at": row.get("modified"),
		"version": str(row.get("modified") or ""),
	}


def _profile_snapshot(doc):
	data = _serialize_profile(doc)
	return {
		key: data[key]
		for key in [
			"email",
			"display_name",
			"ra",
			"profile_key",
			"active",
			"provisioning_source",
			"scopes",
			"actions",
		]
	}


def _serialize_request(value):
	row = value.as_dict() if hasattr(value, "as_dict") else value
	return {
		"id": row.get("name"),
		"email": row.get("user_email"),
		"display_name": row.get("display_name"),
		"ra": row.get("ra") or "",
		"identity_flow": row.get("identity_flow") or "",
		"status": str(row.get("status") or "Pending").lower(),
		"first_seen_at": row.get("first_seen_at"),
		"last_seen_at": row.get("last_seen_at"),
		"attempt_count": cint(row.get("attempt_count")),
		"resolved_by": row.get("resolved_by"),
		"resolved_at": row.get("resolved_at"),
		"version": str(row.get("modified") or ""),
	}


def _request_snapshot(doc):
	data = _serialize_request(doc)
	return {
		key: data[key] for key in ["email", "display_name", "ra", "identity_flow", "status", "attempt_count"]
	}


def _resolve_request(email, status, context, reason):
	name = frappe.db.exists("Univesp Access Request", email)
	if not name:
		return
	frappe.db.set_value(
		"Univesp Access Request",
		name,
		{
			"status": status,
			"resolution_reason": reason,
			"resolved_by": context.email,
			"resolved_at": now_datetime(),
		},
	)


def _write_audit(context, target_email, operation, reason, before, after):
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": context.email,
			"target_email": target_email,
			"operation": operation,
			"reason": reason,
			"before_json": json.dumps(before, ensure_ascii=False, default=str) if before else "",
			"after_json": json.dumps(after, ensure_ascii=False, default=str) if after else "",
			"request_id": context.request_id,
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)


def _audit_rows(target_email=None, filters=None, start=0, page_size=25):
	filters = dict(filters or {})
	if target_email:
		filters["target_email"] = target_email
	rows = frappe.get_all(
		"Univesp Access Audit",
		filters=filters,
		fields=[
			"name",
			"actor_email",
			"target_email",
			"operation",
			"reason",
			"before_json",
			"after_json",
			"request_id",
			"event_at",
		],
		order_by="event_at desc",
		start=start,
		page_length=page_size,
	)
	return [
		{
			"id": row.name,
			"actor_email": row.actor_email,
			"target_email": row.target_email,
			"operation": row.operation,
			"reason": row.reason,
			"before": frappe.parse_json(row.before_json) if row.before_json else None,
			"after": frappe.parse_json(row.after_json) if row.after_json else None,
			"request_id": row.request_id,
			"event_at": row.event_at,
		}
		for row in rows
	]


def _distinct_ticket_values(fieldname, scope_key):
	values = {
		str(row.get(fieldname) or "").strip()
		for row in frappe.get_all(
			"HD Ticket", filters={fieldname: ["!=", ""]}, fields=[fieldname], limit_page_length=0
		)
		if str(row.get(fieldname) or "").strip()
	}
	for row in frappe.get_all("Univesp Access Profile", fields=["scopes_json"], limit_page_length=0):
		scopes = frappe.parse_json(row.scopes_json or "{}")
		values.update(str(item).strip() for item in scopes.get(scope_key, []) if str(item).strip())
	return sorted(values)
