import hashlib
import hmac
import json
import uuid

import frappe
from frappe import _
from frappe.utils import add_to_date, get_datetime, now_datetime

from univesp_atendimento.api.v1.common import (
	ensure_ticket_access,
	get_request_context,
	resolve_ticket_name,
	response,
	verify_gateway_only,
)
from univesp_atendimento.api.v1.knowledge import _build_published_faq_entries
from univesp_atendimento.knowledge_graph import (
	KnowledgeGraphError,
	project_runtime,
	validate_ordered_path,
)


SESSION_PREFIX = "univesp:knowledge:session:"
SESSION_PERSONAS = {"student", "op", "bpo", "analyst"}
EVENT_METADATA_KEYS = {"outcome_key", "action_key", "source"}
PROFILE_PERSONAS = {
	"aluno": {"student"},
	"op": {"op"},
	"op_externo": {"bpo"},
	"gestor_polos": {"op"},
	"analista_area": {"analyst", "op", "bpo"},
	"gestor_area": {"analyst", "op", "bpo"},
	"admin_central": SESSION_PERSONAS,
}


class KnowledgeRuntimeValidationError(frappe.ValidationError):
	http_status_code = 422


class KnowledgeSessionExpiredError(frappe.ValidationError):
	http_status_code = 410


@frappe.whitelist(methods=["GET"])
def published_runtime(persona: str | None = None):
	context = get_request_context()
	resolved_persona = _resolve_persona(context, persona)
	settings = frappe.get_single("Univesp Runtime Settings")
	if not bool(settings.knowledge_v3_read):
		faq_type = "aluno" if resolved_persona == "student" else "op"
		entries, doc = _build_published_faq_entries(faq_type)
		return response(
			entries,
			meta={
				"runtime_schema": "2.0.0",
				"faq_type": faq_type,
				"version": str(doc.modified or ""),
				"persona": resolved_persona,
			},
			request_id=context.request_id,
		)

	entries = _published_v3_entries(resolved_persona)
	return response(
		entries,
		meta={"runtime_schema": "3.0.0", "persona": resolved_persona},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def published_runtime_public():
	verify_gateway_only()
	settings = frappe.get_single("Univesp Runtime Settings")
	if not bool(settings.knowledge_v3_read):
		entries, doc = _build_published_faq_entries("publico")
		return response(
			entries,
			meta={
				"runtime_schema": "2.0.0",
				"faq_type": "publico",
				"version": str(doc.modified or ""),
				"persona": "public",
			},
		)
	return response(
		_published_v3_entries("public"),
		meta={"runtime_schema": "3.0.0", "persona": "public"},
	)


@frappe.whitelist(methods=["POST"])
def start_session(payload: dict | str | None = None):
	context = get_request_context()
	data = _payload(payload)
	persona = _resolve_persona(context, data.get("persona"))
	bundle = _active_bundle(data.get("bundle_key"), persona)
	version = _session_version(bundle, data.get("bundle_version_id"))
	canonical = json.loads(version.payload_json)
	try:
		runtime = project_runtime(canonical, persona)
	except KnowledgeGraphError as exc:
		raise KnowledgeRuntimeValidationError(str(exc)) from exc
	root_id = runtime["root_node_id"]
	session_id = _session_id(data.get("faq_session_id"))
	binding_hash = _binding_hash(data.get("binding_hash"))
	origin = _origin(data.get("origin"), context.profile_key)
	ttl = _session_ttl()
	record = {
		"faq_session_id": session_id,
		"binding_hash": binding_hash,
		"actor_hash": _actor_hash(context.email),
		"bundle_key": bundle.bundle_key,
		"bundle_version_id": version.version_id,
		"persona": persona,
		"graph_audience": runtime["graph_audience"],
		"path": [root_id],
		"profile_key": context.profile_key,
		"origin": origin,
		"created_at": str(now_datetime()),
		"expires_at": str(add_to_date(now_datetime(), seconds=ttl)),
	}
	_store_session(record, ttl)
	_append_event(
		context,
		record,
		"faq.session_started",
		root_id,
		event_id=str(uuid.uuid4()),
		metadata={},
	)
	return response(
		{
			"faq_session_id": session_id,
			"bundle_key": bundle.bundle_key,
			"bundle_version_id": version.version_id,
			"persona": persona,
			"root_node_id": root_id,
			"path": [root_id],
			"expires_at": record["expires_at"],
			"runtime": runtime,
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["GET"])
def get_session(faq_session_id: str, binding_hash: str):
	context = get_request_context()
	record = _load_session(faq_session_id, binding_hash, context)
	return response(_public_session(record), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def advance_session(faq_session_id: str, payload: dict | str | None = None):
	context = get_request_context()
	data = _payload(payload)
	record = _load_session(faq_session_id, data.get("binding_hash"), context)
	node_id = str(data.get("node_id") or "").strip()
	if not node_id:
		raise KnowledgeRuntimeValidationError(_("Nó de destino é obrigatório."))
	version = frappe.get_doc("Univesp Knowledge Version", record["bundle_version_id"])
	canonical = json.loads(version.payload_json)
	requested_path = data.get("path")
	proposed_path = (
		[str(item or "").strip() for item in requested_path if str(item or "").strip()]
		if isinstance(requested_path, list)
		else [*record["path"], node_id]
	)
	if not proposed_path or proposed_path[-1] != node_id:
		raise KnowledgeRuntimeValidationError(_("Caminho informado não termina no nó selecionado."))
	try:
		record["path"] = validate_ordered_path(
			canonical,
			record["graph_audience"],
			proposed_path,
		)
	except KnowledgeGraphError as exc:
		raise KnowledgeRuntimeValidationError(str(exc)) from exc
	ttl = _session_ttl()
	record["expires_at"] = str(add_to_date(now_datetime(), seconds=ttl))
	_store_session(record, ttl)
	_append_event(
		context,
		record,
		"faq.path_advanced",
		node_id,
		event_id=str(data.get("event_id") or uuid.uuid4()),
		metadata={},
	)
	return response(_public_session(record), request_id=context.request_id)


@frappe.whitelist(methods=["POST"])
def record_event(payload: dict | str | None = None):
	context = get_request_context()
	data = _payload(payload)
	record = _load_session(data.get("faq_session_id"), data.get("binding_hash"), context)
	event_name = str(data.get("event_name") or "").strip()
	node_id = str(data.get("node_id") or record["path"][-1]).strip()
	if node_id not in record["path"]:
		raise KnowledgeRuntimeValidationError(_("Evento referencia nó fora do caminho da sessão."))
	event_id = _session_id(data.get("event_id"))
	event = _append_event(
		context,
		record,
		event_name,
		node_id,
		event_id=event_id,
		metadata=_safe_event_metadata(data.get("metadata")),
	)
	return response(_serialize_event(event), request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def legacy_metrics():
	context = get_request_context("view_audit")
	resolved = int(
		frappe.db.sql(
			"""
			select count(distinct faq_session_id)
			from `tabUnivesp Knowledge Event`
			where event_name in ('faq.resolved_without_ticket', 'faq.resolution_confirmed')
			""",
		)[0][0]
	)
	started = int(
		frappe.db.sql(
			"""
			select count(distinct faq_session_id)
			from `tabUnivesp Knowledge Event`
			where event_name = 'faq.ticket_open_started'
			""",
		)[0][0]
	)
	return response(
		{
			"metrics": [
				{"label": "Resolvidos pela FAQ", "value": resolved},
				{"label": "Abriram atendimento após a FAQ", "value": started},
			],
			"legacy_metrics": [
				{"label": "Resolvidos pela FAQ", "value": resolved},
				{"label": "Enviados ao OP", "value": started},
			],
			"source": "knowledge_events_v3",
		},
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def record_case_knowledge_applied(ticket_id: str, payload: dict | str | None = None):
	context = get_request_context("view_ticket")
	ticket_name = resolve_ticket_name(ticket_id)
	ensure_ticket_access(ticket_name, context)
	data = _payload(payload)
	ticket = frappe.db.get_value(
		"HD Ticket",
		ticket_name,
		[
			"custom_source_bundle_id",
			"custom_source_bundle_version_id",
			"custom_source_node_id",
			"custom_faq_session_id",
		],
		as_dict=True,
	)
	if not ticket or not all(
		(
			ticket.custom_source_bundle_id,
			ticket.custom_source_bundle_version_id,
			ticket.custom_source_node_id,
		)
	):
		raise KnowledgeRuntimeValidationError(_("Atendimento sem lineage de conhecimento completo."))
	persona = {
		"op": "op",
		"gestor_polos": "op",
		"op_externo": "bpo",
		"analista_area": "analyst",
		"gestor_area": "analyst",
		"admin_central": "analyst",
	}.get(context.profile_key)
	if not persona:
		raise frappe.PermissionError(_("Seu perfil não pode registrar uso de playbook."))
	record = {
		"bundle_key": ticket.custom_source_bundle_id,
		"bundle_version_id": ticket.custom_source_bundle_version_id,
		"faq_session_id": ticket.custom_faq_session_id or f"case:{ticket_name}",
		"persona": persona,
		"profile_key": context.profile_key,
		"origin": "op_assisted",
	}
	event = _append_event(
		context,
		record,
		"case.knowledge_applied",
		ticket.custom_source_node_id,
		event_id=str(data.get("event_id") or uuid.uuid4()),
		metadata=_safe_event_metadata(
			{
				"action_key": data.get("action_key") or "explicit_use",
				"source": "ticket_detail",
			}
		),
	)
	return response(_serialize_event(event), request_id=context.request_id)


def validate_session_lineage(knowledge, context):
	if not isinstance(knowledge, dict) or not knowledge.get("faq_session_id"):
		return None
	record = _load_session(
		knowledge.get("faq_session_id"),
		knowledge.get("binding_hash"),
		context,
	)
	requested_path = knowledge.get("path")
	if requested_path is not None and list(requested_path) != record["path"]:
		raise KnowledgeRuntimeValidationError(_("Caminho informado diverge da sessão FAQ."))
	if str(knowledge.get("bundle_id") or record["bundle_key"]) != record["bundle_key"]:
		raise KnowledgeRuntimeValidationError(_("Bundle informado diverge da sessão FAQ."))
	if (
		str(knowledge.get("bundle_version_id") or record["bundle_version_id"])
		!= record["bundle_version_id"]
	):
		raise KnowledgeRuntimeValidationError(_("Versão informada diverge da sessão FAQ."))
	if str(knowledge.get("node_id") or record["path"][-1]) != record["path"][-1]:
		raise KnowledgeRuntimeValidationError(_("Nó informado diverge da sessão FAQ."))
	return record


def record_protocol_created(context, session_record, ticket_name):
	if not session_record:
		return None
	return _append_event(
		context,
		session_record,
		"protocol.created",
		session_record["path"][-1],
		event_id=f"protocol:{ticket_name}",
		metadata={"source": "ticket"},
	)


def _published_v3_entries(persona):
	profiles = ["public", "mixed"] if persona == "public" else ["student", "mixed"]
	if persona == "analyst":
		profiles.append("internal")
	bundles = frappe.get_all(
		"Univesp Knowledge Bundle",
		filters={"status": "active", "audience_profile": ["in", profiles]},
		fields=["name"],
		order_by="modified desc",
		limit_page_length=0,
	)
	entries = []
	for row in bundles:
		bundle = frappe.get_doc("Univesp Knowledge Bundle", row.name)
		try:
			version = _active_published_version(bundle)
			canonical = json.loads(version.payload_json)
			runtime = project_runtime(canonical, persona)
		except KnowledgeGraphError as exc:
			raise KnowledgeRuntimeValidationError(
				_("Fluxo publicado inválido: {0}.").format(bundle.bundle_key)
			) from exc
		entries.append(
			{
				"bundle_id": bundle.bundle_key,
				"bundle_version_id": version.version_id,
				"title": runtime["metadata"]["title"],
				"runtime": runtime,
				"package": _legacy_package(runtime, version),
			}
		)
	return entries


def _active_bundle(bundle_key, persona):
	key = str(bundle_key or "").strip()
	if not key or not frappe.db.exists("Univesp Knowledge Bundle", key):
		raise KnowledgeRuntimeValidationError(_("Fluxo publicado não encontrado."))
	bundle = frappe.get_doc("Univesp Knowledge Bundle", key)
	allowed_profiles = {"student", "mixed"} if persona != "analyst" else {"student", "mixed", "internal"}
	if bundle.status != "active" or bundle.audience_profile not in allowed_profiles:
		raise KnowledgeRuntimeValidationError(_("Fluxo indisponível para esta persona."))
	return bundle


def _active_published_version(bundle):
	if not bundle.published_version:
		raise KnowledgeRuntimeValidationError(_("Fluxo não possui versão publicada vigente."))
	version = frappe.get_doc("Univesp Knowledge Version", bundle.published_version)
	now = now_datetime()
	if version.lifecycle_state != "published":
		raise KnowledgeRuntimeValidationError(_("Versão indicada não está publicada."))
	if version.valid_from and get_datetime(version.valid_from) > now:
		raise KnowledgeRuntimeValidationError(_("Versão ainda não está vigente."))
	if version.valid_until and get_datetime(version.valid_until) < now:
		raise KnowledgeRuntimeValidationError(_("Versão publicada expirou."))
	return version


def _session_version(bundle, requested_version_id):
	requested = str(requested_version_id or "").strip()
	if not requested:
		return _active_published_version(bundle)
	if not frappe.db.exists("Univesp Knowledge Version", requested):
		raise KnowledgeRuntimeValidationError(_("Versão exibida não foi encontrada."))
	version = frappe.get_doc("Univesp Knowledge Version", requested)
	if version.bundle != bundle.name or version.lifecycle_state not in {"published", "superseded"}:
		raise KnowledgeRuntimeValidationError(_("Versão exibida não pertence ao fluxo publicado."))
	return version


def _load_session(session_id, binding_hash, context):
	normalized_id = _session_id(session_id)
	value = frappe.cache().get_value(f"{SESSION_PREFIX}{normalized_id}")
	if not value:
		raise KnowledgeSessionExpiredError(_("A sessão da FAQ expirou. Reinicie a jornada."))
	record = json.loads(value)
	if not hmac.compare_digest(record["binding_hash"], _binding_hash(binding_hash)):
		raise frappe.PermissionError(_("Sessão FAQ não pertence a este navegador."))
	if not hmac.compare_digest(record["actor_hash"], _actor_hash(context.email)):
		raise frappe.PermissionError(_("Sessão FAQ não pertence ao usuário atual."))
	return record


def _store_session(record, ttl):
	frappe.cache().set_value(
		f"{SESSION_PREFIX}{record['faq_session_id']}",
		json.dumps(record, ensure_ascii=False),
		expires_in_sec=ttl,
	)


def _append_event(context, record, event_name, node_id, *, event_id, metadata):
	if frappe.db.exists("Univesp Knowledge Event", event_id):
		return frappe.get_doc("Univesp Knowledge Event", event_id)
	version = frappe.get_doc("Univesp Knowledge Version", record["bundle_version_id"])
	payload = json.loads(version.payload_json)
	node = next(
		(
			item
			for item in payload.get("nodes") or []
			if str(item.get("node_id") or "") == str(node_id)
		),
		None,
	)
	if not node:
		raise KnowledgeRuntimeValidationError(_("Nó do evento não existe na versão fixada."))
	return frappe.get_doc(
		{
			"doctype": "Univesp Knowledge Event",
			"event_id": event_id,
			"event_name": event_name,
			"occurred_at": now_datetime(),
			"bundle_key": record["bundle_key"],
			"bundle_version_id": record["bundle_version_id"],
			"node_id": node_id,
			"stable_key": str(node.get("stable_key") or ""),
			"audience_layer": record["persona"],
			"faq_session_id": record["faq_session_id"],
			"profile_key": record["profile_key"],
			"origin": record["origin"],
			"metadata_json": json.dumps(metadata or {}, ensure_ascii=False),
			"request_id": context.request_id,
		}
	).insert(ignore_permissions=True)


def _legacy_package(runtime, version):
	persona = runtime["persona"]
	faq_type = "aluno" if persona == "student" else "publico" if persona == "public" else "op"
	root_id = runtime["root_node_id"]
	metadata = runtime["metadata"]
	nodes = []
	for node in runtime["nodes"]:
		display = node.get("display") or {}
		content = node.get("content") or {}
		playbook = node.get("playbook") or {}
		blocks = content.get("blocks") if isinstance(content, dict) else []
		answer = "\n\n".join(
			str(block.get("body") or "").strip()
			for block in blocks or []
			if isinstance(block, dict) and block.get("type") == "text" and str(block.get("body") or "").strip()
		)
		outcome = str(content.get("outcome_key") or "") if isinstance(content, dict) else ""
		node_kind = (
			"theme"
			if node["node_id"] == root_id
			else "leaf"
			if node.get("node_kind") == "final"
			else "branch"
		)
		nodes.append(
			{
				"id": node["node_id"],
				"stable_key": node["stable_key"],
				"node_kind": node_kind,
				"titulo_exibido": str(display.get("title") or display.get("question") or ""),
				"pergunta_exibida": str(display.get("question") or display.get("title") or ""),
				"tema": str(metadata.get("title") or ""),
				"subtema": "" if node["node_id"] == root_id else str(display.get("title") or ""),
				"resposta": answer,
				"acao": _legacy_action(node_kind, outcome),
				"criticidade_padrao": metadata.get("criticidade_default_key") or "media",
				"sla_padrao": metadata.get("sla_policy_key") or "48h",
				"fila_destino": "nao_aplicavel",
				"perfil": faq_type,
				"ativo": True,
				"publication_status": "published",
				"checklist_op": _playbook_texts(playbook.get("checklist")),
				"sistemas_a_consultar": _playbook_labels(playbook.get("systems")),
				"documentos_a_solicitar": _playbook_labels(playbook.get("documents_to_request")),
				"resposta_padrao_sugerida": str(playbook.get("suggested_reply") or ""),
				"criterio_de_escalonamento": str(
					playbook.get("escalation_criteria")
					or (playbook.get("escalation") or {}).get("criteria")
					or ""
				),
				"motivo_escalonamento_sugerido": str(
					playbook.get("escalation_reason_template")
					or (playbook.get("escalation") or {}).get("reason_template")
					or ""
				),
				"playbook_v3": playbook or None,
				"document_policy": node.get("document_policy"),
				"intake_policy": node.get("intake_policy"),
			}
		)
	return {
		"schema_version": "3.0.0-runtime",
		"faq_id": runtime["bundle_key"],
		"tipo_faq": faq_type,
		"metadata": metadata,
		"versioning": {
			"publication_status": "published",
			"bundle_version_id": version.version_id,
		},
		"publication": {"active_bundle_version_id": version.version_id},
		"nodes": nodes,
		"links": [
			{
				"link_id": edge["edge_id"],
				"faq_id": runtime["bundle_key"],
				"parent_node_id": edge["parent_node_id"],
				"child_node_id": edge["child_node_id"],
				"ordem": edge["order"],
				"ativo": True,
			}
			for edge in runtime["edges"]
		],
		"calendar_highlights": [],
	}


def _resolve_persona(context, requested):
	defaults = {
		"aluno": "student",
		"op": "op",
		"op_externo": "bpo",
		"gestor_polos": "op",
		"analista_area": "analyst",
		"gestor_area": "analyst",
		"admin_central": "analyst",
	}
	persona = str(requested or defaults.get(context.profile_key) or "").strip().lower()
	if persona not in PROFILE_PERSONAS.get(context.profile_key, set()):
		raise frappe.PermissionError(_("Persona de conhecimento não permitida para seu perfil."))
	return persona


def _session_ttl():
	settings = frappe.get_single("Univesp Runtime Settings")
	return max(int(settings.knowledge_session_ttl_seconds or 7200), 300)


def _actor_hash(email):
	secret = str(getattr(frappe.local.conf, "encryption_key", "") or "univesp-knowledge-session")
	return hmac.new(secret.encode(), str(email or "").strip().lower().encode(), hashlib.sha256).hexdigest()


def _binding_hash(value):
	normalized = str(value or "").strip().lower()
	if len(normalized) != 64 or any(char not in "0123456789abcdef" for char in normalized):
		raise frappe.PermissionError(_("Vínculo de navegador inválido."))
	return normalized


def _session_id(value):
	normalized = str(value or "").strip()
	try:
		return str(uuid.UUID(normalized))
	except (ValueError, TypeError, AttributeError) as exc:
		raise KnowledgeRuntimeValidationError(_("Identificador opaco inválido.")) from exc


def _origin(value, profile_key):
	default = "portal" if profile_key == "aluno" else "op_assisted"
	normalized = str(value or default).strip()
	if normalized not in {"portal", "op_assisted"}:
		raise KnowledgeRuntimeValidationError(_("Origem da sessão inválida."))
	return normalized


def _safe_event_metadata(value):
	if not isinstance(value, dict):
		return {}
	return {
		key: str(value[key])[:180]
		for key in EVENT_METADATA_KEYS
		if key in value and value[key] is not None
	}


def _public_session(record):
	return {
		"faq_session_id": record["faq_session_id"],
		"bundle_key": record["bundle_key"],
		"bundle_version_id": record["bundle_version_id"],
		"persona": record["persona"],
		"path": list(record["path"]),
		"origin": record["origin"],
		"expires_at": record["expires_at"],
	}


def _serialize_event(event):
	return {
		"event_id": event.event_id,
		"event_name": event.event_name,
		"occurred_at": str(event.occurred_at),
		"bundle_key": event.bundle_key,
		"bundle_version_id": event.bundle_version_id,
		"node_id": event.node_id,
		"stable_key": event.stable_key,
		"audience_layer": event.audience_layer,
		"faq_session_id": event.faq_session_id,
		"profile_key": event.profile_key,
		"origin": event.origin,
	}


def _legacy_action(node_kind, outcome):
	if node_kind != "leaf":
		return "ir_para_subniveis"
	if outcome == "open_ticket":
		return "abrir_atendimento"
	if outcome == "goto_node":
		return "ir_para_subniveis"
	return "mostrar_resposta"


def _playbook_texts(items):
	return [
		str(item.get("text") if isinstance(item, dict) else item or "").strip()
		for item in items or []
		if str(item.get("text") if isinstance(item, dict) else item or "").strip()
	]


def _playbook_labels(items):
	return [
		str(
			(item.get("label") or item.get("system_key") or item.get("document_type_key"))
			if isinstance(item, dict)
			else item or ""
		).strip()
		for item in items or []
		if str(
			(item.get("label") or item.get("system_key") or item.get("document_type_key"))
			if isinstance(item, dict)
			else item or ""
		).strip()
	]


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value.strip():
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise KnowledgeRuntimeValidationError(_("Corpo JSON inválido.")) from exc
	return {}
