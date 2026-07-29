import json
import secrets
from datetime import datetime

import frappe
from frappe import _
from frappe.utils import cint, now_datetime
from frappe.utils.file_manager import save_file
from frappe.utils.file_manager import get_file

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
	"custom_univesp_assignee_email",
	"custom_univesp_assignee_name",
	"custom_univesp_context_json",
	"custom_source_bundle_id",
	"custom_source_bundle_version_id",
	"custom_source_node_id",
	"custom_source_path_json",
	"custom_source_audience",
	"custom_faq_session_id",
	"custom_channel_metadata_json",
	"custom_ai_suggestion_json",
]


@frappe.whitelist(methods=["POST"])
def create(payload: dict | str | None = None):
	context = get_request_context("create_ticket")
	data = _payload(payload)
	if "channel" in data:
		from univesp_atendimento.channel_adapter import normalize_channel_payload

		data = normalize_channel_payload(data)
	student = data.get("student") if isinstance(data.get("student"), dict) else {}
	knowledge = data.get("knowledge") if isinstance(data.get("knowledge"), dict) else {}
	from univesp_atendimento.api.v1.knowledge_runtime import validate_session_lineage

	session_record = validate_session_lineage(knowledge, context)
	if (
		not session_record
		and knowledge.get("bundle_id")
		and frappe.db.exists("Univesp Knowledge Bundle", str(knowledge.get("bundle_id")))
		and bool(frappe.get_single("Univesp Runtime Settings").knowledge_v3_read)
	):
		raise frappe.PermissionError(_("Lineage v3 exige sessão FAQ válida."))
	if session_record:
		knowledge = {
			**knowledge,
			"bundle_id": session_record["bundle_key"],
			"bundle_version_id": session_record["bundle_version_id"],
			"node_id": session_record["path"][-1],
			"path": session_record["path"],
			"audience": session_record["persona"],
			"faq_session_id": session_record["faq_session_id"],
		}
	settings = frappe.get_single("Univesp Runtime Settings")
	server_routing = bool(getattr(settings, "routing_server_authority", False)) or bool(session_record)
	if server_routing:
		from univesp_atendimento.api.v1.routing import resolve_ticket_route

		routing_decision = resolve_ticket_route(
			session_record=session_record,
			knowledge=knowledge,
			student=student,
			context=context,
			manual_routing_key=data.get("routing_key"),
		)
		queue = routing_decision["resolved_queue"]
		area = routing_decision["resolved_area"]
	else:
		routing_decision = {}
		queue = str(data.get("queue") or "").strip()
		area = str(data.get("area") or "").strip()

	if context.profile_key == "aluno":
		student = {**student, "email": context.email, "name": context.name, "ra": context.ra}
	elif context.profile_key not in {"op", "op_externo", "gestor_polos", "admin_central"}:
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
			"custom_univesp_context_json": json.dumps(
				{
					**(data.get("triage") if isinstance(data.get("triage"), dict) else {}),
					"routing": routing_decision,
				},
				ensure_ascii=False,
			),
			"custom_source_bundle_id": str(knowledge.get("bundle_id") or ""),
			"custom_source_bundle_version_id": str(knowledge.get("bundle_version_id") or ""),
			"custom_source_node_id": str(knowledge.get("node_id") or knowledge.get("flow_id") or ""),
			"custom_source_path_json": json.dumps(knowledge.get("path") or [], ensure_ascii=False),
			"custom_source_audience": str(knowledge.get("audience") or ""),
			"custom_faq_session_id": str(knowledge.get("faq_session_id") or ""),
			"custom_request_id": context.request_id,
			"custom_channel_metadata_json": json.dumps(
				data.get("channel_metadata") if isinstance(data.get("channel_metadata"), dict) else {},
				ensure_ascii=False,
			),
			"custom_ai_suggestion_json": "",
		}
	).insert(ignore_permissions=True)
	doc.custom_univesp_protocol = _public_protocol(doc.name, doc.creation)
	doc.save(ignore_permissions=True)
	from univesp_atendimento.api.v1.knowledge_runtime import record_protocol_created

	record_protocol_created(context, session_record, doc.name)
	from univesp_atendimento.ticket_hooks import enqueue_ai_suggestion

	enqueue_ai_suggestion(doc.name)
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

	or_filters = _ticket_assignment_or_filters(context)
	query_options = {
		"filters": filters,
		"or_filters": or_filters,
	}
	rows = frappe.get_all(
		"HD Ticket",
		**query_options,
		fields=TICKET_FIELDS,
		order_by="modified desc",
		start=(page - 1) * page_size,
		page_length=page_size,
	)
	if or_filters:
		count_rows = frappe.get_all(
			"HD Ticket",
			**query_options,
			fields=["count(name) as total"],
			page_length=1,
		)
		total = cint(count_rows[0].get("total")) if count_rows else 0
	else:
		total = frappe.db.count("HD Ticket", filters=filters)
	return response(
		[_serialize_ticket(row) for row in rows],
		meta={"page": page, "page_size": page_size, "total": total},
		request_id=context.request_id,
	)


