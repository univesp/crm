from urllib.parse import urlparse

ALLOWED_BLOCK_TYPES = {"text", "image", "link", "video", "notice", "button", "file", "animation"}
ALLOWED_BUTTON_ACTIONS = {"open_ticket", "go_login"}


def validate_blocks(blocks):
	errors = []
	ids = set()
	for block in blocks or []:
		block_id = str(block.get("block_id") or "").strip()
		block_type = str(block.get("type") or "").strip()
		if not block_id or block_id in ids:
			errors.append("Cada bloco precisa de block_id único.")
		ids.add(block_id)
		if block_type not in ALLOWED_BLOCK_TYPES:
			errors.append(f"Tipo de bloco não permitido: {block_type}.")
		url = str(block.get("url") or "").strip()
		if url and urlparse(url).scheme not in {"https", "mailto"}:
			errors.append("Links devem usar HTTPS ou mailto.")
		if block_type in {"image", "animation"} and not str(block.get("alt") or "").strip():
			errors.append("Imagem ou animação exige texto alternativo.")
		if block_type == "video" and not str(block.get("captions_url") or "").strip():
			errors.append("Vídeo exige legenda.")
		if block_type == "video" and not str(block.get("transcript") or "").strip():
			errors.append("Vídeo exige transcrição.")
		if block_type == "button" and block.get("action_key") not in ALLOWED_BUTTON_ACTIONS:
			errors.append("Botão usa uma ação não permitida.")
		if "<script" in str(block.get("body") or "").lower():
			errors.append("Scripts não são permitidos.")
	return errors
