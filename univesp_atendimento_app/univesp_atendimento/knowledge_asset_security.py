def signature_matches(mime, content):
	if mime == "image/png":
		return content.startswith(b"\x89PNG\r\n\x1a\n")
	if mime == "image/jpeg":
		return content.startswith(b"\xff\xd8\xff")
	if mime == "image/webp":
		return content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP"
	if mime == "image/gif":
		return content.startswith((b"GIF87a", b"GIF89a"))
	if mime == "video/mp4":
		return len(content) > 12 and content[4:8] == b"ftyp"
	if mime == "video/webm":
		return content.startswith(b"\x1aE\xdf\xa3")
	if mime == "application/pdf":
		return content.startswith(b"%PDF-")
	return False
