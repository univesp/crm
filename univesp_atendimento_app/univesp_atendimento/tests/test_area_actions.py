from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import frappe

from univesp_atendimento.api.v1.common import RequestContext
from univesp_atendimento.api.v1.tickets import (
	_move_to_status,
	_ticket_assignment_or_filters,
	_validate_area_destination,
)


class TestAreaActions(TestCase):
	def _context(self, profile_key="analista_area", areas=None, actions=None):
		return RequestContext(
			email="area.tests@univesp.br",
			name="Area Tests",
			ra="",
			profile_key=profile_key,
			scopes={"areas": areas or ["Suporte Academico Digital"]},
			actions=frozenset(actions or {"transition_ticket"}),
			request_id="request-area-tests",
			actor_email="area.tests@univesp.br",
		)

	def test_operator_list_is_scoped_to_unassigned_or_owned_tickets(self):
		context = self._context(profile_key="op", areas=[])
		filters = _ticket_assignment_or_filters(context)
		self.assertEqual(len(filters), 3)
		self.assertEqual(filters[0][-1], context.email)

	def test_non_operator_list_has_no_assignment_or_filter(self):
		self.assertEqual(_ticket_assignment_or_filters(self._context()), [])

	@patch("univesp_atendimento.api.v1.tickets._known_area", return_value=True)
	def test_analyst_cannot_route_outside_scope(self, _known_area_mock):
		with self.assertRaises(frappe.PermissionError):
			_validate_area_destination(self._context(), "Financeiro")

	@patch("univesp_atendimento.api.v1.tickets._known_area", return_value=True)
	def test_manager_override_requires_server_capability(self, _known_area_mock):
		context = self._context(
			profile_key="gestor_area",
			actions={"transition_ticket", "manager_override_route"},
		)
		_validate_area_destination(context, "Financeiro", allow_manager_override=True)

	@patch("univesp_atendimento.api.v1.tickets._known_area", return_value=False)
	def test_unknown_area_is_rejected_even_for_admin(self, _known_area_mock):
		with self.assertRaises(frappe.ValidationError):
			_validate_area_destination(self._context(profile_key="admin_central", areas=[]), "Area inventada")

	@patch("univesp_atendimento.api.v1.tickets._status_name", side_effect=lambda status: status)
	def test_area_complement_moves_ticket_to_waiting_student(self, _status_name_mock):
		doc = SimpleNamespace(custom_univesp_status_code="waiting_internal", status="Em atendimento interno")
		_move_to_status(doc, "waiting_student")
		self.assertEqual(doc.custom_univesp_status_code, "waiting_student")
		self.assertEqual(doc.status, "waiting_student")

	@patch("univesp_atendimento.api.v1.tickets._status_name", side_effect=lambda status: status)
	def test_closed_ticket_cannot_be_reopened_by_area_action(self, _status_name_mock):
		doc = SimpleNamespace(custom_univesp_status_code="closed", status="Encerrado")
		with self.assertRaises(frappe.ValidationError):
			_move_to_status(doc, "in_analysis")
