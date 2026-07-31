import frappe
from frappe import _
from frappe.model.document import Document


class UnivespAccessRequest(Document):
	def validate(self):
		self.user_email = str(self.user_email or "").strip().lower()
		if not self.user_email or "@" not in self.user_email:
			frappe.throw(_("Email institucional invalido."), frappe.ValidationError)

	def on_trash(self):
		frappe.throw(_("Solicitacoes de acesso nao podem ser excluidas."), frappe.PermissionError)
