import json

import frappe
from frappe import _
from frappe.utils import now_datetime

from univesp_atendimento.api.v1.common import get_request_context, response


STATES = {"verified", "rejected"}


@frappe.whitelist(methods=["GET"])
def list_link_validations(state: str = "pending"):
	context = get_request_context("view_ticket")
	_require_admin(context)
	requested_state = str(state or "pending").strip().lower()
	if requested_state not in {"pending", "verified", "rejected", "all"}:
		frappe.throw(_("Estado de validação inválido."), frappe.ValidationError)
	filters = {} if requested_state == "all" else {"state": requested_state}
	rows = frappe.get_all(
		"Univesp Link Validation",
		filters=filters,
		fields=[
			"name",
			"ticket",
			"outcome",
			"state",
			"assigned_group",
			"sla_due_at",
			"reviewer",
			"reviewed_at",
			"notes",
			"escalated_at",
			"escalation_group",
		],
		order_by="sla_due_at asc",
		limit_page_length=200,
	)
	for row in rows:
		ticket = frappe.db.get_value(
			"HD Ticket",
			row.ticket,
			[
				"custom_univesp_protocol",
				"custom_student_name",
				"custom_student_email",
				"custom_visitor_phone",
				"custom_student_ra",
				"custom_student_course",
				"custom_student_polo",
			],
			as_dict=True,
		) or {}
		row["protocol"] = ticket.get("custom_univesp_protocol") or row.ticket
		row["person"] = ticket.get("custom_student_name") or "Pessoa não identificada"
		row["email_masked"] = _mask_email(ticket.get("custom_student_email"))
		row["phone_masked"] = _mask_phone(ticket.get("custom_visitor_phone"))
		row["academic_context"] = {
			"ra": _mask_ra(ticket.get("custom_student_ra")),
			"course": ticket.get("custom_student_course") or "",
			"pole": ticket.get("custom_student_polo") or "",
		}
		row["overdue"] = bool(
			row.get("state") == "pending"
			and row.get("sla_due_at")
			and row.get("sla_due_at") < now_datetime()
		)
	return response(rows, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def decide_link_validation(validation_id: str, payload: dict | str | None = None):
	context = get_request_context("view_sensitive_identity")
	_require_admin(context)
	data = _payload(payload)
	decision = str(data.get("decision") or "").strip().lower()
	notes = str(data.get("notes") or "").strip()
	if decision not in STATES:
		frappe.throw(_("Decisão de validação inválida."), frappe.ValidationError)
	if len(notes) < 10:
		frappe.throw(_("Registre uma justificativa com pelo menos 10 caracteres."), frappe.ValidationError)
	doc = frappe.get_doc("Univesp Link Validation", str(validation_id or "").strip())
	if doc.state != "pending":
		frappe.throw(_("Esta validação já foi tratada."), frappe.ValidationError)
	doc.state = decision
	doc.reviewer = context.actor_email
	doc.reviewed_at = now_datetime()
	doc.notes = notes
	doc.save(ignore_permissions=True)
	return response(
		{
			"id": doc.name,
			"ticket": doc.ticket,
			"state": doc.state,
			"reviewed_at": doc.reviewed_at,
		},
		request_id=context.request_id,
	)


def escalate_overdue_link_validations():
	rows = frappe.get_all(
		"Univesp Link Validation",
		filters={
			"state": "pending",
			"sla_due_at": ["<", now_datetime()],
			"escalated_at": ["is", "not set"],
		},
		pluck="name",
		limit_page_length=500,
	)
	for name in rows:
		frappe.db.set_value(
			"Univesp Link Validation",
			name,
			{
				"escalated_at": now_datetime(),
				"escalation_group": "admin-central",
			},
			update_modified=True,
		)
	return len(rows)


def _require_admin(context):
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode tratar validações de vínculo."))


def _payload(value):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value.strip():
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			frappe.throw(_("Payload JSON inválido."), frappe.ValidationError)
			raise exc
	return frappe.form_dict or {}


def _mask_email(value):
	email = str(value or "").strip()
	if "@" not in email:
		return ""
	local, domain = email.split("@", 1)
	return f"{local[:2]}***@{domain}"


def _mask_phone(value):
	digits = "".join(character for character in str(value or "") if character.isdigit())
	return f"***-***-{digits[-4:]}" if len(digits) >= 4 else ""


def _mask_ra(value):
	ra = str(value or "").strip()
	return f"***{ra[-3:]}" if len(ra) >= 3 else ""
