#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
VPC_NETWORK=${VPC_NETWORK:-default}
VPC_CONNECTOR_RANGE=${VPC_CONNECTOR_RANGE:-10.8.0.0/28}
REDIS_URL=${REDIS_URL:-}
REDIS_FIREWALL_RULE=${REDIS_FIREWALL_RULE:-crm-homolog-redis-allow-cloudrun-ip}

for name in PROJECT_ID VPC_NETWORK VPC_CONNECTOR_RANGE REDIS_URL; do
	if [[ -z "${!name:-}" ]]; then
		printf 'Missing required Redis access variable: %s\n' "${name}" >&2
		exit 1
	fi
done

active_account=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)
if [[ -z "${active_account}" ]]; then
	printf 'No active Google Cloud account is available for Redis access provisioning.\n' >&2
	exit 1
fi
printf 'Redis access provisioner: %s\n' "${active_account}"
account_fingerprint=$(printf '%s' "${active_account}" | sha256sum | cut -c1-16)
printf 'Redis access provisioner fingerprint: %s\n' "${account_fingerprint}"

redis_target=$(
	REDIS_URL="${REDIS_URL}" node <<'NODE'
const value = String(process.env.REDIS_URL || '').trim()
let parsed
try {
  parsed = new URL(value)
} catch {
  process.stderr.write('REDIS_URL must be a valid URL.\n')
  process.exit(1)
}
if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
  process.stderr.write('REDIS_URL must use redis:// or rediss://.\n')
  process.exit(1)
}
const octets = parsed.hostname.split('.').map(Number)
const validIpv4 =
  octets.length === 4 &&
  octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
const privateIpv4 =
  validIpv4 &&
  (octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168))
if (!privateIpv4) {
  process.stderr.write('REDIS_URL must target a private IPv4 address for scoped firewall provisioning.\n')
  process.exit(1)
}
const port = parsed.port || '6379'
if (port !== '6379') {
  process.stderr.write('Scoped homolog Redis provisioning only permits port 6379.\n')
  process.exit(1)
}
process.stdout.write(parsed.hostname)
NODE
)

if gcloud compute firewall-rules describe "${REDIS_FIREWALL_RULE}" \
	--project "${PROJECT_ID}" >/dev/null 2>&1; then
	printf 'Private Redis firewall rule already exists.\n'
	exit 0
fi

create_output=$(mktemp)
trap 'rm -f "${create_output}"' EXIT

if ! gcloud compute firewall-rules create "${REDIS_FIREWALL_RULE}" \
	--project "${PROJECT_ID}" \
	--network "${VPC_NETWORK}" \
	--direction INGRESS \
	--priority 900 \
	--action ALLOW \
	--rules tcp:6379 \
	--source-ranges "${VPC_CONNECTOR_RANGE}" \
	--destination-ranges "${redis_target}/32" \
	2>"${create_output}"; then
	if grep -q "compute.firewalls.create" "${create_output}"; then
		printf 'WARNING: deploy identity lacks compute.firewalls.create; skipping Redis firewall provisioning.\n' >&2
		printf 'WARNING: ensure rule %s allows %s -> %s/32:6379 before bootstrap.\n' \
			"${REDIS_FIREWALL_RULE}" "${VPC_CONNECTOR_RANGE}" "${redis_target}" >&2
		cat "${create_output}" >&2
		exit 0
	fi
	cat "${create_output}" >&2
	exit 1
fi

printf 'Private Redis firewall rule provisioned for the Cloud Run connector range.\n'
