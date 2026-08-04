import json
import hashlib

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
			"cpf_hash": hashlib.sha256(cpf.encode("utf-8")).hexdigest(),
			"ra": ra,
			"nome": nome or email,
			"polo_id": polo_id,
			"polo_nome": str(raw.get("polo_nome") or "").strip(),
			"curso": str(raw.get("curso") or "").strip(),
			"situacao": str(raw.get("situacao") or "").strip(),
			"matricula_codigo": str(raw.get("matricula_codigo") or "").strip(),
			"enrollment_track": str(raw.get("enrollment_track") or "").strip(),
			"pessoa_codigo": str(raw.get("pessoa_codigo") or "").strip(),
			"source_updated_at": raw.get("source_updated_at"),
			"last_import_at": now,
		}
		values["source_hash"] = hashlib.sha256(
			json.dumps(
				{key: value for key, value in values.items() if key not in {"last_import_at", "source_hash"}},
				ensure_ascii=False,
				sort_keys=True,
				default=str,
			).encode("utf-8")
		).hexdigest()

		existing = frappe.db.get_value("Univesp Student Directory", {"email": email}, "name")
		if existing:
			doc = frappe.get_doc("Univesp Student Directory", existing)
			if doc.source_hash == values["source_hash"]:
				skipped += 1
				continue
			doc.update(values)
			doc.save(ignore_permissions=True)
			updated += 1
		else:
			frappe.get_doc({"doctype": "Univesp Student Directory", **values}).insert(ignore_permissions=True)
			created += 1

	return {"created": created, "updated": updated, "skipped": skipped, "total": len(payload)}
