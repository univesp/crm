#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
GATEWAY_IMAGE_URI=${GATEWAY_IMAGE_URI:-}
GATEWAY_SERVICE=${GATEWAY_SERVICE:-crm-homolog-sso-gateway}
RUNTIME_SERVICE_ACCOUNT=${CLOUDRUN_RUNTIME_SERVICE_ACCOUNT:-}
VPC_CONNECTOR=${VPC_CONNECTOR:-}
APP_BASE_URL=${APP_BASE_URL:-}
FRAPPE_ORIGIN=${FRAPPE_ORIGIN:-${APP_BASE_URL}}
FRAPPE_SITE_NAME=${FRAPPE_SITE_NAME:-homolog-crm.univesp.br}
GATEWAY_MIN_INSTANCES=${GATEWAY_MIN_INSTANCES:-1}
GATEWAY_MAX_INSTANCES=${GATEWAY_MAX_INSTANCES:-5}
ENABLE_PRODUCTION_SIMULATOR=${ENABLE_PRODUCTION_SIMULATOR:-false}
ENABLE_CUSTOM_PERMISSION_PROFILES=${ENABLE_CUSTOM_PERMISSION_PROFILES:-false}

SESSION_SECRET_NAME=${GATEWAY_SESSION_SECRET_NAME:-crm-homolog-gateway-session-secret}
JWT_SECRET_NAME=${GATEWAY_JWT_SECRET_NAME:-crm-homolog-gateway-jwt-secret}
GATEWAY_REDIS_SECRET_NAME=${GATEWAY_REDIS_SECRET_NAME:-crm-homolog-gateway-redis-url}
FRAPPE_API_KEY_SECRET_NAME=${FRAPPE_API_KEY_SECRET_NAME:-crm-homolog-frappe-api-key}
FRAPPE_API_SECRET_SECRET_NAME=${FRAPPE_API_SECRET_SECRET_NAME:-crm-homolog-frappe-api-secret}
BFF_SHARED_SECRET_NAME=${BFF_SHARED_SECRET_NAME:-crm-homolog-bff-shared-secret}
EDGE_SHARED_SECRET_NAME=${EDGE_SHARED_SECRET_NAME:-crm-homolog-edge-shared-secret}
AZURE_ADMIN_CLIENT_SECRET_NAME=${AZURE_ADMIN_CLIENT_SECRET_NAME:-crm-homolog-azure-admin-client-secret}
AZURE_ACADEMICO_CLIENT_SECRET_NAME=${AZURE_ACADEMICO_CLIENT_SECRET_NAME:-crm-homolog-azure-academico-client-secret}
SAML_IDP_CERT_SECRET_NAME=${SAML_IDP_CERT_SECRET_NAME:-crm-homolog-saml-idp-cert}
INGRESS_SHARED_SECRET_NAME=${INGRESS_SHARED_SECRET_NAME:-crm-homolog-ingress-shared-secret}

required=(
	PROJECT_ID GATEWAY_IMAGE_URI RUNTIME_SERVICE_ACCOUNT VPC_CONNECTOR APP_BASE_URL FRAPPE_ORIGIN
	AZURE_ADMIN_CLIENT_ID AZURE_ADMIN_TENANT_ID AZURE_ACADEMICO_CLIENT_ID AZURE_ACADEMICO_TENANT_ID
	SAML_IDP_SSO_URL SAML_ENTITY_ID
)
for name in "${required[@]}"; do
	if [[ -z "${!name:-}" ]]; then
		printf 'Missing required gateway variable: %s\n' "${name}" >&2
		exit 1
	fi
done

case "${APP_BASE_URL}|${FRAPPE_ORIGIN}" in
https://*'|'https://*) ;;
*)
	printf 'APP_BASE_URL and FRAPPE_ORIGIN must use https://.\n' >&2
	exit 1
	;;
esac

