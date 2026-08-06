import json
import hashlib
import re

import frappe
from frappe import _
from frappe.utils import now_datetime, validate_email_address

from univesp_atendimento.univesp_atendimento.doctype.univesp_student_directory.univesp_student_directory import (
	normalize_cpf,
)


def upsert_rows(rows=None, batch_id=None):
	"""Upsert em Univesp Student Directory. Uso via bench execute."""
	payload = rows
	if isinstance(payload, str):
		payload = json.loads(payload)
	if not isinstance(payload, list):
		frappe.throw(_("Lista de alunos obrigatoria."), frappe.ValidationError)
	batch = str(batch_id or "").strip()
	if batch and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{2,80}", batch):
		frappe.throw(_("Identificador de lote invalido."), frappe.ValidationError)

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
		if not validate_email_address(email, throw=False):
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
			"pessoa_codigo": str(raw.get("pessoa_codigo") or "").strip(),
			"source_updated_at": raw.get("source_updated_at"),
			"last_import_at": now,
		}
		if batch:
			values["import_batch_id"] = batch
		values["source_hash"] = hashlib.sha256(
			json.dumps(
				{
					key: value
					for key, value in values.items()
					if key not in {"last_import_at", "source_hash", "import_batch_id"}
				},
				ensure_ascii=False,
				sort_keys=True,
				default=str,
			).encode("utf-8")
		).hexdigest()

		existing = frappe.db.get_value("Univesp Student Directory", {"email": email}, "name")
		try:
			if existing:
				doc = frappe.get_doc("Univesp Student Directory", existing)
				if doc.source_hash == values["source_hash"]:
					if batch and doc.import_batch_id != batch:
						doc.import_batch_id = batch
						doc.last_import_at = now
						doc.save(ignore_permissions=True)
						updated += 1
					else:
						skipped += 1
					continue
				doc.update(values)
				doc.save(ignore_permissions=True)
				updated += 1
			else:
				frappe.get_doc({"doctype": "Univesp Student Directory", **values}).insert(ignore_permissions=True)
				created += 1
		except frappe.exceptions.InvalidEmailAddressError:
			skipped += 1
			continue

	return {"created": created, "updated": updated, "skipped": skipped, "total": len(payload)}


def upsert_rows_from_file(path=None):
	"""Bench execute — payload grande via arquivo JSON (lista de alunos)."""
	file_path = str(path or "").strip()
	if not file_path:
		frappe.throw(_("Caminho do arquivo obrigatorio."), frappe.ValidationError)
	with open(file_path, encoding="utf-8") as handle:
		payload = json.load(handle)
	return upsert_rows(payload)
