#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
GATEWAY_SERVICE=${GATEWAY_SERVICE:-crm-homolog-sso-gateway}
GITHUB_ENV=${GITHUB_ENV:-}
[[ -n "$PROJECT_ID" && -n "$REGION" && -n "$GITHUB_ENV" ]] || { printf 'GCP_PROJECT_ID, GCP_REGION and GITHUB_ENV are required.\n' >&2; exit 1; }
for command_name in gcloud jq; do command -v "$command_name" >/dev/null || { printf '%s is required.\n' "$command_name" >&2; exit 1; }; done
service_json=$(mktemp)
trap 'rm -f "$service_json"' EXIT
gcloud run services describe "$GATEWAY_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format=json >"$service_json"
secret_enabled() {
  gcloud secrets versions describe latest --secret "$1" --project "$PROJECT_ID" --format='value(state)' 2>/dev/null | grep -qx ENABLED
}
resolve_secret() {
  local output_name=$1 env_name=$2 desired_name=$3 supplied_value=$4 resolved_name
  if [[ -n "$supplied_value" ]] || secret_enabled "$desired_name"; then
    resolved_name=$desired_name
  else
    resolved_name=$(jq -r --arg env_name "$env_name" '[.. | objects | select(.name? == $env_name) | .valueFrom.secretKeyRef.name?] | map(select(type == "string" and length > 0)) | first // empty' "$service_json")
    [[ -n "$resolved_name" ]] || { printf 'No enabled desired secret or deployed secret reference found for %s.\n' "$env_name" >&2; exit 1; }
    secret_enabled "$resolved_name" || { printf 'The deployed secret reference for %s is missing or disabled.\n' "$env_name" >&2; exit 1; }
  fi
  printf '%s=%s\n' "$output_name" "$resolved_name" >>"$GITHUB_ENV"
  printf 'Resolved %s to an enabled Secret Manager reference.\n' "$env_name"
}
resolve_secret GATEWAY_REDIS_SECRET_NAME GATEWAY_REDIS_URL "${GATEWAY_REDIS_SECRET_NAME:-crm-homolog-gateway-redis-url}" "${GATEWAY_REDIS_VALUE:-}"
resolve_secret AZURE_ADMIN_CLIENT_SECRET_NAME AZURE_ADMIN_CLIENT_SECRET "${AZURE_ADMIN_CLIENT_SECRET_NAME:-crm-homolog-azure-admin-client-secret}" "${AZURE_ADMIN_CLIENT_SECRET_VALUE:-}"
resolve_secret AZURE_ACADEMICO_CLIENT_SECRET_NAME AZURE_ACADEMICO_CLIENT_SECRET "${AZURE_ACADEMICO_CLIENT_SECRET_NAME:-crm-homolog-azure-academico-client-secret}" "${AZURE_ACADEMICO_CLIENT_SECRET_VALUE:-}"
resolve_secret SAML_IDP_CERT_SECRET_NAME SAML_IDP_CERT "${SAML_IDP_CERT_SECRET_NAME:-crm-homolog-saml-idp-cert}" "${SAML_IDP_CERT_VALUE:-}"
