import json

import frappe
from frappe import _
from frappe.utils import now_datetime

from univesp_atendimento.univesp_atendimento.doctype.univesp_student_directory.univesp_student_directory import (
	normalize_cpf,
)


def upsert_rows(rows=None):
	"""Upsert em Univesp Student Directory. Uso via bench execute."""
	payload = rows
	if isinstance(payload, str):
		payload = json.loads(payload)
	if not isinstance(payload, list):
		frappe.throw(_("Lista de alunos obrigatoria."), frappe.ValidationError)

	created = updated = skipped = 0
	now = now_datetime()

	for raw in payload:
		if not isinstance(raw, dict):
			skipped += 1
			continue
		email = str(raw.get("email") or "").strip().lower()
		cpf = normalize_cpf(raw.get("cpf") or "")
		ra = str(raw.get("ra") or "").strip()
		nome = str(raw.get("nome") or "").strip()
		polo_id = str(raw.get("polo_id") or "").strip()
		if not email or len(cpf) != 11 or not ra or not polo_id:
			skipped += 1
			continue

		values = {
			"email": email,
			"cpf": cpf,
			"ra": ra,
			"nome": nome or email,
			"polo_id": polo_id,
			"polo_nome": str(raw.get("polo_nome") or "").strip(),
			"curso": str(raw.get("curso") or "").strip(),
			"situacao": str(raw.get("situacao") or "").strip(),
			"pessoa_codigo": str(raw.get("pessoa_codigo") or "").strip(),
			"last_import_at": now,
		}

		existing = frappe.db.get_value("Univesp Student Directory", {"email": email}, "name")
		if existing:
			doc = frappe.get_doc("Univesp Student Directory", existing)
			doc.update(values)
			doc.save(ignore_permissions=True)
			updated += 1
		else:
			frappe.get_doc({"doctype": "Univesp Student Directory", **values}).insert(ignore_permissions=True)
			created += 1

	frappe.db.commit()
	return {"created": created, "updated": updated, "skipped": skipped, "total": len(payload)}
