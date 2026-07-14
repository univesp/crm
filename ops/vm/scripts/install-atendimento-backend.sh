#!/usr/bin/env bash
set -euo pipefail

CRM_ROOT="${CRM_ROOT:-/var/crm}"
BENCH_DIR="${BENCH_DIR:-$CRM_ROOT/frappe-bench}"
SITE="${SITE:-crm.localhost}"
SOURCE_APP="${SOURCE_APP:-$CRM_ROOT/repository/univesp_atendimento_app}"
TARGET_APP="$BENCH_DIR/apps/univesp_atendimento"
HELPDESK_REF="${HELPDESK_REF:-6b423f8fba6d4c7f8ff5db56f197243f6549d450}"
TELEPHONY_REF="${TELEPHONY_REF:-58d32184e44b193e27498d3dd156085c793b7528}"
MIN_FRAPPE_VERSION="15.109.0"
SKIP_RESTART="${SKIP_RESTART:-0}"

fetch_app_ref() {
  local app_dir="$1"
  local ref="$2"
  local remote

  remote="$(git -C "$app_dir" remote | head -n1)"
  if [[ -z "$remote" ]]; then
    echo "App sem remoto Git: $app_dir" >&2
    exit 1
  fi

  git -C "$app_dir" fetch --depth 1 "$remote" "$ref"
  git -C "$app_dir" checkout --detach "$ref"
}

if [[ ! -d "$BENCH_DIR" || ! -f "$BENCH_DIR/sites/$SITE/site_config.json" ]]; then
  echo "Bench/site nao encontrado: $BENCH_DIR/sites/$SITE" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_APP/pyproject.toml" ]]; then
  echo "App fonte nao encontrado: $SOURCE_APP" >&2
  exit 1
fi

cd "$BENCH_DIR"

frappe_version="$(bench version | awk '$1 == "frappe" {print $2}')"
if [[ -z "$frappe_version" || "$(printf '%s\n%s\n' "$MIN_FRAPPE_VERSION" "$frappe_version" | sort -V | head -n1)" != "$MIN_FRAPPE_VERSION" ]]; then
  echo "Frappe $MIN_FRAPPE_VERSION ou superior e obrigatorio; encontrado: ${frappe_version:-desconhecido}." >&2
  exit 1
fi

if ! bench --site "$SITE" show-config | grep -q 'univesp_bff_shared_secret'; then
  echo "Configure univesp_bff_shared_secret no site antes de instalar." >&2
  exit 1
fi

bench --site "$SITE" backup --with-files

if [[ ! -d apps/telephony ]]; then
  bench get-app telephony https://github.com/frappe/telephony
fi

fetch_app_ref apps/telephony "$TELEPHONY_REF"

if [[ ! -d apps/helpdesk ]]; then
  bench get-app --branch main helpdesk https://github.com/frappe/helpdesk
fi

fetch_app_ref apps/helpdesk "$HELPDESK_REF"

mkdir -p "$TARGET_APP"
rsync -a --delete --exclude '.git/' --exclude '__pycache__/' "$SOURCE_APP/" "$TARGET_APP/"

bench setup requirements telephony
bench setup requirements helpdesk
bench setup requirements univesp_atendimento

if ! bench --site "$SITE" list-apps | grep -qx telephony; then
  bench --site "$SITE" install-app telephony
fi

if ! bench --site "$SITE" list-apps | grep -qx helpdesk; then
  bench --site "$SITE" install-app helpdesk
fi

if ! bench --site "$SITE" list-apps | grep -qx univesp_atendimento; then
  bench --site "$SITE" install-app univesp_atendimento
fi

bench --site "$SITE" migrate
bench build --app telephony --app helpdesk --app univesp_atendimento
if [[ "$SKIP_RESTART" != "1" ]]; then
  bench restart
fi
bench --site "$SITE" list-apps
