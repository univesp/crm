#!/usr/bin/env bash
set -Eeuo pipefail

CRM_ROOT="${CRM_ROOT:-/var/crm}"
DOMAIN="${DOMAIN:-homolog-crm.univesp.br}"
BENCH_DIR="${BENCH_DIR:-$CRM_ROOT/frappe-bench}"
SITE="${SITE:-crm.localhost}"
REPO_DIR="${REPO_DIR:-$CRM_ROOT/repository}"
GATEWAY_DIR="${GATEWAY_DIR:-$CRM_ROOT/sso-gateway}"
VUE_DIR="${VUE_DIR:-$CRM_ROOT/univesp-frontend}"
MODE="${MODE:-prepare}"
MIN_FRAPPE_VERSION="15.109.0"
failures=0
warnings=0

ok() { printf '[OK] %s\n' "$*"; }
warn() { printf '[AVISO] %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf '[ERRO] %s\n' "$*" >&2; failures=$((failures + 1)); }

require_command() {
  if command -v "$1" >/dev/null 2>&1; then ok "Comando disponivel: $1"; else fail "Comando ausente: $1"; fi
}

require_file() {
  if [[ -f "$1" ]]; then ok "Arquivo encontrado: $1"; else fail "Arquivo ausente: $1"; fi
}

env_value() {
  local key=$1
  awk -v key="$key" 'index($0, key "=") == 1 { print substr($0, length(key) + 2); exit }' "$GATEWAY_DIR/.env"
}

for command_name in git node npm python3 curl rsync supervisorctl bench; do
  require_command "$command_name"
done

require_file "$BENCH_DIR/sites/$SITE/site_config.json"
require_file "$REPO_DIR/univesp_atendimento_app/pyproject.toml"
require_file "$REPO_DIR/sso-gateway/package-lock.json"
require_file "$REPO_DIR/ops/vm/nginx/homolog-crm.univesp.br.conf"
require_file "$GATEWAY_DIR/.env"

if [[ -d "$BENCH_DIR" ]]; then
  cd "$BENCH_DIR"
  frappe_version="$(bench version 2>/dev/null | awk '$1 == "frappe" {print $2}')"
  if [[ -n "$frappe_version" ]] &&
    [[ "$(printf '%s\n%s\n' "$MIN_FRAPPE_VERSION" "$frappe_version" | sort -V | head -n1)" == "$MIN_FRAPPE_VERSION" ]] &&
    [[ "$frappe_version" == 15.* ]]; then
    ok "Frappe compativel: $frappe_version"
  else
    fail "Frappe deve estar na linha 15 e ser >= $MIN_FRAPPE_VERSION; encontrado: ${frappe_version:-desconhecido}"
  fi

  installed_apps="$(bench --site "$SITE" list-apps 2>/dev/null | awk '{print $1}' || true)"
  for app_name in telephony helpdesk univesp_atendimento; do
    if grep -qx "$app_name" <<<"$installed_apps"; then
      ok "App instalado: $app_name"
    elif [[ "$MODE" == "post-install" ]]; then
      fail "App obrigatorio ainda nao instalado: $app_name"
    else
      warn "App sera instalado na implantacao: $app_name"
    fi
  done

  site_config="$(bench --site "$SITE" show-config 2>/dev/null || true)"
  if grep -q 'univesp_bff_shared_secret' <<<"$site_config"; then
    ok "Segredo BFF configurado no site (valor oculto)"
  else
    fail "Configure univesp_bff_shared_secret no site"
  fi
fi

if [[ -f "$GATEWAY_DIR/.env" ]]; then
  required_env=(
    NODE_ENV SESSION_SECRET JWT_SECRET APP_BASE_URL GATEWAY_REDIS_URL
    FRAPPE_ORIGIN FRAPPE_SITE_NAME FRAPPE_API_KEY FRAPPE_API_SECRET
    UNIVESP_BFF_SHARED_SECRET UNIVESP_EDGE_SHARED_SECRET
    AZURE_REDIRECT_URI AZURE_ADMIN_CLIENT_ID AZURE_ADMIN_TENANT_ID
    AZURE_ADMIN_CLIENT_SECRET AZURE_ACADEMICO_CLIENT_ID
    AZURE_ACADEMICO_TENANT_ID AZURE_ACADEMICO_CLIENT_SECRET
    SAML_IDP_SSO_URL SAML_IDP_CERT SAML_ACS_URL SAML_ENTITY_ID
  )
  for key in "${required_env[@]}"; do
    if [[ -n "$(env_value "$key")" ]]; then ok "Gateway configurado: $key"; else fail "Gateway sem valor para: $key"; fi
  done

  [[ "$(env_value NODE_ENV)" == "production" ]] || fail "NODE_ENV deve ser production"
  [[ "$(env_value APP_BASE_URL)" == "https://homolog-crm.univesp.br" ]] || fail "APP_BASE_URL deve usar o dominio oficial HTTPS"
fi

available_kb="$(df -Pk "$CRM_ROOT" 2>/dev/null | awk 'NR == 2 {print $4}')"
if [[ "$available_kb" =~ ^[0-9]+$ ]] && (( available_kb >= 5242880 )); then
  ok "Espaco livre superior a 5 GB"
else
  fail "A VM precisa de pelo menos 5 GB livres para backup e build"
fi

if [[ -f "$VUE_DIR/dist/index.html" ]]; then
  ok "Build Vue encontrado"
elif [[ "$MODE" == "post-install" ]]; then
  fail "Build Vue ausente em $VUE_DIR/dist"
else
  warn "Build Vue ainda precisa ser publicado"
fi

if [[ "$MODE" == "post-install" ]]; then
  if curl --fail --silent --show-error http://127.0.0.1:4000/health >/dev/null; then
    ok "Gateway respondeu na porta 4000"
  else
    fail "Gateway nao respondeu na porta 4000"
  fi
  if curl --fail --silent --show-error --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/healthz" >/dev/null; then
    ok "Origem HTTPS respondeu na porta 443"
  else
    fail "Origem HTTPS nao respondeu na porta 443"
  fi
  if supervisorctl status sso-gateway 2>/dev/null | grep -q RUNNING; then
    ok "Supervisor informa Gateway RUNNING"
  else
    fail "Gateway nao esta RUNNING no Supervisor"
  fi
fi

printf '\nResumo: %d erro(s), %d aviso(s).\n' "$failures" "$warnings"
(( failures == 0 ))
