import json

import frappe
from frappe import _

from univesp_atendimento.api.v1.common import response, verify_gateway_only
from univesp_atendimento.channel_adapter import ChannelAdapterError
from univesp_atendimento.channel_ingress import ChannelIngressError, create_channel_ticket, verify_ingress_secret


@frappe.whitelist(methods=["POST"])
def create_ticket(payload: dict | str | None = None):
	"""Webhook omnichannel — exige gateway key; shape via channel_adapter."""
	verify_gateway_only()
	verify_ingress_secret()
	data = _payload(payload)
	try:
		result = create_channel_ticket(data)
	except ChannelAdapterError as exc:
		raise ChannelIngressError(str(exc)) from exc
	return response(result, request_id=frappe.get_request_header("X-Request-ID") or "")


@frappe.whitelist(methods=["POST"])
def receive_public_email_reply(payload: dict | str | None = None):
	verify_gateway_only()
	verify_ingress_secret()
	settings = frappe.get_single("Univesp Runtime Settings")
	if not bool(getattr(settings, "faq_public_email_thread", False)):
		raise frappe.PermissionError(_("Respostas públicas por e-mail estão desabilitadas."))
	from univesp_atendimento.public_email import ingest_reply

	return response(
		ingest_reply(_payload(payload)),
		request_id=frappe.get_request_header("X-Request-ID") or "",
	)


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value.strip():
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise ChannelIngressError(_("Payload JSON invalido.")) from exc
	return frappe.form_dict or {}
