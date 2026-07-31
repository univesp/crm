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
CONFIG=$(bench --site "$SITE" get-config 2>/dev/null || true)
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
