import json

import frappe
from frappe import _


PROFILE_DEFINITIONS = {
	"aluno": {
		"label": "Aluno",
		"scope_key": "",
		"actions": ["create_ticket", "view_ticket", "reply_ticket", "attach_ticket"],
	},
	"op": {
		"label": "OP",
		"scope_key": "queues",
		"actions": ["view_ticket", "reply_ticket", "attach_ticket", "transition_ticket"],
	},
	"gestor_polos": {
		"label": "Gestor de polos",
		"scope_key": "polos",
		"actions": ["view_ticket"],
	},
	"analista_area": {
		"label": "Analista de area",
		"scope_key": "areas",
		"actions": [
			"view_ticket",
			"reply_ticket",
			"attach_ticket",
			"transition_ticket",
			"view_area_guidance",
			"suggest_knowledge",
			"view_knowledge_history",
		],
	},
	"gestor_area": {
		"label": "Gestor de area",
		"scope_key": "areas",
		"actions": [
			"view_ticket",
			"reply_ticket",
			"attach_ticket",
			"assign_ticket",
			"transition_ticket",
			"view_audit",
			"view_area_guidance",
			"manage_area_scope",
			"approve_knowledge",
			"manager_override_route",
			"assign_case",
			"manage_user_availability",
			"view_knowledge_history",
		],
	},
	"admin_central": {
		"label": "Admin central",
		"scope_key": "",
		"actions": [
			"create_ticket",
			"view_ticket",
			"reply_ticket",
			"attach_ticket",
			"assign_ticket",
			"transition_ticket",
			"manage_users",
			"view_audit",
			"edit_faq",
			"edit_parameters",
			"publish_version",
			"approve_knowledge",
			"publish_knowledge_version",
			"manage_user_availability",
			"manage_assignment_policies",
		],
	},
}

ALLOWED_PROFILES = frozenset(PROFILE_DEFINITIONS)


def actions_for_profile(profile_key: str):
	definition = PROFILE_DEFINITIONS.get(str(profile_key or "").strip())
	if not definition:
		frappe.throw(_("Perfil institucional invalido."), frappe.ValidationError)
	return list(definition["actions"])


def normalize_scopes(profile_key: str, value):
	if isinstance(value, str):
		try:
			value = json.loads(value or "{}")
		except json.JSONDecodeError as exc:
			raise frappe.ValidationError(_("Escopos: JSON invalido.")) from exc
	if not isinstance(value, dict):
		raise frappe.ValidationError(_("Escopos devem ser um objeto JSON."))

	definition = PROFILE_DEFINITIONS.get(str(profile_key or "").strip())
	if not definition:
		raise frappe.ValidationError(_("Perfil institucional invalido."))
	scope_key = definition["scope_key"]
	if not scope_key:
		return {}

	values = value.get(scope_key)
	if not isinstance(values, list):
		raise frappe.ValidationError(_("O perfil exige uma lista de escopos em {0}.").format(scope_key))
	normalized = list(dict.fromkeys(str(item or "").strip() for item in values if str(item or "").strip()))
	if not normalized:
		raise frappe.ValidationError(_("Selecione ao menos um escopo para o perfil."))
	return {scope_key: normalized}


def profile_catalog():
	return [
		{
			"key": key,
			"label": definition["label"],
			"scope_key": definition["scope_key"],
			"actions": list(definition["actions"]),
		}
		for key, definition in PROFILE_DEFINITIONS.items()
	]
