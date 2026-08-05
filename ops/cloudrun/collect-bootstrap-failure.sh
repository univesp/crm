#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
BOOTSTRAP_JOB=${BOOTSTRAP_JOB:-crm-homolog-bootstrap}
EVIDENCE_DIR=${EVIDENCE_DIR:-artifacts/homolog/bootstrap-failure}

if [[ -z "${PROJECT_ID}" ]]; then
	printf 'GCP_PROJECT_ID is required to collect bootstrap failure diagnostics.\n' >&2
	exit 1
fi

mkdir -p "${EVIDENCE_DIR}"

execution=${EXECUTION_NAME:-}
if [[ -z "${execution}" ]]; then
	execution=$(
		gcloud run jobs executions list \
			--job "${BOOTSTRAP_JOB}" \
			--project "${PROJECT_ID}" \
			--region "${REGION}" \
			--sort-by='~metadata.creationTimestamp' \
			--limit 1 \
			--format='value(metadata.name)' 2>/dev/null || true
	)
fi

output="${EVIDENCE_DIR}/bootstrap-failure.log"
{
	printf 'job=%s\nexecution=%s\n' "${BOOTSTRAP_JOB}" "${execution:-unavailable}"
	if [[ -n "${execution}" ]]; then
		gcloud run jobs executions describe "${execution}" \
			--project "${PROJECT_ID}" \
			--region "${REGION}" \
			--format='yaml(metadata.name,status.conditions,status.logUri,status.startTime,status.completionTime)' || true
		gcloud logging read \
			"resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${BOOTSTRAP_JOB}\" AND labels.\"run.googleapis.com/execution_name\"=\"${execution}\"" \
			--project "${PROJECT_ID}" \
			--freshness=60m \
			--limit=200 \
			--order=asc \
			--format='value(timestamp,severity,textPayload,jsonPayload.message)' || true
	fi
	if [[ -n "${SITES_BUCKET:-}" ]]; then
		printf '\n--- bootstrap-progress.log (GCS) ---\n'
		gsutil cat "gs://${SITES_BUCKET}/bootstrap-progress.log" 2>/dev/null || true
		if [[ -n "${FRAPPE_SITE_NAME:-}" ]]; then
			gsutil cat "gs://${SITES_BUCKET}/${FRAPPE_SITE_NAME}/bootstrap-progress.log" 2>/dev/null || true
		fi
	fi
} > "${output}" 2>&1

printf 'Bootstrap failure diagnostics written to %s\n' "${output}"
