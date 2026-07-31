#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
MODE=${MODE:-${1:-}}
WEB_SERVICE=${WEB_SERVICE:-crm-homolog-web}
WORKER_SERVICE=${WORKER_SERVICE:-crm-homolog-worker}
SCHEDULER_SERVICE=${SCHEDULER_SERVICE:-crm-homolog-scheduler}

if [[ -z "${PROJECT_ID}" || -z "${MODE}" ]]; then
	printf 'GCP_PROJECT_ID and MODE are required. Use MODE=full or MODE=parked.\n' >&2
	exit 1
fi

update_service() {
	local service=$1
	shift

	gcloud run services update "${service}" \
		--project "${PROJECT_ID}" \
		--region "${REGION}" \
		"$@"
}

gcloud config set project "${PROJECT_ID}" >/dev/null

case "${MODE}" in
parked)
	update_service "${WEB_SERVICE}" \
		--cpu 1 \
		--memory 1Gi \
		--concurrency 20 \
		--min 0 \
		--max 1 \
		--timeout 3600 \
		--update-env-vars GUNICORN_WORKERS=1,GUNICORN_THREADS=4

	update_service "${WORKER_SERVICE}" \
		--cpu 1 \
		--memory 1Gi \
		--concurrency 1 \
		--min 0 \
		--max 1 \
		--timeout 3600 \
		--cpu-throttling

	update_service "${SCHEDULER_SERVICE}" \
		--cpu 1 \
		--memory 512Mi \
		--concurrency 1 \
		--min 0 \
		--max 1 \
		--timeout 3600 \
		--cpu-throttling

	printf 'Cloud Run parked mode applied.\n' >&2
	printf 'Worker and scheduler can scale to zero and will stop processing background jobs until restored.\n' >&2
	;;
full)
	update_service "${WEB_SERVICE}" \
		--cpu 2 \
		--memory 4Gi \
		--concurrency 40 \
		--min 1 \
		--max 10 \
		--timeout 3600 \
		--update-env-vars GUNICORN_WORKERS=2,GUNICORN_THREADS=4

	update_service "${WORKER_SERVICE}" \
		--cpu 2 \
		--memory 4Gi \
		--concurrency 1 \
		--min 1 \
		--max 1 \
		--timeout 3600 \
		--no-cpu-throttling

	update_service "${SCHEDULER_SERVICE}" \
		--cpu 1 \
		--memory 2Gi \
		--concurrency 1 \
		--min 1 \
		--max 1 \
		--timeout 3600 \
		--no-cpu-throttling

	printf 'Cloud Run full mode applied.\n' >&2
	;;
*)
	printf 'Unsupported MODE=%s. Use full or parked.\n' "${MODE}" >&2
	exit 1
	;;
esac
