import hashlib
import json
import mimetypes
import re
import secrets

import frappe
from frappe import _
from frappe.utils import add_days, add_to_date, now_datetime
from frappe.utils.file_manager import save_file

from univesp_atendimento.api.v1.common import response, verify_gateway_only
from univesp_atendimento.api.v1.knowledge import _build_published_faq_entries, _normalize_faq_type
from univesp_atendimento.link_validation import classify_link, cpf_hash
from univesp_atendimento.univesp_atendimento.doctype.univesp_student_directory.univesp_student_directory import (
	normalize_cpf,
)


class PublicVisitorValidationError(frappe.ValidationError):
	http_status_code = 422


VISITOR_TYPES = {"aluno", "candidato", "ex_aluno", "visitante", "outro"}
DEFAULT_PUBLIC_QUEUE = "atendimento-geral"
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
ALLOWED_DOCUMENT_MIMES = {"application/pdf", "image/png", "image/jpeg"}
MAX_PUBLIC_DOCUMENT_BYTES = 10 * 1024 * 1024


@frappe.whitelist(methods=["GET"])
def published_faq_public(faq_type: str = "publico"):
	verify_gateway_only()
	normalized_type = _normalize_faq_type(faq_type)
	if normalized_type != "publico":
		raise PublicVisitorValidationError(_("Somente FAQ publica e permitida neste endpoint."))
	published, doc = _build_published_faq_entries(normalized_type)
	return response(
		published,
		meta={"version": str(doc.modified or ""), "faq_type": normalized_type},
		request_id=frappe.get_request_header("X-Request-ID") or "",
	)


@frappe.whitelist(methods=["GET"])
def runtime_flags_public():
	verify_gateway_only()
	doc = frappe.get_single("Univesp Runtime Settings")
	return response(
		{
			"faq_public_anonymous": bool(getattr(doc, "faq_public_anonymous", False)),
			"faq_public_documents": bool(getattr(doc, "faq_public_documents", False)),
			"faq_link_validation": bool(getattr(doc, "faq_link_validation", False)),
			"faq_public_email_thread": bool(getattr(doc, "faq_public_email_thread", False)),
		}
	)


@frappe.whitelist(methods=["GET"])
def public_academic_catalogs():
	verify_gateway_only()
	rows = frappe.get_all(
		"Univesp Student Directory",
		fields=["curso", "polo_id", "polo_nome"],
		filters={"situacao": ["not in", ["cancelado", "inativo"]]},
		limit_page_length=0,
	)
	courses = sorted({str(row.curso or "").strip() for row in rows if str(row.curso or "").strip()})
	poles = {
		str(row.polo_id): str(row.polo_nome or row.polo_id)
		for row in rows
		if str(row.polo_id or "").strip()
	}
	return response(
		{
			"courses": [{"key": value, "label": value} for value in courses],
			"poles": [{"key": key, "label": poles[key]} for key in sorted(poles)],
		}
	)


@frappe.whitelist(methods=["POST"])
def validate_public_link(payload: dict | str | None = None):
	verify_gateway_only()
	data = _payload(payload)
	result = _resolve_link_validation(data)
	return response(
		{
			"received": True,
			"verified": result == "verified",
			"requires_human_review": result in {"inconclusive", "conflicting", "unavailable"},
		}
	)


