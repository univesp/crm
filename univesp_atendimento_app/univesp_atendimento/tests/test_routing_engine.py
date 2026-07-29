from unittest import TestCase

from univesp_atendimento.routing_engine import RoutingResolutionError, resolve_route


def _payload():
	return {
		"theme_key": "acesso-ava",
		"metadata": {
			"default_criticidade": "media",
			"operational_owner": {
				"owner_type": "queue",
				"owner_key": "atendimento-geral",
			},
		},
		"routing_policy": {
			"pattern_key": "op_bpo_area",
			"institutional_exceptions": ["provas", "critica"],
		},
		"nodes": [
			{
				"node_id": "final",
				"operational": {
					"routing_override": None,
					"routing_key": None,
					"criticidade": None,
				},
			}
		],
	}


def _pattern():
	return {
		"pattern_key": "op_bpo_area",
		"steps": ["op", "bpo", "area"],
		"allowed_routing_keys": [
			"atendimento-geral",
			"sra",
			"bpo-leste",
			"op-guarulhos",
		],
		"institutional_exceptions": ["provas", "critica"],
	}


class TestRoutingEngine(TestCase):
	def test_institutional_exception_has_precedence(self):
		decision = resolve_route(
			pattern=_pattern(),
			bundle_payload=_payload(),
			node_id="final",
			context={"theme_key": "provas", "polo_key": "guarulhos"},
			queue_exists=lambda key: key in {"sra", "op-guarulhos", "atendimento-geral"},
		)
		self.assertEqual(decision.resolved_queue, "sra")
		self.assertEqual(decision.applied_rules, ("institutional_exception",))

	def test_node_policy_has_precedence_over_polo(self):
		payload = _payload()
		payload["nodes"][0]["operational"]["routing_override"] = "atendimento-geral"
		decision = resolve_route(
			pattern=_pattern(),
			bundle_payload=payload,
			node_id="final",
			context={"polo_key": "guarulhos"},
			queue_exists=lambda _key: True,
		)
		self.assertEqual(decision.resolved_queue, "atendimento-geral")
		self.assertEqual(decision.applied_rules, ("node_or_bundle_policy",))

	def test_first_operational_step_precedes_later_steps(self):
		decision = resolve_route(
			pattern=_pattern(),
			bundle_payload=_payload(),
			node_id="final",
			context={"polo_key": "guarulhos", "region_key": "leste"},
			queue_exists=lambda key: key in {"bpo-leste", "op-guarulhos", "atendimento-geral"},
		)
		self.assertEqual(decision.resolved_queue, "op-guarulhos")
		self.assertEqual(decision.applied_rules, ("polo_or_region",))

	def test_owner_then_fallback(self):
		decision = resolve_route(
			pattern=_pattern(),
			bundle_payload=_payload(),
			node_id="final",
			context={},
			queue_exists=lambda key: key == "atendimento-geral",
		)
		self.assertEqual(decision.resolved_queue, "atendimento-geral")
		self.assertEqual(decision.applied_rules, ("operational_owner",))
		self.assertNotIn("routing_key", decision.as_dict(public=True))
		self.assertNotIn("resolved_queue", decision.as_dict(public=True))

	def test_fails_closed_when_no_valid_queue_exists(self):
		with self.assertRaises(RoutingResolutionError):
			resolve_route(
				pattern=_pattern(),
				bundle_payload=_payload(),
				node_id="final",
				context={},
				queue_exists=lambda _key: False,
			)
