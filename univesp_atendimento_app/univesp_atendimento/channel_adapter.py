"""Normalizacao de payloads omnichannel (Fase C)."""

from __future__ import annotations

import frappe
from frappe import _

ALLOWED_CHANNELS = frozenset({"whatsapp", "email", "phone", "portal", "publico"})


class ChannelAdapterError(frappe.ValidationError):
	http_status_code = 422


def normalize_channel_payload(data: dict) -> dict:
	"""Valida shape do contrato omnichannel e mapeia para campos de ticket."""
	if not isinstance(data, dict):
		raise ChannelAdapterError(_("Payload deve ser um objeto JSON."))

	channel = str(data.get("channel") or "").strip().lower()
	if not channel:
		raise ChannelAdapterError(_("Campo channel obrigatorio."))
	if channel not in ALLOWED_CHANNELS:
		raise ChannelAdapterError(_("Canal invalido: {0}.").format(channel))

	subject = str(data.get("subject") or "").strip()
	description = str(data.get("description") or "").strip()
	if not subject:
		raise ChannelAdapterError(_("Assunto obrigatorio."))
	if not description:
		raise ChannelAdapterError(_("Descricao obrigatoria."))

	raw_student = data.get("student")
	if raw_student is not None and not isinstance(raw_student, dict):
		raise ChannelAdapterError(_("Campo student deve ser um objeto."))
	student = raw_student if isinstance(raw_student, dict) else {}

	faq_context = data.get("faq_context")
	if faq_context is not None and not isinstance(faq_context, dict):
		raise ChannelAdapterError(_("Campo faq_context deve ser um objeto."))
	knowledge = _map_faq_context(faq_context)
	if isinstance(data.get("knowledge"), dict):
		knowledge = {**knowledge, **data["knowledge"]}

	channel_metadata = data.get("channel_metadata")
	if channel_metadata is not None and not isinstance(channel_metadata, dict):
		raise ChannelAdapterError(_("Campo channel_metadata deve ser um objeto."))

	attachments = data.get("attachments")
	if attachments is not None and not isinstance(attachments, list):
		raise ChannelAdapterError(_("Campo attachments deve ser uma lista."))

	triage = data.get("triage")
	if triage is not None and not isinstance(triage, dict):
		raise ChannelAdapterError(_("Campo triage deve ser um objeto."))

	source = str(data.get("source") or channel).strip()

	return {
		"channel": channel,
		"source": source,
		"subject": subject,
		"description": description,
		"student": {
			"ra": str(student.get("ra") or "").strip(),
			"email": str(student.get("email") or "").strip().lower(),
			"name": str(student.get("name") or "").strip(),
			"polo": str(student.get("polo") or "").strip(),
			"course": str(student.get("course") or "").strip(),
		},
		"knowledge": knowledge,
		"faq_context": faq_context if isinstance(faq_context, dict) else {},
		"channel_metadata": channel_metadata if isinstance(channel_metadata, dict) else {},
		"attachments": attachments or [],
		"queue": str(data.get("queue") or "").strip(),
		"area": str(data.get("area") or "").strip(),
		"priority": data.get("priority"),
		"triage": triage if isinstance(triage, dict) else {},
	}


def _map_faq_context(faq_context: dict | None) -> dict:
	if not isinstance(faq_context, dict):
		return {}
	bundle_id = str(faq_context.get("bundle_id") or "").strip()
	path = faq_context.get("path")
	if path is not None and not isinstance(path, list):
		raise ChannelAdapterError(_("faq_context.path deve ser uma lista."))
	node_id = ""
	if isinstance(path, list) and path:
		node_id = str(path[-1] or "").strip()
	return {
		"bundle_id": bundle_id,
		"bundle_version_id": str(faq_context.get("bundle_version_id") or "").strip(),
		"node_id": node_id,
		"resolved": bool(faq_context.get("resolved")),
	}
