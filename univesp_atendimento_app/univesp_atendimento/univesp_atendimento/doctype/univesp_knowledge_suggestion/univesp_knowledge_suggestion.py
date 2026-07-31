import frappe
from frappe import _
from frappe.model.document import Document


class UnivespKnowledgeSuggestion(Document):
	def validate(self):
		if self.state not in {"received", "in_review", "incorporated", "rejected"}:
			raise frappe.ValidationError(_("Estado de sugestão inválido."))
		if self.audience_layer not in {"student", "public", "op", "bpo", "analyst"}:
			raise frappe.ValidationError(_("Camada da sugestão inválida."))
		if not str(self.reason or "").strip():
			raise frappe.ValidationError(_("Motivo da sugestão é obrigatório."))
		if self.state == "rejected" and not str(self.review_notes or "").strip():
			raise frappe.ValidationError(_("Explique por que a sugestão foi recusada."))
