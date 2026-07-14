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
