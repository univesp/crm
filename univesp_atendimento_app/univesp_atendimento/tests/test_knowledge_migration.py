from unittest import TestCase

from univesp_atendimento.knowledge_migration import (
	extract_v2_packages,
	plan_v2_migration,
)


def bundle(bundle_id, faq_type, *, node_prefix=None):
	node_prefix = node_prefix or bundle_id
	return {
		"legacy_bundle_id": bundle_id,
		"title": "Acesso ao AVA",
		"package": {
			"schema_version": "2.0.0",
			"faq_id": bundle_id,
			"tipo_faq": faq_type,
			"metadata": {"title": "Acesso ao AVA", "defaultOwnerId": "atendimento-geral"},
			"nodes": [
				{
					"id": f"{node_prefix}-root",
					"node_kind": "path",
					"titulo_exibido": "Acesso ao AVA",
				},
				{
					"id": f"{node_prefix}-final",
					"node_kind": "final",
					"titulo_exibido": "Recuperar acesso",
					"resposta": "Use a recuperação de senha.",
					"fila_destino": "atendimento-geral",
				},
			],
			"links": [
				{
					"link_id": f"{node_prefix}-edge",
					"parent_node_id": f"{node_prefix}-root",
					"child_node_id": f"{node_prefix}-final",
					"ordem": 1,
					"ativo": True,
				}
			],
		},
	}


class KnowledgeMigrationTest(TestCase):
	def test_extracts_workspace_packages(self):
		library = {
			"bundles": [
				{
					"bundleId": "acesso-aluno",
					"title": "Acesso",
					"workspace": {"draftBundle": bundle("source", "aluno")["package"]},
				}
			]
		}
		extracted = extract_v2_packages(library)
		self.assertEqual(extracted[0]["legacy_bundle_id"], "acesso-aluno")
		self.assertEqual(extracted[0]["package"]["tipo_faq"], "aluno")

	def test_unifies_student_public_and_op_with_explicit_node_map(self):
		sources = [
			bundle("acesso-aluno", "aluno", node_prefix="student"),
			bundle("acesso-publico", "publico", node_prefix="public"),
			bundle("acesso-op", "op", node_prefix="operator"),
		]
		mappings = [
			{
				"legacy_bundle_id": "acesso-aluno",
				"bundle_key": "acesso-ava",
				"theme_key": "acesso-ava",
			},
			{
				"legacy_bundle_id": "acesso-publico",
				"bundle_key": "acesso-ava",
				"theme_key": "acesso-ava",
				"node_map": {
					"public-root": "student-root",
					"public-final": "student-final",
				},
			},
			{
				"legacy_bundle_id": "acesso-op",
				"bundle_key": "acesso-ava",
				"theme_key": "acesso-ava",
				"node_map": {
					"operator-root": "student-root",
					"operator-final": "student-final",
				},
			},
		]
		plan = plan_v2_migration(sources, mappings)[0]
		self.assertFalse(plan["blocking"])
		self.assertEqual(plan["payload"]["metadata"]["audience_profile"], "mixed")
		self.assertEqual(len(plan["payload"]["nodes"]), 2)
		final = next(node for node in plan["payload"]["nodes"] if node["node_kind"] == "final")
		self.assertIsNotNone(final["content"]["student"])
		self.assertIsNotNone(final["content"]["public"])
		self.assertIsNotNone(final["playbooks"]["op"])
		self.assertIsNone(final["playbooks"]["bpo"])

	def test_unmatched_op_node_is_a_blocking_conflict(self):
		sources = [
			bundle("acesso-aluno", "aluno", node_prefix="student"),
			bundle("outro-op", "op", node_prefix="operator"),
		]
		mappings = [
			{
				"legacy_bundle_id": "acesso-aluno",
				"bundle_key": "acesso-ava",
				"theme_key": "acesso-ava",
			},
			{
				"legacy_bundle_id": "outro-op",
				"bundle_key": "acesso-ava",
				"theme_key": "acesso-ava",
				"match_by_title": False,
			},
		]
		plan = plan_v2_migration(sources, mappings)[0]
		self.assertTrue(plan["blocking"])
		self.assertTrue(
			any(item["code"] == "UNMATCHED_OPERATIONAL_NODE" for item in plan["report"]["conflicts"])
		)

	def test_checksum_is_idempotent(self):
		source = bundle("acesso-aluno", "aluno")
		first = plan_v2_migration([source])[0]
		second = plan_v2_migration([source])[0]
		self.assertEqual(
			first["migration_idempotency_key"],
			second["migration_idempotency_key"],
		)
