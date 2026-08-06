#!/usr/bin/env bash
# Ativa flags operacionais faltantes na VM homolog (gateway + Frappe).
set -Eeuo pipefail

CRM_ROOT="${CRM_ROOT:-/var/crm}"
REPO_ROOT="${REPO_ROOT:-$CRM_ROOT/repository}"
GATEWAY_ENV="${GATEWAY_ENV:-$CRM_ROOT/sso-gateway/.env}"
BENCH_DIR="${BENCH_DIR:-$CRM_ROOT/frappe-bench}"
SITE="${SITE:-crm.localhost}"

set_gateway_flag() {
  local key=$1
  local value=$2
  if sudo grep -q "^${key}=" "$GATEWAY_ENV"; then
    sudo sed -i "s|^${key}=.*|${key}=${value}|" "$GATEWAY_ENV"
  else
    printf '%s=%s\n' "$key" "$value" | sudo tee -a "$GATEWAY_ENV" >/dev/null
  fi
}

printf '1/5 Gateway — perfis/grupos personalizados (FAQ biblioteca usa access-groups)\n'
set_gateway_flag ENABLE_CUSTOM_PERMISSION_PROFILES true
set_gateway_flag ENABLE_PRODUCTION_SIMULATOR false
sudo chown root:www-data "$GATEWAY_ENV"
sudo chmod 640 "$GATEWAY_ENV"

printf '2/5 Frappe — migrate (DocTypes access-groups / permission profiles)\n'
sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' migrate"

printf '3/5 Frappe — flags FAQ v3 + seeds de autorização + Users Frappe\n'
sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' execute univesp_atendimento.homolog_seed.enable_homolog_faq_v3_flags"
sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' execute univesp_atendimento.homolog_seed.upsert_homolog_knowledge_authorization"
sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' execute univesp_atendimento.homolog_seed.sync_homolog_frappe_users"

printf '4/5 Reiniciar serviços\n'
sudo supervisorctl restart sso-gateway 'frappe-bench:*'
sleep 4
curl -sf http://127.0.0.1:4000/health >/dev/null

printf '5/5 Antimalware/mídia FAQ (upload de imagem exige este passo)\n'
if command -v docker >/dev/null && [[ -f "$REPO_ROOT/ops/vm/docker-compose.faq-services.yml" ]]; then
	REPO_ROOT="$REPO_ROOT" CRM_ROOT="$CRM_ROOT" bash "$REPO_ROOT/ops/vm/scripts/deploy-faq-services.sh" || {
		printf 'AVISO: deploy-faq-services falhou — upload editorial continuará bloqueado.\n' >&2
	}
else
	printf 'AVISO: Docker/compose FAQ ausente — rode deploy-faq-services.sh manualmente.\n' >&2
fi

printf '\n=== Validação ===\n'
curl -sf http://127.0.0.1:4000/api/public/v1/runtime/flags | head -c 240 || true
printf '\n...\n'
sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' execute univesp_atendimento.homolog_seed.inspect_faq_v3_pilot" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('flags:', {k:v for k,v in d.get('flags',{}).items() if k in ('knowledge_v3_write','knowledge_media_upload')})" 2>/dev/null || true
printf '\nHomolog features aplicadas. Browser: Ctrl+Shift+R e teste FAQ + upload.\n'
