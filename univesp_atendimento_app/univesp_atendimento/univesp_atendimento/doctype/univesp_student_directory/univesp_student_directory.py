import re

import frappe
from frappe.model.document import Document
from frappe import _


def normalize_cpf(value: str) -> str:
	return re.sub(r"[^0-9]", "", str(value or ""))


class UnivespStudentDirectory(Document):
	def validate(self):
		self.email = str(self.email or "").strip().lower()
		self.cpf = normalize_cpf(self.cpf)
		self.ra = str(self.ra or "").strip()
		self.nome = str(self.nome or "").strip()
		self.polo_id = str(self.polo_id or "").strip()
		if not self.email or "@" not in self.email:
			frappe.throw(_("Email invalido."), frappe.ValidationError)
		if len(self.cpf) != 11:
			frappe.throw(_("CPF invalido."), frappe.ValidationError)
		if not self.ra or not self.polo_id:
			frappe.throw(_("RA e polo sao obrigatorios."), frappe.ValidationError)
