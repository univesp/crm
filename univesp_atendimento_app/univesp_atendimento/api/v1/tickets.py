import json
from datetime import datetime

import frappe
from frappe import _
from frappe.utils import cint, now_datetime
from frappe.utils.file_manager import save_file

from univesp_atendimento.api.v1.common import (
	ensure_ticket_access,
	get_request_context,
	resolve_ticket_name,
	response,
	ticket_scope_filters,
)


STATUS_LABELS = {
	"open": "Aberto",
	"in_analysis": "Em analise",
	"waiting_student": "Aguardando aluno",
	"waiting_internal": "Em atendimento interno",
	"resolved": "Resolvido",
	"closed": "Encerrado",
	"cancelled": "Cancelado",
}

PRIORITY_LABELS = {
	"low": "Low",
	"baixa": "Low",
	"medium": "Medium",
	"media": "Medium",
	"high": "High",
	"alta": "High",
	"urgent": "Urgent",
	"urgente": "Urgent",
}

TRANSITIONS = {
	"open": {"in_analysis", "cancelled"},
	"in_analysis": {"waiting_student", "waiting_internal", "resolved", "cancelled"},
	"waiting_student": {"in_analysis", "cancelled"},
	"waiting_internal": {"in_analysis", "waiting_student", "resolved", "cancelled"},
	"resolved": {"in_analysis", "closed"},
	"closed": set(),
	"cancelled": set(),
}

TICKET_FIELDS = [
	"name",
	"subject",
	"description",
	"status",
	"priority",
	"creation",
	"modified",
	"custom_univesp_protocol",
	"custom_univesp_status_code",
	"custom_univesp_source",
	"custom_student_email",
	"custom_student_name",
	"custom_student_ra",
	"custom_student_polo",
	"custom_student_course",
	"custom_univesp_queue",
	"custom_univesp_area",
	"custom_univesp_context_json",
	"custom_source_bundle_id",
	"custom_source_bundle_version_id",
	"custom_source_node_id",
]


