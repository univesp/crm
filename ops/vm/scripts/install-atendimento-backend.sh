#!/usr/bin/env bash
set -euo pipefail

CRM_ROOT="${CRM_ROOT:-/var/crm}"
BENCH_DIR="${BENCH_DIR:-$CRM_ROOT/frappe-bench}"
SITE="${SITE:-crm.localhost}"
SOURCE_APP="${SOURCE_APP:-$CRM_ROOT/repository/univesp_atendimento_app}"
TARGET_APP="$BENCH_DIR/apps/univesp_atendimento"

if [[ ! -d "$BENCH_DIR" || ! -f "$BENCH_DIR/sites/$SITE/site_config.json" ]]; then
  echo "Bench/site nao encontrado: $BENCH_DIR/sites/$SITE" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_APP/pyproject.toml" ]]; then
  echo "App fonte nao encontrado: $SOURCE_APP" >&2
  exit 1
fi

cd "$BENCH_DIR"

if ! bench --site "$SITE" show-config | grep -q 'univesp_bff_shared_secret'; then
  echo "Configure univesp_bff_shared_secret no site antes de instalar." >&2
  exit 1
fi

bench --site "$SITE" backup --with-files

if [[ ! -d apps/helpdesk ]]; then
  bench get-app --branch main helpdesk https://github.com/frappe/helpdesk
fi

if [[ ! -d "$TARGET_APP" ]]; then
  cp -a "$SOURCE_APP" "$TARGET_APP"
fi

bench setup requirements --app helpdesk
bench setup requirements --app univesp_atendimento

if ! bench --site "$SITE" list-apps | grep -qx helpdesk; then
  bench --site "$SITE" install-app helpdesk
fi

if ! bench --site "$SITE" list-apps | grep -qx univesp_atendimento; then
  bench --site "$SITE" install-app univesp_atendimento
fi

bench --site "$SITE" migrate
bench build --app helpdesk --app univesp_atendimento
bench restart
bench --site "$SITE" list-apps
