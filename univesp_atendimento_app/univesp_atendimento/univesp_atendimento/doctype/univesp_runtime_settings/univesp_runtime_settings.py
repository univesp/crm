import frappe
from frappe import _
from frappe.model.document import Document


class UnivespRuntimeSettings(Document):
	def validate(self):
		self.institutional_timezone = str(self.institutional_timezone or "America/Sao_Paulo").strip()
		if int(self.knowledge_session_ttl_seconds or 0) < 300:
			frappe.throw(_("Sessão FAQ deve durar ao menos 300 segundos."), frappe.ValidationError)
		if int(self.default_suggestion_sla_hours or 0) < 1:
			frappe.throw(_("SLA padrão de sugestões deve ser maior que zero."), frappe.ValidationError)
