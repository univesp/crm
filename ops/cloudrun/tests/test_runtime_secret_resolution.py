import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CLOUDRUN = ROOT / "ops" / "cloudrun"


class RuntimeSecretResolutionTest(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.resolver = (CLOUDRUN / "resolve-runtime-secret-names.sh").read_text(encoding="utf-8")
		cls.preflight = (CLOUDRUN / "preflight-homolog.sh").read_text(encoding="utf-8")
		cls.smoke = (CLOUDRUN / "smoke-homolog.sh").read_text(encoding="utf-8")

	def test_reuses_only_enabled_secret_references_without_reading_values(self):
		for env_name in (
			"GATEWAY_REDIS_URL",
			"AZURE_ADMIN_CLIENT_SECRET",
			"AZURE_ACADEMICO_CLIENT_SECRET",
			"SAML_IDP_CERT",
		):
			self.assertIn(env_name, self.resolver)
		self.assertIn("secrets versions describe latest", self.resolver)
		self.assertNotIn("secrets versions access", self.resolver)
		self.assertIn("GITHUB_ENV", self.resolver)

	def test_preflight_fallback_remains_fail_closed(self):
		self.assertIn("attached-current-service", self.preflight)
		self.assertIn("service_references", self.preflight)
		self.assertIn("not-found-or-not-attached", self.preflight)

	def test_smoke_covers_both_azure_tenants(self):
		self.assertIn("/api/sso/azure/start?tenant=admin", self.smoke)
		self.assertIn("/api/sso/azure/start?tenant=academico", self.smoke)


if __name__ == "__main__":
	unittest.main()
