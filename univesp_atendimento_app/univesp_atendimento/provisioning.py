import os

import frappe
from frappe import _

from univesp_atendimento.access_control import actions_for_profile


MIN_SECRET_LENGTH = 32
MIN_API_KEY_LENGTH = 15


def configure_bff_service_account():
	email = _required("FRAPPE_SERVICE_USER_EMAIL").strip().lower()
	api_key = _required("FRAPPE_API_KEY")
	api_secret = _required("FRAPPE_API_SECRET")
	if "@" not in email:
		frappe.throw(_("Email da conta tecnica Frappe invalido."), frappe.ValidationError)
	if len(api_key) < MIN_API_KEY_LENGTH or len(api_secret) < MIN_SECRET_LENGTH:
		frappe.throw(
			_("Credenciais da conta tecnica Frappe abaixo do tamanho minimo."), frappe.ValidationError
		)

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
	# bench execute has no HTTP transaction lifecycle; persist before the process exits.
	frappe.db.commit()  # nosemgrep
	return {"email": email, "configured": True}


def configure_initial_access_admin():
	email = _required("INITIAL_ADMIN_EMAIL").strip().lower()
	if email.count("@") != 1 or not email.endswith("@univesp.br"):
		frappe.throw(
			_("INITIAL_ADMIN_EMAIL deve ser um email institucional @univesp.br."),
			frappe.ValidationError,
		)

	existing_name = frappe.db.get_value("Univesp Access Profile", {"user_email": email}, "name")
	active_admins = frappe.db.count(
		"Univesp Access Profile", filters={"profile_key": "admin_central", "active": 1}
	)
	if active_admins:
		if existing_name:
			existing = frappe.get_doc("Univesp Access Profile", existing_name)
			if existing.profile_key == "admin_central" and existing.active:
				return {"email": email, "configured": False, "reason": "already-configured"}
		return {"email": email, "configured": False, "reason": "active-admin-exists"}

	if existing_name:
		frappe.throw(
			_("O INITIAL_ADMIN_EMAIL ja possui um perfil inativo ou incompatível."),
			frappe.ValidationError,
		)

	frappe.get_doc(
		{
			"doctype": "Univesp Access Profile",
			"user_email": email,
			"display_name": "Administrador Homologacao",
			"profile_key": "admin_central",
			"active": 1,
			"provisioning_source": "manual",
			"approved_by": "bootstrap",
			"approved_at": frappe.utils.now_datetime(),
			"scopes_json": "{}",
			"actions_json": frappe.as_json(actions_for_profile("admin_central")),
		}
	).insert(ignore_permissions=True)
	frappe.db.commit()  # nosemgrep
	return {"email": email, "configured": True, "reason": "first-active-admin"}


def _required(name):
	value = str(os.environ.get(name) or "")
	if not value:
		frappe.throw(_("Variavel obrigatoria ausente: {0}.").format(name), frappe.ValidationError)
	return value
