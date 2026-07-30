#!/usr/bin/env bash
set -Eeuo pipefail

source /usr/local/bin/common.sh

start_cloud_sql_proxy
bootstrap_site

if [[ "${FAQ_V3_HOMOLOG_PILOT_ENABLED:-false}" == "true" ]]; then
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.verify_public_email_transport
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.bootstrap_faq_v3_pilot \
		--kwargs '{"confirmation":"homolog-faq-v3"}'
	bench --site "${SITE_NAME}" execute \
		univesp_atendimento.homolog_seed.inspect_faq_v3_pilot
fi
