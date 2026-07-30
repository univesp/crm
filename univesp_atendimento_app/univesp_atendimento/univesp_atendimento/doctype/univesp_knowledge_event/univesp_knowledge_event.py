import json

import frappe
from frappe import _
from frappe.model.document import Document


ALLOWED_EVENTS = {
	"faq.session_started",
	"faq.node_viewed",
	"faq.path_advanced",
	"faq.resolution_confirmed",
	"faq.resolved_without_ticket",
	"faq.ticket_open_started",
	"protocol.created",
	"case.knowledge_applied",
}


class UnivespKnowledgeEvent(Document):
	def validate(self):
		if self.event_name not in ALLOWED_EVENTS:
			frappe.throw(_("Evento de conhecimento inválido."), frappe.ValidationError)
		if self.audience_layer not in {"student", "public", "op", "bpo", "analyst"}:
			frappe.throw(_("Camada de audiência inválida."), frappe.ValidationError)
		if self.origin not in {"portal", "publico", "op_assisted"}:
			frappe.throw(_("Origem do evento inválida."), frappe.ValidationError)
		try:
			metadata = json.loads(self.metadata_json or "{}")
		except (TypeError, json.JSONDecodeError) as exc:
			raise frappe.ValidationError(_("Metadados do evento devem ser JSON.")) from exc
		if not isinstance(metadata, dict):
			frappe.throw(_("Metadados do evento devem ser objeto JSON."), frappe.ValidationError)
		if not self.is_new():
			frappe.throw(_("Eventos de conhecimento são imutáveis."), frappe.PermissionError)

	def on_trash(self):
		if not getattr(self.flags, "knowledge_retention_delete", False):
			frappe.throw(_("Evento só pode ser removido pelo job de retenção."), frappe.PermissionError)
