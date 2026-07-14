import frappe
from frappe.utils import now_datetime

from univesp_atendimento.api.v1.common import response, verify_signed_identity


@frappe.whitelist()
def get_context():
	identity = verify_signed_identity()
	request_id = frappe.get_request_header("X-Request-ID") or ""
	profile_name = frappe.db.get_value(
		"Univesp Access Profile", {"user_email": identity["email"]}, "name"
	)
	if not profile_name:
		request = _touch_access_request(identity)
		return response(
			{
				"user": _session_user(identity),
				"profile": None,
				"scopes": {},
				"actions": [],
				"access": {"status": request.status.lower(), "request_id": request.name},
			},
			request_id=request_id,
		)

	profile = frappe.get_doc("Univesp Access Profile", profile_name)
	if not profile.active:
		return response(
			{
				"user": _session_user(identity, profile),
				"profile": None,
				"scopes": {},
				"actions": [],
				"access": {"status": "disabled"},
			},
			request_id=request_id,
		)

	now = now_datetime()
	values = {"last_login_at": now}
	if not profile.first_login_at:
		values["first_login_at"] = now
	frappe.db.set_value("Univesp Access Profile", profile.name, values, update_modified=False)
	if frappe.db.exists("Univesp Access Request", identity["email"]):
		frappe.db.set_value(
			"Univesp Access Request",
			identity["email"],
			{"status": "Approved", "resolved_at": now},
			update_modified=False,
		)
	return response(
		{
			"user": _session_user(identity, profile),
			"profile": {"key": profile.profile_key},
			"scopes": frappe.parse_json(profile.scopes_json or "{}"),
			"actions": frappe.parse_json(profile.actions_json or "[]"),
			"access": {"status": "active"},
		},
		request_id=request_id,
	)


def _session_user(identity, profile=None):
	return {
		"email": identity["email"],
		"display_name": identity.get("name") or getattr(profile, "display_name", "") or identity["email"],
		"ra": identity.get("ra") or getattr(profile, "ra", "") or "",
	}


def _touch_access_request(identity):
	now = now_datetime()
	name = frappe.db.exists("Univesp Access Request", identity["email"])
	if name:
		doc = frappe.get_doc("Univesp Access Request", name)
		doc.display_name = identity.get("name") or doc.display_name or identity["email"]
		doc.ra = identity.get("ra") or doc.ra
		doc.identity_flow = identity.get("flow") or doc.identity_flow
		doc.last_seen_at = now
		doc.attempt_count = int(doc.attempt_count or 0) + 1
		doc.save(ignore_permissions=True)
		return doc
	return frappe.get_doc(
		{
			"doctype": "Univesp Access Request",
			"user_email": identity["email"],
			"display_name": identity.get("name") or identity["email"],
			"ra": identity.get("ra") or "",
			"identity_flow": identity.get("flow") or "",
			"status": "Pending",
			"first_seen_at": now,
			"last_seen_at": now,
			"attempt_count": 1,
		}
	).insert(ignore_permissions=True)
