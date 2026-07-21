#!/usr/bin/env bash
set -Eeuo pipefail

PUBLIC_URL=${PUBLIC_URL:-}
AZURE_ADMIN_CLIENT_ID=${AZURE_ADMIN_CLIENT_ID:-}
AZURE_ADMIN_TENANT_ID=${AZURE_ADMIN_TENANT_ID:-}
AZURE_ACADEMICO_CLIENT_ID=${AZURE_ACADEMICO_CLIENT_ID:-}
AZURE_ACADEMICO_TENANT_ID=${AZURE_ACADEMICO_TENANT_ID:-}
SAML_IDP_SSO_URL=${SAML_IDP_SSO_URL:-}
OUTPUT_PATH=${OUTPUT_PATH:-}

[[ "$PUBLIC_URL" =~ ^https://[^/]+/?$ ]] || { printf 'PUBLIC_URL must be an HTTPS origin.\n' >&2; exit 1; }
for name in AZURE_ADMIN_CLIENT_ID AZURE_ADMIN_TENANT_ID AZURE_ACADEMICO_CLIENT_ID AZURE_ACADEMICO_TENANT_ID SAML_IDP_SSO_URL; do
  [[ -n "${!name:-}" ]] || { printf '%s is required.\n' "$name" >&2; exit 1; }
done
for command_name in curl jq awk; do command -v "$command_name" >/dev/null || { printf '%s is required.\n' "$command_name" >&2; exit 1; }; done

PUBLIC_URL=${PUBLIC_URL%/}; results='[]'; failures=0
headers=$(mktemp); trap 'rm -f "$headers"' EXIT
record() {
  local profile=$1 status=$2 target=$3 passed=$4 detail=$5
  [[ "$passed" == true ]] || failures=$((failures+1))
  results=$(jq -c --arg profile "$profile" --arg status "$status" --arg target "$target" --arg detail "$detail" --argjson passed "$passed" \
    '. + [{profile:$profile,status:($status|tonumber),expected_target:$target,detail:$detail,passed:$passed}]' <<<"$results")
}
fetch_location() {
  local path=$1
  curl -sS -o /dev/null -D "$headers" --max-time 20 --connect-timeout 5 "$PUBLIC_URL$path" || true
  HTTP_STATUS=$(awk 'toupper($1) ~ /^HTTP\// {code=$2} END {print code+0}' "$headers")
  LOCATION=$(awk 'BEGIN{IGNORECASE=1} /^location:/ {sub(/^[^:]+:[[:space:]]*/,""); sub(/\r$/,""); print; exit}' "$headers")
}
check_azure() {
  local profile=$1 tenant=$2 client_id=$3 encoded_redirect passed=false detail=mismatch
  encoded_redirect=$(jq -rn --arg value "$PUBLIC_URL/api/sso/azure/callback" '$value|@uri')
  fetch_location "/api/sso/azure/start?tenant=$profile"
  if [[ "$HTTP_STATUS" =~ ^(302|303|307|308)$ && "$LOCATION" == "https://login.microsoftonline.com/${tenant}/"* && "$LOCATION" == *"client_id=${client_id}"* && "$LOCATION" == *"redirect_uri=${encoded_redirect}"* ]]; then
    passed=true; detail=redirect-contract-ok
  fi
  record "azure-$profile" "$HTTP_STATUS" login.microsoftonline.com "$passed" "$detail"
}
check_azure admin "$AZURE_ADMIN_TENANT_ID" "$AZURE_ADMIN_CLIENT_ID"
check_azure academico "$AZURE_ACADEMICO_TENANT_ID" "$AZURE_ACADEMICO_CLIENT_ID"
fetch_location /api/sso/saml/start
saml_passed=false; saml_detail=mismatch
if [[ "$HTTP_STATUS" =~ ^(302|303|307|308)$ && "$LOCATION" == "$SAML_IDP_SSO_URL"* ]]; then saml_passed=true; saml_detail=redirect-contract-ok; fi
record saml "$HTTP_STATUS" saml-idp "$saml_passed" "$saml_detail"

result=$(jq -n --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg origin "$PUBLIC_URL" --argjson failures "$failures" --argjson results "$results" \
  '{schema_version:1,generated_at:$generated_at,origin:$origin,passed:($failures==0),failure_count:$failures,checks:$results}')
if [[ -n "$OUTPUT_PATH" ]]; then mkdir -p "$(dirname "$OUTPUT_PATH")"; printf '%s\n' "$result" >"$OUTPUT_PATH"; else printf '%s\n' "$result"; fi
((failures == 0))
