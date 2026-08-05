import frappe
from frappe import _

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


@frappe.whitelist(methods=["GET"])
def list_area_members(area: str):
	context = get_request_context("assign_ticket")
	if context.profile_key not in {"gestor_area", "admin_central"}:
		raise frappe.PermissionError(_("Somente gestor de area pode consultar responsaveis."))
	area_name = str(area or "").strip()
	if not area_name:
		frappe.throw(_("Area obrigatoria."), frappe.ValidationError)
	if context.profile_key != "admin_central" and area_name not in set(context.scopes.get("areas") or []):
		raise frappe.PermissionError(_("Area fora do escopo institucional ativo."))

	rows = frappe.get_all(
		"Univesp Access Profile",
		filters={"active": 1, "profile_key": ["in", ["analista_area", "gestor_area"]]},
		fields=["user_email", "display_name", "profile_key", "scopes_json"],
		order_by="display_name asc",
		page_length=500,
	)
	members = []
	for row in rows:
		scopes = frappe.parse_json(row.scopes_json or "{}")
		if area_name not in set(scopes.get("areas") or []):
			continue
		members.append(
			{
				"profile_id": row.name,
				"email": row.user_email,
				"display_name": row.display_name or row.user_email,
				"profile_key": row.profile_key,
			}
		)
	return response(members, request_id=context.request_id)
