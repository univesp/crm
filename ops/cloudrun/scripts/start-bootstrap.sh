#!/usr/bin/env bash
set -Eeuo pipefail

source /usr/local/bin/common.sh

on_bootstrap_error() {
	log "Bootstrap failed at line ${1} with exit code ${2}"
}
trap 'on_bootstrap_error ${LINENO} $?' ERR

log "Phase: start_cloud_sql_proxy"
start_cloud_sql_proxy
log "Phase: bootstrap_site"
bootstrap_site
log "Phase: bootstrap_site complete"

if [[ "${FAQ_V3_HOMOLOG_PILOT_ENABLED:-false}" == "true" ]]; then
	log "Phase: verify_public_email_transport"
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.verify_public_email_transport
	log "Phase: bootstrap_faq_v3_pilot"
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.bootstrap_faq_v3_pilot \
		--kwargs '{"confirmation":"homolog-faq-v3"}'
	log "Phase: inspect_faq_v3_pilot"
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.inspect_faq_v3_pilot
fi

log "Bootstrap finished successfully"
