#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
DEPLOYER_SERVICE_ACCOUNT=${DEPLOYER_SERVICE_ACCOUNT:-}
ACTION=${ACTION:-check}
CONFIRM_IAM=${CONFIRM_IAM:-}
CONFIRM_IAM_ROLLBACK=${CONFIRM_IAM_ROLLBACK:-}
STATE_PATH=${STATE_PATH:-tmp-homolog-iam-grants.json}
OUTPUT_PATH=${OUTPUT_PATH:-}
roles=(roles/cloudsql.client roles/storage.bucketViewer roles/vpcaccess.user roles/compute.viewer)

[[ -n "$PROJECT_ID" ]] || { printf 'GCP_PROJECT_ID is required.\n' >&2; exit 1; }
[[ "$DEPLOYER_SERVICE_ACCOUNT" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$ ]] || {
  printf 'DEPLOYER_SERVICE_ACCOUNT must be a service account email.\n' >&2
  exit 1
}
for command_name in gcloud jq; do
  command -v "$command_name" >/dev/null || { printf '%s is required.\n' "$command_name" >&2; exit 1; }
done
[[ "$ACTION" =~ ^(check|apply|revoke)$ ]] || { printf 'ACTION must be check, apply or revoke.\n' >&2; exit 1; }

policy_json=$(mktemp)
trap 'rm -f "$policy_json"' EXIT
member="serviceAccount:${DEPLOYER_SERVICE_ACCOUNT}"

load_policy() {
  gcloud projects get-iam-policy "$PROJECT_ID" --format=json >"$policy_json"
}

has_direct_binding() {
  jq -e --arg role "$1" --arg member "$member" \
    '(.bindings // []) | any(.role == $role and any(.members[]?; . == $member))' "$policy_json" >/dev/null
}

write_json() {
  local payload=$1
  if [[ -n "$OUTPUT_PATH" ]]; then
    mkdir -p "$(dirname "$OUTPUT_PATH")"
    printf '%s\n' "$payload" >"$OUTPUT_PATH"
  else
    printf '%s\n' "$payload"
  fi
}

load_policy
missing='[]'
for role in "${roles[@]}"; do
  has_direct_binding "$role" || missing=$(jq -c --arg role "$role" '. + [$role]' <<<"$missing")
done

if [[ "$ACTION" == apply ]]; then
  [[ "$CONFIRM_IAM" == homolog ]] || { printf 'Set CONFIRM_IAM=homolog to apply grants.\n' >&2; exit 1; }
  mkdir -p "$(dirname "$STATE_PATH")"
  jq -n --arg project "$PROJECT_ID" --arg service_account "$DEPLOYER_SERVICE_ACCOUNT" \
    --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{schema_version:1,project:$project,service_account:$service_account,generated_at:$generated_at,roles_added:[]}' >"$STATE_PATH"
  while IFS= read -r role; do
    [[ -n "$role" ]] || continue
    gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "$member" --role "$role" --quiet >/dev/null
    state_tmp="${STATE_PATH}.tmp"
    jq --arg role "$role" '.roles_added += [$role]' "$STATE_PATH" >"$state_tmp"
    mv "$state_tmp" "$STATE_PATH"
  done < <(jq -r '.[]' <<<"$missing")
  load_policy
elif [[ "$ACTION" == revoke ]]; then
  [[ "$CONFIRM_IAM_ROLLBACK" == homolog ]] || { printf 'Set CONFIRM_IAM_ROLLBACK=homolog to revoke grants.\n' >&2; exit 1; }
  [[ -f "$STATE_PATH" ]] || { printf 'Rollback state file not found: %s\n' "$STATE_PATH" >&2; exit 1; }
  jq -e --arg project "$PROJECT_ID" --arg service_account "$DEPLOYER_SERVICE_ACCOUNT" \
    '.schema_version == 1 and .project == $project and .service_account == $service_account and (.roles_added | type == "array")' \
    "$STATE_PATH" >/dev/null || { printf 'Rollback state does not match project/service account.\n' >&2; exit 1; }
  while IFS= read -r role; do
    [[ -n "$role" ]] || continue
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" --member "$member" --role "$role" --quiet >/dev/null
  done < <(jq -r '.roles_added[]' "$STATE_PATH")
  load_policy
fi

checks='[]'; failures=0
for role in "${roles[@]}"; do
  if has_direct_binding "$role"; then status=pass; detail=direct-binding; else status=fail; detail=missing-direct-binding; failures=$((failures+1)); fi
  checks=$(jq -c --arg role "$role" --arg status "$status" --arg detail "$detail" '. + [{role:$role,status:$status,detail:$detail}]' <<<"$checks")
done
result=$(jq -n --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg action "$ACTION" \
  --arg project "$PROJECT_ID" --arg service_account "$DEPLOYER_SERVICE_ACCOUNT" --argjson failures "$failures" --argjson checks "$checks" \
  '{schema_version:1,generated_at:$generated_at,action:$action,project:$project,service_account:$service_account,passed:($failures==0),failure_count:$failures,checks:$checks}')
write_json "$result"
((failures == 0))
