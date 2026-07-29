import os
import sys
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from univesp_atendimento.cloud_service_auth import (
	allowed_service_endpoint,
	configured_value,
	service_headers,
)
from univesp_atendimento.gcs_config import inspect_gcs_site_config


class TestCloudServiceAuth(TestCase):
	def test_accepts_https_and_loopback_http_only(self):
		self.assertTrue(allowed_service_endpoint("https://scanner.example/scan"))
		self.assertTrue(allowed_service_endpoint("http://127.0.0.1:18081/scan"))
		self.assertTrue(allowed_service_endpoint("http://localhost:18082/convert-gif"))
		self.assertFalse(allowed_service_endpoint("http://10.0.0.8:8080/scan"))
		self.assertFalse(allowed_service_endpoint("http://example.com/scan"))
		self.assertFalse(allowed_service_endpoint("http://localhost:invalid/scan"))
		self.assertFalse(allowed_service_endpoint("file:///tmp/scan"))

	def test_config_prefers_site_config_and_falls_back_to_environment(self):
		frappe = SimpleNamespace(conf={"endpoint": "https://site.example/scan"})
		with patch.dict(os.environ, {"SERVICE_ENDPOINT": "https://env.example/scan"}):
			self.assertEqual(
				configured_value(frappe, "endpoint", "SERVICE_ENDPOINT"),
				"https://site.example/scan",
			)
			frappe.conf = {}
			self.assertEqual(
				configured_value(frappe, "endpoint", "SERVICE_ENDPOINT"),
				"https://env.example/scan",
			)

	def test_iam_header_uses_service_origin_as_audience(self):
		response = SimpleNamespace(text="signed-id-token", raise_for_status=lambda: None)
		request_args = {}

		def fake_get(url, **kwargs):
			request_args["url"] = url
			request_args.update(kwargs)
			return response

		requests = SimpleNamespace(get=fake_get)
		with (
			patch.dict(os.environ, {"FAQ_CLOUD_RUN_IAM_AUTH": "true"}),
			patch.dict(sys.modules, {"requests": requests}),
		):
			headers = service_headers(
				"https://scanner-abc.run.app/scan",
				"X-Antimalware-Token",
				"shared-secret",
			)
		self.assertEqual(headers["Authorization"], "Bearer signed-id-token")
		self.assertEqual(headers["X-Antimalware-Token"], "shared-secret")
		self.assertEqual(request_args["params"]["audience"], "https://scanner-abc.run.app")
		self.assertEqual(request_args["headers"]["Metadata-Flavor"], "Google")
		self.assertEqual(request_args["timeout"], 3)

	def test_mounted_gcs_is_accepted_without_s3_compat_credentials(self):
		frappe = SimpleNamespace(local=SimpleNamespace(conf={}), conf={})
		with (
			patch.dict(sys.modules, {"frappe": frappe}),
			patch.dict(
				os.environ,
				{"GCS_MOUNTED_STORAGE": "true", "GCS_BUCKET": "private-sites-bucket"},
			),
		):
			result = inspect_gcs_site_config()
		self.assertTrue(result["ok"])
		self.assertEqual(result["mode"], "mounted_gcs")
