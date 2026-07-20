import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
CONFIG = ROOT / "ops" / "cloudrun" / "nginx" / "frappe.conf.template"
DEPLOY = ROOT / "ops" / "cloudrun" / "deploy.sh"
ROLLBACK = ROOT / "ops" / "cloudrun" / "rollback.sh"
WORKFLOW = ROOT / ".github" / "workflows" / "univesp-cloudrun-homolog.yml"


class CloudRunFrontDoorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = CONFIG.read_text(encoding="utf-8")
        cls.deploy = DEPLOY.read_text(encoding="utf-8")
        cls.rollback = ROLLBACK.read_text(encoding="utf-8")
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")

    def test_academic_api_precedes_generic_api_block(self):
        academic = self.config.index("location ^~ /api/app/v1/")
        generic = self.config.index("location ^~ /api/ { return 404; }")
        self.assertLess(academic, generic)
        self.assertIn("location = /api/app/v1", self.config)

    def test_legacy_browser_surfaces_are_not_proxied(self):
        for path in ("/api/method/", "/api/resource/", "/app/", "/desk/", "/assets/", "/files/", "/socket.io/"):
            pattern = rf"location\s+(?:\^~\s+|=\s+)?{re.escape(path)}[^{{]*\{{\s*return\s+(?:302|404)"
            self.assertRegex(self.config, pattern, path)

    def test_academic_api_targets_sso_gateway(self):
        block = self.config.split("location ^~ /api/app/v1/", 1)[1].split("\n\t}", 1)[0]
        self.assertIn("proxy_pass ${SSO_GATEWAY_ORIGIN};", block)

    def test_deploy_requires_https_gateway_origin(self):
        self.assertIn("SSO_GATEWAY_ORIGIN are required.", self.deploy)
        self.assertIn("https://*)", self.deploy)

    def test_workflow_requires_manual_confirmation_on_academic_branch(self):
        self.assertIn("workflow_dispatch:", self.workflow)
        self.assertIn("confirm_homolog_deploy:", self.workflow)
        self.assertIn("github.ref_name == 'univesp/cloudrun-homolog'", self.workflow)
        self.assertIn("name: homolog", self.workflow)
        trigger_block = self.workflow.split("permissions:", 1)[0]
        self.assertNotRegex(trigger_block, r"(?m)^  push:")

    def test_rollback_requires_confirmation_and_immutable_image(self):
        self.assertIn('CONFIRM_ROLLBACK" != "homolog"', self.rollback)
        self.assertIn("*:latest)", self.rollback)
        self.assertIn("gcloud run services update", self.rollback)
        self.assertIn("nao desfaz migrations", self.rollback)


if __name__ == "__main__":
    unittest.main()
