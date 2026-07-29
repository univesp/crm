#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
RUNTIME_SERVICE_ACCOUNT=${CLOUDRUN_RUNTIME_SERVICE_ACCOUNT:-}
ANTIMALWARE_IMAGE_URI=${ANTIMALWARE_IMAGE_URI:-}
MEDIA_PROCESSOR_IMAGE_URI=${MEDIA_PROCESSOR_IMAGE_URI:-}
ANTIMALWARE_SERVICE=${ANTIMALWARE_SERVICE:-crm-homolog-antimalware}
MEDIA_PROCESSOR_SERVICE=${MEDIA_PROCESSOR_SERVICE:-crm-homolog-media-processor}
ANTIMALWARE_TOKEN_SECRET_NAME=${ANTIMALWARE_TOKEN_SECRET_NAME:-crm-homolog-antimalware-token}
MEDIA_PROCESSOR_TOKEN_SECRET_NAME=${MEDIA_PROCESSOR_TOKEN_SECRET_NAME:-crm-homolog-media-processor-token}

for name in PROJECT_ID RUNTIME_SERVICE_ACCOUNT ANTIMALWARE_IMAGE_URI MEDIA_PROCESSOR_IMAGE_URI; do
	[[ -n "${!name:-}" ]] || {
		printf 'Missing required FAQ service variable: %s\n' "${name}" >&2
		exit 1
	}
done

deploy_service() {
	local service=$1 image=$2 token_env=$3 secret_name=$4 memory=$5 timeout=$6
	gcloud run deploy "${service}" \
		--project "${PROJECT_ID}" \
		--region "${REGION}" \
		--image "${image}" \
		--service-account "${RUNTIME_SERVICE_ACCOUNT}" \
		--no-allow-unauthenticated \
		--ingress all \
		--port 8080 \
		--cpu 1 \
		--memory "${memory}" \
		--concurrency 8 \
		--min 0 \
		--max 3 \
		--timeout "${timeout}" \
		--execution-environment gen2 \
		--set-secrets "${token_env}=${secret_name}:latest" \
		--startup-probe=timeoutSeconds=5,periodSeconds=10,failureThreshold=18,httpGet.port=8080,httpGet.path=/health \
		--quiet
	gcloud run services add-iam-policy-binding "${service}" \
		--project "${PROJECT_ID}" \
		--region "${REGION}" \
		--member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
		--role roles/run.invoker \
		--quiet >/dev/null
}

deploy_service \
	"${ANTIMALWARE_SERVICE}" "${ANTIMALWARE_IMAGE_URI}" ANTIMALWARE_TOKEN \
	"${ANTIMALWARE_TOKEN_SECRET_NAME}" 2Gi 45
deploy_service \
	"${MEDIA_PROCESSOR_SERVICE}" "${MEDIA_PROCESSOR_IMAGE_URI}" MEDIA_PROCESSOR_TOKEN \
	"${MEDIA_PROCESSOR_TOKEN_SECRET_NAME}" 1Gi 45

antimalware_url=$(gcloud run services describe "${ANTIMALWARE_SERVICE}" \
	--project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')
media_processor_url=$(gcloud run services describe "${MEDIA_PROCESSOR_SERVICE}" \
	--project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)')

[[ "${antimalware_url}" == https://* && "${media_processor_url}" == https://* ]] || {
	printf 'FAQ service URLs were not resolved.\n' >&2
	exit 1
}

printf 'ANTIMALWARE_ENDPOINT=%s/scan\n' "${antimalware_url%/}"
printf 'MEDIA_PROCESSOR_ENDPOINT=%s/convert-gif\n' "${media_processor_url%/}"
