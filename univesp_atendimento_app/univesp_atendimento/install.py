import frappe
from frappe import _
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from univesp_atendimento.access_control import actions_for_profile


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
					"fieldname": "custom_visitor_phone",
					"label": "Celular para contato",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_student_name",
				},
				{
					"fieldname": "custom_visitor_cpf",
					"label": "CPF protegido",
					"fieldtype": "Password",
					"read_only": 1,
					"hidden": 1,
					"insert_after": "custom_visitor_phone",
				},
				{
					"fieldname": "custom_student_ra",
					"label": "RA",
					"fieldtype": "Data",
					"in_standard_filter": 1,
					"insert_after": "custom_visitor_cpf",
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
					"fieldname": "custom_univesp_assignee_email",
					"label": "Responsavel institucional",
					"fieldtype": "Data",
					"options": "Email",
					"in_standard_filter": 1,
					"insert_after": "custom_univesp_area",
				},
				{
					"fieldname": "custom_univesp_assignee_name",
					"label": "Nome do responsavel",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_univesp_assignee_email",
				},
				{
					"fieldname": "custom_univesp_context_json",
					"label": "Contexto da triagem",
					"fieldtype": "Long Text",
					"read_only": 1,
					"insert_after": "custom_univesp_assignee_name",
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
					"fieldname": "custom_source_path_json",
					"label": "Caminho da FAQ",
					"fieldtype": "Long Text",
					"read_only": 1,
					"insert_after": "custom_source_node_id",
				},
				{
					"fieldname": "custom_source_audience",
					"label": "Camada da FAQ",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_source_path_json",
				},
				{
					"fieldname": "custom_faq_session_id",
					"label": "Sessão da FAQ",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_source_audience",
				},
				{
					"fieldname": "custom_request_id",
					"label": "Request ID",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "custom_faq_session_id",
				},
				{
					"fieldname": "custom_channel_metadata_json",
					"label": "Metadados do canal",
					"fieldtype": "Long Text",
					"read_only": 1,
					"insert_after": "custom_request_id",
				},
				{
					"fieldname": "custom_ai_suggestion_json",
					"label": "Sugestao IA",
					"fieldtype": "Long Text",
					"read_only": 1,
					"insert_after": "custom_channel_metadata_json",
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

	if frappe.db.exists("DocType", "Univesp Access Profile"):
		for profile in frappe.get_all("Univesp Access Profile", fields=["name", "profile_key"]):
			frappe.db.set_value(
				"Univesp Access Profile",
				profile.name,
				"actions_json",
				frappe.as_json(actions_for_profile(profile.profile_key)),
				update_modified=False,
			)

	seed_knowledge_v3_configuration()


def seed_knowledge_v3_configuration():
	if frappe.db.exists("DocType", "Univesp Runtime Settings"):
		settings = frappe.get_single("Univesp Runtime Settings")
		settings.institutional_timezone = settings.institutional_timezone or "America/Sao_Paulo"
		settings.knowledge_session_ttl_seconds = settings.knowledge_session_ttl_seconds or 7200
		settings.default_suggestion_sla_hours = settings.default_suggestion_sla_hours or 72
		settings.save(ignore_permissions=True)

	if not frappe.db.exists("DocType", "Univesp Knowledge Routing Pattern"):
		return
	active_queue_keys = set(
		frappe.get_all("HD Team", filters={"disabled": 0}, pluck="name", limit_page_length=0)
	)
	allowed_routing_keys = sorted(active_queue_keys | {"atendimento-geral", "sra"})
	patterns = (
		("op_then_area", "OP → Área/Analista", 0, ["op", "area"]),
		("op_bpo_area", "OP → BPO → Área", 1, ["op", "bpo", "area"]),
		("bpo_op_area", "BPO → OP → Área", 1, ["bpo", "op", "area"]),
		("direct_area", "Área direta", 0, ["area"]),
		("institutional_triage", "Triagem Central → equipe", 0, ["triage", "area"]),
	)
	for pattern_key, label, bpo_enabled, steps in patterns:
		if frappe.db.exists("Univesp Knowledge Routing Pattern", pattern_key):
			doc = frappe.get_doc("Univesp Knowledge Routing Pattern", pattern_key)
			existing_keys = set(frappe.parse_json(doc.allowed_routing_keys_json or "[]"))
			next_keys = existing_keys | set(allowed_routing_keys)
			if next_keys != existing_keys:
				doc.allowed_routing_keys_json = frappe.as_json(sorted(next_keys))
				doc.save(ignore_permissions=True)
			continue
		frappe.get_doc(
			{
				"doctype": "Univesp Knowledge Routing Pattern",
				"pattern_key": pattern_key,
				"label": label,
				"bpo_enabled": bpo_enabled,
				"steps_json": frappe.as_json(steps),
				"allowed_routing_keys_json": frappe.as_json(allowed_routing_keys),
				"institutional_exceptions_json": frappe.as_json(["provas", "critica"]),
				"active": 1,
			}
		).insert(ignore_permissions=True)
