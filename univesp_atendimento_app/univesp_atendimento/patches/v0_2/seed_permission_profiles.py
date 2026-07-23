import json

import frappe

from univesp_atendimento.access_control import PROFILE_DEFINITIONS, actions_for_profile


def execute():
	if frappe.db.exists("DocType", "Univesp Permission Profile"):
		for profile_key, definition in PROFILE_DEFINITIONS.items():
			if not frappe.db.exists("Univesp Permission Profile", profile_key):
				frappe.get_doc(
					{
						"doctype": "Univesp Permission Profile",
						"profile_key": profile_key,
						"label": definition["label"],
						"base_persona": profile_key,
						"scope_type": definition["scope_key"],
						"capabilities_json": json.dumps(definition["actions"]),
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
