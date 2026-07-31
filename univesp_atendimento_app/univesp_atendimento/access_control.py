import json

import frappe
from frappe import _


PROFILE_DEFINITIONS = {
	"aluno": {
		"label": "Aluno",
		"scope_keys": [],
		"actions": ["create_ticket", "view_ticket", "reply_ticket", "attach_ticket"],
	},
	"op": {
		"label": "OP",
		"scope_keys": ["queues"],
		"actions": [
			"view_ticket",
			"reply_ticket",
			"attach_ticket",
			"transition_ticket",
			"view_playbook_op",
			"view_contact_details",
		],
	},
	"op_externo": {
		"label": "Operador externo (BPO)",
		"scope_keys": ["regional_pools", "polos", "areas"],
		"actions": [
			"view_ticket",
			"reply_ticket",
			"attach_ticket",
			"transition_ticket",
			"escalate_to_internal",
			"view_area_guidance",
			"view_playbook_op",
			"view_playbook_bpo",
			"view_contact_details",
		],
	},
	"gestor_polos": {
		"label": "Gestor de polos",
		"scope_keys": ["polos"],
		"actions": ["view_ticket", "view_playbook_op", "view_contact_details"],
	},
	"analista_area": {
		"label": "Analista de area",
		"scope_keys": ["areas", "polos"],
		"actions": [
			"view_ticket",
			"reply_ticket",
			"attach_ticket",
			"transition_ticket",
			"view_area_guidance",
			"suggest_knowledge",
			"view_knowledge_history",
			"view_playbook_op",
			"view_playbook_bpo",
			"view_playbook_analyst",
			"edit_knowledge_draft",
			"submit_knowledge_approval",
			"view_contact_details",
		],
	},
	"gestor_area": {
		"label": "Gestor de area",
		"scope_keys": ["areas", "polos"],
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
			"edit_knowledge_draft",
			"submit_knowledge_approval",
			"view_playbook_op",
			"view_playbook_bpo",
			"view_playbook_analyst",
			"manager_override_route",
			"assign_case",
			"manage_user_availability",
			"view_knowledge_history",
		],
	},
	"admin_central": {
		"label": "Admin central",
		"scope_keys": ["areas"],
		"actions": [
			"create_ticket",
			"view_ticket",
			"reply_ticket",
			"attach_ticket",
			"assign_ticket",
			"transition_ticket",
			"manage_users",
			"view_audit",
			"view_area_guidance",
			"manage_area_scope",
			"edit_faq",
			"edit_parameters",
			"publish_version",
			"approve_knowledge",
			"publish_knowledge_version",
			"rollback_knowledge_version",
			"edit_knowledge_draft",
			"submit_knowledge_approval",
			"view_playbook_op",
			"view_playbook_bpo",
			"view_playbook_analyst",
			"view_routing_preview",
			"view_knowledge_history",
			"view_contact_details",
			"view_contact_details",
			"view_sensitive_identity",
			"manage_user_availability",
			"manage_assignment_policies",
			"manage_permission_profiles",
			"simulate_student_generic",
			"simulate_student_real",
			"simulate_op_generic",
			"simulate_op_real",
			"simulate_view_attachments",
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
	scope_keys = list(definition.get("scope_keys") or [])
	if not scope_keys:
		result = {}
	else:
		result = {}
		for scope_key in scope_keys:
			values = value.get(scope_key)
			if values is None:
				continue
			if not isinstance(values, list):
				raise frappe.ValidationError(_("O perfil exige uma lista de escopos em {0}.").format(scope_key))
			normalized = list(
				dict.fromkeys(str(item or "").strip() for item in values if str(item or "").strip())
			)
			if normalized:
				result[scope_key] = normalized
		if not result:
			raise frappe.ValidationError(_("Selecione ao menos um escopo para o perfil."))
	knowledge_themes = value.get("knowledge_themes")
	if knowledge_themes is not None:
		if not isinstance(knowledge_themes, list):
			raise frappe.ValidationError(_("knowledge_themes deve ser uma lista."))
		result["knowledge_themes"] = list(
			dict.fromkeys(str(item or "").strip() for item in knowledge_themes if str(item or "").strip())
		)
	return result


def profile_catalog():
	return [
		{
			"key": key,
			"label": definition["label"],
			"scope_keys": list(definition.get("scope_keys") or []),
			"scope_key": (definition.get("scope_keys") or [""])[0],
			"actions": list(definition["actions"]),
		}
		for key, definition in PROFILE_DEFINITIONS.items()
	]
