import os

import frappe
from frappe import _


MIN_SECRET_LENGTH = 32
MIN_API_KEY_LENGTH = 15


def configure_bff_service_account():
	email = _required("FRAPPE_SERVICE_USER_EMAIL").strip().lower()
	api_key = _required("FRAPPE_API_KEY")
	api_secret = _required("FRAPPE_API_SECRET")
	if "@" not in email:
		frappe.throw(_("Email da conta tecnica Frappe invalido."), frappe.ValidationError)
	if len(api_key) < MIN_API_KEY_LENGTH or len(api_secret) < MIN_SECRET_LENGTH:
		frappe.throw(_("Credenciais da conta tecnica Frappe abaixo do tamanho minimo."), frappe.ValidationError)

	if frappe.db.exists("User", email):
		user = frappe.get_doc("User", email)
	else:
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": email,
				"first_name": "UNIVESP BFF",
				"enabled": 1,
				"user_type": "System User",
				"send_welcome_email": 0,
			}
		).insert(ignore_permissions=True)

	user.enabled = 1
	user.api_key = api_key
	user.api_secret = api_secret
	user.save(ignore_permissions=True)
	frappe.db.commit()
	return {"email": email, "configured": True}


def _required(name):
	value = str(os.environ.get(name) or "")
	if not value:
		frappe.throw(_("Variavel obrigatoria ausente: {0}.").format(name), frappe.ValidationError)
	return value