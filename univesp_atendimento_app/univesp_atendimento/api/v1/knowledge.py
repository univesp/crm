import hashlib
import json

import frappe
from frappe import _
from frappe.utils import get_datetime, now_datetime

from univesp_atendimento.api.v1.common import get_request_context, response


MAX_LIBRARY_BYTES = 2 * 1024 * 1024
MAX_BUNDLES = 500


class KnowledgeLibraryValidationError(frappe.ValidationError):
	http_status_code = 422


class KnowledgeLibraryConflictError(frappe.ValidationError):
	http_status_code = 409


@frappe.whitelist(methods=["GET"])
def published(search: str | None = None, limit: int | str = 50):
	context = get_request_context()
	filters = {"status": "Published"}
	if search:
		filters["title"] = ["like", f"%{str(search).strip()}%"]
	rows = frappe.get_all(
		"HD Article",
		filters=filters,
		fields=["name as id", "title", "content as description", "modified as updated_at"],
		order_by="modified desc",
		page_length=min(max(int(limit), 1), 100),
	)
	return response(rows, request_id=context.request_id)


@frappe.whitelist(methods=["GET"])
def published_faq(faq_type: str = "aluno"):
	context = get_request_context()
	normalized_type = _normalize_faq_type(faq_type)
	published, doc = _build_published_faq_entries(normalized_type)
	return response(
		published,
		meta={"version": str(doc.modified or ""), "faq_type": normalized_type},
		request_id=context.request_id,
	)


def _normalize_faq_type(faq_type: str) -> str:
	normalized_type = str(faq_type or "aluno").strip().lower()
	if normalized_type not in {"aluno", "op", "publico"}:
		raise KnowledgeLibraryValidationError(_("Tipo de FAQ invalido."))
	return normalized_type


def _build_published_faq_entries(normalized_type: str):
	doc = frappe.get_single("Univesp Knowledge Library")
	library = _library(doc)
	current = now_datetime()
	published = []
	for entry in library.get("bundles") or []:
		if not isinstance(entry, dict) or str(entry.get("faqType") or "").lower() != normalized_type:
			continue
		workspace = entry.get("workspace") if isinstance(entry.get("workspace"), dict) else {}
		if str(workspace.get("workflowStatus") or "").strip().lower() != "published":
			continue
		package = workspace.get("publishedBundle")
		if not isinstance(package, dict) or not isinstance(package.get("nodes"), list):
			continue
		config = workspace.get("publishConfig") if isinstance(workspace.get("publishConfig"), dict) else {}
		if not _is_publication_active(config, package, current):
			continue
		published.append(
			{
				"bundle_id": str(entry.get("bundleId") or ""),
				"title": str(entry.get("title") or package.get("metadata", {}).get("title") or ""),
				"priority": int(config.get("priority") or 50),
				"display_rank": int(config.get("displayRank") or 50),
				"package": package,
			}
		)
	published.sort(key=lambda item: (-item["priority"], item["display_rank"], item["bundle_id"]))
	return published, doc


def _is_publication_active(config, package, current):
	publication = package.get("publication") if isinstance(package.get("publication"), dict) else {}
	starts_at = config.get("effectiveStartAt") or publication.get("effective_start_at")
	ends_at = config.get("effectiveEndAt") or publication.get("effective_end_at")
	try:
		if starts_at and get_datetime(starts_at) > current:
			return False
		if ends_at and get_datetime(ends_at) < current:
			return False
	except (TypeError, ValueError):
		return False
	return True


@frappe.whitelist(methods=["GET"])
def get_library():
	context = _library_context()
	doc = frappe.get_single("Univesp Knowledge Library")
	return response(_serialize_library(doc), request_id=context.request_id)


