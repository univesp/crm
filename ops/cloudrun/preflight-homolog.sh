#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
PREFLIGHT_MODE=${PREFLIGHT_MODE:-static}
CHECK_DEPLOYED_SERVICES=${CHECK_DEPLOYED_SERVICES:-false}
OUTPUT_PATH=${OUTPUT_PATH:-}
ARTIFACT_REPOSITORY=${ARTIFACT_REPOSITORY:-}
CLOUDSQL_INSTANCE=${CLOUDSQL_INSTANCE:-}
SITES_BUCKET=${SITES_BUCKET:-}
VPC_CONNECTOR=${VPC_CONNECTOR:-}
CLOUDRUN_RUNTIME_SERVICE_ACCOUNT=${CLOUDRUN_RUNTIME_SERVICE_ACCOUNT:-}
WEB_SERVICE=${WEB_SERVICE:-crm-homolog-web}
WORKER_SERVICE=${WORKER_SERVICE:-crm-homolog-worker}
SCHEDULER_SERVICE=${SCHEDULER_SERVICE:-crm-homolog-scheduler}
GATEWAY_SERVICE=${GATEWAY_SERVICE:-crm-homolog-sso-gateway}
BOOTSTRAP_JOB=${BOOTSTRAP_JOB:-crm-homolog-bootstrap}
required_values=(PROJECT_ID REGION ARTIFACT_REPOSITORY CLOUDSQL_INSTANCE SITES_BUCKET VPC_CONNECTOR CLOUDRUN_RUNTIME_SERVICE_ACCOUNT)
secret_names=(
 ${DB_PASSWORD_SECRET_NAME:-crm-homolog-db-password}
 ${ADMIN_PASSWORD_SECRET_NAME:-crm-homolog-admin-password}
 ${REDIS_CACHE_SECRET_NAME:-crm-homolog-redis-cache-url}
 ${REDIS_QUEUE_SECRET_NAME:-crm-homolog-redis-queue-url}
 ${REDIS_SOCKETIO_SECRET_NAME:-crm-homolog-redis-socketio-url}
 ${BFF_SHARED_SECRET_NAME:-crm-homolog-bff-shared-secret}
 ${EDGE_SHARED_SECRET_NAME:-crm-homolog-edge-shared-secret}
 ${FRAPPE_API_KEY_SECRET_NAME:-crm-homolog-frappe-api-key}
 ${FRAPPE_API_SECRET_SECRET_NAME:-crm-homolog-frappe-api-secret}
 ${GATEWAY_SESSION_SECRET_NAME:-crm-homolog-gateway-session-secret}
 ${GATEWAY_JWT_SECRET_NAME:-crm-homolog-gateway-jwt-secret}
 ${GATEWAY_REDIS_SECRET_NAME:-crm-homolog-gateway-redis-url}
 ${AZURE_ADMIN_CLIENT_SECRET_NAME:-crm-homolog-azure-admin-client-secret}
 ${AZURE_ACADEMICO_CLIENT_SECRET_NAME:-crm-homolog-azure-academico-client-secret}
 ${SAML_IDP_CERT_SECRET_NAME:-crm-homolog-saml-idp-cert}
)
command -v jq >/dev/null || { printf 'jq is required.\n' >&2; exit 1; }
checks='[]'; failures=0
record(){ local name=$1 status=$2 detail=$3; [[ "$status" == pass ]] || failures=$((failures+1)); checks=$(jq -c --arg name "$name" --arg status "$status" --arg detail "$detail" '. + [{name:$name,status:$status,detail:$detail}]' <<<"$checks"); }
for name in "${required_values[@]}"; do if [[ -n "${!name:-}" ]]; then record "env:$name" pass configured; else record "env:$name" fail missing; fi; done
if [[ "$PREFLIGHT_MODE" == gcp ]]; then
 command -v gcloud >/dev/null || { printf 'gcloud is required in gcp mode.\n' >&2; exit 1; }
 if gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" --project "$PROJECT_ID" --location "$REGION" >/dev/null 2>&1; then record artifact_repository pass found; else record artifact_repository fail not-found; fi
 current_web_json=$(mktemp); trap 'rm -f "$current_web_json"' EXIT
 if ! gcloud run services describe "$WEB_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format=json >"$current_web_json" 2>/dev/null; then printf '{}' >"$current_web_json"; fi
 service_references(){ jq -e --arg expected "$1" '[.. | strings] | any(. == $expected or contains($expected))' "$current_web_json" >/dev/null; }
 cloudsql_instance_name=${CLOUDSQL_INSTANCE##*:}
 if gcloud sql instances describe "$cloudsql_instance_name" --project "$PROJECT_ID" >/dev/null 2>&1; then record cloudsql pass found; elif service_references "$CLOUDSQL_INSTANCE"; then record cloudsql pass attached-current-service; else record cloudsql fail not-found-or-not-attached; fi
 if gcloud storage buckets describe "gs://$SITES_BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1; then record sites_bucket pass found; elif service_references "$SITES_BUCKET"; then record sites_bucket pass attached-current-service; else record sites_bucket fail not-found-or-not-attached; fi
 if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then record vpc_connector pass found; elif service_references "$VPC_CONNECTOR"; then record vpc_connector pass attached-current-service; else record vpc_connector fail not-found-or-not-attached; fi
 if gcloud iam service-accounts describe "$CLOUDRUN_RUNTIME_SERVICE_ACCOUNT" --project "$PROJECT_ID" >/dev/null 2>&1; then record runtime_service_account pass found; else record runtime_service_account fail not-found; fi
 for secret_name in "${secret_names[@]}"; do if gcloud secrets versions describe latest --secret "$secret_name" --project "$PROJECT_ID" --format='value(state)' 2>/dev/null | grep -qx ENABLED; then record "secret:$secret_name" pass latest-enabled; else record "secret:$secret_name" fail missing-or-disabled; fi; done
 if [[ "$CHECK_DEPLOYED_SERVICES" == true ]]; then
  for service in "$WEB_SERVICE" "$WORKER_SERVICE" "$SCHEDULER_SERVICE" "$GATEWAY_SERVICE"; do if gcloud run services describe "$service" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then record "service:$service" pass found; else record "service:$service" fail not-found; fi; done
  if gcloud run jobs describe "$BOOTSTRAP_JOB" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then record "job:$BOOTSTRAP_JOB" pass found; else record "job:$BOOTSTRAP_JOB" fail not-found; fi
 fi
elif [[ "$PREFLIGHT_MODE" != static ]]; then printf 'PREFLIGHT_MODE must be static or gcp.\n' >&2; exit 1; fi
result=$(jq -n --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg mode "$PREFLIGHT_MODE" --arg project "$PROJECT_ID" --arg region "$REGION" --argjson failures "$failures" --argjson checks "$checks" '{schema_version:1,generated_at:$generated_at,mode:$mode,project:$project,region:$region,passed:($failures==0),failure_count:$failures,checks:$checks}')
if [[ -n "$OUTPUT_PATH" ]]; then mkdir -p "$(dirname "$OUTPUT_PATH")"; printf '%s\n' "$result" >"$OUTPUT_PATH"; else printf '%s\n' "$result"; fi
((failures==0))
