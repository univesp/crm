import json

import frappe
from frappe import _

from univesp_atendimento.api.v1.common import get_request_context, response
from univesp_atendimento.univesp_atendimento.doctype.univesp_student_directory.univesp_student_directory import (
	normalize_cpf,
)


class StudentValidationError(frappe.ValidationError):
	http_status_code = 422


@frappe.whitelist(methods=["POST"])
def validate(payload: dict | str | None = None):
	context = get_request_context()
	data = _payload(payload)
	email = str(data.get("email") or context.email).strip().lower()
	cpf = normalize_cpf(data.get("cpf") or "")
	ra = str(data.get("ra") or context.ra or "").strip()

	if not email and not cpf:
		raise StudentValidationError(_("Informe email ou CPF para validacao."))

	rows = _lookup_students(email=email, cpf=cpf, ra=ra)
	if not rows:
		return response({"found": False, "student": None}, request_id=context.request_id)
	if len(rows) > 1:
		return response(
			{
				"found": True,
				"ambiguous": True,
				"student": _serialize_student(rows[0]),
				"matches": len(rows),
			},
			request_id=context.request_id,
		)
	return response({"found": True, "student": _serialize_student(rows[0])}, request_id=context.request_id)


def _lookup_students(*, email: str, cpf: str, ra: str):
	filters = []
	if cpf:
		filters.append(["Univesp Student Directory", "cpf", "=", cpf])
	elif email:
		filters.append(["Univesp Student Directory", "email", "=", email])
	else:
		return []
	if ra:
		filters.append(["Univesp Student Directory", "ra", "=", ra])
	return frappe.get_all(
		"Univesp Student Directory",
		filters=filters,
		fields=[
			"email",
			"cpf",
			"ra",
			"nome",
			"polo_id",
			"polo_nome",
			"curso",
			"situacao",
		],
		limit=5,
	)


def _serialize_student(row):
	return {
		"email": row.get("email"),
		"cpf": row.get("cpf"),
		"ra": row.get("ra"),
		"nome": row.get("nome"),
		"polo_id": row.get("polo_id"),
		"polo_nome": row.get("polo_nome"),
		"curso": row.get("curso"),
		"situacao": row.get("situacao"),
	}


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value.strip():
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise StudentValidationError(_("Payload JSON invalido.")) from exc
	return frappe.form_dict or {}
