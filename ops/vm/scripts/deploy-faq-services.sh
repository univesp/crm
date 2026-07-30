#!/usr/bin/env bash
set -Eeuo pipefail

CRM_ROOT="${CRM_ROOT:-/var/crm}"
REPO_ROOT="${REPO_ROOT:-$CRM_ROOT/repository}"
BENCH_PATH="${BENCH_PATH:-$CRM_ROOT/frappe-bench}"
SITE="${FRAPPE_SITE:-crm.localhost}"
CONFIG_DIR="${FAQ_SERVICES_CONFIG_DIR:-$CRM_ROOT/faq-services}"
ENV_FILE="$CONFIG_DIR/.env"
COMPOSE_FILE="$REPO_ROOT/ops/vm/docker-compose.faq-services.yml"
GATEWAY_ENV="${GATEWAY_ENV:-$CRM_ROOT/sso-gateway/.env}"

if [[ "$(id -u)" -ne 0 ]]; then
	printf 'Execute como root para configurar os serviços FAQ da VM.\n' >&2
	exit 1
fi
for command_name in docker openssl curl sudo supervisorctl; do
	command -v "$command_name" >/dev/null || {
		printf 'Comando obrigatório ausente: %s\n' "$command_name" >&2
		exit 1
	}
done
if docker compose version >/dev/null 2>&1; then
	compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
	compose=(docker-compose)
else
	printf 'Docker Compose obrigatório ausente.\n' >&2
	exit 1
fi
[[ -f "$COMPOSE_FILE" && -f "$GATEWAY_ENV" ]] || {
	printf 'Compose FAQ ou ambiente do gateway ausente.\n' >&2
	exit 1
}

install -d -m 0700 "$CONFIG_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
	umask 077
	{
		printf 'ANTIMALWARE_TOKEN=%s\n' "$(openssl rand -hex 32)"
		printf 'MEDIA_PROCESSOR_TOKEN=%s\n' "$(openssl rand -hex 32)"
		printf 'PUBLIC_EMAIL_REPLY_SECRET=%s\n' "$(openssl rand -hex 32)"
		printf 'UNIVESP_INGRESS_SHARED_SECRET=%s\n' "$(openssl rand -hex 32)"
		printf 'ANTIMALWARE_PORT=18081\n'
		printf 'MEDIA_PROCESSOR_PORT=18082\n'
	} >"$ENV_FILE"
fi
chmod 0600 "$ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
for name in ANTIMALWARE_TOKEN MEDIA_PROCESSOR_TOKEN PUBLIC_EMAIL_REPLY_SECRET UNIVESP_INGRESS_SHARED_SECRET; do
	value="${!name}"
	[[ ${#value} -ge 32 ]] || {
		printf 'Segredo inválido no ambiente FAQ: %s\n' "$name" >&2
		exit 1
	}
done

"${compose[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build
for attempt in $(seq 1 24); do
	if curl -fsS "http://127.0.0.1:${ANTIMALWARE_PORT}/health" >/dev/null &&
		curl -fsS "http://127.0.0.1:${MEDIA_PROCESSOR_PORT}/health" >/dev/null; then
		break
	fi
	[[ "$attempt" -lt 24 ]] || {
		printf 'Serviços FAQ locais não ficaram saudáveis.\n' >&2
		exit 1
	}
	sleep 5
done

set_gateway_value() {
	local key=$1
	local value=$2
	if grep -q "^${key}=" "$GATEWAY_ENV"; then
		sed -i "s|^${key}=.*|${key}=${value}|" "$GATEWAY_ENV"
	else
		printf '%s=%s\n' "$key" "$value" >>"$GATEWAY_ENV"
	fi
}
set_gateway_value UNIVESP_INGRESS_SHARED_SECRET "$UNIVESP_INGRESS_SHARED_SECRET"

set_site_config() {
	sudo -u frappe bash -lc \
		"cd '$BENCH_PATH' && bench --site '$SITE' set-config '$1' '$2'"
}
set_site_config antimalware_endpoint "http://127.0.0.1:${ANTIMALWARE_PORT}/scan"
set_site_config antimalware_token "$ANTIMALWARE_TOKEN"
set_site_config media_processor_endpoint "http://127.0.0.1:${MEDIA_PROCESSOR_PORT}/convert-gif"
set_site_config media_processor_token "$MEDIA_PROCESSOR_TOKEN"
set_site_config public_email_reply_secret "$PUBLIC_EMAIL_REPLY_SECRET"
set_site_config univesp_ingress_shared_secret "$UNIVESP_INGRESS_SHARED_SECRET"
set_site_config public_reply_domain "homolog-crm.univesp.br"
set_site_config auto_email_id "crm-homolog-service@univesp.br"
set_site_config mail_server "relay.univesp.br"
set_site_config mail_port "587"
set_site_config use_tls "true"
set_site_config use_ssl "false"
set_site_config no_smtp_authentication "true"
set_site_config mute_emails "false"

supervisorctl restart sso-gateway
supervisorctl restart 'frappe-bench:*'
sleep 4
curl -fsS http://127.0.0.1:4000/health >/dev/null
sudo -u frappe env DEPLOYMENT_ENV=homolog bash -lc \
	"cd '$BENCH_PATH' && bench --site '$SITE' execute univesp_atendimento.homolog_seed.verify_public_email_transport"
printf 'Serviços FAQ locais e relay de homolog configurados.\n'
