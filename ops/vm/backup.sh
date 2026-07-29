#!/usr/bin/env bash
# Backup DB Frappe + manifesto para migracao GCP. Anexos no GCS nao entram no dump.
set -euo pipefail

BACKUP_DIR="${1:-./backups/vm-$(date -u +%Y%m%dT%H%M%SZ)}"
BENCH_PATH="${BENCH_PATH:-/home/frappe/frappe-bench}"
SITE="${FRAPPE_SITE_NAME:-homolog-crm.univesp.br}"

mkdir -p "$BACKUP_DIR"

if command -v bench >/dev/null 2>&1; then
  bench --site "$SITE" backup --with-files --backup-path "$BACKUP_DIR/frappe"
else
  echo "bench nao encontrado; execute no host com Frappe instalado." >&2
fi

cat >"$BACKUP_DIR/manifest.json" <<EOF
{
  "site": "$SITE",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "notes": "Anexos em GCS (GCS_BUCKET) migram separadamente."
}
EOF

echo "Backup em $BACKUP_DIR"
