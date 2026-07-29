from unittest import TestCase

from univesp_atendimento.api.v1.public import (
	PublicVisitorValidationError,
	_resolve_public_knowledge_reference,
	_resolve_public_queue,
)


def _published_entries():
	return [
		{
			"bundle_id": "bundle:publico:acesso",
			"package": {
				"versioning": {"bundle_version_id": "v2.0"},
				"nodes": [
					{
						"id": "acesso-final",
						"node_kind": "leaf",
						"document_policy": {"mode": "disabled"},
						"intake_policy": {},
					}
				],
			},
		}
	]


class TestPublicTicketKnowledgeReference(TestCase):
	def test_ignores_queue_selected_by_public_client(self):
		self.assertEqual(
			_resolve_public_queue({"queue": "equipe-interna-restrita"}),
			"atendimento-geral",
		)

	def test_resolves_published_bundle_version_and_node(self):
		result = _resolve_public_knowledge_reference(
			{
				"bundle_id": "bundle:publico:acesso",
				"bundle_version_id": "v2.0",
				"node_id": "acesso-final",
				"document_policy": {"mode": "disabled"},
				"intake_policy": {},
			},
			_published_entries(),
		)
		self.assertEqual(
			result,
			{
				"bundle_id": "bundle:publico:acesso",
				"bundle_version_id": "v2.0",
				"node_id": "acesso-final",
				"document_policy": {"mode": "disabled"},
				"intake_policy": {},
			},
		)

	def test_fills_version_for_compatible_older_client(self):
		result = _resolve_public_knowledge_reference(
			{"bundle_id": "bundle:publico:acesso", "node_id": "acesso-final"},
			_published_entries(),
		)
		self.assertEqual(result["bundle_version_id"], "v2.0")

	def test_rejects_unknown_or_stale_reference(self):
		with self.assertRaises(PublicVisitorValidationError):
			_resolve_public_knowledge_reference(
				{
					"bundle_id": "bundle:publico:acesso",
					"bundle_version_id": "v1.0",
					"node_id": "acesso-final",
				},
				_published_entries(),
			)
		with self.assertRaises(PublicVisitorValidationError):
			_resolve_public_knowledge_reference(
				{"bundle_id": "bundle:publico:acesso", "node_id": "outro-no"},
				_published_entries(),
			)
