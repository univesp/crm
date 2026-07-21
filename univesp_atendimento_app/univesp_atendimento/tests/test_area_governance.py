from unittest import TestCase
from unittest.mock import patch

import frappe

from univesp_atendimento.api.v1.common import RequestContext
from univesp_atendimento.api.v1.governance import (
	AreaGovernanceValidationError,
	_authorize_area,
	_validate_state,
)


class TestAreaGovernance(TestCase):
	def _context(self, profile_key="gestor_area", areas=None):
		return RequestContext(
			email="manager@univesp.br",
			name="Manager",
			ra="",
			profile_key=profile_key,
			scopes={"areas": areas or ["Suporte Academico Digital"]},
			actions=frozenset({"view_area_guidance", "manage_area_scope"}),
			request_id="governance-test",
		)

	def test_manager_cannot_write_outside_area_scope(self):
		with self.assertRaises(frappe.PermissionError):
			_authorize_area(self._context(), "Financeiro", write=True)

	@patch("univesp_atendimento.api.v1.governance._known_areas", return_value={"Suporte Academico Digital"})
	def test_admin_cannot_create_governance_for_unknown_area(self, _areas):
		with self.assertRaises(AreaGovernanceValidationError):
			_authorize_area(self._context(profile_key="admin_central"), "Area Inventada", write=True)

	@patch(
		"univesp_atendimento.api.v1.governance._known_area_member_names",
		return_value={"Analista Um", "Gestora Area"},
	)
	def test_accepts_scoped_rule_and_availability(self, _members):
		_validate_state(
			"Suporte Academico Digital",
			[
				{
					"id": "scope-1",
					"areaLabel": "Suporte Academico Digital",
					"accessMode": "restricted",
					"allowedAnalysts": ["Analista Um"],
				}
			],
			[
				{
					"id": "availability-1",
					"userName": "Analista Um",
					"areaLabel": "Suporte Academico Digital",
					"statusCode": "unavailable",
					"startsAt": "2026-07-20 10:00:00",
					"endsAt": "2026-07-21 10:00:00",
				}
			],
		)

	@patch(
		"univesp_atendimento.api.v1.governance._known_area_member_names",
		return_value={"Analista Um"},
	)
	def test_rejects_unknown_analyst(self, _members):
		with self.assertRaises(AreaGovernanceValidationError):
			_validate_state(
				"Suporte Academico Digital",
				[
					{
						"id": "scope-1",
						"areaLabel": "Suporte Academico Digital",
						"accessMode": "restricted",
						"allowedAnalysts": ["Pessoa Externa"],
					}
				],
				[],
			)
