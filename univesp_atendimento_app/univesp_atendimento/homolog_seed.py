"""Seeds idempotentes para homolog — bench execute targets."""

from __future__ import annotations

import hashlib
import json
import os
import smtplib
import ssl
from pathlib import Path

import frappe
from frappe.utils import now_datetime

from univesp_atendimento.access_control import actions_for_profile
from univesp_atendimento.import_students import upsert_rows
from univesp_atendimento.knowledge_graph import assert_valid_knowledge_graph
from univesp_atendimento.provisioning import ensure_frappe_user


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
HOMOLOG_BUNDLE_HYGIENE_ALLOWLIST = ("teste", "matricula")

HOMOLOG_ACCESS_PROFILES = [
	{
		"user_email": "bruno.miyasato@univesp.br",
		"display_name": "Bruno Miyasato",
		"profile_key": "admin_central",
		"scopes_json": {"areas": ["tecnologia"]},
	},
	{
		"user_email": "admin@univesp.br",
		"display_name": "Admin Central Homolog",
		"profile_key": "admin_central",
		"scopes_json": {"areas": ["tecnologia"]},
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
		"scopes_json": {"areas": ["tecnologia"]},
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


def sync_homolog_frappe_users() -> dict:
	created: list[str] = []
	for row in HOMOLOG_ACCESS_PROFILES:
		email = str(row["user_email"]).strip().lower()
		if frappe.db.exists("User", email):
			continue
		ensure_frappe_user(email, row.get("display_name"))
		created.append(email)
	return {"created": created}


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
		ensure_frappe_user(row["user_email"], row.get("display_name"))
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
	approver_emails = [
		"gestor.faq@univesp.br",
		"bruno.miyasato@univesp.br",
		"admin@univesp.br",
	]
	_upsert_homolog_permission_profile(
		approver_profile,
		label="Gestor — aprovar FAQ do tema",
		base_persona="gestor_area",
		scope_type="areas",
		capabilities=["approve_knowledge"],
	)
	if frappe.db.exists("Univesp Access Group", approver_group):
		group = frappe.get_doc("Univesp Access Group", approver_group)
		existing_members = frappe.parse_json(group.members_json or "[]")
		members = list(
			dict.fromkeys(
				str(item).strip().lower()
				for item in [*approver_emails, *existing_members]
				if str(item).strip()
			)
		)
		group.update(
			{
				"label": "Aprovadores FAQ — Acesso ao AVA",
				"permission_profile": approver_profile,
				"scopes_json": json.dumps(
					{"areas": ["tecnologia"], "knowledge_themes": [FAQ_V3_PILOT_BUNDLE_KEY]}
				),
				"members_json": json.dumps(members),
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
				"members_json": json.dumps(approver_emails),
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
		"public_email": _public_email_readiness(),
	}


def verify_public_email_transport() -> dict:
	"""Confirma transporte SMTP sem enviar mensagem."""
	_require_homolog_confirmation(FAQ_V3_PILOT_CONFIRMATION)
	readiness = _public_email_readiness()
	if not readiness["ready"]:
		raise frappe.ValidationError("Configuração de e-mail público incompleta em homolog.")

	if _env_truthy("SMTP_BOOTSTRAP_SKIP_LIVE_PROBE"):
		return {
			"ready": True,
			"live_probe_skipped": True,
			"authentication_mode": readiness["authentication_mode"],
			"authenticated": readiness["authentication_mode"] == "credentials",
			"tls": readiness["tls"],
			"ssl": readiness["ssl"],
			"reply_domain_configured": True,
		}

	host = str(frappe.conf.get("mail_server") or "")
	port = int(frappe.conf.get("mail_port") or 0)
	username = str(frappe.conf.get("mail_login") or "")
	password = str(frappe.conf.get("mail_password") or "")
	use_ssl = _config_bool(frappe.conf.get("use_ssl"))
	use_tls = _config_bool(frappe.conf.get("use_tls"))
	no_authentication = _config_bool(frappe.conf.get("no_smtp_authentication"))
	from_email = str(frappe.conf.get("auto_email_id") or "").strip()
	client = None
	try:
		if use_ssl:
			client = smtplib.SMTP_SSL(host, port, timeout=15, context=ssl.create_default_context())
		else:
			client = smtplib.SMTP(host, port, timeout=15)
			client.ehlo()
			if use_tls:
				client.starttls(context=ssl.create_default_context())
				client.ehlo()
		if no_authentication:
			code, _message = client.mail(from_email)
			if int(code) >= 400:
				raise frappe.ValidationError("Relay SMTP recusou o remetente institucional.")
			client.rset()
		else:
			client.login(username, password)
		code, _message = client.noop()
		if int(code) >= 400:
			raise frappe.ValidationError("Servidor SMTP recusou a verificação de prontidão.")
	finally:
		if client is not None:
			try:
				client.quit()
			except (OSError, smtplib.SMTPException):
				client.close()
	return {
		"ready": True,
		"authentication_mode": "trusted_relay" if no_authentication else "credentials",
		"authenticated": not no_authentication,
		"tls": use_tls,
		"ssl": use_ssl,
		"reply_domain_configured": True,
	}


def _public_email_readiness() -> dict:
	required = {
		"public_reply_domain": str(frappe.conf.get("public_reply_domain") or "").strip(),
		"public_email_reply_secret": str(frappe.conf.get("public_email_reply_secret") or ""),
		"univesp_ingress_shared_secret": str(frappe.conf.get("univesp_ingress_shared_secret") or ""),
		"auto_email_id": str(frappe.conf.get("auto_email_id") or "").strip(),
		"mail_server": str(frappe.conf.get("mail_server") or "").strip(),
	}
	if not _config_bool(frappe.conf.get("no_smtp_authentication")):
		required["mail_login"] = str(frappe.conf.get("mail_login") or "").strip()
		required["mail_password"] = str(frappe.conf.get("mail_password") or "")
	missing = [key for key, value in required.items() if not value]
	if len(required["public_email_reply_secret"]) < 32:
		missing.append("public_email_reply_secret_length")
	if len(required["univesp_ingress_shared_secret"]) < 32:
		missing.append("univesp_ingress_shared_secret_length")
	port = int(frappe.conf.get("mail_port") or 0)
	if port < 1 or port > 65535:
		missing.append("mail_port")
	if _config_bool(frappe.conf.get("use_ssl")) and _config_bool(frappe.conf.get("use_tls")):
		missing.append("mail_transport_mode")
	muted = _config_bool(frappe.conf.get("mute_emails"))
	if muted:
		missing.append("mute_emails")
	return {
		"ready": not missing,
		"missing": sorted(set(missing)),
		"muted": muted,
		"tls": _config_bool(frappe.conf.get("use_tls")),
		"ssl": _config_bool(frappe.conf.get("use_ssl")),
		"authentication_mode": (
			"trusted_relay" if _config_bool(frappe.conf.get("no_smtp_authentication")) else "credentials"
		),
	}


def _config_bool(value) -> bool:
	if isinstance(value, bool):
		return value
	return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _env_truthy(name: str) -> bool:
	return _config_bool(os.getenv(name))


def _require_homolog_confirmation(confirmation: str):
	if (
		os.getenv("DEPLOYMENT_ENV", "").strip().lower() != "homolog"
		or str(confirmation or "").strip() != FAQ_V3_PILOT_CONFIRMATION
	):
		raise frappe.PermissionError("Bootstrap FAQ v3 exige DEPLOYMENT_ENV=homolog e confirmação explícita.")


def _load_seed(file_name: str) -> dict:
	allowed_seeds = {*FAQ_V2_SEEDS, "faq-v3-acesso-ava-seed.json"}
	if file_name not in allowed_seeds:
		raise frappe.ValidationError("Seed fora da lista institucional permitida.")
	path = Path(__file__).resolve().parent / "seeds" / file_name
	if not path.is_file():
		raise frappe.ValidationError(f"Seed institucional não empacotado: {file_name}")
	# The filename is selected exclusively from the immutable allowlist above.
	with open(path, encoding="utf-8") as handle:  # nosemgrep
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


def diagnose_knowledge_bundle(bundle_key: str) -> dict:
	"""Lista bloqueios reais de submit/publish para um fluxo FAQ v3."""
	import json

	from univesp_atendimento.api.v1.knowledge_v3 import (
		KnowledgeV3ValidationError,
		_bundle,
		_validate_publishable_payload,
	)

	key = str(bundle_key or "").strip()
	if not key:
		return {"ok": False, "issues": ["Informe bundle_key."]}

	issues: list[str] = []
	bundle = _bundle(key)
	if not bundle.draft_version:
		return {"ok": False, "bundle_key": key, "issues": ["Bundle sem versão em edição."]}
	version = frappe.get_doc("Univesp Knowledge Version", bundle.draft_version)
	lifecycle_state = str(version.lifecycle_state or "").strip()
	if lifecycle_state == "pending_approval":
		issues.append(
			"Versão aguardando aprovação — Admin não publica direto. "
			"Aprove, ou volte para rascunho antes de publicar."
		)
	payload = json.loads(version.payload_json or "{}")
	try:
		_validate_publishable_payload(payload, bundle)
	except KnowledgeV3ValidationError as exc:
		issues.append(str(exc))
	except Exception as exc:  # pragma: no cover - diagnóstico operacional
		issues.append(f"{type(exc).__name__}: {exc}")

	governance = frappe.get_doc("Univesp Knowledge Theme Governance", bundle.theme_key)
	if not str(governance.approver_group or "").strip():
		issues.append("Configure o grupo aprovador do tema antes de enviar para revisão.")

	for node in payload.get("nodes") or []:
		if not isinstance(node, dict):
			continue
		title = (node.get("display") or {}).get("title") or node.get("node_id") or "?"
		for layer in ("student", "public"):
			content = (node.get("content") or {}).get(layer) or {}
			for block in content.get("blocks") or []:
				url = str((block or {}).get("url") or "").strip()
				if url.startswith("http://"):
					issues.append(f'{title}: URL HTTP em bloco ({url[:80]}...) — use HTTPS.')

	summary = str(version.change_summary or "").strip()
	if len(summary) < 20:
		issues.append("Resumo das mudanças deve ter ao menos 20 caracteres.")

	return {
		"ok": not issues,
		"bundle_key": key,
		"theme_key": bundle.theme_key,
		"lifecycle_state": lifecycle_state,
		"approver_group": governance.approver_group or "",
		"change_summary_length": len(summary),
		"issues": issues,
	}


def publish_homolog_knowledge_bundle(
	bundle_key: str,
	publisher_email: str = "bruno.miyasato@univesp.br",
) -> dict:
	"""Publica o rascunho ativo de um bundle FAQ v3 em homolog (bench execute)."""
	import json
	from types import SimpleNamespace

	from univesp_atendimento.api.v1.knowledge_v3 import (
		_activate_version,
		_bundle,
		_encode_payload,
		_set_bundle_pointer,
		_validate_publishable_payload,
	)
	from univesp_atendimento.file_urls import normalize_payload_media_urls

	diagnosis = diagnose_knowledge_bundle(bundle_key)
	if not diagnosis.get("ok"):
		return {"ok": False, "stage": "diagnose", "diagnosis": diagnosis}

	bundle = _bundle(bundle_key)
	version = frappe.get_doc("Univesp Knowledge Version", bundle.draft_version)
	lifecycle_state = str(version.lifecycle_state or "").strip()
	if lifecycle_state != "draft":
		return {
			"ok": False,
			"stage": "lifecycle",
			"issues": [f"Estado atual: {lifecycle_state} — esperado draft."],
		}

	payload = json.loads(version.payload_json or "{}")
	normalize_payload_media_urls(payload)
	_validate_publishable_payload(payload, bundle)
	version.payload_json = _encode_payload(payload)
	publisher = str(publisher_email or "bruno.miyasato@univesp.br").strip()
	now = now_datetime()
	version.publisher_email = publisher
	version.approver_email = version.approver_email or publisher
	version.approved_at = version.approved_at or now
	version.published_at = now

	context = SimpleNamespace(
		email=publisher,
		profile_key="admin_central",
		request_id=f"homolog-publish:{bundle_key}",
	)
	_activate_version(bundle, version, context, approval_mode="admin_direct")
	_set_bundle_pointer(bundle.name, "draft_version", "")
	frappe.db.commit()

	validation = validate_homolog_knowledge_publish(bundle_key)
	bundle.reload()
	version.reload()
	return {
		"ok": bool(validation.get("ok")),
		"bundle_key": bundle_key,
		"version_id": version.version_id,
		"lifecycle_state": version.lifecycle_state,
		"published_version": bundle.published_version,
		"audience_profile": bundle.audience_profile,
		"validation": validation,
	}


def validate_homolog_knowledge_publish(bundle_key: str) -> dict:
	"""Confirma bundle publicado no runtime v3 e mídia acessível via nginx."""
	import json
	from urllib.parse import urlparse

	import requests

	from univesp_atendimento.api.v1.knowledge_runtime import _published_v3_entries

	key = str(bundle_key or "").strip()
	issues: list[str] = []
	result: dict = {"ok": False, "bundle_key": key, "personas": {}, "media": [], "issues": issues}

	if not key or not frappe.db.exists("Univesp Knowledge Bundle", key):
		issues.append("Bundle não encontrado.")
		return result

	bundle = frappe.get_doc("Univesp Knowledge Bundle", key)
	if not bundle.published_version:
		issues.append("Bundle sem published_version.")
		return result

	version = frappe.get_doc("Univesp Knowledge Version", bundle.published_version)
	if str(version.lifecycle_state or "").strip() != "published":
		issues.append(f"Versão publicada em estado inválido: {version.lifecycle_state}.")

	profile = str(bundle.audience_profile or "").strip()
	for persona in ("student", "public"):
		expected = persona == "public" and profile in {"public", "mixed"}
		expected = expected or (persona == "student" and profile in {"student", "mixed"})
		try:
			entries = _published_v3_entries(persona)
			match = next((entry for entry in entries if entry.get("bundle_id") == key), None)
			result["personas"][persona] = {
				"expected": expected,
				"listed": bool(match),
				"title": (match or {}).get("title", ""),
			}
			if expected and not match:
				issues.append(f"Bundle ausente no runtime v3 ({persona}).")
		except Exception as exc:  # pragma: no cover - diagnóstico operacional
			issues.append(f"Runtime {persona}: {type(exc).__name__}: {exc}")
			result["personas"][persona] = {"expected": expected, "listed": False, "error": str(exc)}

	payload = json.loads(version.payload_json or "{}")
	domain = str(frappe.conf.get("host_name") or "homolog-crm.univesp.br").strip()
	media_urls: list[str] = []
	for node in payload.get("nodes") or []:
		if not isinstance(node, dict):
			continue
		content = node.get("content") or {}
		for layer in ("student", "public"):
			layer_content = content.get(layer)
			if not isinstance(layer_content, dict):
				continue
			for block in layer_content.get("blocks") or []:
				if not isinstance(block, dict):
					continue
				url = str(block.get("url") or "").strip()
				if url and url not in media_urls:
					media_urls.append(url)

	for url in media_urls:
		parsed = urlparse(url)
		path = parsed.path if parsed.scheme in {"http", "https"} else url
		if not path.startswith("/"):
			path = f"/{path}"
		check_url = f"https://127.0.0.1{path}"
		try:
			response = requests.head(
				check_url,
				headers={"Host": domain},
				timeout=15,
				allow_redirects=True,
				verify=False,
			)
			status = response.status_code
			media_ok = 200 <= status < 300
			result["media"].append({"url": url, "status": status, "ok": media_ok})
			if not media_ok:
				issues.append(f"Mídia HTTP {status}: {url[:120]}")
		except requests.RequestException as exc:
			result["media"].append({"url": url, "ok": False, "error": str(exc)})
			issues.append(f"Mídia inacessível: {url[:120]} ({exc})")

	result["ok"] = not issues
	return result


def diagnose_institutional_file(file_url: str = "", file_name: str = "") -> dict:
	"""Verifica registro File no Frappe e resposta HTTP local para /files/."""
	from urllib.parse import unquote, urlparse

	import requests

	raw = str(file_url or file_name or "").strip()
	if not raw:
		return {"ok": False, "issues": ["Informe file_url ou file_name."]}

	parsed = urlparse(raw)
	path = unquote(parsed.path if parsed.scheme in {"http", "https"} else raw)
	if not path.startswith("/files/"):
		path = f"/files/{path.lstrip('/')}"

	issues: list[str] = []
	file_doc = frappe.db.get_value(
		"File",
		{"file_url": path},
		["name", "file_url", "file_name", "is_private", "file_size"],
		as_dict=True,
	)
	if not file_doc:
		basename = path.rsplit("/", 1)[-1]
		file_doc = frappe.db.get_value(
			"File",
			{"file_name": basename},
			["name", "file_url", "file_name", "is_private", "file_size"],
			as_dict=True,
		)
		if file_doc and file_doc.file_url != path:
			issues.append(f"file_url no banco difere: {file_doc.file_url}")

	result = {
		"ok": False,
		"path": path,
		"file_storage": str(frappe.conf.get("file_storage") or "local"),
		"s3_bucket": str(frappe.conf.get("s3_bucket") or ""),
		"host_name": str(frappe.conf.get("host_name") or ""),
		"public_reply_domain": str(frappe.conf.get("public_reply_domain") or ""),
		"file": file_doc,
		"frappe_local_status": None,
		"nginx_local_status": None,
		"issues": issues,
	}

	if not file_doc:
		issues.append("Arquivo não encontrado na tabela File do Frappe.")
		return result

	if int(file_doc.is_private or 0):
		issues.append("Arquivo marcado como privado — /files/ público não deve servir.")

	file_doc_full = frappe.get_doc("File", file_doc.name)
	local_path = file_doc_full.get_full_path()
	result["local_path"] = local_path
	result["local_exists"] = os.path.exists(local_path)
	try:
		from frappe.utils.file_manager import get_file

		_, blob = get_file(file_doc.file_url)
		result["storage_bytes"] = len(blob or b"")
	except Exception as exc:
		result["storage_bytes"] = 0
		issues.append(f"Storage indisponível (get_file): {exc}")
		if result["local_exists"]:
			issues.append(
				"Arquivo existe no disco local mas não no GCS — rode repair_institutional_file."
			)
		else:
			issues.append("Arquivo ausente no GCS e no disco local — faça upload novamente no editor.")

	headers = {"Host": "crm.localhost", "X-Frappe-Site-Name": "crm.localhost"}
	try:
		frappe_response = requests.head(
			f"http://127.0.0.1:8000{path}",
			headers=headers,
			timeout=15,
			allow_redirects=True,
		)
		result["frappe_local_status"] = frappe_response.status_code
		if frappe_response.status_code >= 400:
			issues.append(f"Frappe (:8000) retornou HTTP {frappe_response.status_code}.")
			if result.get("local_exists") and frappe_response.status_code == 404:
				issues.append(
					"Esperado com gunicorn: frappe.app:application não serve /files/ "
					"(StaticDataMiddleware só no bench serve). Nginx homolog deve usar alias "
					"para sites/crm.localhost/public/files/."
				)
	except requests.RequestException as exc:
		issues.append(f"Frappe local inacessível: {exc}")

	domain = str(frappe.conf.get("host_name") or "homolog-crm.univesp.br").strip()
	try:
		nginx_response = requests.head(
			f"https://127.0.0.1{path}",
			headers={"Host": domain},
			timeout=15,
			allow_redirects=True,
			verify=False,
		)
		result["nginx_local_status"] = nginx_response.status_code
		if nginx_response.status_code >= 400:
			issues.append(f"Nginx local retornou HTTP {nginx_response.status_code}.")
			if result.get("local_exists") and nginx_response.status_code == 404:
				issues.append(
					"Nginx ainda proxyando /files/ para Frappe? Recarregue ops/vm/nginx/homolog-crm.univesp.br.conf "
					"(alias para public/files)."
				)
	except requests.RequestException as exc:
		issues.append(f"Nginx local inacessível: {exc}")

	result["issues"] = issues
	http_ok = result.get("nginx_local_status") and 200 <= int(result["nginx_local_status"]) < 300
	result["ok"] = bool(http_ok) and not any(
		issue
		for issue in issues
		if issue.startswith("Arquivo não encontrado")
		or issue.startswith("Arquivo marcado como privado")
		or issue.startswith("Arquivo ausente")
		or issue.startswith("Storage indisponível")
		or (issue.startswith("Nginx local retornou HTTP") and not http_ok)
	)
	return result


def repair_institutional_file(file_url: str = "", file_name: str = "") -> dict:
	"""Reenvia ao GCS um arquivo presente no disco local mas ausente no bucket."""
	diagnosis = diagnose_institutional_file(file_url=file_url, file_name=file_name)
	if not diagnosis.get("file"):
		return diagnosis
	if not diagnosis.get("local_exists"):
		return {
			"ok": False,
			"issues": [
				"Arquivo não está no disco local. Remova a mídia do bloco e faça upload novamente.",
			],
			"diagnosis": diagnosis,
		}

	file_doc = frappe.get_doc("File", diagnosis["file"]["name"])
	with open(file_doc.get_full_path(), "rb") as handle:
		content = handle.read()
	if not content:
		return {"ok": False, "issues": ["Arquivo local vazio."], "diagnosis": diagnosis}

	file_doc.save_file(content, decode=False, ignore_existing_file_check=True, overwrite=True)
	frappe.db.commit()
	after = diagnose_institutional_file(file_url=file_doc.file_url)
	return {
		"ok": after.get("ok"),
		"before": diagnosis,
		"after": after,
		"issues": after.get("issues") or [],
	}


def add_homolog_knowledge_approver(email: str, group_key: str = "faq-acesso-ava-aprovadores") -> dict:
	"""Inclui e-mail no grupo aprovador de um tema FAQ (homolog)."""
	address = str(email or "").strip().lower()
	if not address or "@" not in address:
		raise frappe.ValidationError("Informe um e-mail válido.")
	if not frappe.db.exists("Univesp Access Group", group_key):
		raise frappe.ValidationError(f"Grupo não encontrado: {group_key}")
	group = frappe.get_doc("Univesp Access Group", group_key)
	members = [
		str(item).strip().lower()
		for item in frappe.parse_json(group.members_json or "[]")
		if str(item).strip()
	]
	if address not in members:
		members.append(address)
	group.members_json = json.dumps(members)
	group.save(ignore_permissions=True)
	frappe.db.commit()
	return {"group_key": group_key, "members": members}


def diagnose_access_groups_api() -> dict:
	"""Valida leitura/serialização de grupos (isolando falha do gateway)."""
	from univesp_atendimento.api.v1.admin import _serialize_group

	count = frappe.db.count("Univesp Access Group")
	rows = frappe.get_all("Univesp Access Group", fields=["name"], limit=1)
	try:
		sample = _serialize_group(frappe.get_doc("Univesp Access Group", rows[0].name)) if rows else None
		return {"ok": True, "count": count, "sample": sample}
	except Exception as exc:
		return {"ok": False, "count": count, "error": f"{type(exc).__name__}: {exc}"}


def hygienize_homolog_bundles(
	bundle_keys: list[str] | tuple[str, ...] | None = None,
	confirmation: str = "",
	apply: bool = False,
) -> dict:
	"""Inspeciona e remove/arquiva somente bundles órfãos autorizados de homolog."""
	from univesp_atendimento.api.v1.knowledge_v3 import IMMUTABLE_STATES, _audit

	keys = tuple(
		str(item or "").strip().lower()
		for item in (bundle_keys or HOMOLOG_BUNDLE_HYGIENE_ALLOWLIST)
		if str(item or "").strip()
	)
	if not keys or any(key not in HOMOLOG_BUNDLE_HYGIENE_ALLOWLIST for key in keys):
		raise frappe.ValidationError(
			"Higiene homolog aceita somente os bundles: "
			+ ", ".join(HOMOLOG_BUNDLE_HYGIENE_ALLOWLIST)
		)
	if confirmation != FAQ_V3_PILOT_CONFIRMATION:
		raise frappe.ValidationError("Confirmação homolog inválida.")

	before = [_homolog_bundle_hygiene_state(key, IMMUTABLE_STATES) for key in keys]
	actions = [_homolog_bundle_hygiene_action(item, IMMUTABLE_STATES) for item in before]
	result = {
		"ok": True,
		"apply": bool(apply),
		"allowlist": list(HOMOLOG_BUNDLE_HYGIENE_ALLOWLIST),
		"before": before,
		"actions": actions,
		"snapshot_path": "",
		"after": None,
	}
	if not apply:
		return result

	snapshot = {
		"confirmation": confirmation,
		"created_at": str(now_datetime()),
		"bundles": before,
	}
	snapshot_path = _write_homolog_bundle_snapshot(snapshot)
	result["snapshot_path"] = snapshot_path
	for action in actions:
		if action["action"] == "archive":
			bundle = frappe.get_doc("Univesp Knowledge Bundle", action["name"])
			bundle.status = "archived"
			bundle.archived_at = now_datetime()
			bundle.archived_by_email = "homolog-hygiene"
			bundle.save(ignore_permissions=True)
			_audit(None, "knowledge_bundle_archived", bundle.name, {"reason": "homolog_bundle_hygiene"})
		elif action["action"] == "delete_unpublished":
			bundle = frappe.get_doc("Univesp Knowledge Bundle", action["name"])
			for version in action["versions"]:
				doc = frappe.get_doc("Univesp Knowledge Version", version["name"])
				doc.flags.allow_knowledge_draft_delete = True
				doc.delete(ignore_permissions=True)
			bundle.delete(ignore_permissions=True)
			_audit(
				None,
				"knowledge_bundle_deleted",
				action["name"],
				{"reason": "homolog_bundle_hygiene", "snapshot_path": snapshot_path},
			)
	frappe.db.commit()
	result["after"] = [_homolog_bundle_hygiene_state(key, IMMUTABLE_STATES) for key in keys]
	return result


def _homolog_bundle_hygiene_state(bundle_key, immutable_states):
	name = frappe.db.get_value("Univesp Knowledge Bundle", bundle_key, "name")
	if not name:
		return {"bundle_key": bundle_key, "exists": False, "versions": []}
	bundle = frappe.get_doc("Univesp Knowledge Bundle", name)
	versions = frappe.get_all(
		"Univesp Knowledge Version",
		filters={"bundle": bundle.name},
		fields=["name", "version_id", "lifecycle_state", "revision", "published_at", "creation", "modified"],
		order_by="creation asc",
		limit_page_length=0,
	)
	return {
		"bundle_key": bundle.bundle_key,
		"name": bundle.name,
		"exists": True,
		"status": bundle.status,
		"published_version": bundle.published_version or "",
		"draft_version": bundle.draft_version or "",
		"versions": [
			{
				"name": row.name,
				"version_id": row.version_id,
				"lifecycle_state": row.lifecycle_state,
				"revision": int(row.revision or 0),
				"published_at": str(row.published_at or ""),
				"creation": str(row.creation or ""),
				"modified": str(row.modified or ""),
			}
			for row in versions
		],
	}


def _homolog_bundle_hygiene_action(state, immutable_states):
	if not state.get("exists"):
		return {"bundle_key": state["bundle_key"], "action": "skip_missing", "versions": []}
	if state.get("status") != "active":
		return {"bundle_key": state["bundle_key"], "name": state["name"], "action": "skip_inactive", "versions": state["versions"]}
	if state.get("published_version"):
		return {"bundle_key": state["bundle_key"], "name": state["name"], "action": "skip_published", "versions": state["versions"]}
	if any(version["lifecycle_state"] in immutable_states for version in state["versions"]):
		return {"bundle_key": state["bundle_key"], "name": state["name"], "action": "archive", "versions": state["versions"]}
	return {"bundle_key": state["bundle_key"], "name": state["name"], "action": "delete_unpublished", "versions": state["versions"]}


def _write_homolog_bundle_snapshot(snapshot):
	backup_root = Path(frappe.get_site_path("private", "backups"))
	backup_root.mkdir(parents=True, exist_ok=True)
	filename = f"homolog-bundle-hygiene-{now_datetime().strftime('%Y%m%d-%H%M%S')}.json"
	path = backup_root / filename
	path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
	return f"private/backups/{filename}"
