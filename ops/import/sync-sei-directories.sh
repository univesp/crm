#!/usr/bin/env bash
# Sync diario SEI → CRM (Student + Staff Directory). Nao e realtime.
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/var/crm/repository}"
SITE="${FRAPPE_SITE_NAME:-crm.localhost}"
PYTHON="${TRINO_PYTHON:-python3}"
APPLY="${SYNC_APPLY:-1}"
SYNC_PROFILES="${SYNC_STAFF_PROFILES:-1}"
LOG_DIR="${SYNC_LOG_DIR:-/var/log/crm-sei-sync}"

mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/sync-$STAMP.log"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "== CRM SEI sync $STAMP site=$SITE =="

if [[ -f "$REPO_DIR/ops/import/.env.trino" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_DIR/ops/import/.env.trino"
  set +a
fi

cd "$REPO_DIR"

STUDENT_ARGS=(ops/import/students-from-trino.py --full --site "$SITE")
STAFF_ARGS=(ops/import/staff-from-trino.py --full --site "$SITE")

if [[ "$APPLY" == "1" ]]; then
  STUDENT_ARGS+=(--apply)
  STAFF_ARGS+=(--apply)
  if [[ "$SYNC_PROFILES" == "1" ]]; then
    STAFF_ARGS+=(--sync-profiles)
  fi
else
  STUDENT_ARGS+=(--dry-run)
  STAFF_ARGS+=(--dry-run)
fi

echo "-- students"
"$PYTHON" "${STUDENT_ARGS[@]}"
STUDENT_RC=$?

echo "-- staff"
"$PYTHON" "${STAFF_ARGS[@]}"
STAFF_RC=$?

if [[ "$STUDENT_RC" -ne 0 || "$STAFF_RC" -ne 0 ]]; then
  echo "sync FAILED student=$STUDENT_RC staff=$STAFF_RC"
  exit 1
fi

echo "sync OK log=$LOG_FILE"
