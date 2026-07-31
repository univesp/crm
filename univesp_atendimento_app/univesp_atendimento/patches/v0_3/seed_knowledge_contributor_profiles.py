import json

import frappe

from univesp_atendimento.access_control import PROFILE_DEFINITIONS, actions_for_profile


PROFILES = (
	{
		"profile_key": "faq-contributor-op",
		"label": "OP — sugerir melhorias em FAQs",
		"base_persona": "op",
		"scope_type": "queues",
	},
	{
		"profile_key": "faq-contributor-bpo",
		"label": "BPO — sugerir melhorias em FAQs",
		"base_persona": "op_externo",
		"scope_type": "regional_pools",
	},
)


def execute():
	if not frappe.db.exists("DocType", "Univesp Permission Profile"):
		return
	for profile_key, definition in PROFILE_DEFINITIONS.items():
		if frappe.db.exists("Univesp Permission Profile", profile_key):
			frappe.db.set_value(
				"Univesp Permission Profile",
				profile_key,
				"capabilities_json",
				json.dumps(definition["actions"]),
				update_modified=False,
			)
	for values in PROFILES:
		if frappe.db.exists("Univesp Permission Profile", values["profile_key"]):
			continue
		frappe.get_doc(
			{
				"doctype": "Univesp Permission Profile",
				**values,
				"capabilities_json": json.dumps(["suggest_knowledge"]),
				"active": 1,
				"system_profile": 1,
			}
		).insert(ignore_permissions=True)
	if not frappe.db.exists("DocType", "Univesp Access Profile"):
		return
	for row in frappe.get_all(
		"Univesp Access Profile",
		fields=["name", "profile_key"],
		limit_page_length=0,
	):
		if row.profile_key in PROFILE_DEFINITIONS:
			frappe.db.set_value(
				"Univesp Access Profile",
				row.name,
				"actions_json",
				json.dumps(actions_for_profile(row.profile_key)),
				update_modified=False,
			)
