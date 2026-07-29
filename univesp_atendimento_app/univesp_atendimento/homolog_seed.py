"""Seeds idempotentes para homolog — bench execute targets."""

from __future__ import annotations

import hashlib
import json
import os

import frappe
from frappe.utils import now_datetime

from univesp_atendimento.access_control import actions_for_profile
from univesp_atendimento.import_students import upsert_rows
from univesp_atendimento.knowledge_graph import assert_valid_knowledge_graph


FAQ_V3_PILOT_CONFIRMATION = "homolog-faq-v3"
FAQ_V3_PILOT_BUNDLE_KEY = "acesso-ava"
FAQ_V3_PILOT_VERSION_ID = "acesso-ava-homolog-v1"
FAQ_V3_FLAGS = (
	"knowledge_v3_read",
	"knowledge_v3_write",
	"routing_server_authority",
	"knowledge_collaboration",
	"faq_public_anonymous",
	"faq_public_documents",
	"faq_link_validation",
	"faq_public_email_thread",
	"knowledge_media_upload",
)
FAQ_V2_SEEDS = (
	"faq-aluno-seed.json",
	"faq-op-seed.json",
	"faq-publico-seed.json",
)

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
		"scopes_json": {
			"regional_pools": ["pool-homolog-sp"],
			"knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY],
		},
	},
	{
		"user_email": "analista.faq@univesp.br",
		"display_name": "Analista FAQ Homolog",
		"profile_key": "analista_area",
		"scopes_json": {
			"areas": ["tecnologia"],
			"knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY],
		},
	},
	{
		"user_email": "gestor.faq@univesp.br",
		"display_name": "Gestor FAQ Homolog",
		"profile_key": "gestor_area",
		"scopes_json": {
			"areas": ["tecnologia"],
			"knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY],
		},
	},
	{
		"user_email": "publicador.faq@univesp.br",
		"display_name": "Publicador FAQ Homolog",
		"profile_key": "admin_central",
		"scopes_json": {},
	},
]

