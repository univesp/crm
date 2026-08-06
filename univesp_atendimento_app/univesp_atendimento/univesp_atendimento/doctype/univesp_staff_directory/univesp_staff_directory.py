import frappe
from frappe import _
from frappe.model.document import Document


def build_staff_key(email: str, polo_id: str) -> str:
	return f"{str(email or '').strip().lower()}|{str(polo_id or '').strip()}"


class UnivespStaffDirectory(Document):
	def validate(self):
		self.email = str(self.email or "").strip().lower()
		self.nome = str(self.nome or "").strip()
		self.polo_id = str(self.polo_id or "").strip()
		if not self.email or "@" not in self.email:
			frappe.throw(_("Email SSO invalido."), frappe.ValidationError)
		if not self.polo_id:
			frappe.throw(_("Polo ID obrigatorio."), frappe.ValidationError)
		self.staff_key = build_staff_key(self.email, self.polo_id)
