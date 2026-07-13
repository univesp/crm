import frappe

from univesp_atendimento.api.v1.common import get_request_context, response


@frappe.whitelist(methods=["GET"])
def list_queues():
	context = get_request_context("view_ticket")
	allowed = set(context.scopes.get("queues") or context.scopes.get("filas") or [])
	rows = frappe.get_all(
		"HD Team",
		filters={"disabled": 0},
		fields=["name", "team_name"],
		order_by="team_name asc",
	)
	data = [
		{"id": row.name, "label": row.team_name or row.name}
		for row in rows
		if context.profile_key == "admin_central" or row.name in allowed or row.team_name in allowed
	]
	return response(data, request_id=context.request_id)
