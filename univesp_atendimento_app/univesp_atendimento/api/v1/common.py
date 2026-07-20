import base64
import binascii
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass

import frappe
from frappe import _

from univesp_atendimento.access_control import ALLOWED_PROFILES


MAX_CONTEXT_AGE_SECONDS = 60


@dataclass(frozen=True)
class RequestContext:
	email: str
	name: str
	ra: str
	profile_key: str
	scopes: dict
	actions: frozenset
	request_id: str


def get_request_context(required_action: str | None = None) -> RequestContext:
	identity = verify_signed_identity()
	profile = load_access_profile(identity["email"])
	request_id = frappe.get_request_header("X-Request-ID") or str(uuid.uuid4())
	context = RequestContext(
		email=identity["email"],
		name=identity.get("name") or profile.display_name or identity["email"],
		ra=identity.get("ra") or profile.ra or "",
		profile_key=profile.profile_key,
		scopes=_parse_json_object(profile.scopes_json, "scopes_json"),
		actions=frozenset(_parse_json_list(profile.actions_json, "actions_json")),
		request_id=request_id,
	)

	if required_action and required_action not in context.actions:
		raise frappe.PermissionError(_("Seu perfil nao permite esta acao."))

	return context


def response(data=None, *, meta=None, request_id: str = ""):
	return {
		"data": data,
		"error": None,
		"meta": meta or {},
		"request_id": request_id or frappe.get_request_header("X-Request-ID") or str(uuid.uuid4()),
	}


def ticket_scope_filters(context: RequestContext):
	if context.profile_key == "admin_central":
		return []
	if context.profile_key == "aluno":
		return [["HD Ticket", "custom_student_email", "=", context.email]]
	if context.profile_key == "op":
		queues = _scope_values(context.scopes, "queues", "filas")
		return _required_scope_filter("custom_univesp_queue", queues)
	if context.profile_key == "gestor_polos":
		polos = _scope_values(context.scopes, "polos")
		return _required_scope_filter("custom_student_polo", polos)
	if context.profile_key in {"analista_area", "gestor_area"}:
		areas = _scope_values(context.scopes, "areas")
		return _required_scope_filter("custom_univesp_area", areas)
	raise frappe.PermissionError(_("Perfil operacional invalido."))


def ensure_ticket_access(ticket_name: str, context: RequestContext):
	filters = [["HD Ticket", "name", "=", ticket_name], *ticket_scope_filters(context)]
	if not frappe.get_all("HD Ticket", filters=filters, pluck="name", limit=1):
		raise frappe.PermissionError(_("Voce nao pode acessar este protocolo."))
	if context.profile_key == "op":
		assignee = str(
			frappe.db.get_value("HD Ticket", ticket_name, "custom_univesp_assignee_email") or ""
		).strip().lower()
		if assignee and assignee != context.email:
			raise frappe.PermissionError(_("Este atendimento esta atribuido a outro OP."))


def resolve_ticket_name(ticket_id: str) -> str:
	normalized = str(ticket_id or "").strip()
	if not normalized:
		frappe.throw(_("Protocolo obrigatorio."), frappe.ValidationError)
	if frappe.db.exists("HD Ticket", normalized):
		return normalized
	name = frappe.db.get_value("HD Ticket", {"custom_univesp_protocol": normalized}, "name")
	if not name:
		raise frappe.DoesNotExistError(_("Protocolo nao encontrado."))
	return name


def verify_signed_identity():
	encoded = frappe.get_request_header("X-Univesp-User-Context") or ""
	timestamp = frappe.get_request_header("X-Univesp-Timestamp") or ""
	signature = frappe.get_request_header("X-Univesp-Signature") or ""
	secret = str(frappe.conf.get("univesp_bff_shared_secret") or "")

	if not secret:
		frappe.log_error("univesp_bff_shared_secret ausente", "UNIVESP BFF configuration")
		raise frappe.AuthenticationError(_("Integracao institucional indisponivel."))
	if not encoded or not timestamp or not signature:
		raise frappe.AuthenticationError(_("Contexto institucional ausente."))

	try:
		timestamp_value = int(timestamp)
	except ValueError as exc:
		raise frappe.AuthenticationError(_("Contexto institucional invalido.")) from exc
	if abs(int(time.time()) - timestamp_value) > MAX_CONTEXT_AGE_SECONDS:
		raise frappe.AuthenticationError(_("Contexto institucional expirado."))

	expected = hmac.new(
		secret.encode("utf-8"),
		f"{timestamp}.{encoded}".encode("utf-8"),
		hashlib.sha256,
	).hexdigest()
	if not hmac.compare_digest(expected, signature):
		raise frappe.AuthenticationError(_("Assinatura institucional invalida."))

	try:
		padding = "=" * (-len(encoded) % 4)
		payload = json.loads(base64.urlsafe_b64decode(f"{encoded}{padding}").decode("utf-8"))
	except (ValueError, json.JSONDecodeError, binascii.Error) as exc:
		raise frappe.AuthenticationError(_("Contexto institucional invalido.")) from exc

	email = str(payload.get("email") or "").strip().lower()
	if not email:
		raise frappe.AuthenticationError(_("Identidade institucional sem email."))
	return {
		"email": email,
		"name": str(payload.get("name") or ""),
		"ra": str(payload.get("ra") or ""),
		"flow": str(payload.get("flow") or ""),
	}


def load_access_profile(email: str):
	name = frappe.db.get_value("Univesp Access Profile", {"user_email": email}, "name")
	if not name:
		raise frappe.PermissionError(_("Usuario sem perfil ativo no Atendimento UNIVESP."))
	profile = frappe.get_doc("Univesp Access Profile", name)
	if not profile.active:
		raise frappe.PermissionError(_("Usuario desativado no Atendimento UNIVESP."))
	if profile.profile_key not in ALLOWED_PROFILES:
		raise frappe.PermissionError(_("Perfil institucional invalido."))
	return profile


def _parse_json_object(value, fieldname):
	parsed = _parse_json(value, fieldname, {})
	if not isinstance(parsed, dict):
		frappe.throw(_("{0} deve ser um objeto JSON.").format(fieldname), frappe.ValidationError)
	return parsed


def _parse_json_list(value, fieldname):
	parsed = _parse_json(value, fieldname, [])
	if not isinstance(parsed, list):
		frappe.throw(_("{0} deve ser uma lista JSON.").format(fieldname), frappe.ValidationError)
	return [str(item).strip() for item in parsed if str(item).strip()]


def _parse_json(value, fieldname, fallback):
	if not value:
		return fallback
	try:
		return json.loads(value)
	except (TypeError, json.JSONDecodeError) as exc:
		raise frappe.ValidationError(_("JSON invalido em {0}.").format(fieldname)) from exc


def _scope_values(scopes, *keys):
	for key in keys:
		value = scopes.get(key)
		if isinstance(value, list):
			return [str(item).strip() for item in value if str(item).strip()]
	return []


def _required_scope_filter(fieldname, values):
	if not values:
		raise frappe.PermissionError(_("Usuario sem escopo operacional para esta consulta."))
	return [["HD Ticket", fieldname, "in", values]]
