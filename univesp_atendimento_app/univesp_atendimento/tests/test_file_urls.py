from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from univesp_atendimento.file_urls import (
	normalize_institutional_block_url,
	normalize_payload_media_urls,
	resolve_institutional_file_url,
)


class TestFileUrls(TestCase):
	def test_rewrites_loopback_to_public_https(self):
		frappe = SimpleNamespace(conf={"public_reply_domain": "homolog-crm.univesp.br"})
		with patch("univesp_atendimento.file_urls.frappe", frappe):
			result = resolve_institutional_file_url(
				"http://127.0.0.1:8000/files/diagram.png",
			)
		self.assertEqual(result, "https://homolog-crm.univesp.br/files/diagram.png")

	def test_keeps_external_https(self):
		frappe = SimpleNamespace(conf={"public_reply_domain": "homolog-crm.univesp.br"})
		with patch("univesp_atendimento.file_urls.frappe", frappe):
			result = resolve_institutional_file_url("https://cdn.example/assets/a.png")
		self.assertEqual(result, "https://cdn.example/assets/a.png")

	def test_upgrades_http_institutional_host_to_https(self):
		frappe = SimpleNamespace(conf={"public_reply_domain": "homolog-crm.univesp.br"})
		with patch("univesp_atendimento.file_urls.frappe", frappe):
			result = normalize_institutional_block_url(
				"http://homolog-crm.univesp.br/files/diagram.png",
			)
		self.assertEqual(result, "https://homolog-crm.univesp.br/files/diagram.png")

	def test_normalizes_payload_block_urls(self):
		frappe = SimpleNamespace(conf={"public_reply_domain": "homolog-crm.univesp.br"})
		payload = {
			"nodes": [
				{
					"content": {
						"student": {
							"blocks": [
								{
									"block_id": "a",
									"type": "image",
									"url": "http://homolog-crm.univesp.br/files/diagram.png",
								}
							]
						}
					}
				}
			]
		}
		with patch("univesp_atendimento.file_urls.frappe", frappe):
			normalize_payload_media_urls(payload)
		self.assertEqual(
			payload["nodes"][0]["content"]["student"]["blocks"][0]["url"],
			"https://homolog-crm.univesp.br/files/diagram.png",
		)
