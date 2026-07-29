#!/usr/bin/env bash
set -euo pipefail
CRM_ROOT="${CRM_ROOT:-/var/crm}"
SOURCE_GATEWAY="${SOURCE_GATEWAY:-$CRM_ROOT/repository/sso-gateway}"
TARGET_GATEWAY="${TARGET_GATEWAY:-$CRM_ROOT/sso-gateway}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Execute como root para atualizar arquivos e Supervisor." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_GATEWAY/package-lock.json" ]]; then
  echo "Gateway fonte nao encontrado: $SOURCE_GATEWAY" >&2
  exit 1
fi

if [[ ! -f "$TARGET_GATEWAY/.env" ]]; then
  echo "Preserve e complete $TARGET_GATEWAY/.env antes do deploy." >&2
  exit 1
fi

required=(
  SESSION_SECRET JWT_SECRET APP_BASE_URL GATEWAY_REDIS_URL
  FRAPPE_API_KEY FRAPPE_API_SECRET UNIVESP_BFF_SHARED_SECRET
  AZURE_REDIRECT_URI AZURE_ADMIN_CLIENT_ID AZURE_ADMIN_TENANT_ID
  AZURE_ADMIN_CLIENT_SECRET AZURE_ACADEMICO_CLIENT_ID
  AZURE_ACADEMICO_TENANT_ID AZURE_ACADEMICO_CLIENT_SECRET
  SAML_IDP_SSO_URL SAML_IDP_CERT SAML_ACS_URL SAML_ENTITY_ID
)
for name in "${required[@]}"; do
  if ! grep -Eq "^${name}=.+" "$TARGET_GATEWAY/.env"; then
    echo "Variavel obrigatoria ausente no Gateway: $name" >&2
    exit 1
  fi
done

rsync -a --delete \
  --exclude '.env' \
  --exclude 'node_modules/' \
  --chown=www-data:www-data \
	"$SOURCE_GATEWAY/" "$TARGET_GATEWAY/"

if [[ -d "$TARGET_GATEWAY/node_modules" ]]; then
	chown -R www-data:www-data "$TARGET_GATEWAY/node_modules"
fi
cd "$TARGET_GATEWAY"
sudo -u www-data npm ci --omit=dev
sudo -u www-data node --check src/index.js
supervisorctl restart sso-gateway
sleep 2
curl --fail --silent --show-error http://127.0.0.1:4000/health
printf '\nGateway publicado com sucesso.\n'
