import json

import frappe
from frappe import _
from frappe.model.document import Document


ALLOWED_STEPS = {"op", "bpo", "area", "triage"}


class UnivespKnowledgeRoutingPattern(Document):
	def validate(self):
		steps = self._list("steps_json")
		routing_keys = self._list("allowed_routing_keys_json")
		self._list("institutional_exceptions_json")
		if not steps or any(step not in ALLOWED_STEPS for step in steps):
			frappe.throw(_("Padrão contém etapa de roteamento inválida."), frappe.ValidationError)
		if bool(self.bpo_enabled) != ("bpo" in steps):
			frappe.throw(_("Indicador BPO deve corresponder às etapas do padrão."), frappe.ValidationError)
		if not routing_keys:
			frappe.throw(_("Informe ao menos uma rota permitida."), frappe.ValidationError)

	def _list(self, fieldname):
		try:
			value = json.loads(self.get(fieldname) or "[]")
		except (TypeError, json.JSONDecodeError) as exc:
			raise frappe.ValidationError(_("Campo {0} deve ser JSON válido.").format(fieldname)) from exc
		if not isinstance(value, list) or any(
			not isinstance(item, str) or not item.strip() for item in value
		):
			frappe.throw(
				_("Campo {0} deve ser uma lista de textos.").format(fieldname), frappe.ValidationError
			)
		normalized = list(dict.fromkeys(item.strip() for item in value))
		self.set(fieldname, json.dumps(normalized, ensure_ascii=False))
		return normalized
