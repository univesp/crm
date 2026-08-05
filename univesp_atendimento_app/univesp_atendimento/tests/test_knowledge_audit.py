from unittest import TestCase

from univesp_atendimento.knowledge_audit import audit_payload_area_keys


def _payload(nodes, owner=None):
	return {
		"metadata": {"operational_owner": owner} if owner else {},
		"nodes": nodes,
	}


def _final(node_id, area=None):
	operational = {"area_key": area} if area is not None else {}
	return {"node_id": node_id, "node_kind": "final", "operational": operational}


class TestKnowledgeAudit(TestCase):
	def test_explicit_area_key_has_no_finding(self):
		self.assertEqual(audit_payload_area_keys(_payload([_final("final", "sra")])), [])

	def test_legacy_area_owner_is_reported_as_warning(self):
		findings = audit_payload_area_keys(
			_payload([_final("final")], {"owner_type": "area", "owner_key": "sra"}),
			bundle_key="acesso-ava",
		)
		self.assertEqual(findings[0]["severity"], "warning")
		self.assertEqual(findings[0]["effective_area"], "sra")

	def test_missing_area_without_fallback_is_blocking(self):
		findings = audit_payload_area_keys(_payload([_final("final")]))
		self.assertEqual(findings[0]["code"], "missing_effective_area")
		self.assertEqual(findings[0]["severity"], "blocking")

	def test_non_final_nodes_are_not_audited(self):
		node = {"node_id": "path", "node_kind": "path", "operational": {}}
		self.assertEqual(audit_payload_area_keys(_payload([node])), [])
