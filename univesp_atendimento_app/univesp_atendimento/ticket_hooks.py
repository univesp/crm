"""Hooks pos-criacao de ticket — extensibilidade IA/omnichannel (Fase C/D)."""

from __future__ import annotations

import json

import frappe


def on_ticket_created(doc, method=None):
	"""No-op no MVP; registra evento para fila IA futura."""
	if frappe.flags.in_import or frappe.flags.in_migrate:
		return
	payload = {
		"ticket": doc.name,
		"protocol": getattr(doc, "custom_univesp_protocol", None),
		"source": getattr(doc, "custom_univesp_source", None) or "portal",
		"queue": getattr(doc, "custom_univesp_queue", None),
	}
	frappe.publish_realtime(
		"univesp_ticket_created",
		payload,
		user=frappe.session.user if frappe.session else None,
		after_commit=True,
	)
	frappe.logger("univesp_atendimento").info(
		"ticket_created %s",
		json.dumps(payload, ensure_ascii=False),
	)


def enqueue_ai_suggestion(ticket_name: str) -> None:
	"""Stub Fase D — grava JSON minimo no ticket; worker real pluga depois."""
	stub = {
		"status": "pending",
		"provider": "stub",
		"ticket_ref": str(ticket_name),
		"queued_at": frappe.utils.now(),
	}
	frappe.db.set_value(
		"HD Ticket",
		ticket_name,
		"custom_ai_suggestion_json",
		json.dumps(stub, ensure_ascii=False),
	)
	frappe.logger("univesp_atendimento").info("ai_suggestion_enqueued ticket=%s", ticket_name)
