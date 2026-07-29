import hashlib
import json
import uuid

import frappe
from frappe import _
from frappe.utils import add_to_date, get_datetime, now_datetime

from univesp_atendimento.api.v1.common import get_request_context, response
from univesp_atendimento.api.v1.routing import validate_payload_routing
from univesp_atendimento.knowledge_graph import KnowledgeGraphError, assert_valid_knowledge_graph
from univesp_atendimento.knowledge_migration import extract_v2_packages, plan_v2_migration


ACTIVE_DRAFT_STATES = {"draft", "pending_approval"}
IMMUTABLE_STATES = {"approved", "published", "superseded", "rejected"}
DEFAULT_TIMEZONE = "America/Sao_Paulo"
BREAK_GLASS_TTL_SECONDS = 900


class KnowledgeV3ValidationError(frappe.ValidationError):
	http_status_code = 422


class KnowledgeV3ConflictError(frappe.ValidationError):
	http_status_code = 409


@frappe.whitelist(methods=["GET"])
def list_bundles(
	status: str = "active",
	audience_profile: str | None = None,
	theme_key: str | None = None,
	lifecycle_state: str | None = None,
	page: int | str = 1,
	page_size: int | str = 25,
):
	context = get_request_context("edit_knowledge_draft")
	filters = {}
	if status:
		filters["status"] = _choice(status, {"active", "archived"}, "estado")
	if audience_profile:
		filters["audience_profile"] = _choice(
			audience_profile,
			{"student", "public", "mixed", "internal"},
			"público",
		)
	if theme_key:
		filters["theme_key"] = str(theme_key).strip()
	if filters.get("theme_key"):
		_ensure_theme_scope(context, filters["theme_key"])
	elif context.profile_key != "admin_central":
		allowed_themes = sorted(_theme_scope_keys(context))
		if not allowed_themes:
			return response(
				[],
				meta={"page": 1, "page_size": min(max(int(page_size or 25), 1), 100), "total": 0},
				request_id=context.request_id,
			)
		filters["theme_key"] = ["in", allowed_themes]

	page_number = max(int(page or 1), 1)
	limit = min(max(int(page_size or 25), 1), 100)
	rows = frappe.get_all(
		"Univesp Knowledge Bundle",
		filters=filters,
		fields=[
			"name",
			"bundle_key",
			"title",
			"theme_key",
			"audience_profile",
			"status",
			"published_version",
			"draft_version",
			"modified",
		],
		order_by="modified desc",
		start=(page_number - 1) * limit,
		page_length=limit,
	)
	if lifecycle_state:
		expected = _choice(
			lifecycle_state,
			ACTIVE_DRAFT_STATES | IMMUTABLE_STATES,
			"lifecycle",
		)
		rows = [
			row
			for row in rows
			if row.draft_version
			and frappe.db.get_value("Univesp Knowledge Version", row.draft_version, "lifecycle_state") == expected
		]
	total = frappe.db.count("Univesp Knowledge Bundle", filters=filters)
	return response(
		[_serialize_bundle(row) for row in rows],
		meta={"page": page_number, "page_size": limit, "total": total},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def get_bundle(bundle_key: str):
	context = get_request_context("edit_knowledge_draft")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	data = _serialize_bundle(bundle)
	if bundle.draft_version:
		data["draft"] = _serialize_version(frappe.get_doc("Univesp Knowledge Version", bundle.draft_version))
	if bundle.published_version:
		data["published"] = _serialize_version(
			frappe.get_doc("Univesp Knowledge Version", bundle.published_version),
		)
	etag = data.get("draft", {}).get("etag", "")
	_set_etag(etag)
	return response(data, meta={"etag": etag}, request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def list_versions(bundle_key: str, page: int | str = 1, page_size: int | str = 25):
	context = get_request_context("view_knowledge_history")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	page_number = max(int(page or 1), 1)
	limit = min(max(int(page_size or 25), 1), 100)
	rows = frappe.get_all(
		"Univesp Knowledge Version",
		filters={"bundle": bundle.name},
		fields=["name"],
		order_by="creation desc",
		start=(page_number - 1) * limit,
		page_length=limit,
	)
	versions = [
		_serialize_version(
			frappe.get_doc("Univesp Knowledge Version", row.name),
			include_payload=False,
		)
		for row in rows
	]
	return response(
		versions,
		meta={
			"page": page_number,
			"page_size": limit,
			"total": frappe.db.count("Univesp Knowledge Version", {"bundle": bundle.name}),
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def catalogs():
	context = get_request_context("edit_knowledge_draft")
	theme_filters = {"active": 1}
	if context.profile_key != "admin_central":
		allowed = sorted(_theme_scope_keys(context))
		if not allowed:
			return response({"themes": [], "routing_patterns": []}, request_id=context.request_id)
		theme_filters["theme_key"] = ["in", allowed]
	themes = frappe.get_all(
		"Univesp Knowledge Theme Governance",
		filters=theme_filters,
		fields=[
			"theme_key",
			"theme_label",
			"owner_email",
			"approver_group",
			"suggestion_sla_hours",
		],
		order_by="theme_label asc",
		limit_page_length=0,
	)
	patterns = frappe.get_all(
		"Univesp Knowledge Routing Pattern",
		filters={"active": 1},
		fields=[
			"pattern_key",
			"label",
			"bpo_enabled",
			"steps_json",
			"allowed_routing_keys_json",
			"institutional_exceptions_json",
		],
		order_by="label asc",
		limit_page_length=0,
	)
	return response(
		{
			"themes": [dict(row) for row in themes],
			"routing_patterns": [
				{
					"pattern_key": row.pattern_key,
					"label": row.label,
					"bpo_enabled": bool(row.bpo_enabled),
					"steps": frappe.parse_json(row.steps_json or "[]"),
					"allowed_routing_keys": frappe.parse_json(row.allowed_routing_keys_json or "[]"),
					"institutional_exceptions": frappe.parse_json(
						row.institutional_exceptions_json or "[]"
					),
				}
				for row in patterns
			],
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def preview_v2_migration(payload: dict | str | None = None):
	context = _write_context("edit_knowledge_draft")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode migrar a biblioteca v2."))
	data = _payload(payload)
	plans = _v2_migration_plans(data)
	return response(
		{
			"plans": plans,
			"summary": {
				"bundles": len(plans),
				"blocking": sum(1 for plan in plans if plan["blocking"]),
				"source_bundles": sum(len(plan["legacy_bundle_ids"]) for plan in plans),
			},
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def apply_v2_migration(payload: dict | str | None = None):
	context = _write_context("edit_knowledge_draft")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode migrar a biblioteca v2."))
	data = _payload(payload)
	plans = _v2_migration_plans(data)
	blocked = [plan["bundle_key"] for plan in plans if plan["blocking"]]
	if blocked:
		raise KnowledgeV3ValidationError(
			_("A migração possui conflitos ou órfãos não resolvidos: {0}.").format(
				", ".join(blocked)
			)
		)
	results = []
	for plan in plans:
		_ensure_theme_scope(context, plan["theme_key"])
		if not frappe.db.exists("Univesp Knowledge Theme Governance", plan["theme_key"]):
			raise KnowledgeV3ValidationError(
				_("Tema sem governança configurada: {0}.").format(plan["theme_key"])
			)
		existing_version = frappe.db.exists(
			"Univesp Knowledge Version",
			{"migration_idempotency_key": plan["migration_idempotency_key"]},
		)
		if existing_version:
			results.append(
				{
					"bundle_key": plan["bundle_key"],
					"version_id": frappe.db.get_value(
						"Univesp Knowledge Version",
						existing_version,
						"version_id",
					),
					"status": "already_applied",
				}
			)
			continue
		if frappe.db.exists("Univesp Knowledge Bundle", plan["bundle_key"]):
			raise KnowledgeV3ConflictError(
				_("O fluxo {0} já existe e não pertence a esta migração.").format(plan["bundle_key"])
			)
		try:
			assert_valid_knowledge_graph(plan["payload"])
		except KnowledgeGraphError as exc:
			raise KnowledgeV3ValidationError(str(exc)) from exc
		bundle = frappe.get_doc(
			{
				"doctype": "Univesp Knowledge Bundle",
				"bundle_key": plan["bundle_key"],
				"title": plan["title"],
				"theme_key": plan["theme_key"],
				"audience_profile": plan["audience_profile"],
				"status": "active",
				"legacy_v2_bundle_id": plan["legacy_bundle_ids"][0],
				"created_by_email": context.email,
				"created_at": now_datetime(),
			}
		).insert(ignore_permissions=True)
		version = _create_draft(
			bundle,
			context.email,
			plan["payload"],
			import_source="migration_v2",
			migration_key=plan["migration_idempotency_key"],
		)
		_set_bundle_pointer(bundle.name, "draft_version", version.name)
		_audit(
			context,
			"knowledge_v2_migrated",
			bundle.name,
			{
				"version_id": version.version_id,
				"legacy_bundle_ids": plan["legacy_bundle_ids"],
				"migration_idempotency_key": plan["migration_idempotency_key"],
			},
		)
		results.append(
			{
				"bundle_key": plan["bundle_key"],
				"version_id": version.version_id,
				"status": "created",
			}
		)
	return response({"results": results}, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def create_bundle(payload: dict | str | None = None):
	context = _write_context("edit_knowledge_draft")
	data = _payload(payload)
	bundle_key = _key(data.get("bundle_key"), "bundle_key")
	theme_key = _key(data.get("theme_key"), "theme_key")
	_ensure_theme_scope(context, theme_key)
	if not frappe.db.exists("Univesp Knowledge Theme Governance", theme_key):
		raise KnowledgeV3ValidationError(_("Tema sem governança configurada."))
	if frappe.db.exists("Univesp Knowledge Bundle", bundle_key):
		raise KnowledgeV3ConflictError(_("Já existe um fluxo com essa chave."))

	bundle = frappe.get_doc(
		{
			"doctype": "Univesp Knowledge Bundle",
			"bundle_key": bundle_key,
			"title": str(data.get("title") or "").strip(),
			"theme_key": theme_key,
			"audience_profile": _choice(
				data.get("audience_profile"),
				{"student", "public", "mixed", "internal"},
				"público",
			),
			"status": "active",
			"legacy_v2_bundle_id": str(data.get("legacy_v2_bundle_id") or "").strip(),
			"created_by_email": context.email,
			"created_at": now_datetime(),
		}
	).insert(ignore_permissions=True)
	version = _create_draft(
		bundle,
		context.email,
		data.get("payload") or _empty_payload(bundle),
		import_source=str(data.get("import_source") or "builder"),
		migration_key=str(data.get("migration_idempotency_key") or "").strip(),
	)
	_set_bundle_pointer(bundle.name, "draft_version", version.name)
	_audit(context, "knowledge_bundle_created", bundle.name, {"version_id": version.version_id})
	result = _serialize_bundle(frappe.get_doc("Univesp Knowledge Bundle", bundle.name))
	result["draft"] = _serialize_version(version)
	_set_etag(result["draft"]["etag"])
	return response(result, meta={"etag": result["draft"]["etag"]}, request_id=context.request_id)


@frappe.whitelist(methods=["PATCH", "POST"])
def save_draft(bundle_key: str, payload: dict | str | None = None, if_match: str | None = None):
	context = _write_context("edit_knowledge_draft")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	if bundle.status != "active":
		raise KnowledgeV3ValidationError(_("Fluxo arquivado não pode ser editado."))
	if not bundle.draft_version:
		raise KnowledgeV3ValidationError(_("Fluxo não possui rascunho ativo."))
	version = frappe.get_doc("Univesp Knowledge Version", bundle.draft_version)
	if version.lifecycle_state != "draft":
		raise KnowledgeV3ValidationError(_("Somente versão em rascunho pode ser editada."))

	data = _payload(payload)
	_expect_etag(version, if_match or data.get("if_match"))
	new_payload = data.get("payload")
	if not isinstance(new_payload, dict):
		raise KnowledgeV3ValidationError(_("Conteúdo do rascunho é obrigatório."))
	_validate_payload_identity(new_payload, bundle)
	version.payload_json = _encode_payload(new_payload)
	version.version_label = str(data.get("version_label") or version.version_label).strip()
	version.change_summary = str(data.get("change_summary") or version.change_summary or "").strip()
	version.valid_from = data.get("valid_from") or None
	version.valid_until = data.get("valid_until") or None
	version.revision = int(version.revision or 1) + 1
	version.save(ignore_permissions=True)
	_audit(context, "knowledge_draft_updated", version.name, {"revision": version.revision})
	result = _serialize_version(version)
	_set_etag(result["etag"])
	return response(result, meta={"etag": result["etag"]}, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def fork_draft(bundle_key: str):
	context = _write_context("edit_knowledge_draft")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	if bundle.draft_version:
		raise KnowledgeV3ConflictError(_("O fluxo já possui rascunho ativo."))
	source = (
		frappe.get_doc("Univesp Knowledge Version", bundle.published_version)
		if bundle.published_version
		else None
	)
	payload = json.loads(source.payload_json) if source else _empty_payload(bundle)
	version = _create_draft(bundle, context.email, payload)
	_set_bundle_pointer(bundle.name, "draft_version", version.name)
	_audit(context, "knowledge_draft_forked", version.name, {"source": source.name if source else ""})
	result = _serialize_version(version)
	_set_etag(result["etag"])
	return response(result, meta={"etag": result["etag"]}, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def submit_for_approval(bundle_key: str, payload: dict | str | None = None):
	context = _write_context("submit_knowledge_approval")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	version = _active_draft(bundle, "draft")
	data = _payload(payload)
	_expect_etag(version, data.get("if_match"))
	summary = str(data.get("change_summary") or version.change_summary or "").strip()
	if len(summary) < 20:
		raise KnowledgeV3ValidationError(_("Resumo das mudanças deve ter ao menos 20 caracteres."))
	_validate_publishable_payload(json.loads(version.payload_json), bundle)
	version.change_summary = summary
	version.lifecycle_state = "pending_approval"
	version.revision = int(version.revision or 1) + 1
	_save_transition(version)
	_audit(context, "knowledge_submitted_for_approval", version.name, {})
	result = _serialize_version(version)
	_set_etag(result["etag"])
	return response(result, meta={"etag": result["etag"]}, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def request_changes(bundle_key: str, payload: dict | str | None = None):
	context = _write_context("approve_knowledge")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	_ensure_theme_approver(context, bundle.theme_key)
	version = _active_draft(bundle, "pending_approval")
	data = _payload(payload)
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 10:
		raise KnowledgeV3ValidationError(_("Explique os ajustes solicitados."))
	version.lifecycle_state = "draft"
	version.revision = int(version.revision or 1) + 1
	version.approver_email = ""
	version.approved_at = None
	version.rejection_reason = ""
	_save_transition(version)
	_audit(context, "knowledge_changes_requested", version.name, {"reason": reason})
	return response(_serialize_version(version), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def approve(bundle_key: str):
	context = _write_context("approve_knowledge")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	_ensure_theme_approver(context, bundle.theme_key)
	version = _active_draft(bundle, "pending_approval")
	if context.email == version.author_email:
		raise frappe.PermissionError(_("Autor não pode aprovar a própria versão."))
	version.lifecycle_state = "approved"
	version.approver_email = context.email
	version.approved_at = now_datetime()
	_save_transition(version)
	_set_bundle_pointer(bundle.name, "draft_version", "")
	_audit(context, "knowledge_version_approved", version.name, {})
	return response(_serialize_version(version), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def reject(bundle_key: str, payload: dict | str | None = None):
	context = _write_context("approve_knowledge")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	_ensure_theme_approver(context, bundle.theme_key)
	version = _active_draft(bundle, "pending_approval")
	data = _payload(payload)
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 10:
		raise KnowledgeV3ValidationError(_("Motivo da recusa é obrigatório."))
	version.lifecycle_state = "rejected"
	version.rejection_reason = reason
	version.approver_email = context.email
	_save_transition(version)
	_set_bundle_pointer(bundle.name, "draft_version", "")
	_audit(context, "knowledge_version_rejected", version.name, {"reason": reason})
	return response(_serialize_version(version), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def publish(version_id: str, payload: dict | str | None = None):
	context = _write_context("publish_knowledge_version")
	version = frappe.get_doc("Univesp Knowledge Version", version_id)
	bundle = frappe.get_doc("Univesp Knowledge Bundle", version.bundle)
	_ensure_theme_scope(context, bundle.theme_key)
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode publicar."))
	if version.lifecycle_state != "approved":
		raise KnowledgeV3ValidationError(_("Somente versão aprovada pode ser publicada."))
	if context.email == version.author_email:
		raise frappe.PermissionError(_("Autor não pode publicar a própria versão."))
	if context.email == version.approver_email:
		_validate_break_glass_confirmation(context, version, _payload(payload))
	_validate_publishable_payload(json.loads(version.payload_json), bundle)
	version.publisher_email = context.email
	version.published_at = now_datetime()
	if version.valid_from and get_datetime(version.valid_from) > now_datetime():
		version.flags.knowledge_schedule_publication = True
		version.save(ignore_permissions=True)
		_audit(context, "knowledge_publication_scheduled", version.name, {"valid_from": str(version.valid_from)})
		return response(
			{**_serialize_version(version), "scheduled": True},
			request_id=context.request_id,
		)
	_activate_version(bundle, version, context)
	return response(_serialize_version(version), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def archive_bundle(bundle_key: str):
	context = _write_context("publish_knowledge_version")
	bundle = _bundle(bundle_key)
	has_review_history = frappe.db.exists(
		"Univesp Knowledge Version",
		{"bundle": bundle.name, "lifecycle_state": ["in", list(IMMUTABLE_STATES)]},
	)
	if not bundle.published_version and not has_review_history:
		raise KnowledgeV3ValidationError(_("Rascunho sem histórico deve ser excluído, não arquivado."))
	bundle.status = "archived"
	bundle.archived_at = now_datetime()
	bundle.archived_by_email = context.email
	bundle.save(ignore_permissions=True)
	_audit(context, "knowledge_bundle_archived", bundle.name, {})
	return response(_serialize_bundle(bundle), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def unarchive_bundle(bundle_key: str):
	context = _write_context("publish_knowledge_version")
	bundle = _bundle(bundle_key)
	bundle.status = "active"
	bundle.archived_at = None
	bundle.archived_by_email = ""
	bundle.save(ignore_permissions=True)
	_audit(context, "knowledge_bundle_unarchived", bundle.name, {})
	return response(_serialize_bundle(bundle), request_id=context.request_id)


@frappe.whitelist(methods=["DELETE", "POST"])
def delete_unpublished_bundle(bundle_key: str):
	context = _write_context("edit_knowledge_draft")
	bundle = _bundle(bundle_key)
	_ensure_theme_scope(context, bundle.theme_key)
	if bundle.published_version or frappe.db.exists(
		"Univesp Knowledge Version",
		{"bundle": bundle.name, "lifecycle_state": ["in", ["published", "superseded"]]},
	):
		raise frappe.PermissionError(_("Fluxo já publicado não pode ser excluído."))
	versions = frappe.get_all(
		"Univesp Knowledge Version",
		filters={"bundle": bundle.name},
		fields=["name", "lifecycle_state"],
		limit_page_length=0,
	)
	retained_history = [row.name for row in versions if row.lifecycle_state not in ACTIVE_DRAFT_STATES]
	if retained_history:
		raise KnowledgeV3ValidationError(
			_("Fluxo possui histórico de revisão e deve ser arquivado para preservar auditoria.")
		)
	version_names = [row.name for row in versions]
	for version_name in version_names:
		version = frappe.get_doc("Univesp Knowledge Version", version_name)
		version.flags.allow_knowledge_draft_delete = True
		version.delete(ignore_permissions=True)
	bundle.delete(ignore_permissions=True)
	_audit(context, "knowledge_bundle_deleted", bundle.name, {"draft_versions": version_names})
	return response({"deleted": True, "bundle_key": bundle_key}, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def rollback(version_id: str, payload: dict | str | None = None):
	context = _write_context("rollback_knowledge_version")
	target = frappe.get_doc("Univesp Knowledge Version", version_id)
	if target.lifecycle_state != "superseded":
		raise KnowledgeV3ValidationError(_("Rollback exige versão historicamente publicada."))
	bundle = frappe.get_doc("Univesp Knowledge Bundle", target.bundle)
	data = _payload(payload)
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 10:
		raise KnowledgeV3ValidationError(_("Justificativa do rollback é obrigatória."))
	current = (
		frappe.get_doc("Univesp Knowledge Version", bundle.published_version)
		if bundle.published_version
		else None
	)
	if current:
		current.lifecycle_state = "superseded"
		current.superseded_at = now_datetime()
		_save_transition(current)
	target.lifecycle_state = "published"
	target.superseded_at = None
	target.publisher_email = context.email
	target.published_at = now_datetime()
	_save_transition(target)
	_set_bundle_pointer(bundle.name, "published_version", target.name)
	_audit(context, "knowledge_version_rolled_back", target.name, {"reason": reason})
	return response(_serialize_version(target), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def request_break_glass(version_id: str, operation: str = "publish"):
	context = _write_context("publish_knowledge_version")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Break-glass é restrito a Admin central."))
	version = frappe.get_doc("Univesp Knowledge Version", version_id)
	if context.email == version.author_email:
		raise frappe.PermissionError(_("Autor não pode solicitar break-glass para a própria versão."))
	token = uuid.uuid4().hex
	record = {
		"version_id": version.version_id,
		"operation": _choice(operation, {"publish"}, "operação"),
		"requester": context.email,
		"confirmed_by": "",
		"expires_at": str(add_to_date(now_datetime(), seconds=BREAK_GLASS_TTL_SECONDS)),
	}
	frappe.cache().set_value(_break_glass_key(token), json.dumps(record), expires_in_sec=BREAK_GLASS_TTL_SECONDS)
	_audit(context, "knowledge_break_glass_requested", version.name, {"token_hash": _token_hash(token)})
	return response({"confirmation_id": token, "expires_in": BREAK_GLASS_TTL_SECONDS}, request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def confirm_break_glass(confirmation_id: str):
	context = _write_context("publish_knowledge_version")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Break-glass é restrito a Admin central."))
	record = _break_glass_record(confirmation_id)
	if context.email == record["requester"]:
		raise frappe.PermissionError(_("A confirmação exige um segundo Admin."))
	record["confirmed_by"] = context.email
	frappe.cache().set_value(
		_break_glass_key(confirmation_id),
		json.dumps(record),
		expires_in_sec=BREAK_GLASS_TTL_SECONDS,
	)
	_audit(
		context,
		"knowledge_break_glass_confirmed",
		record["version_id"],
		{"token_hash": _token_hash(confirmation_id)},
	)
	return response({"confirmed": True, "confirmation_id": confirmation_id}, request_id=context.request_id)


def activate_scheduled_versions():
	if not bool(frappe.get_single("Univesp Runtime Settings").knowledge_v3_write):
		return
	now = now_datetime()
	versions = frappe.get_all(
		"Univesp Knowledge Version",
		filters={
			"lifecycle_state": "approved",
			"publisher_email": ["!=", ""],
			"valid_from": ["<=", now],
		},
		pluck="name",
		limit_page_length=0,
	)
	for name in versions:
		version = frappe.get_doc("Univesp Knowledge Version", name)
		bundle = frappe.get_doc("Univesp Knowledge Bundle", version.bundle)
		_activate_version(bundle, version, None)


def expire_published_versions():
	if not bool(frappe.get_single("Univesp Runtime Settings").knowledge_v3_write):
		return
	now = now_datetime()
	expired = frappe.get_all(
		"Univesp Knowledge Version",
		filters={"lifecycle_state": "published", "valid_until": ["<", now]},
		pluck="name",
		limit_page_length=0,
	)
	for name in expired:
		version = frappe.get_doc("Univesp Knowledge Version", name)
		version.lifecycle_state = "superseded"
		version.superseded_at = now
		_save_transition(version)
		if frappe.db.get_value("Univesp Knowledge Bundle", version.bundle, "published_version") == version.name:
			_set_bundle_pointer(version.bundle, "published_version", "")


def _create_draft(
	bundle,
	author_email,
	payload,
	*,
	import_source="builder",
	migration_key="",
):
	_validate_payload_identity(payload, bundle)
	existing_migration = (
		frappe.db.exists(
			"Univesp Knowledge Version",
			{"migration_idempotency_key": migration_key},
		)
		if migration_key
		else None
	)
	if existing_migration:
		return frappe.get_doc("Univesp Knowledge Version", existing_migration)
	version_id = str(uuid.uuid4())
	return frappe.get_doc(
		{
			"doctype": "Univesp Knowledge Version",
			"version_id": version_id,
			"bundle": bundle.name,
			"version_label": f"{now_datetime().date()}-draft-01",
			"revision": 1,
			"lifecycle_state": "draft",
			"payload_json": _encode_payload(payload),
			"author_email": author_email,
			"timezone": DEFAULT_TIMEZONE,
			"import_source": import_source,
			"migration_idempotency_key": migration_key,
		}
	).insert(ignore_permissions=True)


def _v2_migration_plans(data):
	source_packages = data.get("packages")
	if isinstance(source_packages, list):
		packages = [
			{
				"legacy_bundle_id": str(
					entry.get("legacy_bundle_id")
					or (entry.get("package") or {}).get("faq_id")
					or ""
				).strip(),
				"title": str(
					entry.get("title")
					or ((entry.get("package") or {}).get("metadata") or {}).get("title")
					or ""
				).strip(),
				"package": entry.get("package"),
			}
			for entry in source_packages
			if isinstance(entry, dict) and isinstance(entry.get("package"), dict)
		]
	else:
		doc = frappe.get_single("Univesp Knowledge Library")
		try:
			library = json.loads(doc.library_json or "{}")
		except json.JSONDecodeError as exc:
			raise KnowledgeV3ValidationError(_("Biblioteca v2 contém JSON inválido.")) from exc
		packages = extract_v2_packages(library)
	if not packages:
		raise KnowledgeV3ValidationError(_("Nenhum bundle v2 disponível para migração."))
	return plan_v2_migration(
		packages,
		data.get("mappings") if isinstance(data.get("mappings"), list) else [],
		default_routing_pattern=str(data.get("default_routing_pattern") or "op_then_area").strip(),
	)


def _activate_version(bundle, version, context):
	current_name = str(bundle.published_version or "")
	if current_name and current_name != version.name:
		current = frappe.get_doc("Univesp Knowledge Version", current_name)
		current.lifecycle_state = "superseded"
		current.superseded_at = now_datetime()
		_save_transition(current)
	version.lifecycle_state = "published"
	version.published_at = version.published_at or now_datetime()
	_save_transition(version)
	_set_bundle_pointer(bundle.name, "published_version", version.name)
	if context:
		_audit(context, "knowledge_version_published", version.name, {})


def _validate_publishable_payload(payload, bundle):
	_validate_payload_identity(payload, bundle)
	try:
		assert_valid_knowledge_graph(payload)
	except KnowledgeGraphError as exc:
		raise KnowledgeV3ValidationError(str(exc)) from exc
	nodes = payload.get("nodes")
	edges = payload.get("edges")
	if not isinstance(nodes, list) or not nodes:
		raise KnowledgeV3ValidationError(_("Fluxo deve possuir nós."))
	if not isinstance(edges, list):
		raise KnowledgeV3ValidationError(_("Fluxo deve possuir lista de conexões."))
	node_ids = set()
	stable_keys = set()
	for node in nodes:
		if not isinstance(node, dict):
			raise KnowledgeV3ValidationError(_("Nó inválido."))
		node_id = _key(node.get("node_id"), "node_id")
		stable_key = _key(node.get("stable_key"), "stable_key")
		if node_id in node_ids or stable_key in stable_keys:
			raise KnowledgeV3ValidationError(_("IDs e chaves estáveis dos nós devem ser únicos."))
		node_ids.add(node_id)
		stable_keys.add(stable_key)
	for edge in edges:
		if not isinstance(edge, dict):
			raise KnowledgeV3ValidationError(_("Conexão inválida."))
		if edge.get("parent_node_id") not in node_ids or edge.get("child_node_id") not in node_ids:
			raise KnowledgeV3ValidationError(_("Conexão referencia nó inexistente."))
	active_node_ids = {
		str(edge.get(field) or "").strip()
		for edge in edges
		if edge.get("active") is not False
		for field in ("parent_node_id", "child_node_id")
	}
	unresolved_import_nodes = [
		node.get("stable_key")
		for node in nodes
		if node.get("import_status") == "missing_in_import"
		and node.get("node_id") in active_node_ids
	]
	if unresolved_import_nodes:
		raise KnowledgeV3ValidationError(
			_("Resolva etapas ausentes da importação antes de publicar: {0}.").format(
				", ".join(sorted(unresolved_import_nodes))
			)
		)
	routing = payload.get("routing_policy")
	if not isinstance(routing, dict):
		raise KnowledgeV3ValidationError(_("Política de roteamento é obrigatória."))
	pattern_key = _key(routing.get("pattern_key"), "pattern_key")
	pattern = frappe.db.get_value(
		"Univesp Knowledge Routing Pattern",
		{"pattern_key": pattern_key, "active": 1},
		["name", "steps_json", "allowed_routing_keys_json"],
		as_dict=True,
	)
	if not pattern:
		raise KnowledgeV3ValidationError(_("Padrão de roteamento não está ativo no catálogo."))
	validate_payload_routing(payload, pattern)
	steps = set(frappe.parse_json(pattern.steps_json or "[]"))
	if "op" in steps:
		missing_playbook = [
			node.get("node_id")
			for node in nodes
			if node.get("node_kind") == "final"
			and "student" in (node.get("audiences") or [])
			and not isinstance((node.get("playbooks") or {}).get("op"), dict)
		]
		if missing_playbook:
			raise KnowledgeV3ValidationError(
				_("Playbook OP obrigatório nos nós finais: {0}.").format(", ".join(missing_playbook))
			)


def _validate_payload_identity(payload, bundle):
	if not isinstance(payload, dict) or str(payload.get("schema_version") or "") != "3.0.0":
		raise KnowledgeV3ValidationError(_("Conteúdo deve usar schema_version 3.0.0."))
	if str(payload.get("bundle_key") or "").strip() != bundle.bundle_key:
		raise KnowledgeV3ValidationError(_("bundle_key do conteúdo diverge do fluxo."))
	if str(payload.get("theme_key") or "").strip() != bundle.theme_key:
		raise KnowledgeV3ValidationError(_("theme_key do conteúdo diverge do fluxo."))


def _empty_payload(bundle):
	return {
		"schema_version": "3.0.0",
		"bundle_key": bundle.bundle_key,
		"theme_key": bundle.theme_key,
		"metadata": {
			"title": bundle.title,
			"audience_profile": bundle.audience_profile,
		},
		"routing_policy": {},
		"graph": {
			"student_root_node_id": None,
			"public_root_node_id": None,
			"internal_root_node_id": None,
		},
		"nodes": [],
		"edges": [],
	}


def _serialize_bundle(bundle):
	draft = _version_summary(bundle.draft_version)
	published = _version_summary(bundle.published_version)
	content_summary = _bundle_content_summary(bundle.draft_version or bundle.published_version)
	return {
		"bundle_key": bundle.bundle_key,
		"title": bundle.title,
		"theme_key": bundle.theme_key,
		"audience_profile": bundle.audience_profile,
		"status": bundle.status,
		"published_version": bundle.published_version or "",
		"draft_version": bundle.draft_version or "",
		"legacy_v2_bundle_id": bundle.legacy_v2_bundle_id or "",
		"owner_email": frappe.db.get_value(
			"Univesp Knowledge Theme Governance",
			bundle.theme_key,
			"owner_email",
		)
		or "",
		"draft_summary": draft,
		"published_summary": published,
		**content_summary,
		"modified": str(bundle.modified or ""),
	}


def _version_summary(version_name):
	if not version_name:
		return None
	return frappe.db.get_value(
		"Univesp Knowledge Version",
		version_name,
		[
			"version_id",
			"lifecycle_state",
			"valid_from",
			"valid_until",
			"published_at",
		],
		as_dict=True,
	)


def _bundle_content_summary(version_name):
	if not version_name:
		return {
			"audiences": [],
			"playbook_summary": {"op": False, "bpo": False, "analyst": False},
			"node_count": 0,
		}
	raw = frappe.db.get_value("Univesp Knowledge Version", version_name, "payload_json") or "{}"
	try:
		payload = json.loads(raw)
	except (TypeError, json.JSONDecodeError):
		payload = {}
	nodes = [node for node in payload.get("nodes") or [] if isinstance(node, dict)]
	audiences = sorted(
		{
			str(audience)
			for node in nodes
			for audience in node.get("audiences") or []
			if str(audience)
		}
	)
	return {
		"audiences": audiences,
		"playbook_summary": {
			layer: any(isinstance((node.get("playbooks") or {}).get(layer), dict) for node in nodes)
			for layer in ("op", "bpo", "analyst")
		},
		"node_count": len(nodes),
	}


def _serialize_version(version, *, include_payload=True):
	data = {
		"version_id": version.version_id,
		"bundle_key": version.bundle,
		"version_label": version.version_label,
		"revision": int(version.revision or 1),
		"lifecycle_state": version.lifecycle_state,
		"change_summary": version.change_summary or "",
		"author_email": version.author_email,
		"approver_email": version.approver_email or "",
		"publisher_email": version.publisher_email or "",
		"approved_at": str(version.approved_at or ""),
		"published_at": str(version.published_at or ""),
		"valid_from": str(version.valid_from or ""),
		"valid_until": str(version.valid_until or ""),
		"timezone": version.timezone,
		"etag": _etag(version),
	}
	if include_payload:
		data["payload"] = json.loads(version.payload_json)
	return data


def _active_draft(bundle, expected_state):
	if not bundle.draft_version:
		raise KnowledgeV3ValidationError(_("Fluxo não possui rascunho ativo."))
	version = frappe.get_doc("Univesp Knowledge Version", bundle.draft_version)
	if version.lifecycle_state != expected_state:
		raise KnowledgeV3ValidationError(_("Estado atual da versão não permite esta ação."))
	return version


def _bundle(bundle_key):
	key = _key(bundle_key, "bundle_key")
	if not frappe.db.exists("Univesp Knowledge Bundle", key):
		raise frappe.DoesNotExistError(_("Fluxo não encontrado."))
	return frappe.get_doc("Univesp Knowledge Bundle", key)


def _set_bundle_pointer(bundle_name, fieldname, value):
	frappe.db.set_value(
		"Univesp Knowledge Bundle",
		bundle_name,
		fieldname,
		value or None,
		update_modified=False,
	)


def _write_context(required_action):
	context = get_request_context(required_action)
	settings = frappe.get_single("Univesp Runtime Settings")
	if not bool(settings.knowledge_v3_write):
		raise frappe.PermissionError(_("Escrita FAQ v3 está desativada neste ambiente."))
	return context


def _save_transition(version):
	version.flags.knowledge_lifecycle_transition = True
	version.save(ignore_permissions=True)


def _expect_etag(version, supplied):
	expected = _etag(version)
	received = str(supplied or frappe.get_request_header("If-Match") or "").strip()
	if not received or received != expected:
		raise KnowledgeV3ConflictError(
			_("A versão foi alterada por outra pessoa. Recarregue antes de salvar.")
		)


def _etag(version):
	return f'"{version.version_id}-{int(version.revision or 1)}"'


def _set_etag(etag):
	if etag:
		frappe.local.response["headers"] = {"ETag": etag}


def _ensure_theme_scope(context, theme_key):
	if context.profile_key == "admin_central" or theme_key in _theme_scope_keys(context):
		return
	raise frappe.PermissionError(_("Tema fora do seu escopo de conhecimento."))


def _theme_scope_keys(context):
	allowed = {
		str(item).strip()
		for item in (context.scopes.get("knowledge_themes") or [])
		if str(item).strip()
	}
	if context.profile_key not in {"analista_area", "gestor_area"}:
		return allowed
	areas = {
		str(item).strip()
		for item in (context.scopes.get("areas") or [])
		if str(item).strip()
	}
	if areas:
		allowed.update(
			frappe.get_all(
				"Univesp Knowledge Theme Editor Area",
				filters={"area_key": ["in", sorted(areas)], "can_edit_draft": 1},
				pluck="parent",
				limit_page_length=0,
			)
		)
	return allowed


def _ensure_theme_approver(context, theme_key):
	governance = frappe.get_doc("Univesp Knowledge Theme Governance", theme_key)
	group = frappe.get_doc("Univesp Access Group", governance.approver_group)
	members = {
		str(item).strip().lower()
		for item in frappe.parse_json(group.members_json or "[]")
		if str(item).strip()
	}
	if context.email not in members:
		raise frappe.PermissionError(_("Você não pertence ao grupo aprovador deste tema."))


def _validate_break_glass_confirmation(context, version, data):
	confirmation_id = str(data.get("confirmation_id") or "").strip()
	record = _break_glass_record(confirmation_id)
	if (
		record["version_id"] != version.version_id
		or record["operation"] != "publish"
		or record["requester"] != context.email
		or not record["confirmed_by"]
		or record["confirmed_by"] in {context.email, version.author_email}
	):
		raise frappe.PermissionError(_("Confirmação break-glass inválida."))
	frappe.cache().delete_value(_break_glass_key(confirmation_id))
	_audit(
		context,
		"knowledge_break_glass_used",
		version.name,
		{
			"confirmed_by": record["confirmed_by"],
			"token_hash": _token_hash(confirmation_id),
		},
	)


def _break_glass_record(confirmation_id):
	value = frappe.cache().get_value(_break_glass_key(str(confirmation_id or "").strip()))
	if not value:
		raise KnowledgeV3ValidationError(_("Confirmação break-glass ausente ou expirada."))
	record = json.loads(value)
	if get_datetime(record["expires_at"]) < now_datetime():
		raise KnowledgeV3ValidationError(_("Confirmação break-glass expirada."))
	return record


def _break_glass_key(token):
	return f"univesp:knowledge:break-glass:{token}"


def _token_hash(token):
	return hashlib.sha256(str(token).encode("utf-8")).hexdigest()


def _audit(context, operation, target, details):
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": context.email if context else "scheduler@system",
			"target_email": context.email if context else "scheduler@system",
			"operation": operation,
			"reason": json.dumps(details or {}, ensure_ascii=False),
			"after_json": json.dumps({"target": str(target)}, ensure_ascii=False),
			"request_id": context.request_id if context else "",
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value.strip():
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise KnowledgeV3ValidationError(_("Corpo JSON inválido.")) from exc
	return {}


def _encode_payload(payload):
	return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _key(value, label):
	key = str(value or "").strip().lower()
	if not key:
		raise KnowledgeV3ValidationError(_("{0} é obrigatório.").format(label))
	return key


def _choice(value, allowed, label):
	normalized = str(value or "").strip().lower()
	if normalized not in allowed:
		raise KnowledgeV3ValidationError(_("{0} inválido.").format(label))
	return normalized
