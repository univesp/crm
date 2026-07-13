import frappe

from univesp_atendimento.api.v1.common import get_request_context, response


@frappe.whitelist()
def get_context():
	context = get_request_context()
	return response(
		{
			"user": {
				"email": context.email,
				"display_name": context.name,
				"ra": context.ra,
			},
			"profile": {"key": context.profile_key},
			"scopes": context.scopes,
			"actions": sorted(context.actions),
		},
		request_id=context.request_id,
	)
