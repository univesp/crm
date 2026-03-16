#!/usr/bin/env bash
set -Eeuo pipefail

ZONE_ID=${CLOUDFLARE_ZONE_ID:-}
TOKEN=${CLOUDFLARE_API_TOKEN:-}
MAPPING_JSON=${1:-}

if [[ -z "${ZONE_ID}" || -z "${TOKEN}" || -z "${MAPPING_JSON}" ]]; then
	printf 'Usage: CLOUDFLARE_ZONE_ID=... CLOUDFLARE_API_TOKEN=... %s <domain-mapping.json>\n' "$0" >&2
	exit 1
fi

api() {
	local method=$1
	local url=$2
	local payload=${3:-}

	if [[ -n "${payload}" ]]; then
		curl -fsS -X "${method}" "${url}" \
			-H "Authorization: Bearer ${TOKEN}" \
			-H 'Content-Type: application/json' \
			--data "${payload}"
	else
		curl -fsS -X "${method}" "${url}" \
			-H "Authorization: Bearer ${TOKEN}" \
			-H 'Content-Type: application/json'
	fi
}

jq -c '.status.resourceRecords[]' "${MAPPING_JSON}" | while read -r row; do
	name=$(jq -r '.name' <<<"${row}" | sed 's/\.$//')
	type=$(jq -r '.type' <<<"${row}")
	content=$(jq -r '.rrdata' <<<"${row}" | sed 's/\.$//')

	payload=$(jq -cn \
		--arg name "${name}" \
		--arg type "${type}" \
		--arg content "${content}" \
		'{name: $name, type: $type, content: $content, ttl: 1, proxied: false}')

	existing=$(api GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=${type}&name=${name}")
	record_id=$(jq -r '.result[0].id // empty' <<<"${existing}")

	if [[ -n "${record_id}" ]]; then
		api PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record_id}" "${payload}" >/dev/null
		printf 'Updated Cloudflare DNS %s %s -> %s\n' "${type}" "${name}" "${content}"
	else
		api POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" "${payload}" >/dev/null
		printf 'Created Cloudflare DNS %s %s -> %s\n' "${type}" "${name}" "${content}"
	fi
done