public_origin=${APP_BASE_URL%/}
gateway_env="NODE_ENV=production,HOST=0.0.0.0,TRUST_PROXY_HOPS=1,APP_BASE_URL=${public_origin},FRAPPE_ORIGIN=${FRAPPE_ORIGIN%/},FRAPPE_SITE_NAME=${FRAPPE_SITE_NAME}"
gateway_env="${gateway_env},AZURE_REDIRECT_URI=${public_origin}/api/sso/azure/callback,SAML_ACS_URL=${public_origin}/api/sso/saml/callback"
gateway_env="${gateway_env},ENABLE_PRODUCTION_SIMULATOR=${ENABLE_PRODUCTION_SIMULATOR},ENABLE_CUSTOM_PERMISSION_PROFILES=${ENABLE_CUSTOM_PERMISSION_PROFILES}"
gateway_env="${gateway_env},AZURE_ADMIN_CLIENT_ID=${AZURE_ADMIN_CLIENT_ID},AZURE_ADMIN_TENANT_ID=${AZURE_ADMIN_TENANT_ID}"
gateway_env="${gateway_env},AZURE_ACADEMICO_CLIENT_ID=${AZURE_ACADEMICO_CLIENT_ID},AZURE_ACADEMICO_TENANT_ID=${AZURE_ACADEMICO_TENANT_ID}"
gateway_env="${gateway_env},SAML_IDP_SSO_URL=${SAML_IDP_SSO_URL},SAML_ENTITY_ID=${SAML_ENTITY_ID}"
if [[ -n "${SAML_IDP_SLO_URL:-}" ]]; then
	gateway_env="${gateway_env},SAML_IDP_SLO_URL=${SAML_IDP_SLO_URL}"
fi

gateway_secrets="SESSION_SECRET=${SESSION_SECRET_NAME}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest,GATEWAY_REDIS_URL=${GATEWAY_REDIS_SECRET_NAME}:latest"
gateway_secrets="${gateway_secrets},FRAPPE_API_KEY=${FRAPPE_API_KEY_SECRET_NAME}:latest,FRAPPE_API_SECRET=${FRAPPE_API_SECRET_SECRET_NAME}:latest"
gateway_secrets="${gateway_secrets},UNIVESP_BFF_SHARED_SECRET=${BFF_SHARED_SECRET_NAME}:latest,UNIVESP_EDGE_SHARED_SECRET=${EDGE_SHARED_SECRET_NAME}:latest"
gateway_secrets="${gateway_secrets},UNIVESP_INGRESS_SHARED_SECRET=${INGRESS_SHARED_SECRET_NAME}:latest"
gateway_secrets="${gateway_secrets},AZURE_ADMIN_CLIENT_SECRET=${AZURE_ADMIN_CLIENT_SECRET_NAME}:latest,AZURE_ACADEMICO_CLIENT_SECRET=${AZURE_ACADEMICO_CLIENT_SECRET_NAME}:latest,SAML_IDP_CERT=${SAML_IDP_CERT_SECRET_NAME}:latest"

gcloud run deploy "${GATEWAY_SERVICE}" \
	--project "${PROJECT_ID}" \
	--region "${REGION}" \
	--image "${GATEWAY_IMAGE_URI}" \
	--service-account "${RUNTIME_SERVICE_ACCOUNT}" \
	--allow-unauthenticated \
	--ingress all \
	--port 8080 \
	--cpu 1 \
	--memory 512Mi \
	--concurrency 80 \
	--min "${GATEWAY_MIN_INSTANCES}" \
	--max "${GATEWAY_MAX_INSTANCES}" \
	--timeout 60 \
	--execution-environment gen2 \
	--vpc-connector "${VPC_CONNECTOR}" \
	--vpc-egress private-ranges-only \
	--set-env-vars "${gateway_env}" \
	--set-secrets "${gateway_secrets}" \
	--startup-probe=timeoutSeconds=5,periodSeconds=10,failureThreshold=12,httpGet.port=8080,httpGet.path=/health

gcloud run services describe "${GATEWAY_SERVICE}" \
	--project "${PROJECT_ID}" \
	--region "${REGION}" \
	--format='value(status.url)'
