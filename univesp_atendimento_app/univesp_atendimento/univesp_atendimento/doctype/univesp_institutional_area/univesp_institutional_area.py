import frappe
from frappe.model.document import Document


class UnivespInstitutionalArea(Document):
	def validate(self):
		self.area_key = str(self.area_key or "").strip().lower()
		self.area_label = str(self.area_label or self.area_key or "").strip()
		if not self.area_key:
			frappe.throw("Chave da area e obrigatoria.")
		if not self.area_label:
			frappe.throw("Nome da area e obrigatorio.")
