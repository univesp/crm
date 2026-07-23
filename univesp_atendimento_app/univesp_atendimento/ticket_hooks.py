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
	"""Stub — Fase D pluga worker Redis/Celery aqui."""
	frappe.logger("univesp_atendimento").info("ai_suggestion_stub ticket=%s", ticket_name)
