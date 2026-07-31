from unittest import TestCase

from univesp_atendimento.knowledge_asset_security import signature_matches


class TestKnowledgeAssetSecurity(TestCase):
	def test_accepts_supported_magic_signatures(self):
		self.assertTrue(signature_matches("image/png", b"\x89PNG\r\n\x1a\nrest"))
		self.assertTrue(signature_matches("image/gif", b"GIF89arest"))
		self.assertTrue(signature_matches("video/mp4", b"\x00\x00\x00\x18ftypisomrest"))
		self.assertTrue(signature_matches("application/pdf", b"%PDF-1.7"))

	def test_rejects_spoofed_or_unknown_content(self):
		self.assertFalse(signature_matches("image/png", b"<script>"))
		self.assertFalse(signature_matches("image/gif", b"\x89PNG\r\n\x1a\n"))
		self.assertFalse(signature_matches("application/octet-stream", b"anything"))