def _ticket_assignment_or_filters(context):
	if context.profile_key != "op":
		return []
	return [
		["HD Ticket", "custom_univesp_assignee_email", "=", context.email],
		["HD Ticket", "custom_univesp_assignee_email", "=", ""],
		["HD Ticket", "custom_univesp_assignee_email", "is", "not set"],
	]


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
	_claim_operator_ticket(name, context)
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
	_claim_operator_ticket(name, context)
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
def reveal_public_contact(ticket_id: str, reason: str | None = None, include_cpf: int | str = 0):
	context = get_request_context("view_contact_details")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	justification = str(reason or "").strip()
	if len(justification) < 10:
		frappe.throw(_("Informe um motivo com ao menos 10 caracteres."), frappe.ValidationError)
	doc = frappe.get_doc("HD Ticket", name)
	result = {
		"email": doc.custom_student_email,
		"phone": getattr(doc, "custom_visitor_phone", "") or "",
	}
	if cint(include_cpf):
		if "view_sensitive_identity" not in context.actions:
			raise frappe.PermissionError(_("Seu perfil não permite visualizar CPF."))
		result["cpf"] = doc.get_password("custom_visitor_cpf") if doc.custom_visitor_cpf else ""
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": context.actor_email or context.email,
			"target_email": doc.custom_student_email or "publico@univesp.br",
			"operation": "public_contact_revealed",
			"reason": justification,
			"before_json": "",
			"after_json": json.dumps(
				{"ticket": doc.name, "fields": sorted(result), "cpf_included": bool(cint(include_cpf))},
				ensure_ascii=False,
			),
			"request_id": context.request_id,
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)
	return response(result, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def issue_document_download(ticket_id: str, document_id: str, reason: str | None = None):
	context = get_request_context("view_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	justification = str(reason or "").strip()
	if len(justification) < 10:
		frappe.throw(_("Informe um motivo com ao menos 10 caracteres."), frappe.ValidationError)
	document = frappe.get_doc("Univesp Public Document", document_id)
	if document.ticket != name or document.scan_status != "clean":
		raise frappe.PermissionError(_("Documento indisponível."))
	token = secrets.token_urlsafe(32)
	frappe.cache().set_value(
		f"univesp:public-document-download:{token}",
		json.dumps(
			{
				"document_id": document.name,
				"ticket": name,
				"actor_email": context.actor_email or context.email,
				"reason": justification,
			}
		),
		expires_in_sec=300,
	)
	return response(
		{
			"url": f"/api/app/v1/tickets/{name}/documents/{document.name}/content?token={token}",
			"expires_in_seconds": 300,
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def download_document(ticket_id: str, document_id: str, token: str):
	context = get_request_context("view_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	cache_key = f"univesp:public-document-download:{str(token or '').strip()}"
	raw = frappe.cache().get_value(cache_key)
	if not raw:
		raise frappe.PermissionError(_("Link expirado ou inválido."))
	grant = json.loads(raw)
	if (
		grant.get("document_id") != document_id
		or grant.get("ticket") != name
		or grant.get("actor_email") != (context.actor_email or context.email)
	):
		raise frappe.PermissionError(_("Link expirado ou inválido."))
	frappe.cache().delete_value(cache_key)
	document = frappe.get_doc("Univesp Public Document", document_id)
	if document.ticket != name or document.scan_status != "clean":
		raise frappe.PermissionError(_("Documento indisponível."))
	file_doc = frappe.get_doc("File", document.file)
	filename, content = get_file(file_doc.file_url)
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": context.actor_email or context.email,
			"target_email": frappe.db.get_value("HD Ticket", name, "custom_student_email")
			or "publico@univesp.br",
			"operation": "public_document_downloaded",
			"reason": grant.get("reason"),
			"before_json": "",
			"after_json": json.dumps({"ticket": name, "document": document.name}),
			"request_id": context.request_id,
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)
	frappe.local.response.filename = filename
	frappe.local.response.filecontent = content
	frappe.local.response.type = "download"
	frappe.local.response.display_content_as = "attachment"


@frappe.whitelist(methods=["POST"])
def assign(
	ticket_id: str,
	assignee: str | None = None,
	queue: str | None = None,
	area: str | None = None,
	reason: str | None = None,
):
	context = get_request_context("assign_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	doc = frappe.get_doc("HD Ticket", name)
	assignment_reason = str(reason or "").strip()
	if len(assignment_reason) < 5:
		frappe.throw(_("Informe um motivo auditavel para a atribuicao."), frappe.ValidationError)
	if queue is not None:
		queue_name = str(queue).strip()
		doc.custom_univesp_queue = queue_name
		doc.agent_group = queue_name if queue_name and frappe.db.exists("HD Team", queue_name) else None
	if area is not None:
		area_name = str(area).strip()
		if area_name:
			_validate_area_destination(context, area_name)
		doc.custom_univesp_area = area_name
	if assignee:
		profile = _assignable_profile(context, assignee, doc.custom_univesp_area)
		doc.custom_univesp_assignee_email = profile.user_email
		doc.custom_univesp_assignee_name = profile.display_name
		if frappe.db.exists("User", profile.user_email):
			from frappe.desk.form.assign_to import add

			add({"doctype": "HD Ticket", "name": name, "assign_to": [profile.user_email]})
	doc.add_comment("Comment", text=assignment_reason)
	doc.custom_request_id = context.request_id
	doc.save(ignore_permissions=True)
	return response(_serialize_ticket(doc), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def area_action(
	ticket_id: str,
	action_type: str | None = None,
	note: str | None = None,
	destination_area: str | None = None,
):
	context = get_request_context("transition_ticket")
	if context.profile_key not in {"analista_area", "gestor_area", "admin_central"}:
		raise frappe.PermissionError(_("Seu perfil nao pode registrar tratativa de area."))
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	doc = frappe.get_doc("HD Ticket", name)
	action = str(action_type or "").strip()
	message = str(note or "").strip()
	if len(message) < 3:
		frappe.throw(_("Registre uma nota auditavel para a tratativa."), frappe.ValidationError)

	if action == "reassign":
		if context.profile_key not in {"gestor_area", "admin_central"}:
			raise frappe.PermissionError(_("Somente gestor de area pode reencaminhar o caso."))
		next_area = str(destination_area or "").strip()
		if not next_area:
			frappe.throw(_("Area de destino obrigatoria."), frappe.ValidationError)
		_validate_area_destination(context, next_area, allow_manager_override=True)
		target_status = "waiting_internal"
		doc.custom_univesp_area = next_area
	elif action == "technical_reply":
		target_status = "in_analysis"
		doc.custom_univesp_area = ""
	elif action == "request_complement":
		target_status = "waiting_student"
		doc.custom_univesp_area = ""
	elif action == "conclude":
		target_status = "resolved"
		doc.custom_univesp_area = ""
	else:
		frappe.throw(_("Acao de area invalida."), frappe.ValidationError)

	_move_to_status(doc, target_status)
	doc.custom_request_id = context.request_id
	doc.save(ignore_permissions=True)
	doc.add_comment("Comment", text=message)
	result = _serialize_ticket(doc)
	result["timeline"] = _ticket_timeline(name)
	result["attachments"] = _ticket_attachments(name)
	return response(result, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def transition(ticket_id: str, status: str | None = None, message: str | None = None):
	context = get_request_context("transition_ticket")
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	_claim_operator_ticket(name, context)
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


@frappe.whitelist(methods=["POST"])
def escalate_to_internal(
	ticket_id: str,
	message: str | None = None,
	destination_area: str | None = None,
):
	"""BPO regional encaminha caso para atendimento interno (Fase B stub)."""
	context = get_request_context("escalate_to_internal")
	if context.profile_key not in {"op_externo", "admin_central"}:
		raise frappe.PermissionError(_("Seu perfil nao pode escalar para atendimento interno."))
	name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(name, context)
	doc = frappe.get_doc("HD Ticket", name)
	body = _payload()
	note = str(message or body.get("message") or "").strip()
	if len(note) < 3:
		frappe.throw(_("Registre o motivo da escalacao."), frappe.ValidationError)
	next_area = str(destination_area or body.get("destination_area") or "Triagem Central").strip()
	if not next_area:
		frappe.throw(_("Area de destino obrigatoria."), frappe.ValidationError)
	_move_to_status(doc, "waiting_internal")
	doc.custom_univesp_area = next_area
	doc.custom_request_id = context.request_id
	doc.save(ignore_permissions=True)
	doc.add_comment("Comment", text=note)
	result = _serialize_ticket(doc)
	result["timeline"] = _ticket_timeline(name)
	result["attachments"] = _ticket_attachments(name)
	return response(result, request_id=context.request_id)


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


def _parse_json_field(raw):
	if not raw:
		return {}
	if isinstance(raw, dict):
		return raw
	try:
		parsed = json.loads(raw)
		return parsed if isinstance(parsed, dict) else {}
	except (TypeError, json.JSONDecodeError):
		return {}


def _parse_json_list(raw):
	if not raw:
		return []
	if isinstance(raw, list):
		return raw
	try:
		parsed = json.loads(raw)
		return parsed if isinstance(parsed, list) else []
	except (TypeError, json.JSONDecodeError):
		return []


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
		"channel_metadata": _parse_json_field(value.get("custom_channel_metadata_json")),
		"ai_suggestion": _parse_json_field(value.get("custom_ai_suggestion_json")),
		"context": _parse_json_field(value.get("custom_univesp_context_json")),
		"knowledge": {
			"bundle_id": value.get("custom_source_bundle_id") or "",
			"bundle_version_id": value.get("custom_source_bundle_version_id") or "",
			"node_id": value.get("custom_source_node_id") or "",
			"path": _parse_json_list(value.get("custom_source_path_json")),
			"audience": value.get("custom_source_audience") or "",
			"faq_session_id": value.get("custom_faq_session_id") or "",
		},
		"queue": value.get("custom_univesp_queue"),
		"area": value.get("custom_univesp_area"),
		"assignee": value.get("custom_univesp_assignee_name") or "",
		"assignee_email": value.get("custom_univesp_assignee_email") or "",
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


def _claim_operator_ticket(ticket_name, context):
	if context.profile_key != "op":
		return
	frappe.db.sql(
		"""
		UPDATE `tabHD Ticket`
		SET custom_univesp_assignee_email = %s,
			custom_univesp_assignee_name = %s,
			custom_request_id = %s
		WHERE name = %s
			AND COALESCE(custom_univesp_assignee_email, '') = ''
		""",
		(context.email, context.name, context.request_id, ticket_name),
	)
	assignee = (
		str(frappe.db.get_value("HD Ticket", ticket_name, "custom_univesp_assignee_email") or "")
		.strip()
		.lower()
	)
	if assignee != context.email:
		raise frappe.PermissionError(_("Este atendimento foi assumido por outro OP."))


def _validate_area_destination(context, area_name, allow_manager_override=False):
	if not _known_area(area_name):
		frappe.throw(_("Area institucional de destino nao encontrada."), frappe.ValidationError)
	if context.profile_key == "admin_central":
		return
	allowed_areas = {str(value).strip() for value in context.scopes.get("areas", []) if str(value).strip()}
	if area_name in allowed_areas:
		return
	if allow_manager_override and "manager_override_route" in context.actions:
		return
	raise frappe.PermissionError(_("Area fora do escopo institucional ativo."))


def _known_area(area_name):
	if frappe.db.exists("HD Ticket", {"custom_univesp_area": area_name}):
		return True
	rows = frappe.get_all(
		"Univesp Access Profile", fields=["scopes_json"], filters={"active": 1}, limit_page_length=0
	)
	for row in rows:
		scopes = frappe.parse_json(row.scopes_json or "{}")
		if area_name in set(scopes.get("areas") or []):
			return True
	return False


def _assignable_profile(context, email, area_name):
	normalized_email = str(email or "").strip().lower()
	profile_name = frappe.db.get_value(
		"Univesp Access Profile", {"user_email": normalized_email, "active": 1}, "name"
	)
	if not profile_name:
		frappe.throw(_("Responsavel institucional ativo nao encontrado."), frappe.ValidationError)
	profile = frappe.get_doc("Univesp Access Profile", profile_name)
	if profile.profile_key not in {"analista_area", "gestor_area"}:
		frappe.throw(_("O responsavel precisa ter perfil de area."), frappe.ValidationError)
	profile_scopes = frappe.parse_json(profile.scopes_json or "{}")
	if area_name and area_name not in set(profile_scopes.get("areas") or []):
		frappe.throw(_("O responsavel nao pertence a area atual do caso."), frappe.ValidationError)
	if area_name:
		_validate_area_destination(context, area_name)
	return profile


def _move_to_status(doc, target):
	current = doc.custom_univesp_status_code or "open"
	if current == target:
		return
	if target not in TRANSITIONS.get(current, set()):
		if "in_analysis" not in TRANSITIONS.get(current, set()):
			frappe.throw(_("Transicao de status nao permitida."), frappe.ValidationError)
		doc.status = _status_name("in_analysis")
		doc.custom_univesp_status_code = "in_analysis"
		current = "in_analysis"
	if target not in TRANSITIONS.get(current, set()):
		frappe.throw(_("Transicao de status nao permitida."), frappe.ValidationError)
	doc.status = _status_name(target)
	doc.custom_univesp_status_code = target


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
	rows = frappe.get_all(
		"File",
		filters={"attached_to_doctype": "HD Ticket", "attached_to_name": ticket_name, "is_private": 1},
		fields=["name as id", "file_name", "file_size", "creation as created_at"],
		order_by="creation asc",
	)
	public_documents = {
		row.file: row
		for row in frappe.get_all(
			"Univesp Public Document",
			filters={"ticket": ticket_name},
			fields=["name", "file", "scan_status"],
			limit_page_length=0,
		)
	}
	for row in rows:
		document = public_documents.get(row.id)
		row["public_document_id"] = document.name if document else ""
		row["security_status"] = document.scan_status if document else "private"
	return rows
