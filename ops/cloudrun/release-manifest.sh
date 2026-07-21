#!/usr/bin/env bash
set -Eeuo pipefail
PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
WEB_SERVICE=${WEB_SERVICE:-crm-homolog-web}
WORKER_SERVICE=${WORKER_SERVICE:-crm-homolog-worker}
SCHEDULER_SERVICE=${SCHEDULER_SERVICE:-crm-homolog-scheduler}
GATEWAY_SERVICE=${GATEWAY_SERVICE:-crm-homolog-sso-gateway}
BOOTSTRAP_JOB=${BOOTSTRAP_JOB:-crm-homolog-bootstrap}
OUTPUT_PATH=${OUTPUT_PATH:-}
RELEASE_SHA=${RELEASE_SHA:-${GITHUB_SHA:-unknown}}
for command_name in gcloud jq; do command -v "$command_name" >/dev/null || { printf '%s is required.\n' "$command_name" >&2; exit 1; }; done
[[ -n "$PROJECT_ID" ]] || { printf 'GCP_PROJECT_ID is required.\n' >&2; exit 1; }
services_json='[]'
for service in "$WEB_SERVICE" "$WORKER_SERVICE" "$SCHEDULER_SERVICE" "$GATEWAY_SERVICE"; do
  description=$(gcloud run services describe "$service" --project "$PROJECT_ID" --region "$REGION" --format=json)
  entry=$(jq -c --arg name "$service" '{name: $name, url: (.status.url // null), revision: (.status.latestReadyRevisionName // null), image: (.spec.template.spec.containers[0].image // null), traffic: [(.status.traffic // [])[] | {revision: (.revisionName // null), percent: (.percent // 0), latest: (.latestRevision // false)}]}' <<<"$description")
  services_json=$(jq -c --argjson entry "$entry" '. + [$entry]' <<<"$services_json")
done
job_description=$(gcloud run jobs describe "$BOOTSTRAP_JOB" --project "$PROJECT_ID" --region "$REGION" --format=json)
job_json=$(jq -c --arg name "$BOOTSTRAP_JOB" '{name: $name, image: (.spec.template.template.spec.template.spec.containers[0].image // .spec.template.template.spec.containers[0].image // null)}' <<<"$job_description")
manifest=$(jq -n --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg release_sha "$RELEASE_SHA" --arg project "$PROJECT_ID" --arg region "$REGION" --argjson services "$services_json" --argjson bootstrap_job "$job_json" '{schema_version: 1, generated_at: $generated_at, release_sha: $release_sha, project: $project, region: $region, services: $services, bootstrap_job: $bootstrap_job}')
if [[ -n "$OUTPUT_PATH" ]]; then mkdir -p "$(dirname "$OUTPUT_PATH")"; printf '%s\n' "$manifest" >"$OUTPUT_PATH"; printf 'Release manifest written to %s\n' "$OUTPUT_PATH" >&2; else printf '%s\n' "$manifest"; fi
