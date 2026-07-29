#!/usr/bin/env bash
set -Eeuo pipefail

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
: "${GCP_REGION:?GCP_REGION is required}"
: "${BOOTSTRAP_JOB:=crm-homolog-bootstrap}"

execution_name=$(
	gcloud run jobs execute "${BOOTSTRAP_JOB}" \
		--project "${GCP_PROJECT_ID}" \
		--region "${GCP_REGION}" \
		--wait \
		--format='value(metadata.name)'
)

test -n "${execution_name}"
logs=$(
	gcloud logging read \
		"resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"${BOOTSTRAP_JOB}\" AND labels.execution_name=\"${execution_name}\"" \
		--project "${GCP_PROJECT_ID}" \
		--limit 200 \
		--format='value(textPayload)'
)

printf '%s\n' "${logs}"
grep -q '"published_version": "acesso-ava-homolog-v1"' <<<"${logs}"
grep -q '"aluno": \["acesso-ava-seed"\]' <<<"${logs}"
grep -q '"op": \["op-playbook-matricula-seed"\]' <<<"${logs}"
grep -q '"publico": \["publico-atendimento-seed"\]' <<<"${logs}"
grep -q '"knowledge_v3_read": true' <<<"${logs}"
grep -q '"knowledge_media_upload": true' <<<"${logs}"
grep -q '"atendimento-geral": true' <<<"${logs}"
grep -q '"sra": true' <<<"${logs}"
