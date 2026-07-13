import frappe

from univesp_atendimento.api.v1.common import get_request_context, response


@frappe.whitelist(methods=["GET"])
def published(search=None, limit=50):
	context = get_request_context()
	filters = {}
	if search:
		filters["title"] = ["like", f"%{str(search).strip()}%"]
	rows = frappe.get_all(
		"HD Article",
		filters=filters,
		fields=["name as id", "title", "description", "modified as updated_at"],
		order_by="modified desc",
		page_length=min(max(int(limit), 1), 100),
	)
	return response(rows, request_id=context.request_id)
