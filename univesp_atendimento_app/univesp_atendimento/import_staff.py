import json

import frappe
from frappe import _
from frappe.utils import now_datetime

from univesp_atendimento.access_control import actions_for_profile
from univesp_atendimento.univesp_atendimento.doctype.univesp_staff_directory.univesp_staff_directory import (
	build_staff_key,
)

DEFAULT_OP_QUEUES = ["atendimento-geral", "sra"]


def upsert_rows(rows=None):
	"""Upsert em Univesp Staff Directory. Uso via bench execute."""
	payload = rows
	if isinstance(payload, str):
		payload = json.loads(payload)
	if not isinstance(payload, list):
		frappe.throw(_("Lista de operadores obrigatoria."), frappe.ValidationError)

	created = updated = skipped = 0
	now = now_datetime()

	for raw in payload:
		if not isinstance(raw, dict):
			skipped += 1
			continue
		email = str(raw.get("email") or "").strip().lower()
		polo_id = str(raw.get("polo_id") or "").strip()
		nome = str(raw.get("nome") or "").strip()
		if not email or not polo_id:
			skipped += 1
			continue

		values = {
			"staff_key": build_staff_key(email, polo_id),
			"email": email,
			"nome": nome or email,
			"polo_id": polo_id,
			"polo_nome": str(raw.get("polo_nome") or "").strip(),
			"pessoa_codigo": str(raw.get("pessoa_codigo") or "").strip(),
			"cargo_ativo": 1 if int(raw.get("cargo_ativo") or 0) else 0,
			"last_import_at": now,
		}
		values["source_hash"] = _hash_values(values)

		existing = frappe.db.get_value("Univesp Staff Directory", {"staff_key": values["staff_key"]}, "name")
		if existing:
			doc = frappe.get_doc("Univesp Staff Directory", existing)
			if doc.source_hash == values["source_hash"]:
				skipped += 1
				continue
			doc.update(values)
			doc.save(ignore_permissions=True)
			updated += 1
		else:
			frappe.get_doc({"doctype": "Univesp Staff Directory", **values}).insert(ignore_permissions=True)
			created += 1

	return {"created": created, "updated": updated, "skipped": skipped, "total": len(payload)}


def sync_access_profiles_from_staff_directory():
	"""Agrega polos ativos do Staff Directory em Univesp Access Profile (profile_key=op)."""
	if not frappe.db.exists("DocType", "Univesp Staff Directory"):
		frappe.throw(_("DocType Univesp Staff Directory ausente."), frappe.ValidationError)

	rows = frappe.get_all(
		"Univesp Staff Directory",
		filters={"cargo_ativo": 1},
		fields=["email", "nome", "polo_id"],
		limit_page_length=0,
	)
	grouped: dict[str, dict] = {}
	for row in rows:
		email = str(row.email or "").strip().lower()
		polo_id = str(row.polo_id or "").strip()
		if not email or not polo_id:
			continue
		entry = grouped.setdefault(email, {"email": email, "nome": row.nome or email, "polos": set()})
		entry["polos"].add(polo_id)

	created = updated = skipped = 0
	for email, entry in grouped.items():
		existing_name = frappe.db.get_value("Univesp Access Profile", {"user_email": email}, "name")
		scopes = {"polos": sorted(entry["polos"]), "queues": DEFAULT_OP_QUEUES}
		if existing_name:
			doc = frappe.get_doc("Univesp Access Profile", existing_name)
			if doc.profile_key not in {"op", "gestor_polos"}:
				skipped += 1
				continue
			doc.display_name = entry["nome"]
			doc.profile_key = "op"
			doc.active = 1
			doc.scopes_json = frappe.as_json(scopes)
			doc.actions_json = frappe.as_json(actions_for_profile("op"))
			doc.provisioning_source = "academic"
			doc.save(ignore_permissions=True)
			updated += 1
			continue

		frappe.get_doc(
			{
				"doctype": "Univesp Access Profile",
				"user_email": email,
				"display_name": entry["nome"],
				"profile_key": "op",
				"active": 1,
				"provisioning_source": "academic",
				"scopes_json": frappe.as_json(scopes),
				"actions_json": frappe.as_json(actions_for_profile("op")),
			}
		).insert(ignore_permissions=True)
		created += 1

	frappe.db.commit()  # nosemgrep
	return {"created": created, "updated": updated, "skipped": skipped, "emails": len(grouped)}


def _hash_values(values: dict) -> str:
	import hashlib

	payload = {key: values[key] for key in values if key not in {"last_import_at", "source_hash"}}
	return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")).hexdigest()
