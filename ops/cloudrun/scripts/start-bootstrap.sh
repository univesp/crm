#!/usr/bin/env bash
set -Eeuo pipefail

source /usr/local/bin/common.sh

on_bootstrap_error() {
	bootstrap_progress "Bootstrap failed at line ${1} with exit code ${2}"
}
trap 'on_bootstrap_error ${LINENO} $?' ERR

bootstrap_progress "Phase: start_cloud_sql_proxy"
start_cloud_sql_proxy
bootstrap_progress "Phase: bootstrap_site"
bootstrap_site
bootstrap_progress "Phase: bootstrap_site complete"

if [[ "${FAQ_V3_HOMOLOG_PILOT_ENABLED:-false}" == "true" ]]; then
	bootstrap_progress "Phase: verify_public_email_transport"
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.verify_public_email_transport
	bootstrap_progress "Phase: bootstrap_faq_v3_pilot"
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.bootstrap_faq_v3_pilot \
		--kwargs '{"confirmation":"homolog-faq-v3"}'
	bootstrap_progress "Phase: inspect_faq_v3_pilot"
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.inspect_faq_v3_pilot
fi

bootstrap_progress "Bootstrap finished successfully"
