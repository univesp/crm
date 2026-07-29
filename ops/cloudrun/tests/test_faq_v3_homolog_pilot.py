import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CLOUDRUN = ROOT / "ops" / "cloudrun"
APP = ROOT / "univesp_atendimento_app" / "univesp_atendimento"


class FaqV3HomologPilotTest(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.workflow = (ROOT / ".github" / "workflows" / "univesp-cloudrun-homolog.yml").read_text(
			encoding="utf-8"
		)
		cls.deploy = (CLOUDRUN / "deploy.sh").read_text(encoding="utf-8")
		cls.deploy_gateway = (CLOUDRUN / "deploy-sso-gateway.sh").read_text(encoding="utf-8")
		cls.common = (CLOUDRUN / "scripts" / "common.sh").read_text(encoding="utf-8")
		cls.bootstrap = (CLOUDRUN / "scripts" / "start-bootstrap.sh").read_text(encoding="utf-8")
		cls.verify = (CLOUDRUN / "verify-faq-v3-pilot.sh").read_text(encoding="utf-8")
		cls.smoke = (CLOUDRUN / "smoke-homolog.sh").read_text(encoding="utf-8")
		cls.seed = (APP / "homolog_seed.py").read_text(encoding="utf-8")

	def test_workflow_explicitly_seeds_and_verifies_pilot_before_evidence(self):
		self.assertIn("DEPLOYMENT_ENV: homolog", self.workflow)
		self.assertIn('FAQ_V3_HOMOLOG_PILOT_ENABLED: "true"', self.workflow)
		self.assertIn("./ops/cloudrun/verify-faq-v3-pilot.sh", self.workflow)
		self.assertLess(
			self.workflow.index("Verify FAQ v3 homolog pilot state"),
			self.workflow.index("Collect post-deploy homolog evidence"),
		)

	def test_bootstrap_is_guarded_and_idempotent(self):
		self.assertIn("FAQ_V3_HOMOLOG_PILOT_ENABLED:-false", self.bootstrap)
		self.assertIn("bootstrap_faq_v3_pilot", self.bootstrap)
		self.assertIn("inspect_faq_v3_pilot", self.bootstrap)
		self.assertIn('DEPLOYMENT_ENV", "").strip().lower() != "homolog"', self.seed)
		self.assertIn("FAQ_V3_PILOT_CONFIRMATION", self.seed)
		self.assertIn("idempotent", self.seed)
		self.assertIn("_backup_v2_library", self.seed)
		self.assertIn('"faq-approver-manager"', self.seed)
		self.assertIn('base_persona="gestor_area"', self.seed)
		self.assertIn('capabilities=["approve_knowledge"]', self.seed)

	def test_all_runtime_flags_and_three_v2_seeds_are_covered(self):
		for flag in (
			"knowledge_v3_read",
			"knowledge_v3_write",
			"routing_server_authority",
			"knowledge_collaboration",
			"faq_public_anonymous",
			"faq_public_documents",
			"faq_link_validation",
			"faq_public_email_thread",
			"knowledge_media_upload",
		):
			self.assertIn(f'"{flag}"', self.seed)
		for seed in ("faq-aluno-seed.json", "faq-op-seed.json", "faq-publico-seed.json"):
			self.assertIn(seed, self.seed)
			self.assertTrue((APP / "seeds" / seed).is_file())
		self.assertTrue((APP / "seeds" / seed).read_text(encoding="utf-8").strip())
		self.assertIn('Path(__file__).resolve().parent / "seeds"', self.seed)
		self.assertTrue((APP / "seeds" / "faq-v3-acesso-ava-seed.json").is_file())

	def test_verifier_and_smoke_fail_closed_on_missing_pilot_content(self):
		for expected in (
			"acesso-ava-homolog-v1",
			"acesso-ava-seed",
			"op-playbook-matricula-seed",
			"publico-atendimento-seed",
			"knowledge_v3_read",
			"knowledge_media_upload",
		):
			self.assertIn(expected, self.verify)
		self.assertIn("runtime v3 acesso-ava publicado", self.smoke)
		self.assertIn("flags publicas do piloto ativas", self.smoke)
		self.assertIn("catalogos sinteticos do piloto", self.smoke)

	def test_helpdesk_team_queries_use_pinned_disabled_field(self):
		sources = (
			APP / "install.py",
			APP / "api" / "v1" / "admin.py",
			APP / "api" / "v1" / "queues.py",
			APP / "api" / "v1" / "routing.py",
		)
		combined = "\n".join(path.read_text(encoding="utf-8") for path in sources)
		self.assertNotIn('"HD Team", filters={"enabled": 1}', combined)
		self.assertNotIn('{"name": str(queue_key or "").strip(), "enabled": 1}', combined)
		self.assertIn('filters={"disabled": 0}', combined)
		self.assertIn('"disabled": 0', combined)

	def test_deploy_propagates_homolog_guard_to_bootstrap_job(self):
		self.assertIn("DEPLOYMENT_ENV=${DEPLOYMENT_ENV:-}", self.deploy)
		self.assertIn(
			"FAQ_V3_HOMOLOG_PILOT_ENABLED=${FAQ_V3_HOMOLOG_PILOT_ENABLED:-false}",
			self.deploy,
		)

	def test_public_email_gate_requires_real_transport_and_shared_ingress(self):
		for expected in (
			"PUBLIC_REPLY_DOMAIN",
			"SMTP_HOST",
			"SMTP_NO_AUTHENTICATION",
			"SMTP_FROM_EMAIL",
			"PUBLIC_EMAIL_REPLY_SECRET",
			"UNIVESP_INGRESS_SHARED_SECRET",
		):
			self.assertIn(expected, self.common)
		self.assertIn("verify_public_email_transport", self.bootstrap)
		self.assertIn("SMTP_PASSWORD_VALUE", self.workflow)
		self.assertIn('if [[ "${SMTP_NO_AUTHENTICATION}" == "true" ]]', self.workflow)
		self.assertIn("client.mail(from_email)", self.seed)
		self.assertIn("client.login(username, password)", self.seed)
		self.assertIn("crm-homolog-public-email-reply-secret", self.workflow)
		self.assertIn("crm-homolog-ingress-shared-secret", self.workflow)
		self.assertIn("UNIVESP_INGRESS_SHARED_SECRET=", self.deploy_gateway)
		self.assertIn('"public_email": {"ready": true', self.verify)


if __name__ == "__main__":
	unittest.main()
