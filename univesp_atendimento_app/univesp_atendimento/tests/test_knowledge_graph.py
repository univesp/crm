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

	def test_unified_tree_shared_root_with_inherited_public_content(self):
		value = {
			"schema_version": "3.0.0",
			"bundle_key": "acesso-ava",
			"theme_key": "acesso-ava",
			"metadata": {"title": "Acesso ao AVA", "audience_profile": "mixed"},
			"graph": {
				"student_root_node_id": "root",
				"public_root_node_id": "root",
				"internal_root_node_id": None,
			},
			"nodes": [
				{
					"node_id": "root",
					"stable_key": "root",
					"node_kind": "path",
					"audiences": ["student", "public"],
					"presentation": {"public_content_mode": "inherit_student"},
					"display": {"title": "Início"},
					"content": {
						"student": {"blocks": [{"block_id": "b1", "type": "text", "body": "Orientação aluno"}]},
						"public": None,
					},
					"playbooks": {"op": None, "bpo": None, "analyst": None},
				},
				{
					"node_id": "final",
					"stable_key": "final",
					"node_kind": "final",
					"audiences": ["student", "public"],
					"presentation": {"public_content_mode": "custom"},
					"display": {"title": "Resposta"},
					"content": {
						"student": {
							"blocks": [{"block_id": "b2", "type": "text", "body": "Aluno final"}],
							"outcome_key": "resolved",
						},
						"public": {
							"blocks": [{"block_id": "b3", "type": "text", "body": "Público final"}],
							"outcome_key": "resolved",
						},
					},
					"playbooks": {
						"op": {"objective": "Ajudar", "systems": ["portal"]},
						"bpo": None,
						"analyst": {"objective": "Analisar"},
					},
				},
			],
			"edges": [
				{
					"edge_id": "root-final",
					"parent_node_id": "root",
					"child_node_id": "final",
					"order": 1,
					"active": True,
					"audiences": ["student", "public"],
				}
			],
		}
		assert_valid_knowledge_graph(value)
		student = project_runtime(value, "student")
		public = project_runtime(value, "public")
		self.assertEqual(student["root_node_id"], public["root_node_id"])
		self.assertEqual(len(student["nodes"]), len(public["nodes"]))
		public_root = next(node for node in public["nodes"] if node["node_id"] == "root")
		self.assertEqual(public_root["content"]["blocks"][0]["body"], "Orientação aluno")
		public_final = next(node for node in public["nodes"] if node["node_id"] == "final")
		self.assertEqual(public_final["content"]["blocks"][0]["body"], "Público final")
		op = project_runtime(value, "op")
		bpo = project_runtime(value, "bpo")
		op_final = next(node for node in op["nodes"] if node["node_id"] == "final")
		bpo_final = next(node for node in bpo["nodes"] if node["node_id"] == "final")
		self.assertEqual(op_final["playbook"]["objective"], "Ajudar")
		self.assertEqual(bpo_final["playbook"]["objective"], "Ajudar")

	def test_public_disabled_profile_has_no_public_root(self):
		value = payload()
		value["metadata"]["audience_profile"] = "student"
		value["graph"]["public_root_node_id"] = None
		value["nodes"] = [node for node in value["nodes"] if "public" not in node["audiences"]]
		assert_valid_knowledge_graph(value)
		errors = validate_knowledge_graph(
			{
				**value,
				"metadata": {"title": "x", "audience_profile": "public"},
				"graph": {**value["graph"], "public_root_node_id": None},
			}
		)
		self.assertTrue(any(error.code == "ROOT_REQUIRED" for error in errors))
