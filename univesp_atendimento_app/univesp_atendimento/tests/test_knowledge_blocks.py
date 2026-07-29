from unittest import TestCase

from univesp_atendimento.knowledge_blocks import validate_blocks


class TestKnowledgeBlocks(TestCase):
	def test_rejects_unsafe_or_inaccessible_blocks(self):
		errors = validate_blocks(
			[
				{"block_id": "a", "type": "image", "url": "http://x/image.png"},
				{"block_id": "b", "type": "video", "url": "https://x/video.mp4"},
				{"block_id": "c", "type": "text", "body": "<script>alert(1)</script>"},
			]
		)
		self.assertGreaterEqual(len(errors), 4)

	def test_accepts_accessible_blocks(self):
		self.assertEqual(
			validate_blocks(
				[
					{"block_id": "a", "type": "image", "url": "https://x/i.png", "alt": "Diagrama"},
					{
						"block_id": "b",
						"type": "video",
						"url": "https://x/v.mp4",
						"captions_url": "https://x/v.vtt",
						"transcript": "Descrição do vídeo.",
					},
				]
			),
			[],
		)
