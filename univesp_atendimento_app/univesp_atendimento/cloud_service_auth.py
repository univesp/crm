import os
from urllib.parse import urlsplit


def configured_value(frappe, config_key, env_key):
	value = str(frappe.conf.get(config_key) or "").strip()
	return value or str(os.getenv(env_key, "")).strip()


def allowed_service_endpoint(endpoint):
	parts = urlsplit(str(endpoint or "").strip())
	if parts.scheme == "https" and parts.netloc:
		return True
	try:
		return (
			parts.scheme == "http"
			and parts.hostname in {"127.0.0.1", "::1", "localhost"}
			and bool(parts.port)
		)
	except ValueError:
		return False


def service_headers(endpoint, token_header, token):
	headers = {token_header: token}
	if str(os.getenv("FAQ_CLOUD_RUN_IAM_AUTH", "")).strip().lower() not in {"1", "true", "yes"}:
		return headers

	import requests

	parts = urlsplit(endpoint)
	audience = f"{parts.scheme}://{parts.netloc}"
	result = requests.get(
		("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"),
		params={"audience": audience, "format": "full"},
		headers={"Metadata-Flavor": "Google"},
		timeout=3,
	)
	result.raise_for_status()
	headers["Authorization"] = f"Bearer {result.text.strip()}"
	return headers
