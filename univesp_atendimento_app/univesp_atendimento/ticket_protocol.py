"""Persistência segura do protocolo público do ticket."""

from __future__ import annotations


def persist_ticket_protocol(frappe_module, doc, protocol: str) -> str:
	"""Grava o protocolo sem salvar novamente o documento recém-inserido.

	Hooks do Helpdesk podem atualizar o ticket durante ``after_insert``. Um
	``doc.save()`` subsequente usa o timestamp anterior e falha por concorrência.
	"""
	value = str(protocol or "").strip()
	frappe_module.db.set_value(
		"HD Ticket",
		doc.name,
		"custom_univesp_protocol",
		value,
		update_modified=False,
	)
	doc.custom_univesp_protocol = value
	return value
