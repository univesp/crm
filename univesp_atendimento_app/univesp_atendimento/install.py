import frappe
from frappe import _
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


STATUS_DEFINITIONS = (
	("Aberto", "Aberto", "Open", "Red"),
	("Em analise", "Em analise", "Open", "Orange"),
	("Aguardando aluno", "Aguardando voce", "Paused", "Yellow"),
	("Em atendimento interno", "Em atendimento", "Open", "Blue"),
	("Resolvido", "Resolvido", "Resolved", "Green"),
	("Encerrado", "Encerrado", "Resolved", "Gray"),
	("Cancelado", "Cancelado", "Resolved", "Gray"),
)


def after_install():
	setup_schema()


def after_migrate():
	setup_schema()


def setup_schema():
	if not frappe.db.exists("DocType", "HD Ticket"):
		frappe.throw(_("Frappe Helpdesk deve estar instalado antes de UNIVESP Atendimento."))

	create_custom_fields(
		{
			"HD Ticket": [
				{
					"fieldname": "custom_univesp_section",
					"label": "UNIVESP",
					"fieldtype": "Section Break",
					"insert_after": "description",
				},
				{
					"fieldname": "custom_univesp_protocol",
					"label": "Protocolo UNIVESP",
					"fieldtype": "Data",
					"unique": 1,
					"read_only": 1,
					"in_standard_filter": 1,
					"insert_after": "custom_univesp_section",
				},
				{
					"fieldname": "custom_univesp_status_code",
					"label": "Status publico",
					"fieldtype": "Data",
					"read_only": 1,
					"in_standard_filter": 1,
					"insert_after": "custom_univesp_protocol",
				},
				{
					"fieldname": "custom_univesp_source",
					"label": "Origem",
					"fieldtype": "Data",
					"insert_after": "custom_univesp_status_code",
				},
				{
					"fieldname": "custom_student_email",
					"label": "Email do aluno",
					"fieldtype": "Data",
					"options": "Email",
					"in_standard_filter": 1,
					"insert_after": "custom_univesp_source",
				},
				{
					"fieldname": "custom_student_name",
					"label": "Nome do aluno",
					"fieldtype": "Data",
					"insert_after": "custom_student_email",
				},
				{
					"fieldname": "custom_student_ra",
					"label": "RA",
					"fieldtype": "Data",
					"in_standard_filter": 1,
					"insert_after": "custom_student_name",
				},
				{
					"fieldname": "custom_student_polo",
					"label": "Polo",
					"fieldtype": "Data",
					"in_standard_filter": 1,
					"insert_after": "custom_student_ra",
				},
				{
					"fieldname": "custom_student_course",
					"label": "Curso",
					"fieldtype": "Data",
					"insert_after": "custom_student_polo",
				},
				{
					"fieldname": "custom_univesp_queue",
					"label": "Fila UNIVESP",
					"fieldtype": "Data",
					"in_standard_filter": 1,
					"insert_after": "custom_student_course",
				},
				{
					"fieldname": "custom_univesp_area",
					"label": "Area UNIVESP",
					"fieldtype": "Data",
					"in_standard_filter": 1,
					"insert_after": "custom_univesp_queue",
				},
				{
					"fieldname": "custom_univesp_context_json",
					"label": "Contexto da triagem",
					"fieldtype": "Long Text",
					"read_only": 1,
					"insert_after": "custom_univesp_area",
				},
				{
					"fieldname": "custom_source_bundle_id",
					"label": "Bundle de conhecimento",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_univesp_context_json",
				},
				{
					"fieldname": "custom_source_bundle_version_id",
					"label": "Versao do conhecimento",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_source_bundle_id",
				},
				{
					"fieldname": "custom_source_node_id",
					"label": "No de conhecimento",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_source_bundle_version_id",
				},
				{
					"fieldname": "custom_request_id",
					"label": "Request ID",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_source_node_id",
				},
			],
		},
		update=True,
	)

	for label_agent, label_customer, category, color in STATUS_DEFINITIONS:
		if frappe.db.exists("HD Ticket Status", {"label_agent": label_agent}):
			continue
		frappe.get_doc(
			{
				"doctype": "HD Ticket Status",
				"label_agent": label_agent,
				"different_view": int(label_agent != label_customer),
				"label_customer": label_customer if label_agent != label_customer else "",
				"category": category,
				"color": color,
				"enabled": 1,
			}
		).insert(ignore_permissions=True)
