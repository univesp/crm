import json

import frappe
from frappe.model.document import Document


class UnivespKnowledgeAsset(Document):
	def on_trash(self):
		for row in frappe.get_all(
			"Univesp Knowledge Version",
			filters={"payload_json": ["like", f"%{self.asset_key}%"]},
			fields=["name", "payload_json"],
		):
			try:
				payload = json.loads(row.payload_json or "{}")
			except (TypeError, ValueError):
				continue
			if _payload_references_asset(payload, self.asset_key):
				frappe.throw("Asset referenciado por uma versão de conhecimento não pode ser excluído.")


def _payload_references_asset(value, asset_key):
	if isinstance(value, dict):
		if value.get("asset_id") == asset_key:
			return True
		return any(_payload_references_asset(item, asset_key) for item in value.values())
	if isinstance(value, list):
		return any(_payload_references_asset(item, asset_key) for item in value)
	return False
