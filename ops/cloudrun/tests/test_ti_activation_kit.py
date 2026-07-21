import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TI = ROOT / "ops" / "cloudrun" / "ti"


class TiActivationKitTest(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.iam = (TI / "manage-deployer-iam.sh").read_text(encoding="utf-8")
		cls.idp = (TI / "verify-idp-redirects.sh").read_text(encoding="utf-8")
		cls.validator = (TI / "validate-synthetic-accounts.sh").read_text(encoding="utf-8")
		cls.workflow = (ROOT / ".github" / "workflows" / "univesp-cloudrun-readiness.yml").read_text(encoding="utf-8")
		cls.manifest = json.loads((TI / "synthetic-accounts.example.json").read_text(encoding="utf-8"))

	def test_iam_defaults_to_check_and_has_manifest_based_rollback(self):
		self.assertIn("ACTION=${ACTION:-check}", self.iam)
		self.assertIn("CONFIRM_IAM=homolog", self.iam)
		self.assertIn("CONFIRM_IAM_ROLLBACK=homolog", self.iam)
		self.assertIn("roles_added", self.iam)
		for role in ("roles/cloudsql.client", "roles/storage.bucketViewer", "roles/vpcaccess.user", "roles/compute.viewer"):
			self.assertIn(role, self.iam)
		for broad_role in ("roles/owner", "roles/editor", "roles/storage.admin", "roles/cloudsql.admin"):
			self.assertNotIn(broad_role, self.iam)

	def test_readiness_workflow_cannot_deploy_or_sync_secrets(self):
		for forbidden in ("deploy.sh", "provision.sh", "sync_secret.sh", "gcloud run deploy"):
			self.assertNotIn(forbidden, self.workflow)
		self.assertIn("preflight-homolog.sh", self.workflow)
		self.assertIn("environment: homolog", self.workflow)
		self.assertIn("verify-idp-redirects.sh", self.workflow)
		self.assertIn("actions/upload-artifact@v4", self.workflow)

	def test_idp_check_does_not_follow_or_persist_redirect_payload(self):
		self.assertNotIn("--location", self.idp)
		self.assertNotIn("LOCATION=", self.idp.split("result=$(", 1)[1])
		self.assertIn("redirect-contract-ok", self.idp)

	def test_synthetic_manifest_has_exact_profiles_and_no_credentials(self):
		self.assertEqual({account["profile"] for account in self.manifest["accounts"]}, {"student", "operator", "area", "admin"})
		mapping = {account["profile"]: account["frappe_profile_key"] for account in self.manifest["accounts"]}
		self.assertEqual(mapping, {"student": "aluno", "operator": "op", "area": "analista_area", "admin": "admin_central"})
		self.assertIn("INITIAL_ADMIN_EMAIL", self.workflow)
		serialized = json.dumps(self.manifest).lower()
		for forbidden in ("password", "secret", "token", "cookie"):
			self.assertNotIn(forbidden, serialized)
		self.assertIn("VALIDATION_MODE", self.validator)


if __name__ == "__main__":
	unittest.main()
