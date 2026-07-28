"""Ingresso omnichannel via webhook (email/WhatsApp) — Fase C."""

from __future__ import annotations

import json

import frappe
from frappe import _

from univesp_atendimento.channel_adapter import ChannelAdapterError, normalize_channel_payload


class ChannelIngressError(frappe.ValidationError):
	http_status_code = 422


def verify_ingress_secret() -> None:
	"""Valida cabecalho compartilhado no gateway (segunda camada opcional no Frappe)."""
	import hmac

	secret = str(frappe.conf.get("univesp_ingress_shared_secret") or "").strip()
	if not secret:
		return
	header = str(frappe.get_request_header("X-Univesp-Ingress-Secret") or "").strip()
	if not header or not hmac.compare_digest(header, secret):
		raise frappe.AuthenticationError(_("Ingress nao autorizado."))


def create_channel_ticket(data: dict) -> dict:
	"""Normaliza payload omnichannel e cria HD Ticket via caminho institucional."""
	normalized = normalize_channel_payload(data)
	student = normalized.get("student") or {}
	knowledge = normalized.get("knowledge") or {}
	queue = str(normalized.get("queue") or "atendimento-geral").strip()

	subject = normalized["subject"]
	description = normalized["description"]
	raised_by = str(student.get("email") or "ingress@invalid.local").strip().lower()

	doc = frappe.get_doc(
		{
			"doctype": "HD Ticket",
			"subject": subject,
			"description": description,
			"raised_by": raised_by,
			"priority": _priority_name(normalized.get("priority")),
			"status": _status_name("open"),
			"custom_univesp_status_code": "open",
			"custom_univesp_source": str(normalized.get("source") or normalized.get("channel") or "portal"),
			"custom_student_email": raised_by,
			"custom_student_name": str(student.get("name") or ""),
			"custom_student_ra": str(student.get("ra") or ""),
			"custom_student_polo": str(student.get("polo") or ""),
			"custom_student_course": str(student.get("course") or ""),
			"custom_univesp_queue": queue,
			"agent_group": queue if queue and frappe.db.exists("HD Team", queue) else None,
			"custom_univesp_area": str(normalized.get("area") or ""),
			"custom_univesp_context_json": json.dumps(normalized.get("triage") or {}, ensure_ascii=False),
			"custom_source_bundle_id": str(knowledge.get("bundle_id") or ""),
			"custom_source_bundle_version_id": str(knowledge.get("bundle_version_id") or ""),
			"custom_source_node_id": str(knowledge.get("node_id") or ""),
			"custom_source_path_json": json.dumps(knowledge.get("path") or [], ensure_ascii=False),
			"custom_source_audience": str(knowledge.get("audience") or ""),
			"custom_faq_session_id": str(knowledge.get("faq_session_id") or ""),
			"custom_channel_metadata_json": json.dumps(
				normalized.get("channel_metadata") or {},
				ensure_ascii=False,
			),
			"custom_ai_suggestion_json": "",
		}
	).insert(ignore_permissions=True)
	doc.custom_univesp_protocol = _public_protocol(doc.name, doc.creation)
	doc.save(ignore_permissions=True)

	from univesp_atendimento.ticket_hooks import enqueue_ai_suggestion

	enqueue_ai_suggestion(doc.name)

	return {
		"id": doc.name,
		"protocol": doc.custom_univesp_protocol,
		"status": doc.custom_univesp_status_code,
		"channel": normalized.get("channel"),
		"queue": queue,
	}


def self_test() -> dict:
	"""Bench execute smoke — univesp_atendimento.channel_ingress.self_test"""
	sample = {
		"channel": "email",
		"source": "email",
		"subject": "Ingress self-test",
		"description": "Ticket criado pelo self-test do ingress.",
		"student": {"email": "ingress.selftest@invalid.local", "name": "Self Test"},
		"queue": "atendimento-geral",
		"channel_metadata": {"self_test": True},
	}
	try:
		normalize_channel_payload(sample)
	except ChannelAdapterError as exc:
		return {"ok": False, "stage": "normalize", "error": str(exc)}
	return {"ok": True, "stage": "normalize", "channel": sample["channel"]}


def _priority_name(value) -> str:
	mapping = {
		"low": "Low",
		"baixa": "Low",
		"medium": "Medium",
		"media": "Medium",
		"high": "High",
		"alta": "High",
		"urgent": "Urgent",
		"urgente": "Urgent",
	}
	key = str(value or "medium").strip().lower()
	return mapping.get(key, "Medium")


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


def _public_protocol(name: str, creation) -> str:
	import re

	from frappe.utils import now_datetime

	year = creation.year if hasattr(creation, "year") else now_datetime().year
	suffix = re.sub(r"[^0-9]", "", str(name))[-6:].zfill(6)
	return f"PRT-{year}-{suffix}"
