import frappe
from frappe.model.document import Document


class UnivespPublicIntake(Document):
	def validate(self):
		if self.state not in {"pending", "ready", "finalized", "expired", "failed"}:
			frappe.throw("Estado da sessão pública inválido.", frappe.ValidationError)
		if self.state == "finalized" and not self.finalized_ticket:
			frappe.throw("Sessão finalizada exige protocolo vinculado.", frappe.ValidationError)
