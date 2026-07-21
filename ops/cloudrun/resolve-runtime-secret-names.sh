#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
GATEWAY_SERVICE=${GATEWAY_SERVICE:-crm-homolog-sso-gateway}
GITHUB_ENV=${GITHUB_ENV:-}
[[ -n "$PROJECT_ID" && -n "$REGION" && -n "$GITHUB_ENV" ]] || { printf 'GCP_PROJECT_ID, GCP_REGION and GITHUB_ENV are required.\n' >&2; exit 1; }
for command_name in gcloud jq; do command -v "$command_name" >/dev/null || { printf '%s is required.\n' "$command_name" >&2; exit 1; }; done

service_json=$(mktemp)
services_json=$(mktemp)
candidate_json=$(mktemp)
trap 'rm -f "$service_json" "$services_json" "$candidate_json"' EXIT

has_gateway_secret_refs() {
  jq -e '[.. | objects | .name?] | any(. == "AZURE_ADMIN_CLIENT_SECRET")' "$1" >/dev/null
}
load_gateway_service() {
  local service_name=$1 service_region=$2
  if gcloud run services describe "$service_name" --project "$PROJECT_ID" --region "$service_region" --format=json >"$candidate_json" 2>/dev/null &&
     has_gateway_secret_refs "$candidate_json"; then
    cp "$candidate_json" "$service_json"
    printf 'Using deployed gateway secret references from %s (%s).\n' "$service_name" "$service_region"
    return 0
  fi
  return 1
}

gateway_found=false
if load_gateway_service "$GATEWAY_SERVICE" "$REGION"; then
  gateway_found=true
elif gcloud run services list --platform managed --project "$PROJECT_ID" --format=json >"$services_json" 2>/dev/null; then
  while IFS=$'\t' read -r service_name service_region; do
    [[ -n "$service_name" ]] || continue
    service_region=${service_region:-$REGION}
    if load_gateway_service "$service_name" "$service_region"; then gateway_found=true; break; fi
  done < <(jq -r '.[] | [.metadata.name, (.metadata.labels["cloud.googleapis.com/location"] // "")] | @tsv' "$services_json")
fi
[[ "$gateway_found" == true ]] || {
  printf 'No deployed Cloud Run service with gateway secret references was found in the project.\n' >&2
  exit 1
}

secret_enabled() {
  gcloud secrets versions describe latest --secret "$1" --project "$PROJECT_ID" --format='value(state)' 2>/dev/null | grep -qx ENABLED
}
resolve_secret() {
  local output_name=$1 env_name=$2 desired_name=$3 supplied_value=$4 resolved_name
  if [[ -n "$supplied_value" ]] || secret_enabled "$desired_name"; then
    resolved_name=$desired_name
  else
    resolved_name=$(jq -r --arg env_name "$env_name" '[.. | objects | select(.name? == $env_name) | (.valueFrom.secretKeyRef.name? // .valueSource.secretKeyRef.secret?)] | map(select(type == "string" and length > 0)) | first // empty' "$service_json")
    [[ -n "$resolved_name" ]] || { printf 'No enabled desired secret or deployed secret reference found for %s.\n' "$env_name" >&2; exit 1; }
    if ! secret_enabled "$resolved_name"; then
      resolved_name=$(jq -r --arg secret_ref "$resolved_name" '[.. | strings | select(contains($secret_ref) and contains("/secrets/")) | capture("/secrets/(?<name>[^,]+)").name | gsub("\\s+$"; "")] | first // empty' "$service_json")
    fi
    [[ -n "$resolved_name" ]] && secret_enabled "$resolved_name" || { printf 'The deployed secret reference for %s is missing or disabled.\n' "$env_name" >&2; exit 1; }
  fi
  printf '%s=%s\n' "$output_name" "$resolved_name" >>"$GITHUB_ENV"
  printf 'Resolved %s to an enabled Secret Manager reference.\n' "$env_name"
}
resolve_secret GATEWAY_REDIS_SECRET_NAME GATEWAY_REDIS_URL "${GATEWAY_REDIS_SECRET_NAME:-crm-homolog-gateway-redis-url}" "${GATEWAY_REDIS_VALUE:-}"
resolve_secret AZURE_ADMIN_CLIENT_SECRET_NAME AZURE_ADMIN_CLIENT_SECRET "${AZURE_ADMIN_CLIENT_SECRET_NAME:-crm-homolog-azure-admin-client-secret}" "${AZURE_ADMIN_CLIENT_SECRET_VALUE:-}"
resolve_secret AZURE_ACADEMICO_CLIENT_SECRET_NAME AZURE_ACADEMICO_CLIENT_SECRET "${AZURE_ACADEMICO_CLIENT_SECRET_NAME:-crm-homolog-azure-academico-client-secret}" "${AZURE_ACADEMICO_CLIENT_SECRET_VALUE:-}"
resolve_secret SAML_IDP_CERT_SECRET_NAME SAML_IDP_CERT "${SAML_IDP_CERT_SECRET_NAME:-crm-homolog-saml-idp-cert}" "${SAML_IDP_CERT_VALUE:-}"
