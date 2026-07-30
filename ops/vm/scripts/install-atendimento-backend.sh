#!/usr/bin/env bash
# Instala/atualiza univesp_atendimento no bench Frappe (VM homolog).
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/var/crm/repository}"
BENCH_PATH="${BENCH_PATH:-/var/crm/frappe-bench}"
SITE="${FRAPPE_SITE:-crm.localhost}"
APP_SRC="${REPO_ROOT}/univesp_atendimento_app/univesp_atendimento"
APP_DEST="${BENCH_PATH}/apps/univesp_atendimento/univesp_atendimento"

echo "==> Git safe.directory (evita dubious ownership no bench/telephony)"
for dir in \
	"$REPO_ROOT" \
	"${BENCH_PATH}/apps/univesp_atendimento" \
	"${BENCH_PATH}/apps/helpdesk" \
	"${BENCH_PATH}/apps/telephony" \
	"${BENCH_PATH}/apps/frappe"
do
	if [[ -d "$dir" ]]; then
		sudo -u frappe git config --global --add safe.directory "$dir" 2>/dev/null || true
	fi
done

echo "==> Rsync app univesp_atendimento"
sudo rsync -a --delete \
	--exclude='__pycache__' \
	--exclude='*.pyc' \
	--exclude='.ruff_cache' \
	"${APP_SRC}/" "${APP_DEST}/"

echo "==> Migrate + seeds homolog"
sudo -u frappe bash -lc "
cd '${BENCH_PATH}' &&
bench --site '${SITE}' migrate &&
bench --site '${SITE}' execute univesp_atendimento.homolog_seed.upsert_homolog_access_profiles &&
bench --site '${SITE}' execute univesp_atendimento.homolog_seed.upsert_homolog_student_directory
"

echo "==> Restart Frappe services"
sudo supervisorctl restart 'frappe-bench:*'
sleep 3
sudo supervisorctl status 'frappe-bench:*' | grep -q RUNNING

echo "Backend atualizado em ${SITE}"
