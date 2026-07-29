import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CLOUDRUN = ROOT / "ops" / "cloudrun"


class HomologReadinessToolingTest(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.preflight = (CLOUDRUN / "preflight-homolog.sh").read_text(encoding="utf-8")
		cls.smoke = (CLOUDRUN / "smoke-homolog.sh").read_text(encoding="utf-8")
		cls.manifest = (CLOUDRUN / "release-manifest.sh").read_text(encoding="utf-8")
		cls.collect = (CLOUDRUN / "collect-homolog-evidence.sh").read_text(encoding="utf-8")
		cls.rollback = (CLOUDRUN / "rollback.sh").read_text(encoding="utf-8")
		cls.workflow = (ROOT / ".github" / "workflows" / "univesp-cloudrun-homolog.yml").read_text(
			encoding="utf-8"
		)

	def test_preflight_is_read_only_and_checks_dependencies(self):
		for required in (
			"artifacts repositories describe",
			"sql instances describe",
			"storage buckets describe",
			"vpc-access connectors describe",
			"service-accounts describe",
			"secrets versions describe latest",
		):
			self.assertIn(required, self.preflight)
		for mutation in (" services create ", " services update ", " deploy ", " secrets delete ", " rm "):
			self.assertNotIn(mutation, self.preflight)

	def test_preflight_can_defer_visibility_to_actual_deploy_only_when_explicit(self):
		self.assertIn(
			"PREFLIGHT_ALLOW_UNVERIFIED_EXISTING_RESOURCES=${PREFLIGHT_ALLOW_UNVERIFIED_EXISTING_RESOURCES:-false}",
			self.preflight,
		)
		self.assertIn("configured-unverified", self.preflight)
		self.assertIn("PREFLIGHT_ALLOW_UNVERIFIED_EXISTING_RESOURCES", self.workflow)

	def test_manifest_captures_all_runtime_images_without_secret_values(self):
		for name in (
			"WEB_SERVICE",
			"WORKER_SERVICE",
			"SCHEDULER_SERVICE",
			"GATEWAY_SERVICE",
			"BOOTSTRAP_JOB",
		):
			self.assertIn(name, self.manifest)
		self.assertIn("latestReadyRevisionName", self.manifest)
		self.assertNotIn("secrets versions access", self.manifest)

	def test_smoke_is_read_only_and_covers_front_door(self):
		for path in (
			"/api/me",
			"/api/app/v1/tickets",
			"/api/method/ping",
			"/api/resource/User",
			"/desk",
			"/files/private.txt",
			"/socket.io/",
			"/api/sso/azure/start",
			"/api/sso/saml/start",
		):
			self.assertIn(path, self.smoke)
		self.assertIn("--request GET", self.smoke)
		for mutation in ("--request POST", "--request PATCH", "--request DELETE"):
			self.assertNotIn(mutation, self.smoke)

	def test_evidence_collector_is_fail_closed_and_checksummed(self):
		for script in ("preflight-homolog.sh", "release-manifest.sh", "smoke-homolog.sh"):
			self.assertIn(script, self.collect)
		self.assertIn("CHECK_DEPLOYED_SERVICES=true", self.collect)
		self.assertIn("sha256sum", self.collect)

	def test_rollback_covers_gateway_with_two_immutable_images(self):
		self.assertIn("ROLLBACK_GATEWAY_IMAGE_URI", self.rollback)
		self.assertIn("pre-rollback-manifest.json", self.rollback)
		self.assertIn("post-rollback-manifest.json", self.rollback)
		self.assertIn("GATEWAY_SERVICE", self.rollback)
		self.assertIn("{7,64}", self.rollback)
		self.assertIn("{64}", self.rollback)

	def test_workflow_enforces_preflight_smoke_and_evidence_upload(self):
		self.assertLess(
			self.workflow.index("Run read-only GCP preflight"),
			self.workflow.index("Build and push Frappe image"),
		)
		self.assertGreater(
			self.workflow.index("Collect post-deploy homolog evidence"),
			self.workflow.index("Deploy Frappe services"),
		)
		self.assertIn("./ops/cloudrun/collect-homolog-evidence.sh", self.workflow)
		self.assertIn("actions/upload-artifact@v4", self.workflow)
		self.assertIn("if: always()", self.workflow)

	def test_workflow_can_reuse_existing_idp_and_gateway_secrets(self):
		self.assertIn("reuse_or_sync_secret", self.workflow)
		required_block = self.workflow.split("required_secrets=(", 1)[1].split(")", 1)[0]
		for value_name in (
			"GATEWAY_REDIS_VALUE",
			"AZURE_ADMIN_CLIENT_SECRET_VALUE",
			"AZURE_ACADEMICO_CLIENT_SECRET_VALUE",
			"SAML_IDP_CERT_VALUE",
		):
			self.assertNotIn(value_name, required_block)
			self.assertIn(value_name, self.workflow)


if __name__ == "__main__":
	unittest.main()
