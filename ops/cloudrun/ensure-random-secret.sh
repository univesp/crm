#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
SECRET_NAME=${SECRET_NAME:-}

[[ -n "${PROJECT_ID}" && -n "${SECRET_NAME}" ]] || {
	printf 'GCP_PROJECT_ID and SECRET_NAME are required.\n' >&2
	exit 1
}

if ! gcloud secrets describe "${SECRET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
	gcloud secrets create "${SECRET_NAME}" \
		--project "${PROJECT_ID}" \
		--replication-policy automatic >/dev/null
fi

if ! gcloud secrets versions describe latest \
	--secret "${SECRET_NAME}" \
	--project "${PROJECT_ID}" \
	--format='value(state)' 2>/dev/null | grep -qx ENABLED; then
	openssl rand -hex 32 |
		gcloud secrets versions add "${SECRET_NAME}" \
			--project "${PROJECT_ID}" \
			--data-file=- >/dev/null
fi

printf '%s\n' "${SECRET_NAME}"