HOMOLOG_STUDENT_DIRECTORY = [
	{
		"email": "teste@aluno.univesp.br",
		"cpf": "11144477735",
		"ra": "HOMOLOG001",
		"nome": "Aluno Homolog",
		"polo_id": "237",
		"polo_nome": "Polo Homolog SP",
		"curso": "Licenciatura em Computacao",
		"situacao": "Ativo",
	},
	{
		"email": "aluno2.homolog@aluno.univesp.br",
		"cpf": "52998224725",
		"ra": "HOMOLOG002",
		"nome": "Aluno Homolog Dois",
		"polo_id": "237",
		"polo_nome": "Polo Homolog SP",
		"curso": "Administracao",
		"situacao": "Ativo",
	},
	{
		"email": "visitante.homolog@aluno.univesp.br",
		"cpf": "39053344705",
		"ra": "HOMOLOG003",
		"nome": "Aluno Homolog Tres",
		"polo_id": "238",
		"polo_nome": "Polo Homolog RJ",
		"curso": "Pedagogia",
		"situacao": "Ativo",
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


def upsert_homolog_student_directory() -> dict:
	return upsert_rows(HOMOLOG_STUDENT_DIRECTORY)


def bootstrap_faq_v3_pilot(confirmation: str = "") -> dict:
	"""Prepara dados e flags do piloto somente no ambiente homolog explicitamente confirmado."""
	_require_homolog_confirmation(confirmation)
	queue_result = upsert_homolog_queues()
	profile_result = upsert_homolog_access_profiles()
	student_result = upsert_homolog_student_directory()
	authorization_result = upsert_homolog_knowledge_authorization()
	v2_result = publish_homolog_v2_seeds()
	v3_result = publish_homolog_v3_seed()
	flag_result = enable_homolog_faq_v3_flags()
	frappe.db.commit()
	return {
		"queues": queue_result,
		"access_profiles": profile_result,
		"student_directory": student_result,
		"authorization": authorization_result,
		"v2": v2_result,
		"v3": v3_result,
		"flags": flag_result,
	}


def upsert_homolog_queues() -> dict:
	created: list[str] = []
	updated: list[str] = []
	for queue_key in ("atendimento-geral", "sra"):
		if frappe.db.exists("HD Team", queue_key):
			doc = frappe.get_doc("HD Team", queue_key)
			if doc.disabled:
				doc.disabled = 0
				doc.save(ignore_permissions=True)
			updated.append(queue_key)
			continue
		frappe.get_doc(
			{
				"doctype": "HD Team",
				"team_name": queue_key,
				"disabled": 0,
				"users": [{"user": "Administrator"}],
			}
		).insert(ignore_permissions=True)
		created.append(queue_key)
	return {"created": created, "updated": updated}


def upsert_homolog_knowledge_authorization() -> dict:
	approver_group = "faq-acesso-ava-aprovadores"
	approver_profile = "faq-approver-manager"
	approver_email = "gestor.faq@univesp.br"
	_upsert_homolog_permission_profile(
		approver_profile,
		label="Gestor — aprovar FAQ do tema",
		base_persona="gestor_area",
		scope_type="areas",
		capabilities=["approve_knowledge"],
	)
	if frappe.db.exists("Univesp Access Group", approver_group):
		group = frappe.get_doc("Univesp Access Group", approver_group)
		group.update(
			{
				"label": "Aprovadores FAQ — Acesso ao AVA",
				"permission_profile": approver_profile,
				"scopes_json": json.dumps(
					{"areas": ["tecnologia"], "knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY]}
				),
				"members_json": json.dumps([approver_email]),
				"active": 1,
			}
		)
		group.save(ignore_permissions=True)
	else:
		frappe.get_doc(
			{
				"doctype": "Univesp Access Group",
				"group_key": approver_group,
				"label": "Aprovadores FAQ — Acesso ao AVA",
				"permission_profile": approver_profile,
				"scopes_json": json.dumps(
					{"areas": ["tecnologia"], "knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY]}
				),
				"members_json": json.dumps([approver_email]),
				"active": 1,
			}
		).insert(ignore_permissions=True)

	if frappe.db.exists("Univesp Knowledge Theme Governance", FAQ_V3_PILOT_BUNDLE_KEY):
		governance = frappe.get_doc(
			"Univesp Knowledge Theme Governance",
			FAQ_V3_PILOT_BUNDLE_KEY,
		)
		governance.editor_areas = []
		governance.update(
			{
				"theme_label": "Acesso ao AVA",
				"owner_email": "gestor.faq@univesp.br",
				"approver_group": approver_group,
				"suggestion_sla_hours": 72,
				"fallback_admin_group": approver_group,
				"active": 1,
			}
		)
		governance.append(
			"editor_areas",
			{"area_key": "tecnologia", "area_label": "Tecnologia", "can_edit_draft": 1},
		)
		governance.save(ignore_permissions=True)
	else:
		frappe.get_doc(
			{
				"doctype": "Univesp Knowledge Theme Governance",
				"theme_key": FAQ_V3_PILOT_BUNDLE_KEY,
				"theme_label": "Acesso ao AVA",
				"owner_email": "gestor.faq@univesp.br",
				"approver_group": approver_group,
				"editor_areas": [
					{
						"area_key": "tecnologia",
						"area_label": "Tecnologia",
						"can_edit_draft": 1,
					}
				],
				"suggestion_sla_hours": 72,
				"fallback_admin_group": approver_group,
				"active": 1,
			}
		).insert(ignore_permissions=True)

	assignments = []
	for email, permission_profile, scopes in (
		(
			"op@polo.univesp.br",
			"faq-contributor-op",
			{"queues": ["atendimento-geral", "sra"], "knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY]},
		),
		(
			"bpo.regional@externo.univesp.br",
			"faq-contributor-bpo",
			{
				"regional_pools": ["pool-homolog-sp"],
				"knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY],
			},
		),
	):
		filters = {
			"subject_type": "person",
			"subject_id": email,
			"permission_profile": permission_profile,
		}
		name = frappe.db.get_value("Univesp Permission Assignment", filters, "name")
		values = {
			"scopes_json": json.dumps(scopes),
			"justification": "Piloto homolog FAQ v3",
			"active": 1,
		}
		if name:
			doc = frappe.get_doc("Univesp Permission Assignment", name)
			doc.update(values)
			doc.save(ignore_permissions=True)
		else:
			doc = frappe.get_doc(
				{
					"doctype": "Univesp Permission Assignment",
					**filters,
					**values,
				}
			).insert(ignore_permissions=True)
		assignments.append(doc.name)
	return {"approver_group": approver_group, "assignments": assignments}


def _upsert_homolog_permission_profile(
	profile_key: str,
	*,
	label: str,
	base_persona: str,
	scope_type: str,
	capabilities: list[str],
):
	values = {
		"label": label,
		"base_persona": base_persona,
		"scope_type": scope_type,
		"capabilities_json": json.dumps(capabilities),
		"active": 1,
		"system_profile": 1,
	}
	if frappe.db.exists("Univesp Permission Profile", profile_key):
		doc = frappe.get_doc("Univesp Permission Profile", profile_key)
		doc.update(values)
		doc.save(ignore_permissions=True)
		return doc
	return frappe.get_doc(
		{
			"doctype": "Univesp Permission Profile",
			"profile_key": profile_key,
			**values,
		}
	).insert(ignore_permissions=True)


def publish_homolog_v2_seeds() -> dict:
	doc = frappe.get_single("Univesp Knowledge Library")
	try:
		library = json.loads(doc.library_json or "{}")
	except json.JSONDecodeError as exc:
		raise frappe.ValidationError("Biblioteca v2 inválida; seed de homolog abortado.") from exc
	if not isinstance(library, dict):
		library = {}
	backup = _backup_v2_library(doc.library_json or "{}")
	bundles = library.get("bundles")
	if not isinstance(bundles, list):
		bundles = []
	index = {
		str(entry.get("bundleId") or ""): position
		for position, entry in enumerate(bundles)
		if isinstance(entry, dict)
	}
	published = []
	for seed_name in FAQ_V2_SEEDS:
		package = _load_seed(seed_name)
		package.setdefault("versioning", {})["publication_status"] = "published"
		bundle_id = str(package["faq_id"])
		entry = {
			"bundleId": bundle_id,
			"title": str((package.get("metadata") or {}).get("title") or bundle_id),
			"faqType": str(package["tipo_faq"]),
			"workspace": {
				"draftBundle": package,
				"publishedBundle": package,
				"workflowStatus": "Published",
				"publishConfig": {
					"publishMode": "immediate",
					"effectiveStartAt": None,
					"effectiveEndAt": None,
					"priority": 50,
					"displayRank": 50,
					"isFeatured": False,
					"conditions": "",
				},
			},
		}
		if bundle_id in index:
			bundles[index[bundle_id]] = entry
		else:
			index[bundle_id] = len(bundles)
			bundles.append(entry)
		published.append(bundle_id)
	library.update({"schemaVersion": "faq-builder-library-v1", "bundles": bundles})
	doc.library_json = json.dumps(library, ensure_ascii=False, separators=(",", ":"))
	doc.updated_by_email = "publicador.faq@univesp.br"
	doc.updated_at = now_datetime()
	doc.save(ignore_permissions=True)
	return {"published_bundle_ids": published, "backup": backup, "total_bundles": len(bundles)}


def publish_homolog_v3_seed() -> dict:
	payload = _load_seed("faq-v3-acesso-ava-seed.json")
	assert_valid_knowledge_graph(payload)
	payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
	payload_sha256 = hashlib.sha256(payload_json.encode("utf-8")).hexdigest()
	if frappe.db.exists("Univesp Knowledge Version", FAQ_V3_PILOT_VERSION_ID):
		version = frappe.get_doc("Univesp Knowledge Version", FAQ_V3_PILOT_VERSION_ID)
		if hashlib.sha256(version.payload_json.encode("utf-8")).hexdigest() != payload_sha256:
			raise frappe.ValidationError(
				"Versão fixa do piloto já existe com conteúdo divergente; crie nova versão auditada."
			)
		bundle = frappe.get_doc("Univesp Knowledge Bundle", version.bundle)
		if (
			version.lifecycle_state != "published"
			or bundle.bundle_key != FAQ_V3_PILOT_BUNDLE_KEY
			or bundle.published_version != version.name
		):
			raise frappe.ValidationError(
				"Piloto v3 encontrado em estado parcial; corrija o lifecycle antes de reexecutar."
			)
		return {
			"bundle_key": FAQ_V3_PILOT_BUNDLE_KEY,
			"version_id": version.version_id,
			"status": version.lifecycle_state,
			"payload_sha256": payload_sha256,
			"idempotent": True,
		}

	if frappe.db.exists("Univesp Knowledge Bundle", FAQ_V3_PILOT_BUNDLE_KEY):
		raise frappe.ValidationError(
			"Bundle acesso-ava já existe sem a versão fixa do piloto; migração manual necessária."
		)
	now = now_datetime()
	bundle = frappe.get_doc(
		{
			"doctype": "Univesp Knowledge Bundle",
			"bundle_key": FAQ_V3_PILOT_BUNDLE_KEY,
			"title": "Acesso ao AVA",
			"theme_key": FAQ_V3_PILOT_BUNDLE_KEY,
			"audience_profile": "mixed",
			"status": "active",
			"legacy_v2_bundle_id": "acesso-ava-seed",
			"created_by_email": "analista.faq@univesp.br",
			"created_at": now,
		}
	).insert(ignore_permissions=True)
	version = frappe.get_doc(
		{
			"doctype": "Univesp Knowledge Version",
			"version_id": FAQ_V3_PILOT_VERSION_ID,
			"bundle": bundle.name,
			"version_label": "Piloto homolog v1",
			"revision": 1,
			"lifecycle_state": "draft",
			"payload_json": payload_json,
			"change_summary": "Carga inicial auditada do piloto acesso ao AVA.",
			"author_email": "analista.faq@univesp.br",
			"timezone": "America/Sao_Paulo",
			"import_source": "json",
			"migration_idempotency_key": "homolog-acesso-ava-v1",
		}
	).insert(ignore_permissions=True)
	bundle.draft_version = version.name
	bundle.save(ignore_permissions=True)

	version.lifecycle_state = "pending_approval"
	version.revision = 2
	version.flags.knowledge_lifecycle_transition = True
	version.save(ignore_permissions=True)
	version.lifecycle_state = "approved"
	version.approver_email = "gestor.faq@univesp.br"
	version.approved_at = now
	version.flags.knowledge_lifecycle_transition = True
	version.save(ignore_permissions=True)
	bundle.draft_version = ""
	bundle.save(ignore_permissions=True)
	version.lifecycle_state = "published"
	version.publisher_email = "publicador.faq@univesp.br"
	version.published_at = now
	version.flags.knowledge_lifecycle_transition = True
	version.save(ignore_permissions=True)
	bundle.published_version = version.name
	bundle.save(ignore_permissions=True)
	_record_pilot_publication_audit(version, payload_sha256)
	return {
		"bundle_key": bundle.bundle_key,
		"version_id": version.version_id,
		"status": version.lifecycle_state,
		"payload_sha256": payload_sha256,
		"idempotent": False,
	}


def _record_pilot_publication_audit(version, payload_sha256: str):
	request_id = f"homolog-seed:{version.version_id}"
	if frappe.db.exists("Univesp Access Audit", {"request_id": request_id}):
		return
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": "publicador.faq@univesp.br",
			"target_email": "gestor.faq@univesp.br",
			"operation": "homolog_faq_v3_seed_published",
			"reason": "Publicação controlada do piloto FAQ v3 em homolog.",
			"before_json": json.dumps(
				{
					"lifecycle_state": "draft",
					"author_email": "analista.faq@univesp.br",
				}
			),
			"after_json": json.dumps(
				{
					"lifecycle_state": version.lifecycle_state,
					"approver_email": version.approver_email,
					"publisher_email": version.publisher_email,
					"payload_sha256": payload_sha256,
				}
			),
			"request_id": request_id,
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)


def enable_homolog_faq_v3_flags() -> dict:
	settings = frappe.get_single("Univesp Runtime Settings")
	for fieldname in FAQ_V3_FLAGS:
		settings.set(fieldname, 1)
	settings.updated_by_email = "publicador.faq@univesp.br"
	settings.updated_at = now_datetime()
	settings.save(ignore_permissions=True)
	return {fieldname: bool(settings.get(fieldname)) for fieldname in FAQ_V3_FLAGS}


def inspect_faq_v3_pilot() -> dict:
	v2 = {}
	for faq_type in ("aluno", "op", "publico"):
		from univesp_atendimento.api.v1.knowledge import _build_published_faq_entries

		entries, _doc = _build_published_faq_entries(faq_type)
		v2[faq_type] = [entry["bundle_id"] for entry in entries]
	settings = frappe.get_single("Univesp Runtime Settings")
	bundle = (
		frappe.get_doc("Univesp Knowledge Bundle", FAQ_V3_PILOT_BUNDLE_KEY)
		if frappe.db.exists("Univesp Knowledge Bundle", FAQ_V3_PILOT_BUNDLE_KEY)
		else None
	)
	return {
		"v2": v2,
		"v3": {
			"bundle_key": bundle.bundle_key if bundle else "",
			"published_version": bundle.published_version if bundle else "",
		},
		"flags": {fieldname: bool(settings.get(fieldname)) for fieldname in FAQ_V3_FLAGS},
		"queues": {
			queue_key: bool(frappe.db.exists("HD Team", {"name": queue_key, "disabled": 0}))
			for queue_key in ("atendimento-geral", "sra")
		},
	}


def _require_homolog_confirmation(confirmation: str):
	if (
		os.getenv("DEPLOYMENT_ENV", "").strip().lower() != "homolog"
		or str(confirmation or "").strip() != FAQ_V3_PILOT_CONFIRMATION
	):
		raise frappe.PermissionError("Bootstrap FAQ v3 exige DEPLOYMENT_ENV=homolog e confirmação explícita.")


def _load_seed(file_name: str) -> dict:
	path = frappe.get_app_source_path("crm", "docs", "seeds", file_name)
	with open(path, encoding="utf-8") as handle:
		value = json.load(handle)
	if not isinstance(value, dict):
		raise frappe.ValidationError(f"Seed inválido: {file_name}")
	return value


def _backup_v2_library(library_json: str) -> dict:
	payload = str(library_json or "{}")
	digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
	file_name = f"faq-v2-before-v3-{digest[:16]}.json"
	existing = frappe.db.get_value(
		"File",
		{"file_name": file_name, "is_private": 1},
		["name", "file_url"],
		as_dict=True,
	)
	if existing:
		return {"file": existing.name, "file_url": existing.file_url, "sha256": digest}
	doc = frappe.get_doc(
		{
			"doctype": "File",
			"file_name": file_name,
			"is_private": 1,
			"content": payload,
		}
	).insert(ignore_permissions=True)
	return {"file": doc.name, "file_url": doc.file_url, "sha256": digest}


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
		"student_directory": frappe.get_all(
			"Univesp Student Directory",
			fields=["email", "ra", "polo_id", "situacao"],
			filters={"ra": ["like", "HOMOLOG%"]},
			limit_page_length=0,
		),
	}
