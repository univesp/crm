from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from univesp_atendimento.access_control import actions_for_profile, normalize_scopes
from univesp_atendimento.api.v1 import admin, session
from univesp_atendimento.api.v1.common import RequestContext


class TestAdminAccess(IntegrationTestCase):
	def setUp(self):
		self.context = RequestContext(
			email="admin.access.tests@univesp.br",
			name="Admin Tests",
			ra="",
			profile_key="admin_central",
			scopes={},
			actions=frozenset(actions_for_profile("admin_central")),
			request_id="request-admin-tests",
		)
		if not frappe.db.exists("Univesp Access Profile", self.context.email):
			frappe.get_doc(
				{
					"doctype": "Univesp Access Profile",
					"user_email": self.context.email,
					"display_name": self.context.name,
					"profile_key": "admin_central",
					"active": 1,
					"scopes_json": "{}",
					"actions_json": "[]",
				}
			).insert(ignore_permissions=True)

	def test_profile_actions_are_server_controlled(self):
		doc = frappe.get_doc("Univesp Access Profile", self.context.email)
		doc.actions_json = '["create_ticket"]'
		doc.save(ignore_permissions=True)
		self.assertIn("manage_users", frappe.parse_json(doc.actions_json))

	def test_operational_profile_requires_scope(self):
		with self.assertRaises(frappe.ValidationError):
			normalize_scopes("op", {})

	@patch("univesp_atendimento.api.v1.admin.get_request_context")
	def test_create_user_writes_audit_without_secrets(self, context_mock):
		context_mock.return_value = self.context
		result = admin.create_user(
			{
				"email": "operator.access.tests@univesp.br",
				"display_name": "Operator Tests",
				"profile_key": "op",
				"scopes": {"queues": ["Atendimento Geral"]},
				"reason": "Cadastro para teste automatizado",
			}
		)
		self.assertEqual(result["data"]["profile_key"], "op")
		audit = frappe.get_last_doc(
			"Univesp Access Audit", {"target_email": "operator.access.tests@univesp.br"}
		)
		self.assertEqual(audit.operation, "user_created")
		self.assertNotIn("secret", (audit.before_json or "") + (audit.after_json or ""))

	@patch("univesp_atendimento.api.v1.admin.get_request_context")
	def test_update_rejects_stale_version(self, context_mock):
		context_mock.return_value = self.context
		with self.assertRaises(admin.UnivespConflictError):
			admin.update_user(
				self.context.email,
				{
					"version": "stale",
					"profile_key": "admin_central",
					"scopes": {},
					"reason": "Tentativa com versao antiga",
				},
			)

	@patch("univesp_atendimento.api.v1.admin.get_request_context")
	def test_admin_cannot_disable_itself(self, context_mock):
		context_mock.return_value = self.context
		doc = frappe.get_doc("Univesp Access Profile", self.context.email)
		with self.assertRaises(admin.UnivespValidationError):
			admin.update_user(
				self.context.email,
				{
					"version": str(doc.modified),
					"active": 0,
					"reason": "Tentativa de auto bloqueio",
				},
			)

	@patch("univesp_atendimento.api.v1.session.verify_signed_identity")
	@patch("univesp_atendimento.api.v1.session.frappe.get_request_header", return_value="request-pending")
	def test_missing_profile_creates_one_idempotent_request(self, _header_mock, identity_mock):
		identity_mock.return_value = {
			"email": "pending.access.tests@univesp.br",
			"name": "Pending Tests",
			"ra": "",
			"flow": "admin",
		}
		first = session.get_context()
		second = session.get_context()
		self.assertEqual(first["data"]["access"]["status"], "pending")
		self.assertEqual(second["data"]["access"]["status"], "pending")
		self.assertEqual(
			frappe.db.count(
				"Univesp Access Request", {"user_email": "pending.access.tests@univesp.br"}
			),
			1,
		)
		request_doc = frappe.get_doc("Univesp Access Request", "pending.access.tests@univesp.br")
		self.assertEqual(request_doc.attempt_count, 2)
