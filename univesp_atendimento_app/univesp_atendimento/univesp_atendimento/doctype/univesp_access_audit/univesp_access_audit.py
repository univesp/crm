import frappe
from frappe import _
from frappe.model.document import Document


class UnivespAccessAudit(Document):
	def validate(self):
		if not self.is_new():
			frappe.throw(_("Auditoria de acesso e imutavel."), frappe.PermissionError)

	def on_trash(self):
		frappe.throw(_("Auditoria de acesso nao pode ser excluida."), frappe.PermissionError)
