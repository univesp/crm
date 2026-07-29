import base64
import hashlib
import json
import os

import frappe
from frappe import _
from frappe.utils import add_days, now_datetime
from frappe.utils.file_manager import save_file
from univesp_atendimento.public_email_security import parse_reply_recipient, sign_reply, verify_reply


def send_protocol_confirmation(ticket_name):
	ticket = frappe.get_doc("HD Ticket", ticket_name)
	token = reply_token(ticket.name, ticket.custom_student_email)
	domain = str(frappe.conf.get("public_reply_domain") or "").strip()
	if not domain:
		frappe.throw(_("Domínio de resposta pública não configurado."), frappe.ValidationError)
	frappe.sendmail(
		recipients=[ticket.custom_student_email],
		subject=f"[{ticket.custom_univesp_protocol}] Atendimento UNIVESP",
		message="Seu atendimento foi registrado. Responda este e-mail para complementar o protocolo.",
		reply_to=f"reply+{ticket.name}.{token}@{domain}",
		reference_doctype="HD Ticket",
		reference_name=ticket.name,
	)


def ingest_reply(payload):
	data = payload if isinstance(payload, dict) else json.loads(payload or "{}")
	message_id = str(data.get("message_id") or "").strip()
	if not message_id:
		frappe.throw(_("Message-ID obrigatório."), frappe.ValidationError)
	if frappe.db.exists("Communication", {"message_id": message_id}):
		return {"duplicate": True}
	ticket_id, supplied_token = parse_reply_recipient(data.get("recipient"))
	if not ticket_id or not frappe.db.exists("HD Ticket", ticket_id):
		raise frappe.PermissionError(_("Resposta de e-mail inválida."))
	ticket = frappe.get_doc("HD Ticket", ticket_id)
	if not verify_reply(
		frappe.conf.get("public_email_reply_secret"),
		ticket.name,
		ticket.custom_student_email,
		supplied_token,
	):
		raise frappe.PermissionError(_("Resposta de e-mail inválida."))
	sender = str(data.get("sender") or "").strip().lower()
	if sender != str(ticket.custom_student_email or "").strip().lower():
		raise frappe.PermissionError(_("Remetente não corresponde ao protocolo."))
	communication = frappe.get_doc(
		{
			"doctype": "Communication",
			"communication_type": "Communication",
			"communication_medium": "Email",
			"sent_or_received": "Received",
			"subject": str(data.get("subject") or ticket.subject),
			"content": str(data.get("text") or "").strip(),
			"sender": sender,
			"recipients": str(data.get("recipient") or ""),
			"message_id": message_id,
			"reference_doctype": "HD Ticket",
			"reference_name": ticket.name,
		}
	).insert(ignore_permissions=True)
	for attachment in data.get("attachments") or []:
		_save_email_attachment(ticket, attachment)
	return {"duplicate": False, "communication": communication.name, "ticket": ticket.name}


def reply_token(ticket_id, email):
	secret = str(frappe.conf.get("public_email_reply_secret") or "")
	if not secret:
		frappe.throw(_("Segredo de resposta pública não configurado."), frappe.ValidationError)
	return sign_reply(secret, ticket_id, email)


def _save_email_attachment(ticket, attachment):
	from univesp_atendimento.api.v1.public import _scan_document, _validate_document

	content = base64.b64decode(str(attachment.get("content_base64") or ""), validate=True)
	filename = str(attachment.get("filename") or "")
	content_type = str(attachment.get("content_type") or "")
	_validate_document(filename, content_type, content)
	if _scan_document(filename, content_type, content) != "clean":
		frappe.throw(_("Anexo de e-mail rejeitado pelo antimalware."), frappe.ValidationError)
	file_doc = save_file(filename, content, "HD Ticket", ticket.name, is_private=1)
	frappe.get_doc(
		{
			"doctype": "Univesp Public Document",
			"ticket": ticket.name,
			"file": file_doc.name,
			"original_name": filename,
			"content_type": content_type,
			"size_bytes": len(content),
			"sha256": hashlib.sha256(content).hexdigest(),
			"scan_status": "clean",
			"scan_detail": "Anexo recebido por e-mail e verificado.",
			"uploaded_at": now_datetime(),
			"scanned_at": now_datetime(),
			"retention_until": add_days(
				now_datetime(),
				int(
					os.getenv("PUBLIC_DOCUMENT_RETENTION_DAYS")
					or frappe.conf.get("public_document_retention_days", 180)
				),
			),
		}
	).insert(ignore_permissions=True)
