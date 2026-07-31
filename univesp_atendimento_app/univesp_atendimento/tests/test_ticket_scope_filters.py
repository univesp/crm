from unittest import TestCase

from univesp_atendimento.tests.bootstrap_frappe_stub import ensure_frappe_stub

ensure_frappe_stub()

from univesp_atendimento.api.v1.common import RequestContext, ticket_scope_filters  # noqa: E402
from univesp_atendimento.access_control import actions_for_profile  # noqa: E402


def _context(profile_key, scopes):
	return RequestContext(
		email="scope.tests@univesp.br",
		name="Scope Tests",
		ra="",
		profile_key=profile_key,
		scopes=scopes,
		actions=frozenset(actions_for_profile(profile_key)),
		request_id="scope-tests",
		actor_email="scope.tests@univesp.br",
	)


class TestTicketScopeFilters(TestCase):
	def test_op_single_dimension_is_unchanged(self):
		filters = ticket_scope_filters(_context("op", {"queues": ["Atendimento Geral"]}))
		self.assertEqual(
			filters,
			[["HD Ticket", "custom_univesp_queue", "in", ["Atendimento Geral"]]],
		)

	def test_analista_area_intersection_adds_multiple_filters(self):
		filters = ticket_scope_filters(_context("analista_area", {"areas": ["SRA"], "polos": ["guarulhos"]}))
		self.assertEqual(
			filters,
			[
				["HD Ticket", "custom_univesp_area", "in", ["SRA"]],
				["HD Ticket", "custom_student_polo", "in", ["guarulhos"]],
			],
		)

	def test_admin_central_without_area_scope_remains_global(self):
		self.assertEqual(ticket_scope_filters(_context("admin_central", {})), [])

	def test_admin_central_optional_area_scope_is_applied(self):
		filters = ticket_scope_filters(_context("admin_central", {"areas": ["SRA"]}))
		self.assertEqual(filters, [["HD Ticket", "custom_univesp_area", "in", ["SRA"]]])
