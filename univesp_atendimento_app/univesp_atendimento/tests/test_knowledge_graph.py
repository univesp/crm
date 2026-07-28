from unittest import TestCase

from univesp_atendimento.knowledge_graph import (
	KnowledgeGraphError,
	assert_valid_knowledge_graph,
	project_runtime,
	validate_knowledge_graph,
	validate_ordered_path,
)


def payload():
	return {
		"schema_version": "3.0.0",
		"bundle_key": "acesso-ava",
		"theme_key": "acesso-ava",
		"metadata": {"title": "Acesso ao AVA", "audience_profile": "mixed"},
		"graph": {
			"student_root_node_id": "student-root",
			"public_root_node_id": "public-root",
			"internal_root_node_id": None,
		},
		"nodes": [
			{
				"node_id": "student-root",
				"stable_key": "student-root",
				"node_kind": "path",
				"audiences": ["student"],
				"display": {"title": "Aluno"},
				"content": {"student": {"blocks": []}, "public": None},
				"playbooks": {"op": None, "bpo": None, "analyst": None},
			},
			{
				"node_id": "student-final",
				"stable_key": "student-final",
				"node_kind": "final",
				"audiences": ["student"],
				"display": {"title": "Recuperar acesso"},
				"content": {"student": {"blocks": [], "outcome_key": "open_ticket"}, "public": None},
				"playbooks": {
					"op": {"checklist": ["base"], "systems": ["portal"]},
					"bpo": {"checklist": []},
					"analyst": None,
				},
			},
			{
				"node_id": "public-root",
				"stable_key": "public-root",
				"node_kind": "final",
				"audiences": ["public"],
				"display": {"title": "Público"},
				"content": {"student": None, "public": {"blocks": [], "outcome_key": "resolved"}},
				"playbooks": {"op": None, "bpo": None, "analyst": None},
			},
		],
		"edges": [
			{
				"edge_id": "student-edge",
				"parent_node_id": "student-root",
				"child_node_id": "student-final",
				"order": 1,
				"active": True,
				"audiences": ["student"],
			}
		],
	}


class TestKnowledgeGraph(TestCase):
	def test_accepts_two_independent_audience_trees(self):
		assert_valid_knowledge_graph(payload())

	def test_rejects_cycle_and_multiple_parent(self):
		value = payload()
		value["edges"].append(
			{
				"edge_id": "cycle",
				"parent_node_id": "student-final",
				"child_node_id": "student-root",
				"order": 1,
				"active": True,
				"audiences": ["student"],
			}
		)
		codes = {error.code for error in validate_knowledge_graph(value)}
		self.assertTrue({"ROOT_HAS_PARENT", "CYCLE"} & codes)

	def test_validates_ordered_path_from_root(self):
		self.assertEqual(
			validate_ordered_path(payload(), "student", ["student-root", "student-final"]),
			["student-root", "student-final"],
		)
		with self.assertRaises(KnowledgeGraphError):
			validate_ordered_path(payload(), "student", ["student-final"])

	def test_bpo_inherits_op_by_field_and_empty_array_overrides(self):
		runtime = project_runtime(payload(), "bpo")
		final = next(node for node in runtime["nodes"] if node["node_id"] == "student-final")
		self.assertEqual(final["playbook"]["checklist"], [])
		self.assertEqual(final["playbook"]["systems"], ["portal"])
