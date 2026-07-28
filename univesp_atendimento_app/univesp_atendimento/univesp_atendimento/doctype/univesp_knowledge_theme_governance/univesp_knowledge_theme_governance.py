import re

import frappe
from frappe import _
from frappe.model.document import Document


KEY_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class UnivespKnowledgeThemeGovernance(Document):
	def validate(self):
		self.theme_key = str(self.theme_key or "").strip().lower()
		self.theme_label = str(self.theme_label or "").strip()
		self.owner_email = str(self.owner_email or "").strip().lower()
		if not KEY_PATTERN.fullmatch(self.theme_key):
			frappe.throw(_("Chave do tema deve usar letras minúsculas, números e hífen."), frappe.ValidationError)
		if self.suggestion_sla_hours and int(self.suggestion_sla_hours) < 1:
			frappe.throw(_("SLA de sugestões deve ser maior que zero."), frappe.ValidationError)
		seen = set()
		for area in self.editor_areas or []:
			area.area_key = str(area.area_key or "").strip().lower()
			if not area.area_key or area.area_key in seen:
				frappe.throw(_("Áreas editoras devem ter chaves únicas."), frappe.ValidationError)
			seen.add(area.area_key)
