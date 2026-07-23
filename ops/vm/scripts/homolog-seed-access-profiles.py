"""Idempotent homolog access profiles for dev bypass demo. Run via bench execute."""
from __future__ import annotations

import json

import frappe

from univesp_atendimento.access_control import actions_for_profile

HOMOLOG_ACCESS_PROFILES = [
	{
		"user_email": "bruno.miyasato@univesp.br",
		"display_name": "Bruno Miyasato",
		"profile_key": "admin_central",
		"scopes_json": {},
	},
	{
		"user_email": "admin@univesp.br",
		"display_name": "Admin Central Homolog",
		"profile_key": "admin_central",
		"scopes_json": {},
	},
	{
		"user_email": "teste@aluno.univesp.br",
		"display_name": "Aluno Homolog",
		"profile_key": "aluno",
		"ra": "HOMOLOG001",
		"scopes_json": {},
	},
	{
		"user_email": "op@polo.univesp.br",
		"display_name": "OP Homolog",
		"profile_key": "op",
		"scopes_json": {"queues": ["atendimento-geral", "sra"]},
	},
	{
		"user_email": "bpo.regional@externo.univesp.br",
		"display_name": "Operador BPO Regional Homolog",
		"profile_key": "op_externo",
		"scopes_json": {"regional_pools": ["pool-homolog-sp"]},
	},
]


def upsert_homolog_access_profiles() -> dict:
	created: list[str] = []
	updated: list[str] = []
	for row in HOMOLOG_ACCESS_PROFILES:
		profile_key = row["profile_key"]
		actions = actions_for_profile(profile_key)
		payload = {
			"doctype": "Univesp Access Profile",
			"user_email": row["user_email"],
			"display_name": row["display_name"],
			"profile_key": profile_key,
			"active": 1,
			"provisioning_source": "manual",
			"scopes_json": json.dumps(row["scopes_json"]),
			"actions_json": json.dumps(actions),
		}
		if row.get("ra"):
			payload["ra"] = row["ra"]
		existing = frappe.db.get_value("Univesp Access Profile", {"user_email": row["user_email"]}, "name")
		if existing:
			doc = frappe.get_doc("Univesp Access Profile", existing)
			doc.update(payload)
			doc.save(ignore_permissions=True)
			updated.append(row["user_email"])
		else:
			frappe.get_doc(payload).insert(ignore_permissions=True)
			created.append(row["user_email"])
	frappe.db.commit()
	return {"created": created, "updated": updated}


def inspect_homolog_state() -> dict:
	return {
		"permission_profiles": frappe.get_all(
			"Univesp Permission Profile",
			fields=["name", "profile_key", "scope_type"],
			limit_page_length=0,
		),
		"hd_teams": frappe.get_all("HD Team", fields=["name"], limit_page_length=0),
		"access_profiles": frappe.get_all(
			"Univesp Access Profile",
			fields=["name", "user_email", "profile_key", "scopes_json"],
			limit_page_length=0,
		),
	}
