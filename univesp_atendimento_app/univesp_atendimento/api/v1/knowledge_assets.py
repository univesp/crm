import hashlib
import secrets

import frappe
from frappe import _
from frappe.utils.file_manager import save_file

from univesp_atendimento.api.v1.common import get_request_context, response
from univesp_atendimento.cloud_service_auth import configured_value, service_headers
from univesp_atendimento.knowledge_asset_security import signature_matches


MIME_TYPES = {
	"image/png": "image",
	"image/jpeg": "image",
	"image/webp": "image",
	"image/gif": "video",
	"video/mp4": "video",
	"video/webm": "video",
	"application/pdf": "file",
}


@frappe.whitelist(methods=["GET"])
def list_assets():
	context = get_request_context("edit_knowledge_draft")
	rows = frappe.get_all(
		"Univesp Knowledge Asset",
		filters={"status": "active"},
		fields=["asset_key", "file", "asset_type", "mime_type", "alt_text", "caption", "transcript"],
		order_by="creation desc",
		limit_page_length=200,
	)
	files = {
		row.name: row.file_url
		for row in frappe.get_all(
			"File",
			filters={"name": ["in", [item.file for item in rows] or ["__none__"]]},
			fields=["name", "file_url"],
		)
	}
	return response(
		[{**dict(row), "url": files.get(row.file, "")} for row in rows],
		request_id=context.request_id,
	)


@frappe.whitelist(methods=["POST"])
def upload_asset():
	context = get_request_context("edit_knowledge_draft")
	settings = frappe.get_single("Univesp Runtime Settings")
	if not bool(getattr(settings, "knowledge_media_upload", False)):
		raise frappe.PermissionError(_("Upload editorial está desabilitado."))
	files = getattr(frappe.request, "files", None)
	uploads = files.getlist("files") if files and hasattr(files, "getlist") else list((files or {}).values())
	if len(uploads) != 1:
		frappe.throw(_("Envie exatamente um asset."), frappe.ValidationError)
	uploaded = uploads[0]
	filename = str(uploaded.filename or "asset")
	content = uploaded.stream.read(25 * 1024 * 1024 + 1)
	mime = str(uploaded.content_type or "").lower()
	asset_type = MIME_TYPES.get(mime)
	if not asset_type or not content or len(content) > 25 * 1024 * 1024:
		frappe.throw(_("Formato ou tamanho de asset não permitido."), frappe.ValidationError)
	if not signature_matches(mime, content):
		frappe.throw(_("O conteúdo do asset não corresponde ao formato informado."), frappe.ValidationError)
	alt = str(frappe.form_dict.get("alt_text") or "").strip()
	caption = str(frappe.form_dict.get("caption") or "").strip()
	transcript = str(frappe.form_dict.get("transcript") or "").strip()
	if mime == "image/gif":
		if not alt:
			frappe.throw(_("Texto alternativo é obrigatório para animações."), frappe.ValidationError)
		from univesp_atendimento.api.v1.public import _scan_document

		if _scan_document(filename, mime, content) != "clean":
			frappe.throw(_("Asset rejeitado pelo antimalware."), frappe.ValidationError)
		content = _convert_gif(filename, content)
		filename = f"{filename.rsplit('.', 1)[0]}.mp4"
		mime = "video/mp4"
		transcript = transcript or alt
	if asset_type == "image" and not alt:
		frappe.throw(_("Texto alternativo é obrigatório para imagens."), frappe.ValidationError)
	if asset_type == "video" and not transcript:
		frappe.throw(_("Transcrição é obrigatória para vídeos."), frappe.ValidationError)
	from univesp_atendimento.api.v1.public import _scan_document

	if _scan_document(filename, mime, content) != "clean":
		frappe.throw(_("Asset rejeitado pelo antimalware."), frappe.ValidationError)
	file_doc = save_file(filename, content, "", "", is_private=0)
	key = f"asset-{secrets.token_hex(8)}"
	doc = frappe.get_doc(
		{
			"doctype": "Univesp Knowledge Asset",
			"asset_key": key,
			"file": file_doc.name,
			"asset_type": asset_type,
			"mime_type": mime,
			"sha256": hashlib.sha256(content).hexdigest(),
			"alt_text": alt,
			"caption": caption,
			"transcript": transcript,
			"status": "active",
			"created_by": context.email,
		}
	).insert(ignore_permissions=True)
	return response(
		{"asset_id": doc.asset_key, "type": asset_type, "url": file_doc.file_url, "alt": alt},
		request_id=context.request_id,
	)


def _convert_gif(filename, content):
	import requests

	endpoint = configured_value(frappe, "media_processor_endpoint", "MEDIA_PROCESSOR_ENDPOINT")
	token = configured_value(frappe, "media_processor_token", "MEDIA_PROCESSOR_TOKEN")
	if not endpoint.startswith("https://") or not token:
		frappe.throw(_("Conversor institucional de GIF não configurado."), frappe.ValidationError)
	try:
		result = requests.post(
			endpoint,
			files={"file": (filename, content, "image/gif")},
			headers=service_headers(endpoint, "X-Media-Processor-Token", token),
			timeout=30,
		)
		result.raise_for_status()
		if len(result.content) > 25 * 1024 * 1024 or not signature_matches("video/mp4", result.content):
			raise ValueError("Resposta não é MP4.")
		return result.content
	except (requests.RequestException, ValueError) as exc:
		frappe.log_error(title="Falha ao converter GIF", message=str(exc))
		frappe.throw(_("Não foi possível converter a animação."), frappe.ValidationError)
