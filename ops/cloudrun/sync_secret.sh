#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
SECRET_NAME=${SECRET_NAME:-}
SECRET_VALUE=${SECRET_VALUE:-}

if [[ -z "${PROJECT_ID}" || -z "${SECRET_NAME}" ]]; then
	printf 'GCP_PROJECT_ID and SECRET_NAME are required.\n' >&2
	exit 1
fi

if ! gcloud secrets describe "${SECRET_NAME}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
	gcloud secrets create "${SECRET_NAME}" \
		--project "${PROJECT_ID}" \
		--replication-policy automatic >/dev/null
fi

printf '%s' "${SECRET_VALUE}" | gcloud secrets versions add "${SECRET_NAME}" \
	--project "${PROJECT_ID}" \
	--data-file=- >/dev/null
