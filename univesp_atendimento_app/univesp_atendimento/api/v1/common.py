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

from univesp_atendimento.access_control import ALLOWED_PROFILES, actions_for_profile


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
	actor_email: str
	simulation_id: str = ""
	is_simulation: bool = False


def get_request_context(required_action: str | None = None) -> RequestContext:
	identity = verify_signed_identity()
	actor_profile = load_access_profile(identity["email"])
	_actor_scopes, actor_actions = effective_authorization(actor_profile)
	simulation = verify_signed_simulation()
	profile = actor_profile

	if simulation:
		actor_email = str(simulation.get("actor_email") or "").strip().lower()
		if actor_email != identity["email"]:
			raise frappe.AuthenticationError(_("A simulacao nao pertence a esta sessao."))
		if str(getattr(frappe.request, "method", "GET")).upper() not in {"GET", "HEAD", "OPTIONS"}:
			raise frappe.PermissionError(_("Escritas reais sao bloqueadas durante a simulacao."))

		mode = str(simulation.get("mode") or "").strip().lower()
		persona = str(simulation.get("persona") or "").strip().lower()
		persona_capability = "student" if persona == "aluno" else persona
		mode_capability = "real" if mode == "person" else "generic"
		capability = f"simulate_{persona_capability}_{mode_capability}"
		if persona not in {"aluno", "op"} or capability not in actor_actions:
			raise frappe.PermissionError(_("Seu perfil nao permite esta simulacao."))

		if mode == "person":
			profile = load_access_profile(str(simulation.get("target_internal_id") or "").strip().lower())
			identity = {
				"email": profile.user_email,
				"name": profile.display_name or profile.user_email,
				"ra": profile.ra or "",
			}
		elif mode == "generic":
			profile = _generic_simulation_profile(persona, simulation.get("scope"))
			identity = {"email": profile.user_email, "name": profile.display_name, "ra": ""}
		else:
			raise frappe.AuthenticationError(_("Modo de simulacao invalido."))

	effective_scopes, effective_actions = effective_authorization(profile)
	request_id = frappe.get_request_header("X-Request-ID") or str(uuid.uuid4())
	context = RequestContext(
		email=identity["email"],
		name=identity.get("name") or profile.display_name or identity["email"],
		ra=identity.get("ra") or profile.ra or "",
		profile_key=profile.profile_key,
		scopes=effective_scopes,
		actions=effective_actions,
		request_id=request_id,
		actor_email=str(simulation.get("actor_email") if simulation else identity["email"]).strip().lower(),
		simulation_id=str(simulation.get("id") if simulation else ""),
		is_simulation=bool(simulation),
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
		assignee = (
			str(frappe.db.get_value("HD Ticket", ticket_name, "custom_univesp_assignee_email") or "")
			.strip()
			.lower()
		)
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


def verify_gateway_only():
	secret = str(frappe.conf.get("univesp_edge_shared_secret") or "")
	gateway_key = frappe.get_request_header("X-Univesp-Gateway-Key") or ""
	if not secret or not gateway_key or not hmac.compare_digest(gateway_key, secret):
		raise frappe.AuthenticationError(_("Gateway nao autorizado."))


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


def verify_signed_simulation():
	encoded = frappe.get_request_header("X-Univesp-Simulation-Context") or ""
	if not encoded:
		return None
	timestamp = frappe.get_request_header("X-Univesp-Simulation-Timestamp") or ""
	signature = frappe.get_request_header("X-Univesp-Simulation-Signature") or ""
	secret = str(frappe.conf.get("univesp_bff_shared_secret") or "")
	if not timestamp or not signature or not secret:
		raise frappe.AuthenticationError(_("Contexto de simulacao incompleto."))
	try:
		timestamp_value = int(timestamp)
	except ValueError as exc:
		raise frappe.AuthenticationError(_("Contexto de simulacao invalido.")) from exc
	if abs(int(time.time()) - timestamp_value) > MAX_CONTEXT_AGE_SECONDS:
		raise frappe.AuthenticationError(_("Contexto de simulacao expirado."))
	expected = hmac.new(
		secret.encode("utf-8"),
		f"{timestamp}.simulation.{encoded}".encode("utf-8"),
		hashlib.sha256,
	).hexdigest()
	if not hmac.compare_digest(expected, signature):
		raise frappe.AuthenticationError(_("Assinatura de simulacao invalida."))
	try:
		padding = "=" * (-len(encoded) % 4)
		payload = json.loads(base64.urlsafe_b64decode(f"{encoded}{padding}").decode("utf-8"))
	except (ValueError, json.JSONDecodeError, binascii.Error) as exc:
		raise frappe.AuthenticationError(_("Contexto de simulacao invalido.")) from exc
	if not isinstance(payload, dict) or not str(payload.get("id") or "").strip():
		raise frappe.AuthenticationError(_("Sessao de simulacao invalida."))
	return payload


class _GenericSimulationProfile:
	def __init__(self, persona, scope):
		self.user_email = f"simulation-generic-{persona}@invalid.local"
		self.display_name = "Visualizacao generica"
		self.ra = ""
		self.profile_key = persona
		self.scopes_json = json.dumps(scope if isinstance(scope, dict) else {})
		self.actions_json = json.dumps(actions_for_profile(persona))
		self.active = 1


def _generic_simulation_profile(persona, scope):
	if persona not in {"aluno", "op"}:
		raise frappe.PermissionError(_("Persona de simulacao invalida."))
	return _GenericSimulationProfile(persona, scope)


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


def effective_authorization(profile):
	scopes = _parse_json_object(profile.scopes_json, "scopes_json")
	actions = set(_parse_json_list(profile.actions_json, "actions_json"))
	email = str(getattr(profile, "user_email", "") or "").strip().lower()
	if not email or not frappe.db.exists("Univesp Access Profile", {"user_email": email, "active": 1}):
		return scopes, frozenset(actions)

	now = frappe.utils.now_datetime()
	profile_names = set()
	assignments = frappe.get_all(
		"Univesp Permission Assignment",
		filters={"subject_type": "person", "subject_id": email, "active": 1},
		fields=["permission_profile", "scopes_json", "valid_from", "valid_until"],
		limit_page_length=0,
	)
	for assignment in assignments:
		if assignment.valid_from and now < frappe.utils.get_datetime(assignment.valid_from):
			continue
		if assignment.valid_until and now > frappe.utils.get_datetime(assignment.valid_until):
			continue
		profile_names.add(assignment.permission_profile)
		_merge_scopes(scopes, frappe.parse_json(assignment.scopes_json or "{}"))

	groups = frappe.get_all(
		"Univesp Access Group",
		filters={"active": 1},
		fields=["name", "permission_profile", "scopes_json", "members_json"],
		limit_page_length=0,
	)
	member_groups = []
	for group in groups:
		members = {str(item).strip().lower() for item in frappe.parse_json(group.members_json or "[]")}
		if email in members:
			member_groups.append(group.name)
			profile_names.add(group.permission_profile)
			_merge_scopes(scopes, frappe.parse_json(group.scopes_json or "{}"))

	if member_groups:
		group_assignments = frappe.get_all(
			"Univesp Permission Assignment",
			filters={"subject_type": "group", "subject_id": ["in", member_groups], "active": 1},
			fields=["permission_profile", "scopes_json", "valid_from", "valid_until"],
			limit_page_length=0,
		)
		for assignment in group_assignments:
			if assignment.valid_from and now < frappe.utils.get_datetime(assignment.valid_from):
				continue
			if assignment.valid_until and now > frappe.utils.get_datetime(assignment.valid_until):
				continue
			profile_names.add(assignment.permission_profile)
			_merge_scopes(scopes, frappe.parse_json(assignment.scopes_json or "{}"))

	for name in profile_names:
		permission_profile = frappe.get_doc("Univesp Permission Profile", name)
		if not permission_profile.active or permission_profile.base_persona != profile.profile_key:
			continue
		actions.update(frappe.parse_json(permission_profile.capabilities_json or "[]"))
	return scopes, frozenset(str(item).strip() for item in actions if str(item).strip())


def _merge_scopes(target, incoming):
	if not isinstance(incoming, dict):
		return
	for key, values in incoming.items():
		if not isinstance(values, list):
			continue
		current = target.setdefault(str(key), [])
		normalized = [str(item).strip() for item in values if str(item).strip()]
		target[str(key)] = list(dict.fromkeys([*current, *normalized]))


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
