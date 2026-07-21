#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
ROLLBACK_IMAGE_URI=${ROLLBACK_IMAGE_URI:-}
ROLLBACK_GATEWAY_IMAGE_URI=${ROLLBACK_GATEWAY_IMAGE_URI:-}
CONFIRM_ROLLBACK=${CONFIRM_ROLLBACK:-}
WEB_SERVICE=${WEB_SERVICE:-crm-homolog-web}
WORKER_SERVICE=${WORKER_SERVICE:-crm-homolog-worker}
SCHEDULER_SERVICE=${SCHEDULER_SERVICE:-crm-homolog-scheduler}
GATEWAY_SERVICE=${GATEWAY_SERVICE:-crm-homolog-sso-gateway}
EVIDENCE_DIR=${EVIDENCE_DIR:-artifacts/homolog/rollback-$(date -u +%Y%m%dT%H%M%SZ)}

if [[ -z "$PROJECT_ID" || -z "$ROLLBACK_IMAGE_URI" || -z "$ROLLBACK_GATEWAY_IMAGE_URI" ]]; then
  printf 'GCP_PROJECT_ID, ROLLBACK_IMAGE_URI and ROLLBACK_GATEWAY_IMAGE_URI are required.\n' >&2
  exit 1
fi
if [[ "$CONFIRM_ROLLBACK" != homolog ]]; then
  printf 'Set CONFIRM_ROLLBACK=homolog to confirm this rollback.\n' >&2
  exit 1
fi
validate_immutable_image() {
  local image=$1
  if [[ "$image" =~ @sha256:[0-9a-fA-F]{64}$ || "$image" =~ :[0-9a-fA-F]{7,64}$ ]]; then return 0; fi
  printf 'Rollback image must end in a SHA tag (7-64 hex) or sha256 digest: %s\n' "$image" >&2
  return 1
}
validate_immutable_image "$ROLLBACK_IMAGE_URI"
validate_immutable_image "$ROLLBACK_GATEWAY_IMAGE_URI"

mkdir -p "$EVIDENCE_DIR"
OUTPUT_PATH="$EVIDENCE_DIR/pre-rollback-manifest.json" "$SCRIPT_DIR/release-manifest.sh"
services=("$WEB_SERVICE" "$WORKER_SERVICE" "$SCHEDULER_SERVICE")
printf 'Project: %s\nRegion: %s\nEvidence: %s\n' "$PROJECT_ID" "$REGION" "$EVIDENCE_DIR"
for service in "${services[@]}"; do
  current_image=$(gcloud run services describe "$service" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.containers[0].image)')
  printf '%s: %s -> %s\n' "$service" "$current_image" "$ROLLBACK_IMAGE_URI"
done
current_gateway_image=$(gcloud run services describe "$GATEWAY_SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.containers[0].image)')
printf '%s: %s -> %s\n' "$GATEWAY_SERVICE" "$current_gateway_image" "$ROLLBACK_GATEWAY_IMAGE_URI"

for service in "${services[@]}"; do
  gcloud run services update "$service" --project "$PROJECT_ID" --region "$REGION" --image "$ROLLBACK_IMAGE_URI" --quiet
done
gcloud run services update "$GATEWAY_SERVICE" --project "$PROJECT_ID" --region "$REGION" --image "$ROLLBACK_GATEWAY_IMAGE_URI" --quiet
OUTPUT_PATH="$EVIDENCE_DIR/post-rollback-manifest.json" "$SCRIPT_DIR/release-manifest.sh"
printf 'Image rollback completed for Frappe and gateway. Run smoke-homolog.sh next.\n'
printf 'This script does not reverse migrations or restore data.\n'
