import os
from unittest import TestCase
from unittest.mock import MagicMock, patch

import frappe

from univesp_atendimento import provisioning


class TestInitialAccessAdminProvisioning(TestCase):
	@patch.dict(os.environ, {"INITIAL_ADMIN_EMAIL": "homolog.admin@univesp.br"}, clear=False)
	@patch.object(provisioning.frappe.db, "commit")
	@patch.object(provisioning.frappe, "get_doc")
	@patch.object(provisioning.frappe.db, "count", return_value=0)
	@patch.object(provisioning.frappe.db, "get_value", return_value=None)
	def test_creates_only_first_active_admin(self, _get_value, _count, get_doc, commit):
		document = MagicMock()
		get_doc.return_value = document

		result = provisioning.configure_initial_access_admin()

		payload = get_doc.call_args.args[0]
		self.assertEqual(payload["user_email"], "homolog.admin@univesp.br")
		self.assertEqual(payload["profile_key"], "admin_central")
		self.assertEqual(payload["scopes_json"], "{}")
		document.insert.assert_called_once_with(ignore_permissions=True)
		commit.assert_called_once_with()
		self.assertTrue(result["configured"])

	@patch.dict(os.environ, {"INITIAL_ADMIN_EMAIL": "second.admin@univesp.br"}, clear=False)
	@patch.object(provisioning.frappe, "get_doc")
	@patch.object(provisioning.frappe.db, "count", return_value=1)
	@patch.object(provisioning.frappe.db, "get_value", return_value=None)
	def test_does_not_create_second_admin(self, _get_value, _count, get_doc):
		result = provisioning.configure_initial_access_admin()

		get_doc.assert_not_called()
		self.assertFalse(result["configured"])
		self.assertEqual(result["reason"], "active-admin-exists")

	@patch.dict(os.environ, {"INITIAL_ADMIN_EMAIL": "admin@example.com"}, clear=False)
	def test_rejects_non_institutional_email(self):
		with self.assertRaises(frappe.ValidationError):
			provisioning.configure_initial_access_admin()

	@patch.dict(
		os.environ,
		{"INITIAL_ADMIN_EMAIL": "homolog.admin@univesp.br", "DEPLOYMENT_ENV": "homolog"},
		clear=False,
	)
	@patch.object(provisioning.frappe.db, "commit")
	@patch.object(provisioning.frappe, "get_doc")
	@patch.object(provisioning.frappe.db, "count", return_value=0)
	@patch.object(provisioning.frappe.db, "get_value", return_value="PROFILE-1")
	def test_homolog_reactivates_existing_inactive_admin(self, _get_value, _count, get_doc, commit):
		profile = MagicMock()
		get_doc.return_value = profile

		result = provisioning.configure_initial_access_admin()

		self.assertEqual(profile.profile_key, "admin_central")
		self.assertEqual(profile.active, 1)
		profile.save.assert_called_once_with(ignore_permissions=True)
		commit.assert_called_once_with()
		self.assertEqual(result["reason"], "homolog-reactivated")
