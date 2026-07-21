#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
EVIDENCE_DIR=${EVIDENCE_DIR:-artifacts/homolog/$(date -u +%Y%m%dT%H%M%SZ)}
mkdir -p "$EVIDENCE_DIR"
PREFLIGHT_MODE=gcp CHECK_DEPLOYED_SERVICES=true OUTPUT_PATH="$EVIDENCE_DIR/preflight.json" "$SCRIPT_DIR/preflight-homolog.sh"
OUTPUT_PATH="$EVIDENCE_DIR/release-manifest.json" "$SCRIPT_DIR/release-manifest.sh"
OUTPUT_PATH="$EVIDENCE_DIR/smoke.json" "$SCRIPT_DIR/smoke-homolog.sh"
(cd "$EVIDENCE_DIR"; sha256sum preflight.json release-manifest.json smoke.json >SHA256SUMS)
jq -n --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg evidence_dir "$EVIDENCE_DIR" '{schema_version: 1, generated_at: $generated_at, evidence_dir: $evidence_dir, passed: true, files: ["preflight.json", "release-manifest.json", "smoke.json", "SHA256SUMS"]}' >"$EVIDENCE_DIR/summary.json"
printf 'Homolog evidence written to %s\n' "$EVIDENCE_DIR"
