import base64
import hashlib
import hmac
import json
import time
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from univesp_atendimento.api.v1.common import get_request_context


class TestRequestContext(IntegrationTestCase):
	def setUp(self):
		frappe.conf.univesp_bff_shared_secret = "test-secret"
		if not frappe.db.exists("Univesp Access Profile", "student@example.edu"):
			frappe.get_doc(
				{
					"doctype": "Univesp Access Profile",
					"user_email": "student@example.edu",
					"display_name": "Student Test",
					"profile_key": "aluno",
					"active": 1,
					"scopes_json": "{}",
					"actions_json": '["create_ticket", "view_ticket"]',
				}
			).insert(ignore_permissions=True)

	def test_rejects_unsigned_context(self):
		with patch("frappe.get_request_header", return_value=None):
			with self.assertRaises(frappe.AuthenticationError):
				get_request_context()

	def test_loads_profile_from_server_mapping(self):
		headers = self._signed_headers({"email": "student@example.edu", "name": "Student Test"})
		with patch("frappe.get_request_header", side_effect=lambda key: headers.get(key)):
			context = get_request_context("create_ticket")
		self.assertEqual(context.profile_key, "aluno")
		self.assertEqual(context.email, "student@example.edu")

	def _signed_headers(self, payload):
		encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
		timestamp = str(int(time.time()))
		signature = hmac.new(
			b"test-secret",
			f"{timestamp}.{encoded}".encode(),
			hashlib.sha256,
		).hexdigest()
		return {
			"X-Univesp-User-Context": encoded,
			"X-Univesp-Timestamp": timestamp,
			"X-Univesp-Signature": signature,
			"X-Request-ID": "test-request",
		}
