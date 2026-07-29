import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
VM = ROOT / "ops" / "vm"


class VmFaqServicesTest(unittest.TestCase):
	@classmethod
	def setUpClass(cls):
		cls.compose = (VM / "docker-compose.faq-services.yml").read_text(encoding="utf-8")
		cls.deploy = (VM / "scripts" / "deploy-faq-services.sh").read_text(encoding="utf-8")
		cls.dependencies = (VM / "scripts" / "install-faq-host-dependencies.sh").read_text(encoding="utf-8")
		cls.gateway = (VM / "scripts" / "deploy-sso-gateway.sh").read_text(encoding="utf-8")
		cls.backend = (VM / "scripts" / "install-atendimento-backend.sh").read_text(encoding="utf-8")
		cls.nginx = (VM / "nginx" / "homolog-crm.univesp.br.conf").read_text(encoding="utf-8")

	def test_services_are_only_exposed_on_loopback(self):
		self.assertIn("127.0.0.1:${ANTIMALWARE_PORT:-18081}:8080", self.compose)
		self.assertIn("127.0.0.1:${MEDIA_PROCESSOR_PORT:-18082}:8080", self.compose)

	def test_debian_dependencies_use_distribution_packages(self):
		self.assertIn('VERSION_ID:-}" != "12"', self.dependencies)
		self.assertIn("apt-get install -y --no-install-recommends", self.dependencies)
		self.assertIn("docker.io docker-compose", self.dependencies)
		self.assertNotIn("curl", self.dependencies)

	def test_deploy_supports_compose_plugin_and_debian_binary(self):
		self.assertIn("compose=(docker compose)", self.deploy)
		self.assertIn("compose=(docker-compose)", self.deploy)
		self.assertIn('"${compose[@]}" --env-file', self.deploy)

	def test_secrets_are_generated_and_kept_private(self):
		self.assertIn("openssl rand -hex 32", self.deploy)
		self.assertIn('chmod 0600 "$ENV_FILE"', self.deploy)
		self.assertNotIn('cat "$ENV_FILE"', self.deploy)

	def test_deploy_configures_services_email_and_runtime_restart(self):
		for expected in (
			"antimalware_endpoint",
			"media_processor_endpoint",
			"public_email_reply_secret",
			"univesp_ingress_shared_secret",
			"verify_public_email_transport",
			"supervisorctl restart 'frappe-bench:*'",
		):
			self.assertIn(expected, self.deploy)

	def test_ingress_is_forwarded_to_gateway(self):
		self.assertIn("location ^~ /api/ingress/v1/", self.nginx)
		self.assertIn("proxy_pass http://univesp_sso_gateway;", self.nginx)

	def test_repeat_deploy_handles_owned_dependencies_and_cached_frappe(self):
		self.assertIn('chown -R www-data:www-data "$TARGET_GATEWAY/node_modules"', self.gateway)
		self.assertIn("supervisorctl restart 'frappe-bench:*'", self.backend)


if __name__ == "__main__":
	unittest.main()