@frappe.whitelist(methods=["POST"])
def create_public_ticket(payload: dict | str | None = None):
	verify_gateway_only()
	data = _payload(payload)
	visitor = data.get("visitor") if isinstance(data.get("visitor"), dict) else {}
	consent = bool(data.get("lgpd_consent"))
	if not consent:
		raise PublicVisitorValidationError(_("Consentimento LGPD e obrigatorio."))

	email = str(visitor.get("email") or "").strip().lower()
	cpf = normalize_cpf(visitor.get("cpf") or "")
	nome = str(visitor.get("nome") or "").strip()
	phone = _normalize_phone(visitor.get("celular"))
	visitor_type = str(visitor.get("tipo") or "visitante").strip().lower()
	if visitor_type not in VISITOR_TYPES:
		raise PublicVisitorValidationError(_("Tipo de visitante invalido."))
	if not email or "@" not in email or not nome or not phone:
		raise PublicVisitorValidationError(_("Nome, e-mail e celular são obrigatórios."))

	subject = str(data.get("subject") or "").strip()
	description = str(data.get("description") or "").strip()
	if not subject or not description:
		raise PublicVisitorValidationError(_("Assunto e descricao sao obrigatorios."))

	knowledge = data.get("knowledge") if isinstance(data.get("knowledge"), dict) else {}
	settings = frappe.get_single("Univesp Runtime Settings")
	if bool(getattr(settings, "knowledge_v3_read", False)):
		from univesp_atendimento.api.v1.knowledge_runtime import _published_v3_entries

		published_entries = _published_v3_entries("public")
	else:
		published_entries = _build_published_faq_entries("publico")[0]
	knowledge_reference = _resolve_public_knowledge_reference(
		knowledge,
		published_entries,
	)
	intake_policy = knowledge_reference.pop("intake_policy", {})
	document_policy = knowledge_reference.pop("document_policy", {"mode": "disabled"})
	_validate_public_identity(visitor, cpf, intake_policy)
	link_outcome = (
		_resolve_link_validation(visitor)
		if bool(getattr(settings, "faq_link_validation", False)) and visitor_type == "aluno"
		else ""
	)
	if document_policy.get("mode") != "disabled" and not bool(
		getattr(settings, "faq_public_documents", False)
	):
		raise PublicVisitorValidationError(_("O envio de documentos está temporariamente indisponível."))
	if bool(getattr(settings, "routing_server_authority", False)):
		from univesp_atendimento.api.v1.routing import resolve_ticket_route

		routing_decision = resolve_ticket_route(
			session_record=None,
			knowledge=knowledge_reference,
			student={"ra": visitor.get("ra")},
			context=None,
		)
		queue = routing_decision["resolved_queue"]
	else:
		routing_decision = {}
		queue = _resolve_public_queue(data)

	upload_token = secrets.token_urlsafe(32)
	context_payload = {
		"visitor_type": visitor_type,
		"cpf_masked": _mask_cpf(cpf),
		"phone_masked": _mask_phone(phone),
		"triage": data.get("triage") or {},
		"routing": routing_decision,
		"document_policy": document_policy,
		"link_validation": link_outcome,
		"public_upload_token_hash": _token_hash(upload_token),
	}
	doc = frappe.get_doc(
		{
			"doctype": "HD Ticket",
			"subject": subject,
			"description": description,
			"raised_by": email,
			"priority": "Medium",
			"status": _status_name("open"),
			"custom_univesp_status_code": "open",
			"custom_univesp_source": "publico",
			"custom_student_email": email,
			"custom_student_name": nome,
			"custom_visitor_phone": phone,
			"custom_visitor_cpf": cpf or "",
			"custom_student_ra": str(visitor.get("ra") or ""),
			"custom_student_polo": str(visitor.get("polo") or ""),
			"custom_student_course": str(visitor.get("curso") or ""),
			"custom_univesp_queue": queue,
			"agent_group": queue if queue and frappe.db.exists("HD Team", queue) else None,
			"custom_univesp_context_json": json.dumps(context_payload, ensure_ascii=False),
			"custom_source_bundle_id": knowledge_reference["bundle_id"],
			"custom_source_bundle_version_id": knowledge_reference["bundle_version_id"],
			"custom_source_node_id": knowledge_reference["node_id"],
			"custom_channel_metadata_json": json.dumps(
				{"visitor_type": visitor_type, "cpf_masked": _mask_cpf(cpf)},
				ensure_ascii=False,
			),
			"custom_ai_suggestion_json": "",
		}
	).insert(ignore_permissions=True)
	doc.custom_univesp_protocol = _public_protocol(doc.name, doc.creation)
	doc.save(ignore_permissions=True)
	if bool(getattr(settings, "faq_public_email_thread", False)):
		frappe.enqueue(
			"univesp_atendimento.public_email.send_protocol_confirmation",
			ticket_name=doc.name,
			enqueue_after_commit=True,
		)
	if link_outcome in {"inconclusive", "not_found", "conflicting", "unavailable"}:
		frappe.get_doc(
			{
				"doctype": "Univesp Link Validation",
				"ticket": doc.name,
				"outcome": link_outcome,
				"state": "pending",
				"assigned_group": "validacao-vinculo",
				"sla_due_at": add_to_date(now_datetime(), hours=24),
			}
		).insert(ignore_permissions=True)
	return response(
		{
			"id": doc.name,
			"protocol": doc.custom_univesp_protocol,
			"status": doc.custom_univesp_status_code,
			"document_policy": document_policy,
			"upload_token": upload_token,
		},
		request_id=frappe.get_request_header("X-Request-ID") or "",
	)


