import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONFIG = ROOT / "ops" / "cloudrun" / "nginx" / "frappe.conf.template"
DEPLOY = ROOT / "ops" / "cloudrun" / "deploy.sh"
DEPLOY_GATEWAY = ROOT / "ops" / "cloudrun" / "deploy-sso-gateway.sh"
DEPLOY_FAQ_SERVICES = ROOT / "ops" / "cloudrun" / "deploy-faq-services.sh"
COMMON = ROOT / "ops" / "cloudrun" / "scripts" / "common.sh"
CONTAINERFILE = ROOT / "ops" / "cloudrun" / "Containerfile"
ROLLBACK = ROOT / "ops" / "cloudrun" / "rollback.sh"
WORKFLOW = ROOT / ".github" / "workflows" / "univesp-cloudrun-homolog.yml"
SYNC_SECRET = ROOT / "ops" / "cloudrun" / "sync_secret.sh"


class CloudRunFrontDoorTest(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.config = CONFIG.read_text(encoding="utf-8")
		cls.deploy = DEPLOY.read_text(encoding="utf-8")
		cls.deploy_gateway = DEPLOY_GATEWAY.read_text(encoding="utf-8")
		cls.deploy_faq_services = DEPLOY_FAQ_SERVICES.read_text(encoding="utf-8")
		cls.common = COMMON.read_text(encoding="utf-8")
		cls.containerfile = CONTAINERFILE.read_text(encoding="utf-8")
		cls.rollback = ROLLBACK.read_text(encoding="utf-8")
		cls.workflow = WORKFLOW.read_text(encoding="utf-8")
		cls.sync_secret = SYNC_SECRET.read_text(encoding="utf-8")

	def test_academic_api_precedes_generic_api_block(self):
		academic = self.config.index("location ^~ /api/app/v1/")
		generic = self.config.index("location ^~ /api/ { return 404; }")
		self.assertLess(academic, generic)
		self.assertIn("location = /api/app/v1", self.config)

	def test_legacy_browser_surfaces_are_not_proxied(self):
		for path in (
			"/api/method/",
			"/api/resource/",
			"/app/",
			"/desk/",
			"/assets/",
			"/files/",
			"/socket.io/",
		):
			pattern = rf"location\s+(?:\^~\s+|=\s+)?{re.escape(path)}[^{{]*\{{\s*return\s+(?:302|404)"
			self.assertRegex(self.config, pattern, path)

	def test_sso_callbacks_reach_gateway(self):
		self.assertNotIn("location = /api/sso/azure/callback", self.config)
		block = self.config.split("location ^~ /api/sso/", 1)[1].split("\n\t}", 1)[0]
		self.assertIn("proxy_pass ${SSO_GATEWAY_ORIGIN};", block)

	def test_academic_api_targets_sso_gateway(self):
		block = self.config.split("location ^~ /api/app/v1/", 1)[1].split("\n\t}", 1)[0]
		self.assertIn("proxy_pass ${SSO_GATEWAY_ORIGIN};", block)

	def test_only_gateway_can_reach_institutional_frappe_methods(self):
		institutional = self.config.index("location ^~ /api/method/univesp_atendimento.api.v1.")
		generic = self.config.index("location ^~ /api/method/ { return 404; }")
		self.assertLess(institutional, generic)
		block = self.config[institutional:generic]
		self.assertIn("$http_x_univesp_gateway_key", block)
		self.assertIn("${UNIVESP_EDGE_SHARED_SECRET}", block)

	def test_cloudrun_image_contains_academic_apps(self):
		self.assertIn("test -d apps/helpdesk", self.containerfile)
		self.assertIn("HELPDESK_REF", self.containerfile)
		self.assertIn("COPY --chown=frappe:frappe univesp_atendimento_app", self.containerfile)
		self.assertIn('install-app "${app}"', self.common)
		self.assertIn("configure_bff_service_account", self.common)

	def test_gateway_is_built_and_deployed_with_managed_secrets(self):
		self.assertIn("Build and push SSO Gateway image", self.workflow)
		self.assertIn("./ops/cloudrun/deploy-sso-gateway.sh", self.workflow)
		self.assertIn("https://github.com/frappe/helpdesk", self.workflow)
		self.assertIn("GATEWAY_REDIS_URL", self.deploy_gateway)
		self.assertIn("UNIVESP_EDGE_SHARED_SECRET", self.deploy_gateway)
		self.assertIn("--allow-unauthenticated", self.deploy_gateway)

	def test_workflow_fails_before_mutation_when_configuration_is_missing(self):
		preflight = self.workflow.index("Validate required deploy configuration")
		authenticate = self.workflow.index("Authenticate deployment identity to Google Cloud")
		sync = self.workflow.index("Sync runtime secrets to Secret Manager")
		self.assertLess(preflight, authenticate)
		self.assertLess(preflight, sync)
		self.assertIn("EDGE_SHARED_SECRET_VALUE", self.workflow[preflight:authenticate])
		self.assertIn("64 hexadecimal characters", self.workflow[preflight:authenticate])
		self.assertIn('-z "${SECRET_VALUE}"', self.sync_secret)

	def test_deploy_requires_https_gateway_origin(self):
		for required in (
			"SSO_GATEWAY_ORIGIN",
			"ANTIMALWARE_ENDPOINT",
			"MEDIA_PROCESSOR_ENDPOINT",
			"FRAPPE_SERVICE_USER_EMAIL",
			"INITIAL_ADMIN_EMAIL",
		):
			self.assertIn(required, self.deploy)
		self.assertIn("https://*)", self.deploy)
		self.assertIn("UNIVESP_BFF_SHARED_SECRET", self.deploy)
		self.assertIn("UNIVESP_EDGE_SHARED_SECRET", self.deploy)

	def test_private_faq_services_are_built_deployed_and_authenticated(self):
		self.assertIn("Build and push FAQ antimalware image", self.workflow)
		self.assertIn("Build and push FAQ media processor image", self.workflow)
		self.assertIn("./ops/cloudrun/deploy-faq-services.sh", self.workflow)
		self.assertIn("--no-allow-unauthenticated", self.deploy_faq_services)
		self.assertIn("roles/run.invoker", self.deploy_faq_services)
		self.assertIn("ANTIMALWARE_TOKEN_SECRET_NAME", self.deploy_faq_services)
		self.assertIn("MEDIA_PROCESSOR_TOKEN_SECRET_NAME", self.deploy_faq_services)

	def test_frappe_uses_mounted_gcs_and_private_faq_service_secrets(self):
		self.assertIn("GCS_MOUNTED_STORAGE=true", self.deploy)
		self.assertIn("GCS_BUCKET=${SITES_BUCKET}", self.deploy)
		self.assertIn("FAQ_CLOUD_RUN_IAM_AUTH=true", self.deploy)
		self.assertIn("ANTIMALWARE_TOKEN=", self.deploy)
		self.assertIn("MEDIA_PROCESSOR_TOKEN=", self.deploy)
		self.assertIn("PUBLIC_UPLOAD_TTL_HOURS=", self.deploy)

	def test_workflow_requires_manual_confirmation_on_academic_branch(self):
		self.assertIn("workflow_dispatch:", self.workflow)
		self.assertIn("confirm_homolog_deploy:", self.workflow)
		self.assertIn("github.ref_name == 'univesp/cloudrun-homolog'", self.workflow)
		self.assertIn("name: homolog", self.workflow)
		trigger_block = self.workflow.split("permissions:", 1)[0]
		self.assertNotRegex(trigger_block, r"(?m)^  push:")

	def test_provisioning_uses_scoped_credential_then_restores_workload_identity(self):
		self.assertIn("Authenticate infrastructure provisioner", self.workflow)
		self.assertIn("credentials_json: ${{ secrets.GCP_SA_KEY }}", self.workflow)
		self.assertIn("Restore deployment identity", self.workflow)
		provision = self.workflow.index("Optionally provision base infrastructure")
		restore = self.workflow.index("Restore deployment identity")
		preflight = self.workflow.index("Run read-only GCP preflight")
		self.assertLess(provision, restore)
		self.assertLess(restore, preflight)

	def test_rollback_requires_confirmation_and_immutable_images(self):
		self.assertIn('CONFIRM_ROLLBACK" != homolog', self.rollback)
		self.assertIn("ROLLBACK_GATEWAY_IMAGE_URI", self.rollback)
		self.assertIn("@sha256:", self.rollback)
		self.assertIn("{7,64}", self.rollback)
		self.assertIn("gcloud run services update", self.rollback)
		self.assertIn("does not reverse migrations", self.rollback)


if __name__ == "__main__":
	unittest.main()
