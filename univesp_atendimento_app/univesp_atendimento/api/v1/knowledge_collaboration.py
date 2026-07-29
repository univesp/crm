import hashlib
import json

import frappe
from frappe import _
from frappe.utils import add_to_date, get_datetime, now_datetime

from univesp_atendimento.api.v1.common import get_request_context, response
from univesp_atendimento.api.v1.knowledge_v3 import (
	KnowledgeV3ConflictError,
	KnowledgeV3ValidationError,
	_audit,
	_bundle,
	_create_draft,
	_ensure_theme_scope,
	_serialize_version,
	_set_bundle_pointer,
	_theme_scope_keys,
)
from univesp_atendimento.knowledge_graph import KnowledgeGraphError, validate_ordered_path


TARGET_TYPES = {"node", "content_block", "checklist_item", "playbook_field"}
PLAYBOOK_FIELDS = {
	"objective",
	"checklist",
	"systems",
	"documents_to_request",
	"suggested_reply",
	"allowed_actions",
	"escalation_criteria",
	"escalation_reason_template",
	"possible_outcomes",
}


@frappe.whitelist(methods=["POST"])
def create_suggestion(payload: dict | str | None = None):
	context = get_request_context("suggest_knowledge")
	_collaboration_enabled()
	data = _payload(payload)
	bundle = _bundle(data.get("bundle_key"))
	_ensure_theme_scope(context, bundle.theme_key)
	version = _source_version(bundle, data.get("version_id"))
	source_payload = json.loads(version.payload_json)
	layer = _choice(
		data.get("audience_layer"),
		{"student", "public", "op", "bpo", "analyst"},
		"camada",
	)
	if context.profile_key == "op" and layer != "op":
		raise frappe.PermissionError(_("OP só pode sugerir ajustes no playbook OP."))
	if context.profile_key == "op_externo" and layer != "bpo":
		raise frappe.PermissionError(_("BPO só pode sugerir ajustes no playbook BPO."))
	target_ref = data.get("target_ref")
	target_path = data.get("target_path")
	if not isinstance(target_ref, dict) or target_ref.get("type") not in TARGET_TYPES:
		raise KnowledgeV3ValidationError(_("Referência estável da sugestão é inválida."))
	if not isinstance(target_path, list) or not target_path:
		raise KnowledgeV3ValidationError(_("Caminho da sugestão é obrigatório."))
	current_value, node_id = _target_value(source_payload, target_ref, layer)
	if str(data.get("node_id") or "").strip() not in {"", node_id}:
		raise KnowledgeV3ValidationError(_("Etapa informada diverge da referência estável."))
	if str(target_path[-1] or "").strip() != node_id:
		raise KnowledgeV3ValidationError(_("O caminho não termina na etapa sugerida."))
	graph_audience = (
		layer
		if layer in {"student", "public"}
		else "student"
		if (source_payload.get("graph") or {}).get("student_root_node_id")
		else "internal"
	)
	try:
		validate_ordered_path(source_payload, graph_audience, target_path)
	except KnowledgeGraphError as exc:
		raise KnowledgeV3ValidationError(str(exc)) from exc
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 10:
		raise KnowledgeV3ValidationError(_("Explique a melhoria em pelo menos 10 caracteres."))
	if "proposed_value" not in data:
		raise KnowledgeV3ValidationError(_("Conteúdo proposto é obrigatório."))
	sla_hours = _suggestion_sla_hours(bundle.theme_key)
	doc = frappe.get_doc(
		{
			"doctype": "Univesp Knowledge Suggestion",
			"bundle": bundle.name,
			"source_version": version.name,
			"node_id": node_id,
			"audience_layer": layer,
			"target_path_json": _json(target_path),
			"target_ref_json": _json(target_ref),
			"current_value_json": _json(current_value),
			"current_hash": _value_hash(current_value),
			"proposed_value_json": _json(data.get("proposed_value")),
			"reason": reason,
			"author_email": context.email,
			"state": "received",
			"sla_due_at": add_to_date(now_datetime(), hours=sla_hours),
		}
	).insert(ignore_permissions=True)
	_audit(
		context,
		"knowledge_suggestion_created",
		doc.name,
		{"bundle_key": bundle.bundle_key, "node_id": node_id, "target_ref": target_ref},
	)
	_notify_reviewers(bundle.theme_key, "Nova sugestão de conhecimento", doc)
	return response(_serialize_suggestion(doc), request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def list_suggestions(
	state: str | None = None,
	theme_key: str | None = None,
	bundle_key: str | None = None,
	page: int | str = 1,
	page_size: int | str = 50,
):
	context = get_request_context()
	_collaboration_enabled()
	can_review = bool(
		{"edit_knowledge_draft", "approve_knowledge", "publish_knowledge_version"} & set(context.actions)
	)
	if not can_review and "suggest_knowledge" not in context.actions:
		raise frappe.PermissionError(_("Seu perfil não permite consultar sugestões."))
	filters = {}
	if state:
		filters["state"] = _choice(
			state,
			{"received", "in_review", "incorporated", "rejected"},
			"estado",
		)
	if bundle_key:
		bundle = _bundle(bundle_key)
		_ensure_theme_scope(context, bundle.theme_key)
		filters["bundle"] = bundle.name
	if theme_key:
		_ensure_theme_scope(context, theme_key)
		bundle_names = frappe.get_all(
			"Univesp Knowledge Bundle",
			filters={"theme_key": theme_key},
			pluck="name",
			limit_page_length=0,
		)
		filters["bundle"] = ["in", bundle_names]
	if not can_review:
		filters["author_email"] = context.email
	elif not theme_key and not bundle_key and context.profile_key != "admin_central":
		allowed = sorted(_theme_scope_keys(context))
		if not allowed:
			return response([], meta={"page": 1, "page_size": 50, "total": 0}, request_id=context.request_id)
		bundle_names = frappe.get_all(
			"Univesp Knowledge Bundle",
			filters={"theme_key": ["in", allowed]},
			pluck="name",
			limit_page_length=0,
		)
		filters["bundle"] = ["in", bundle_names]
	page_number = max(int(page or 1), 1)
	limit = min(max(int(page_size or 50), 1), 100)
	rows = frappe.get_all(
		"Univesp Knowledge Suggestion",
		filters=filters,
		fields=["name"],
		order_by="creation desc",
		start=(page_number - 1) * limit,
		page_length=limit,
	)
	return response(
		[_serialize_suggestion(frappe.get_doc("Univesp Knowledge Suggestion", row.name)) for row in rows],
		meta={
			"page": page_number,
			"page_size": limit,
			"total": frappe.db.count("Univesp Knowledge Suggestion", filters=filters),
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def start_review(suggestion_id: str):
	context = get_request_context("edit_knowledge_draft")
	_collaboration_enabled()
	doc, bundle = _reviewable_suggestion(suggestion_id, context, {"received", "in_review"})
	if doc.state == "in_review" and doc.reviewer_email != context.email:
		raise KnowledgeV3ConflictError(_("A sugestão já está em análise por outra pessoa."))
	doc.state = "in_review"
	doc.reviewer_email = context.email
	doc.save(ignore_permissions=True)
	_audit(context, "knowledge_suggestion_review_started", doc.name, {})
	return response(_serialize_suggestion(doc), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def incorporate_suggestion(suggestion_id: str, payload: dict | str | None = None):
	context = get_request_context("edit_knowledge_draft")
	_collaboration_enabled()
	doc, bundle = _reviewable_suggestion(suggestion_id, context, {"received", "in_review"})
	if doc.reviewer_email and doc.reviewer_email != context.email:
		raise KnowledgeV3ConflictError(_("A sugestão está em análise por outra pessoa."))
	data = _payload(payload)
	version = _draft_for_suggestion(bundle, context)
	draft_payload = json.loads(version.payload_json)
	target_ref = frappe.parse_json(doc.target_ref_json)
	current_value, _node_id = _target_value(draft_payload, target_ref, doc.audience_layer)
	if _value_hash(current_value) != doc.current_hash and not bool(data.get("accept_stale")):
		raise KnowledgeV3ConflictError(
			_("O conteúdo mudou desde a sugestão. Compare as versões antes de incorporar.")
		)
	proposed = frappe.parse_json(doc.proposed_value_json)
	_set_target_value(draft_payload, target_ref, doc.audience_layer, proposed)
	version.payload_json = _json(draft_payload)
	version.revision = int(version.revision or 1) + 1
	version.change_summary = str(
		data.get("change_summary") or f"Sugestão {doc.name} incorporada ao rascunho."
	).strip()
	version.save(ignore_permissions=True)
	doc.state = "incorporated"
	doc.reviewer_email = context.email
	doc.reviewed_at = now_datetime()
	doc.review_notes = str(data.get("review_notes") or "").strip()
	doc.draft_version_created = version.name
	doc.save(ignore_permissions=True)
	_audit(
		context,
		"knowledge_suggestion_incorporated",
		doc.name,
		{"draft_version": version.version_id},
	)
	_notify_author(doc, "Sua sugestão foi incorporada a um rascunho")
	return response(
		{"suggestion": _serialize_suggestion(doc), "draft": _serialize_version(version)},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def reject_suggestion(suggestion_id: str, payload: dict | str | None = None):
	context = get_request_context("edit_knowledge_draft")
	_collaboration_enabled()
	doc, _bundle_doc = _reviewable_suggestion(suggestion_id, context, {"received", "in_review"})
	data = _payload(payload)
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 10:
		raise KnowledgeV3ValidationError(_("Explique a recusa em pelo menos 10 caracteres."))
	doc.state = "rejected"
	doc.reviewer_email = context.email
	doc.reviewed_at = now_datetime()
	doc.review_notes = reason
	doc.save(ignore_permissions=True)
	_audit(context, "knowledge_suggestion_rejected", doc.name, {"reason": reason})
	_notify_author(doc, "Sua sugestão foi revisada")
	return response(_serialize_suggestion(doc), request_id=context.request_id)


def alert_overdue_suggestions():
	if not frappe.db.exists("DocType", "Univesp Knowledge Suggestion"):
		return
	now = now_datetime()
	rows = frappe.get_all(
		"Univesp Knowledge Suggestion",
		filters={
			"state": ["in", ["received", "in_review"]],
			"sla_due_at": ["<", now],
			"sla_alerted_at": ["is", "not set"],
		},
		fields=["name", "bundle"],
		limit_page_length=100,
	)
	for row in rows:
		doc = frappe.get_doc("Univesp Knowledge Suggestion", row.name)
		theme_key = frappe.db.get_value("Univesp Knowledge Bundle", row.bundle, "theme_key")
		governance = frappe.get_doc("Univesp Knowledge Theme Governance", theme_key)
		group_name = governance.fallback_admin_group
		if group_name:
			group = frappe.get_doc("Univesp Access Group", group_name)
			for email in frappe.parse_json(group.members_json or "[]"):
				frappe.publish_realtime(
					"knowledge_suggestion_sla_overdue",
					{"suggestion_id": doc.name, "theme_key": theme_key},
					user=str(email).strip().lower(),
				)
		doc.sla_alerted_at = now
		doc.save(ignore_permissions=True)


def _reviewable_suggestion(suggestion_id, context, states):
	doc = frappe.get_doc("Univesp Knowledge Suggestion", str(suggestion_id or "").strip())
	if doc.state not in states:
		raise KnowledgeV3ValidationError(_("Sugestão não está disponível para esta ação."))
	bundle = frappe.get_doc("Univesp Knowledge Bundle", doc.bundle)
	_ensure_theme_scope(context, bundle.theme_key)
	return doc, bundle


def _draft_for_suggestion(bundle, context):
	if bundle.draft_version:
		version = frappe.get_doc("Univesp Knowledge Version", bundle.draft_version)
		if version.lifecycle_state != "draft":
			raise KnowledgeV3ConflictError(_("O fluxo possui uma revisão editorial em andamento."))
		return version
	if not bundle.published_version:
		raise KnowledgeV3ValidationError(_("Fluxo sem versão publicada para criar rascunho."))
	source = frappe.get_doc("Univesp Knowledge Version", bundle.published_version)
	version = _create_draft(bundle, context.email, json.loads(source.payload_json))
	_set_bundle_pointer(bundle.name, "draft_version", version.name)
	return version


def _source_version(bundle, requested_version_id):
	name = ""
	if requested_version_id:
		name = frappe.db.get_value(
			"Univesp Knowledge Version",
			{"version_id": str(requested_version_id).strip(), "bundle": bundle.name},
			"name",
		)
	else:
		name = bundle.published_version
	if not name:
		raise KnowledgeV3ValidationError(_("Versão publicada não encontrada para a sugestão."))
	version = frappe.get_doc("Univesp Knowledge Version", name)
	if version.lifecycle_state not in {"published", "superseded"}:
		raise KnowledgeV3ValidationError(_("Sugestões devem referenciar conteúdo que já foi publicado."))
	return version


def _target_value(payload, target_ref, layer):
	node = next(
		(
			item
			for item in payload.get("nodes") or []
			if str(item.get("node_id") or "") == str(target_ref.get("node_id") or "")
			or str(item.get("stable_key") or "") == str(target_ref.get("node_id") or "")
		),
		None,
	)
	if not node:
		raise KnowledgeV3ValidationError(_("Etapa da sugestão não existe na versão publicada."))
	target_type = target_ref.get("type")
	target_id = str(target_ref.get("id") or "").strip()
	if target_type == "node":
		return node, str(node.get("node_id") or "")
	if target_type == "content_block":
		blocks = ((node.get("content") or {}).get(layer) or {}).get("blocks") or []
		target = next((item for item in blocks if str(item.get("block_id") or "") == target_id), None)
	elif target_type == "checklist_item":
		playbooks = node.get("playbooks") or {}
		playbook = playbooks.get(layer)
		if layer == "bpo" and not isinstance(playbook, dict):
			playbook = playbooks.get("op")
		items = (playbook or {}).get("checklist") or []
		target = next(
			(item for item in items if str(item.get("checklist_item_id") or "") == target_id),
			None,
		)
	else:
		field = str(target_ref.get("field") or "").strip()
		if field not in PLAYBOOK_FIELDS or layer not in {"op", "bpo", "analyst"}:
			raise KnowledgeV3ValidationError(_("Campo de playbook inválido."))
		playbooks = node.get("playbooks") or {}
		playbook = playbooks.get(layer)
		if layer == "bpo" and (not isinstance(playbook, dict) or playbook.get(field) is None):
			playbook = playbooks.get("op")
		if not isinstance(playbook, dict):
			raise KnowledgeV3ValidationError(_("Playbook não existe nesta camada."))
		return playbook.get(field), str(node.get("node_id") or "")
	if target is None:
		raise KnowledgeV3ValidationError(_("Item estável da sugestão não foi encontrado."))
	return target, str(node.get("node_id") or "")


def _set_target_value(payload, target_ref, layer, proposed):
	current, _node_id = _target_value(payload, target_ref, layer)
	target_type = target_ref.get("type")
	if target_type in {"node", "content_block", "checklist_item"}:
		if not isinstance(proposed, dict):
			raise KnowledgeV3ValidationError(_("O conteúdo proposto deve preservar a estrutura do item."))
		identity_fields = {
			"node": ("node_id", "stable_key"),
			"content_block": ("block_id",),
			"checklist_item": ("checklist_item_id",),
		}[target_type]
		for field in identity_fields:
			if str(proposed.get(field) or "") != str(current.get(field) or ""):
				raise KnowledgeV3ValidationError(
					_("A sugestão não pode alterar a identidade estável do item.")
				)
		current.clear()
		current.update(proposed)
		return
	node = next(
		item
		for item in payload.get("nodes") or []
		if str(item.get("node_id") or "") == str(target_ref.get("node_id") or "")
		or str(item.get("stable_key") or "") == str(target_ref.get("node_id") or "")
	)
	playbooks = node.setdefault("playbooks", {})
	if not isinstance(playbooks.get(layer), dict):
		playbooks[layer] = {}
	playbooks[layer][target_ref["field"]] = proposed


def _serialize_suggestion(doc):
	bundle = frappe.get_doc("Univesp Knowledge Bundle", doc.bundle)
	return {
		"suggestion_id": doc.name,
		"bundle_key": bundle.bundle_key,
		"bundle_title": bundle.title,
		"theme_key": bundle.theme_key,
		"version_id": frappe.db.get_value("Univesp Knowledge Version", doc.source_version, "version_id"),
		"node_id": doc.node_id,
		"audience_layer": doc.audience_layer,
		"target_path": frappe.parse_json(doc.target_path_json or "[]"),
		"target_ref": frappe.parse_json(doc.target_ref_json or "{}"),
		"current_value": frappe.parse_json(doc.current_value_json or "null"),
		"proposed_value": frappe.parse_json(doc.proposed_value_json or "null"),
		"reason": doc.reason,
		"author_email": doc.author_email,
		"state": doc.state,
		"reviewer_email": doc.reviewer_email or "",
		"reviewed_at": str(doc.reviewed_at or ""),
		"review_notes": doc.review_notes or "",
		"draft_version_created": doc.draft_version_created or "",
		"sla_due_at": str(doc.sla_due_at or ""),
		"sla_overdue": bool(doc.sla_due_at and now_datetime() > get_datetime(doc.sla_due_at)),
		"created_at": str(doc.creation or ""),
		"modified_at": str(doc.modified or ""),
	}


def _suggestion_sla_hours(theme_key):
	value = frappe.db.get_value(
		"Univesp Knowledge Theme Governance",
		theme_key,
		"suggestion_sla_hours",
	)
	if not value:
		value = getattr(frappe.get_single("Univesp Runtime Settings"), "default_suggestion_sla_hours", 72)
	return max(int(value or 72), 1)


def _notify_reviewers(theme_key, subject, doc):
	governance = frappe.get_doc("Univesp Knowledge Theme Governance", theme_key)
	group = frappe.get_doc("Univesp Access Group", governance.approver_group)
	for email in frappe.parse_json(group.members_json or "[]"):
		frappe.publish_realtime(
			"knowledge_suggestion_received",
			{"subject": subject, "suggestion_id": doc.name, "theme_key": theme_key},
			user=str(email).strip().lower(),
		)


def _notify_author(doc, subject):
	frappe.publish_realtime(
		"knowledge_suggestion_updated",
		{"subject": subject, "suggestion_id": doc.name, "state": doc.state},
		user=doc.author_email,
	)


def _collaboration_enabled():
	if not frappe.db.exists("DocType", "Univesp Runtime Settings"):
		raise KnowledgeV3ValidationError(_("Configuração de colaboração indisponível."))
	settings = frappe.get_single("Univesp Runtime Settings")
	if not bool(settings.knowledge_collaboration):
		raise KnowledgeV3ValidationError(_("Colaboração em conhecimento está desativada."))


def _value_hash(value):
	return hashlib.sha256(_json(value).encode("utf-8")).hexdigest()


def _json(value):
	return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _payload(value):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value:
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise KnowledgeV3ValidationError(_("Corpo JSON inválido.")) from exc
	return {}


def _choice(value, allowed, label):
	normalized = str(value or "").strip()
	if normalized not in allowed:
		raise KnowledgeV3ValidationError(_("{0} inválido.").format(label.capitalize()))
	return normalized