@frappe.whitelist(methods=["POST"])
def attach_public_document(ticket_id: str):
	verify_gateway_only()
	doc, context = _public_ticket_with_token(ticket_id)
	settings = frappe.get_single("Univesp Runtime Settings")
	if not bool(getattr(settings, "faq_public_documents", False)):
		raise frappe.PermissionError(_("Envio público de documentos desabilitado."))
	policy = context.get("document_policy") or {}
	if policy.get("mode") == "disabled":
		raise PublicVisitorValidationError(_("Este fluxo não permite documentos."))
	from univesp_atendimento.gcs_config import inspect_gcs_site_config

	if not inspect_gcs_site_config()["ok"]:
		raise frappe.ValidationError(_("Armazenamento privado de documentos não configurado."))
	files = getattr(frappe.request, "files", None)
	uploads = files.getlist("files") if files and hasattr(files, "getlist") else list((files or {}).values())
	if len(uploads) != 1:
		raise PublicVisitorValidationError(_("Envie exatamente um documento por vez."))
	uploaded = uploads[0]
	content = uploaded.stream.read(MAX_PUBLIC_DOCUMENT_BYTES + 1)
	content_type = str(uploaded.content_type or mimetypes.guess_type(uploaded.filename)[0] or "").lower()
	_validate_document(uploaded.filename, content_type, content)
	scan_result = _scan_document(uploaded.filename, content_type, content)
	if scan_result != "clean":
		raise PublicVisitorValidationError(_("O documento não passou pela verificação de segurança."))
	file_doc = save_file(uploaded.filename, content, "HD Ticket", doc.name, is_private=1)
	document = frappe.get_doc(
		{
			"doctype": "Univesp Public Document",
			"ticket": doc.name,
			"file": file_doc.name,
			"original_name": uploaded.filename,
			"content_type": content_type,
			"size_bytes": len(content),
			"sha256": hashlib.sha256(content).hexdigest(),
			"scan_status": "clean",
			"scan_detail": "Verificado pelo serviço antimalware institucional.",
			"uploaded_at": now_datetime(),
			"scanned_at": now_datetime(),
			"retention_until": add_days(now_datetime(), int(frappe.conf.get("public_document_retention_days", 180))),
		}
	).insert(ignore_permissions=True)
	return response({"id": document.name, "file_name": uploaded.filename, "status": "clean"})


@frappe.whitelist(methods=["POST"])
def finalize_public_ticket(ticket_id: str):
	verify_gateway_only()
	doc, context = _public_ticket_with_token(ticket_id)
	policy = context.get("document_policy") or {}
	clean_documents = frappe.db.count(
		"Univesp Public Document",
		{"ticket": doc.name, "scan_status": "clean"},
	)
	if policy.get("mode") == "required" and clean_documents < 1:
		raise PublicVisitorValidationError(_("Este fluxo exige um documento válido."))
	context.pop("public_upload_token_hash", None)
	doc.custom_univesp_context_json = json.dumps(context, ensure_ascii=False)
	doc.save(ignore_permissions=True)
	return response({"id": doc.name, "protocol": doc.custom_univesp_protocol, "status": doc.custom_univesp_status_code})