@frappe.whitelist(methods=["PATCH", "POST"])
def update_library(payload: dict | str | None = None):
	context = _library_context()
	data = _payload(payload)
	reason = str(data.get("reason") or "").strip()
	if len(reason) < 5:
		raise KnowledgeLibraryValidationError(_("Informe um motivo com pelo menos 5 caracteres."))

	library = data.get("library")
	encoded = _validate_library(library)
	doc = frappe.get_single("Univesp Knowledge Library")
	current_version = str(doc.modified or "")
	requested_version = str(data.get("version") or "").strip()
	if doc.library_json and (not requested_version or requested_version != current_version):
		raise KnowledgeLibraryConflictError(
			_("A biblioteca FAQ foi alterada por outra pessoa. Atualize a tela antes de salvar.")
		)

	before = _library(doc)
	doc.library_json = encoded.decode("utf-8")
	doc.updated_by_email = context.email
	doc.updated_at = now_datetime()
	doc.save(ignore_permissions=True)
	_write_library_audit(context, reason, before, library)
	return response(_serialize_library(doc), request_id=context.request_id)


def _library_context():
	context = get_request_context("edit_faq")
	if context.profile_key != "admin_central":
		raise frappe.PermissionError(_("Somente Admin central pode editar a biblioteca FAQ."))
	return context


def _payload(value=None):
	if isinstance(value, dict):
		return value
	if isinstance(value, str) and value:
		try:
			return json.loads(value)
		except json.JSONDecodeError as exc:
			raise KnowledgeLibraryValidationError(_("Corpo JSON invalido.")) from exc
	return {}


def _validate_library(library):
	if not isinstance(library, dict):
		raise KnowledgeLibraryValidationError(_("Biblioteca FAQ deve ser um objeto JSON."))
	if str(library.get("schemaVersion") or "") != "faq-builder-library-v1":
		raise KnowledgeLibraryValidationError(_("Versao de schema da biblioteca FAQ invalida."))
	bundles = library.get("bundles")
	if not isinstance(bundles, list):
		raise KnowledgeLibraryValidationError(_("Colecao bundles obrigatoria."))
	if len(bundles) > MAX_BUNDLES:
		raise KnowledgeLibraryValidationError(_("Biblioteca FAQ excede 500 fluxos."))

	identifiers = []
	for bundle in bundles:
		if not isinstance(bundle, dict):
			raise KnowledgeLibraryValidationError(_("Fluxo FAQ invalido."))
		bundle_id = str(bundle.get("bundleId") or "").strip()
		if not bundle_id or len(bundle_id) > 180:
			raise KnowledgeLibraryValidationError(_("bundleId obrigatorio ou acima do limite."))
		if not isinstance(bundle.get("workspace"), dict):
			raise KnowledgeLibraryValidationError(_("Workspace obrigatorio para cada fluxo FAQ."))
		identifiers.append(bundle_id)
	if len(identifiers) != len(set(identifiers)):
		raise KnowledgeLibraryValidationError(_("bundleId duplicado na biblioteca FAQ."))

	encoded = json.dumps(library, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
	if len(encoded) > MAX_LIBRARY_BYTES:
		raise KnowledgeLibraryValidationError(_("Biblioteca FAQ excede o limite de 2 MiB."))
	return encoded


def _library(doc):
	if not doc.library_json:
		return {}
	value = frappe.parse_json(doc.library_json)
	return value if isinstance(value, dict) else {}


def _serialize_library(doc):
	return {
		"library": _library(doc),
		"version": str(doc.modified or ""),
		"updated_by": doc.updated_by_email or "",
		"updated_at": doc.updated_at,
	}


def _library_summary(library):
	encoded = json.dumps(library or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
		"utf-8"
	)
	bundles = library.get("bundles") if isinstance(library, dict) else []
	bundles = bundles if isinstance(bundles, list) else []
	return {
		"sha256": hashlib.sha256(encoded).hexdigest(),
		"bytes": len(encoded),
		"bundle_count": len(bundles),
	}


def _write_library_audit(context, reason, before, after):
	frappe.get_doc(
		{
			"doctype": "Univesp Access Audit",
			"actor_email": context.email,
			"target_email": context.email,
			"operation": "knowledge_library_updated",
			"reason": reason,
			"before_json": json.dumps(_library_summary(before), ensure_ascii=False),
			"after_json": json.dumps(_library_summary(after), ensure_ascii=False),
			"request_id": context.request_id,
			"event_at": now_datetime(),
		}
	).insert(ignore_permissions=True)
