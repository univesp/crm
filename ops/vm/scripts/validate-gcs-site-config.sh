#!/usr/bin/env bash
# Valida chaves GCS/S3 no site_config Frappe (nao exige bucket acessivel).
set -Eeuo pipefail

SITE=${1:-${FRAPPE_SITE_NAME:-crm.localhost}}
BENCH_DIR=${BENCH_DIR:-/var/crm/frappe-bench}
REQUIRED_KEYS=(file_storage s3_bucket s3_key s3_secret s3_endpoint_url)

if [[ ! -d "$BENCH_DIR" ]]; then
  printf 'ERRO: bench nao encontrado em %s\n' "$BENCH_DIR" >&2
  exit 1
fi

cd "$BENCH_DIR"
SITE_CONFIG="${BENCH_DIR}/sites/${SITE}/site_config.json"
if [[ -r "$SITE_CONFIG" ]]; then
  CONFIG=$(cat "$SITE_CONFIG")
elif command -v bench >/dev/null 2>&1; then
  CONFIG=$(bench --site "$SITE" show-config 2>/dev/null || true)
else
  CONFIG=""
fi
if [[ -z "$CONFIG" ]] && id frappe >/dev/null 2>&1; then
  CONFIG=$(sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' show-config" 2>/dev/null || true)
fi
if [[ -z "$CONFIG" ]]; then
  printf 'ERRO: nao foi possivel ler site_config de %s\n' "$SITE" >&2
  exit 1
fi

missing=0
for key in "${REQUIRED_KEYS[@]}"; do
  if echo "$CONFIG" | grep -q "\"$key\""; then
    printf 'OK   %s presente\n' "$key"
  else
    printf 'FALTA %s\n' "$key"
    missing=$((missing + 1))
  fi
done

if [[ $missing -gt 0 ]]; then
  printf '\n%d chave(s) ausente(s). Ver docs/ops/gcs-frappe-site-config.example.md\n' "$missing"
  exit 1
fi

printf '\nGCS site_config OK para %s\n' "$SITE"