def purge_expired_public_documents():
	expired = frappe.get_all(
		"Univesp Public Document",
		filters={"retention_until": ["<", now_datetime().date()]},
		fields=["name", "file"],
		limit_page_length=500,
	)
	for row in expired:
		if row.file and frappe.db.exists("File", row.file):
			frappe.delete_doc("File", row.file, ignore_permissions=True)
		frappe.delete_doc("Univesp Public Document", row.name, ignore_permissions=True)
	return len(expired)


def _resolve_public_knowledge_reference(knowledge: dict, entries: list[dict]) -> dict:
	if not knowledge:
		raise PublicVisitorValidationError(_("Escolha uma orientação antes de abrir atendimento."))

	bundle_id = str(knowledge.get("bundle_id") or "").strip()
	requested_version = str(knowledge.get("bundle_version_id") or "").strip()
	node_id = str(knowledge.get("node_id") or "").strip()
	if not bundle_id or not node_id:
		raise PublicVisitorValidationError(_("Referencia da FAQ publica incompleta."))

	entry = next(
		(item for item in entries if str(item.get("bundle_id") or "").strip() == bundle_id),
		None,
	)
	if not entry:
		raise PublicVisitorValidationError(_("A orientacao selecionada nao esta publicada."))

	package = entry.get("package") if isinstance(entry.get("package"), dict) else {}
	versioning = package.get("versioning") if isinstance(package.get("versioning"), dict) else {}
	publication = package.get("publication") if isinstance(package.get("publication"), dict) else {}
	published_version = str(
		entry.get("bundle_version_id")
		or versioning.get("bundle_version_id")
		or versioning.get("published_version")
		or publication.get("active_bundle_version_id")
		or ""
	).strip()
	if requested_version and requested_version != published_version:
		raise PublicVisitorValidationError(_("A orientacao foi atualizada. Reabra a jornada antes de continuar."))

	node = next(
		(
			item
			for item in package.get("nodes") or []
			if isinstance(item, dict) and str(item.get("id") or "").strip() == node_id
		),
		None,
	)
	if not node:
		raise PublicVisitorValidationError(_("A etapa selecionada nao pertence a orientacao publicada."))
	if node.get("node_kind") not in {"leaf", "final"}:
		raise PublicVisitorValidationError(_("Abra atendimento somente a partir de uma resposta final."))

	return {
		"bundle_id": bundle_id,
		"bundle_version_id": published_version,
		"node_id": node_id,
		"document_policy": node.get("document_policy") or {"mode": "disabled"},
		"intake_policy": node.get("intake_policy") or {},
	}


def _validate_public_identity(visitor, cpf, policy):
	required = {
		"cpf": bool(policy.get("requires_cpf")),
		"ra": bool(policy.get("requires_ra")),
		"curso": bool(policy.get("requires_course")),
		"polo": bool(policy.get("requires_polo")),
	}
	if required["cpf"] and len(cpf) != 11:
		raise PublicVisitorValidationError(_("CPF é obrigatório para este atendimento."))
	for key in ("ra", "curso", "polo"):
		if required[key] and not str(visitor.get(key) or "").strip():
			raise PublicVisitorValidationError(_("Preencha os dados solicitados para este atendimento."))


def _resolve_link_validation(visitor):
	cpf = normalize_cpf(visitor.get("cpf") or "")
	email = str(visitor.get("email") or "").strip().lower()
	try:
		filters = {"cpf_hash": cpf_hash(cpf)} if len(cpf) == 11 else {"email": email}
		rows = frappe.get_all(
			"Univesp Student Directory",
			filters=filters,
			fields=["email", "ra", "curso", "polo_id", "situacao"],
			limit_page_length=2,
		)
	except Exception:
		frappe.log_error(title="Student Directory indisponível", message=frappe.get_traceback())
		return "unavailable"
	if len(rows) != 1:
		return "inconclusive" if len(rows) > 1 else "not_found"
	return classify_link(rows[0], visitor)


