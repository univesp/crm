import json

import frappe
from frappe import _
from frappe.model.document import Document

from univesp_atendimento.api.v1.common import ALLOWED_PROFILES


class UnivespAccessProfile(Document):
	def validate(self):
		self.user_email = str(self.user_email or "").strip().lower()
		if self.profile_key not in ALLOWED_PROFILES:
			frappe.throw(_("Perfil institucional invalido."))
		_validate_json(self.scopes_json, dict, "Escopos")
		_validate_json(self.actions_json, list, "Acoes")


def _validate_json(value, expected_type, label):
	try:
		parsed = json.loads(value or ("{}" if expected_type is dict else "[]"))
	except json.JSONDecodeError as exc:
		frappe.throw(f"{label}: JSON invalido.")
		raise exc
	if not isinstance(parsed, expected_type):
		frappe.throw(f"{label}: formato JSON invalido.")
