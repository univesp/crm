import json

import frappe
from frappe import _
from frappe.model.document import Document

from univesp_atendimento.access_control import actions_for_profile, normalize_scopes


class UnivespAccessProfile(Document):
	def validate(self):
		self.user_email = str(self.user_email or "").strip().lower()
		if not self.user_email or "@" not in self.user_email:
			frappe.throw(_("Email institucional invalido."), frappe.ValidationError)
		self.scopes_json = json.dumps(normalize_scopes(self.profile_key, self.scopes_json), ensure_ascii=False)
		self.actions_json = json.dumps(actions_for_profile(self.profile_key), ensure_ascii=False)

	def on_trash(self):
		frappe.throw(_("Usuarios nao podem ser excluidos; desative o acesso."), frappe.PermissionError)