def _public_ticket_with_token(ticket_id):
	name = str(ticket_id or "").strip()
	if not name or not frappe.db.exists("HD Ticket", name):
		raise frappe.PermissionError(_("Protocolo ou credencial inválidos."))
	doc = frappe.get_doc("HD Ticket", name)
	if doc.custom_univesp_source != "publico":
		raise frappe.PermissionError(_("Protocolo ou credencial inválidos."))
	context = json.loads(doc.custom_univesp_context_json or "{}")
	expected = str(context.get("public_upload_token_hash") or "")
	supplied = str(frappe.get_request_header("X-Public-Upload-Token") or "")
	if not expected or not secrets.compare_digest(expected, _token_hash(supplied)):
		raise frappe.PermissionError(_("Protocolo ou credencial inválidos."))
	return doc, context


def _validate_document(filename, content_type, content):
	suffix = "." + str(filename or "").rsplit(".", 1)[-1].lower() if "." in str(filename or "") else ""
	if suffix not in ALLOWED_DOCUMENT_EXTENSIONS or content_type not in ALLOWED_DOCUMENT_MIMES:
		raise PublicVisitorValidationError(_("Formato de documento não permitido."))
	if not content or len(content) > MAX_PUBLIC_DOCUMENT_BYTES:
		raise PublicVisitorValidationError(_("Documento vazio ou maior que 10 MiB."))
	signatures = {
		"application/pdf": content.startswith(b"%PDF-"),
		"image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
		"image/jpeg": content.startswith(b"\xff\xd8\xff"),
	}
	if not signatures.get(content_type, False):
		raise PublicVisitorValidationError(_("O conteúdo do arquivo não corresponde ao formato informado."))


def _scan_document(filename, content_type, content):
	endpoint = str(frappe.conf.get("antimalware_endpoint") or "").strip()
	if not endpoint:
		raise frappe.ValidationError(_("Serviço antimalware não configurado."))
	import requests

	try:
		result = requests.post(
			endpoint,
			files={"file": (filename, content, content_type)},
			headers={"X-Antimalware-Token": str(frappe.conf.get("antimalware_token") or "")},
			timeout=20,
		)
		result.raise_for_status()
		return "clean" if result.json().get("status") == "clean" else "infected"
	except (requests.RequestException, ValueError) as exc:
		frappe.log_error(title="Falha no antimalware público", message=str(exc))
		raise frappe.ValidationError(_("Não foi possível verificar o documento agora.")) from exc


def _token_hash(value):
	return hashlib.sha256(str(value or "").encode("utf-8")).hexdigest()


def _normalize_phone(value):
	digits = re.sub(r"\D", "", str(value or ""))
	return digits if 10 <= len(digits) <= 13 else ""


def _mask_phone(value):
	return f"***-***-{value[-4:]}" if len(value) >= 4 else ""


def _resolve_public_queue(_payload: dict | None = None) -> str:
	return DEFAULT_PUBLIC_QUEUE


def _mask_cpf(cpf: str) -> str:
	if len(cpf) != 11:
		return ""
	return f"***.***.***-{cpf[-2:]}"


def _public_protocol(name: str, creation) -> str:
	year = creation.year if hasattr(creation, "year") else now_datetime().year
	suffix = re.sub(r"[^0-9]", "", str(name))[-6:].zfill(6)
	return f"PRT-{year}-{suffix}"


def _status_name(code: str) -> str:
	mapping = {
		"open": "Aberto",
		"in_analysis": "Em analise",
		"waiting_student": "Aguardando aluno",
		"waiting_internal": "Em atendimento interno",
		"resolved": "Resolvido",
		"closed": "Encerrado",
		"cancelled": "Cancelado",
	}
	return mapping.get(code, "Aberto")


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value.strip():
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise PublicVisitorValidationError(_("Payload JSON invalido.")) from exc
	return frappe.form_dict or {}
