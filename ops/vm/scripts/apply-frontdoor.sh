#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN=${DOMAIN:-homolog-crm.univesp.br}
REPO_ROOT=${REPO_ROOT:-/var/crm/repo}
VUE_APP_DIR=${VUE_APP_DIR:-/var/crm/univesp-frontend}
NGINX_SITE_NAME=${NGINX_SITE_NAME:-homolog-crm.univesp.br.conf}
NGINX_AVAILABLE=${NGINX_AVAILABLE:-/etc/nginx/sites-available}
NGINX_ENABLED=${NGINX_ENABLED:-/etc/nginx/sites-enabled}

log() {
	printf '[homolog-vm] %s\n' "$*"
}

require_file() {
	local path=$1
	if [[ ! -f "${path}" ]]; then
		printf 'Arquivo obrigatorio nao encontrado: %s\n' "${path}" >&2
		exit 1
	fi
}

require_dir() {
	local path=$1
	if [[ ! -d "${path}" ]]; then
		printf 'Diretorio obrigatorio nao encontrado: %s\n' "${path}" >&2
		exit 1
	fi
}

if [[ "${EUID}" -ne 0 ]]; then
	printf 'Execute com sudo para copiar configuracao e recarregar nginx.\n' >&2
	exit 1
fi

require_dir "${VUE_APP_DIR}"
require_file "${VUE_APP_DIR}/package.json"
require_file "${REPO_ROOT}/ops/vm/nginx/${NGINX_SITE_NAME}"

log "Gerando build Vue em ${VUE_APP_DIR}/dist"
cd "${VUE_APP_DIR}"
npm ci
npm run build
require_file "${VUE_APP_DIR}/dist/index.html"

log "Aplicando nginx ${DOMAIN}"
install -m 0644 \
	"${REPO_ROOT}/ops/vm/nginx/${NGINX_SITE_NAME}" \
	"${NGINX_AVAILABLE}/${NGINX_SITE_NAME}"

ln -sfn \
	"${NGINX_AVAILABLE}/${NGINX_SITE_NAME}" \
	"${NGINX_ENABLED}/${NGINX_SITE_NAME}"

nginx -t
systemctl reload nginx

log "Nginx recarregado. Testes sugeridos:"
printf 'curl -I https://%s/\n' "${DOMAIN}"
printf 'curl -I https://%s/login\n' "${DOMAIN}"
printf 'curl -i https://%s/api/me\n' "${DOMAIN}"
printf 'curl -i https://%s/api/method/frappe.auth.get_logged_user\n' "${DOMAIN}"
printf 'curl -I https://%s/crm\n' "${DOMAIN}"
