import json
import re

import frappe
from frappe import _
from frappe.utils import now_datetime

from univesp_atendimento.api.v1.common import response, verify_gateway_only
from univesp_atendimento.api.v1.knowledge import _build_published_faq_entries, _normalize_faq_type
from univesp_atendimento.univesp_atendimento.doctype.univesp_student_directory.univesp_student_directory import (
	normalize_cpf,
)


class PublicVisitorValidationError(frappe.ValidationError):
	http_status_code = 422


VISITOR_TYPES = {"candidato", "ex_aluno", "visitante", "outro"}
DEFAULT_PUBLIC_QUEUE = "atendimento-geral"


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
	visitor_type = str(visitor.get("tipo") or "visitante").strip().lower()
	if visitor_type not in VISITOR_TYPES:
		raise PublicVisitorValidationError(_("Tipo de visitante invalido."))
	if not email or not cpf or not nome:
		raise PublicVisitorValidationError(_("Nome, CPF e email sao obrigatorios."))

	subject = str(data.get("subject") or "").strip()
	description = str(data.get("description") or "").strip()
	if not subject or not description:
		raise PublicVisitorValidationError(_("Assunto e descricao sao obrigatorios."))

	knowledge = data.get("knowledge") if isinstance(data.get("knowledge"), dict) else {}
	queue = str(data.get("queue") or DEFAULT_PUBLIC_QUEUE).strip()

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
			"custom_student_ra": str(visitor.get("ra") or ""),
			"custom_student_polo": "",
			"custom_student_course": "",
			"custom_univesp_queue": queue,
			"agent_group": queue if queue and frappe.db.exists("HD Team", queue) else None,
			"custom_univesp_context_json": json.dumps(
				{
					"visitor_type": visitor_type,
					"cpf_masked": _mask_cpf(cpf),
					"triage": data.get("triage") or {},
				},
				ensure_ascii=False,
			),
			"custom_source_bundle_id": str(knowledge.get("bundle_id") or ""),
			"custom_source_node_id": str(knowledge.get("node_id") or ""),
			"custom_channel_metadata_json": json.dumps(
				{"visitor_type": visitor_type, "cpf_masked": _mask_cpf(cpf)},
				ensure_ascii=False,
			),
			"custom_ai_suggestion_json": "",
		}
	).insert(ignore_permissions=True)
	doc.custom_univesp_protocol = _public_protocol(doc.name, doc.creation)
	doc.save(ignore_permissions=True)
	return response(
		{
			"id": doc.name,
			"protocol": doc.custom_univesp_protocol,
			"status": doc.custom_univesp_status_code,
		},
		request_id=frappe.get_request_header("X-Request-ID") or "",
	)


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
