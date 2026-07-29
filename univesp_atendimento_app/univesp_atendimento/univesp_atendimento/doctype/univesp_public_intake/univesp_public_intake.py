import frappe
from frappe import _
from frappe.model.document import Document


class UnivespPublicIntake(Document):
	def validate(self):
		if self.state not in {"pending", "ready", "finalized", "expired", "failed"}:
			frappe.throw(_("Estado da sessão pública inválido."), frappe.ValidationError)
		if self.state == "finalized" and not self.finalized_ticket:
			frappe.throw(_("Sessão finalizada exige protocolo vinculado."), frappe.ValidationError)