@frappe.whitelist(methods=["POST"])
def create(payload: dict | str | None = None):
	context = get_request_context("create_ticket")
	data = _payload(payload)
	student = data.get("student") if isinstance(data.get("student"), dict) else {}
	knowledge = data.get("knowledge") if isinstance(data.get("knowledge"), dict) else {}
	queue = str(data.get("queue") or "").strip()
	area = str(data.get("area") or "").strip()

	if context.profile_key == "aluno":
		student = {**student, "email": context.email, "name": context.name, "ra": context.ra}
	elif context.profile_key not in {"op", "gestor_polos", "admin_central"}:
		raise frappe.PermissionError(_("Seu perfil nao pode abrir atendimento em nome do aluno."))

	_subject = str(data.get("subject") or "").strip()
	_description = str(data.get("description") or "").strip()
	if not _subject or not _description:
		frappe.throw(_("Assunto e descricao sao obrigatorios."), frappe.ValidationError)

	doc = frappe.get_doc(
		{
			"doctype": "HD Ticket",
			"subject": _subject,
			"description": _description,
			"raised_by": student.get("email") or context.email,
			"priority": _priority_name(data.get("priority")),
			"status": _status_name("open"),
			"custom_univesp_status_code": "open",
			"custom_univesp_source": str(data.get("source") or "portal"),
			"custom_student_email": str(student.get("email") or context.email).lower(),
			"custom_student_name": str(student.get("name") or context.name),
			"custom_student_ra": str(student.get("ra") or ""),
			"custom_student_polo": str(student.get("polo") or ""),
			"custom_student_course": str(student.get("course") or ""),
			"custom_univesp_queue": queue,
			"agent_group": queue if queue and frappe.db.exists("HD Team", queue) else None,
			"custom_univesp_area": area,
			"custom_univesp_context_json": json.dumps(data.get("triage") or {}, ensure_ascii=False),
			"custom_source_bundle_id": str(knowledge.get("bundle_id") or ""),
			"custom_source_bundle_version_id": str(knowledge.get("bundle_version_id") or ""),
			"custom_source_node_id": str(knowledge.get("node_id") or knowledge.get("flow_id") or ""),
			"custom_request_id": context.request_id,
		}
	).insert(ignore_permissions=True)
	doc.custom_univesp_protocol = _public_protocol(doc.name, doc.creation)
	doc.save(ignore_permissions=True)
	return response(_serialize_ticket(doc), request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def list_tickets(
	page: int | str = 1,
	page_size: int | str = 25,
	status: str | None = None,
	search: str | None = None,
):
	context = get_request_context("view_ticket")
	page = max(cint(page), 1)
	page_size = min(max(cint(page_size), 1), 100)
	filters = ticket_scope_filters(context)
	if status:
		filters.append(["HD Ticket", "custom_univesp_status_code", "=", str(status)])
	if search:
		term = f"%{str(search).strip()}%"
		filters.append(["HD Ticket", "subject", "like", term])

	rows = frappe.get_all(
		"HD Ticket",
		filters=filters,
		fields=TICKET_FIELDS,
		order_by="modified desc",
		start=(page - 1) * page_size,
		page_length=page_size,
	)
	total = frappe.db.count("HD Ticket", filters=filters)
	return response(
		[_serialize_ticket(row) for row in rows],
		meta={"page": page, "page_size": page_size, "total": total},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def get(ticket_id: str):
	context = get_request_context("view_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	doc = frappe.get_doc("HD Ticket", name)
	result = _serialize_ticket(doc)
	result["timeline"] = _ticket_timeline(name)
	result["attachments"] = _ticket_attachments(name)
	return response(result, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def add_message(ticket_id: str, message: str | None = None):
	context = get_request_context("reply_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	text = str(message or _payload().get("message") or "").strip()
	if not text:
		frappe.throw(_("Mensagem obrigatoria."), frappe.ValidationError)
	comment = frappe.get_doc(
		{
			"doctype": "Comment",
			"comment_type": "Comment",
			"reference_doctype": "HD Ticket",
			"reference_name": name,
			"content": text,
			"comment_email": context.email,
			"comment_by": context.name,
		}
	).insert(ignore_permissions=True)
	return response({"id": comment.name, "created_at": comment.creation}, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def attach(ticket_id: str):
	context = get_request_context("attach_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	files = getattr(frappe.request, "files", None)
	uploads = files.getlist("files") if files and hasattr(files, "getlist") else list((files or {}).values())
	if not uploads:
		frappe.throw(_("Nenhum arquivo enviado."), frappe.ValidationError)
	created = []
	for uploaded in uploads:
		file_doc = save_file(uploaded.filename, uploaded.stream.read(), "HD Ticket", name, is_private=1)
		created.append({"id": file_doc.name, "file_name": file_doc.file_name})
	return response(created, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def assign(ticket_id: str, assignee: str | None = None, queue: str | None = None):
	context = get_request_context("assign_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	doc = frappe.get_doc("HD Ticket", name)
	if queue:
		doc.custom_univesp_queue = str(queue).strip()
		doc.agent_group = str(queue).strip() if frappe.db.exists("HD Team", str(queue).strip()) else None
	if assignee:
		from frappe.desk.form.assign_to import add

		add({"doctype": "HD Ticket", "name": name, "assign_to": [str(assignee)]})
	doc.save(ignore_permissions=True)
	return response(_serialize_ticket(doc), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def transition(ticket_id: str, status: str | None = None, message: str | None = None):
	context = get_request_context("transition_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	doc = frappe.get_doc("HD Ticket", name)
	target = str(status or _payload().get("status") or "").strip()
	current = doc.custom_univesp_status_code or "open"
	if target not in TRANSITIONS.get(current, set()):
		frappe.throw(_("Transicao de status nao permitida."), frappe.ValidationError)
	if context.profile_key == "aluno" and not (current == "waiting_student" and target == "in_analysis"):
		raise frappe.PermissionError(_("Aluno nao pode executar esta transicao."))
	doc.status = _status_name(target)
	doc.custom_univesp_status_code = target
	doc.save(ignore_permissions=True)
	if message:
		doc.add_comment("Comment", text=str(message))
	return response(_serialize_ticket(doc), request_id=context.request_id)


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value:
		return json.loads(value)
	return frappe.form_dict or {}


def _status_name(status_code):
	label = STATUS_LABELS.get(status_code)
	name = frappe.db.get_value("HD Ticket Status", {"label_agent": label}, "name")
	if not name:
		frappe.throw(_("Status do Helpdesk nao configurado: {0}").format(label))
	return name


def _priority_name(value):
	normalized = str(value or "medium").strip().lower()
	return PRIORITY_LABELS.get(normalized, "Medium")


def _public_protocol(name, creation):
	date_value = creation if isinstance(creation, datetime) else now_datetime()
	return f"UVSP-{date_value:%Y%m%d}-{str(name).zfill(6)}"


def _serialize_ticket(ticket):
	value = ticket.as_dict() if hasattr(ticket, "as_dict") else ticket
	return {
		"id": value.get("name"),
		"protocol": value.get("custom_univesp_protocol") or value.get("name"),
		"subject": value.get("subject"),
		"description": value.get("description"),
		"status": value.get("custom_univesp_status_code") or "open",
		"status_label": STATUS_LABELS.get(value.get("custom_univesp_status_code") or "open", "Aberto"),
		"priority": value.get("priority"),
		"source": value.get("custom_univesp_source"),
		"queue": value.get("custom_univesp_queue"),
		"area": value.get("custom_univesp_area"),
		"student": {
			"email": value.get("custom_student_email"),
			"name": value.get("custom_student_name"),
			"ra": value.get("custom_student_ra"),
			"polo": value.get("custom_student_polo"),
			"course": value.get("custom_student_course"),
		},
		"created_at": value.get("creation"),
		"updated_at": value.get("modified"),
	}


def _ticket_timeline(ticket_name):
	rows = frappe.get_all(
		"Comment",
		filters={"reference_doctype": "HD Ticket", "reference_name": ticket_name},
		fields=["name", "comment_by", "comment_email", "content", "creation"],
		order_by="creation asc",
	)
	return [
		{
			"id": row.name,
			"actor": row.comment_by or row.comment_email,
			"message": row.content,
			"created_at": row.creation,
		}
		for row in rows
	]


def _ticket_attachments(ticket_name):
	return frappe.get_all(
		"File",
		filters={"attached_to_doctype": "HD Ticket", "attached_to_name": ticket_name, "is_private": 1},
		fields=["name as id", "file_name", "file_size", "creation as created_at"],
		order_by="creation asc",
	)
