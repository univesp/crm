import frappe
from frappe.model.document import Document


class UnivespPublicDocument(Document):
	def validate(self):
		if self.scan_status not in {"quarantined", "clean", "infected", "failed"}:
			frappe.throw("Estado de verificação do documento inválido.", frappe.ValidationError)
		if int(self.size_bytes or 0) <= 0:
			frappe.throw("Documento vazio não é permitido.", frappe.ValidationError)
