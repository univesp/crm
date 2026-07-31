import frappe
from frappe import _
from frappe.model.document import Document


class UnivespKnowledgeBundle(Document):
	def validate(self):
		self.bundle_key = str(self.bundle_key or "").strip().lower()
		self.title = str(self.title or "").strip()
		if self.audience_profile not in {"student", "public", "mixed", "internal"}:
			frappe.throw(_("Público do fluxo inválido."), frappe.ValidationError)
		if self.status not in {"active", "archived"}:
			frappe.throw(_("Estado do fluxo inválido."), frappe.ValidationError)
		self._validate_version_pointer("draft_version", {"draft", "pending_approval"})
		self._validate_version_pointer("published_version", {"published"})

	def on_trash(self):
		if self.published_version or frappe.db.exists(
			"Univesp Knowledge Version",
			{"bundle": self.name, "lifecycle_state": ["in", ["published", "superseded"]]},
		):
			frappe.throw(
				_("Fluxo já publicado não pode ser excluído. Arquive-o."),
				frappe.PermissionError,
			)

	def _validate_version_pointer(self, fieldname, allowed_states):
		version_name = str(self.get(fieldname) or "").strip()
		if not version_name:
			return
		version = frappe.db.get_value(
			"Univesp Knowledge Version",
			version_name,
			["bundle", "lifecycle_state"],
			as_dict=True,
		)
		if not version or version.bundle != self.name or version.lifecycle_state not in allowed_states:
			frappe.throw(_("Referência de versão inconsistente no fluxo."), frappe.ValidationError)
