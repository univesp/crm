import frappe
from frappe.model.document import Document


class UnivespPublicDocument(Document):
	def validate(self):
		if not self.intake_session and not self.ticket:
			frappe.throw(
				"Documento público exige sessão de entrada ou protocolo.",
				frappe.ValidationError,
			)
		if self.scan_status not in {"quarantined", "clean", "infected", "failed"}:
			frappe.throw("Estado de verificação do documento inválido.", frappe.ValidationError)
		if int(self.size_bytes or 0) <= 0:
			frappe.throw("Documento vazio não é permitido.", frappe.ValidationError)
