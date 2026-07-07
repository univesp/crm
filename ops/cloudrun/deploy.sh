#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
IMAGE_URI=${IMAGE_URI:-}
DEPLOY_PROFILE=${DEPLOY_PROFILE:-default}
FRAPPE_SITE_NAME=${FRAPPE_SITE_NAME:-homolog-crm.univesp.br}
PUBLIC_DOMAIN=${PUBLIC_DOMAIN:-${FRAPPE_SITE_NAME}}
PUBLIC_URL=${PUBLIC_URL:-https://${PUBLIC_DOMAIN}}
DOMAIN_MAPPING_MODE=${DOMAIN_MAPPING_MODE:-none}
DB_TYPE=${DB_TYPE:-postgres}
DB_PORT=${DB_PORT:-}
DB_SETUP_MODE=${DB_SETUP_MODE:-existing}
DB_NAME=${DB_NAME:-crm_homolog}
DB_USER=${DB_USER:-${DB_NAME}}
DB_ROOT_USERNAME=${DB_ROOT_USERNAME:-}
CLOUDSQL_INSTANCE=${CLOUDSQL_INSTANCE:-}
SITES_BUCKET=${SITES_BUCKET:-}
VPC_CONNECTOR=${VPC_CONNECTOR:-}
RUNTIME_SERVICE_ACCOUNT=${CLOUDRUN_RUNTIME_SERVICE_ACCOUNT:-}
WEB_SERVICE=${WEB_SERVICE:-crm-homolog-web}
WORKER_SERVICE=${WORKER_SERVICE:-crm-homolog-worker}
SCHEDULER_SERVICE=${SCHEDULER_SERVICE:-crm-homolog-scheduler}
BOOTSTRAP_JOB=${BOOTSTRAP_JOB:-crm-homolog-bootstrap}
REDIS_CACHE_SECRET_NAME=${REDIS_CACHE_SECRET_NAME:-crm-homolog-redis-cache-url}
REDIS_QUEUE_SECRET_NAME=${REDIS_QUEUE_SECRET_NAME:-crm-homolog-redis-queue-url}
REDIS_SOCKETIO_SECRET_NAME=${REDIS_SOCKETIO_SECRET_NAME:-crm-homolog-redis-socketio-url}
DB_PASSWORD_SECRET_NAME=${DB_PASSWORD_SECRET_NAME:-crm-homolog-db-password}
ADMIN_PASSWORD_SECRET_NAME=${ADMIN_PASSWORD_SECRET_NAME:-crm-homolog-admin-password}
WEB_CPU=${WEB_CPU:-}
WEB_MEMORY=${WEB_MEMORY:-}
WEB_CONCURRENCY=${WEB_CONCURRENCY:-}
WEB_MIN_INSTANCES=${WEB_MIN_INSTANCES:-}
WEB_MAX_INSTANCES=${WEB_MAX_INSTANCES:-}
WEB_TIMEOUT=${WEB_TIMEOUT:-}
WEB_GUNICORN_WORKERS=${WEB_GUNICORN_WORKERS:-}
WEB_GUNICORN_THREADS=${WEB_GUNICORN_THREADS:-}
WORKER_CPU=${WORKER_CPU:-}
WORKER_MEMORY=${WORKER_MEMORY:-}
WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-}
WORKER_MIN_INSTANCES=${WORKER_MIN_INSTANCES:-}
WORKER_MAX_INSTANCES=${WORKER_MAX_INSTANCES:-}
WORKER_TIMEOUT=${WORKER_TIMEOUT:-}
WORKER_CPU_ALWAYS_ALLOCATED=${WORKER_CPU_ALWAYS_ALLOCATED:-}
SCHEDULER_CPU=${SCHEDULER_CPU:-}
SCHEDULER_MEMORY=${SCHEDULER_MEMORY:-}
SCHEDULER_CONCURRENCY=${SCHEDULER_CONCURRENCY:-}
SCHEDULER_MIN_INSTANCES=${SCHEDULER_MIN_INSTANCES:-}
SCHEDULER_MAX_INSTANCES=${SCHEDULER_MAX_INSTANCES:-}
SCHEDULER_TIMEOUT=${SCHEDULER_TIMEOUT:-}
SCHEDULER_CPU_ALWAYS_ALLOCATED=${SCHEDULER_CPU_ALWAYS_ALLOCATED:-}
SSO_GATEWAY_ORIGIN=${SSO_GATEWAY_ORIGIN:-}

if [[ -z "${PROJECT_ID}" || -z "${IMAGE_URI}" || -z "${CLOUDSQL_INSTANCE}" || -z "${SITES_BUCKET}" || -z "${VPC_CONNECTOR}" || -z "${RUNTIME_SERVICE_ACCOUNT}" ]]; then
	printf 'GCP_PROJECT_ID, IMAGE_URI, CLOUDSQL_INSTANCE, SITES_BUCKET, VPC_CONNECTOR and CLOUDRUN_RUNTIME_SERVICE_ACCOUNT are required.\n' >&2
	exit 1
fi

if [[ -z "${DB_PORT}" ]]; then
	if [[ "${DB_TYPE}" == "postgres" ]]; then
		DB_PORT=5432
	else
		DB_PORT=3306
	fi
fi

if [[ -z "${DB_ROOT_USERNAME}" ]]; then
	if [[ "${DB_TYPE}" == "postgres" ]]; then
		DB_ROOT_USERNAME=postgres
	else
		DB_ROOT_USERNAME=root
	fi
fi

append_env_var() {
	local current=$1
	local key=$2
	local value=$3

	if [[ -z "${value}" ]]; then
		printf '%s' "${current}"
		return
	fi

	if [[ -n "${current}" ]]; then
		current="${current},${key}=${value}"
	else
		current="${key}=${value}"
	fi

	printf '%s' "${current}"
}

case "${DEPLOY_PROFILE}" in
default)
	;;
single-user)
	WEB_CPU=${WEB_CPU:-1}
	WEB_MEMORY=${WEB_MEMORY:-1Gi}
	WEB_CONCURRENCY=${WEB_CONCURRENCY:-20}
	WEB_MIN_INSTANCES=${WEB_MIN_INSTANCES:-0}
	WEB_MAX_INSTANCES=${WEB_MAX_INSTANCES:-1}
	WEB_GUNICORN_WORKERS=${WEB_GUNICORN_WORKERS:-1}
	WEB_GUNICORN_THREADS=${WEB_GUNICORN_THREADS:-4}
	WORKER_CPU=${WORKER_CPU:-1}
	WORKER_MEMORY=${WORKER_MEMORY:-1Gi}
	WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-1}
	WORKER_MIN_INSTANCES=${WORKER_MIN_INSTANCES:-0}
	WORKER_MAX_INSTANCES=${WORKER_MAX_INSTANCES:-1}
	WORKER_CPU_ALWAYS_ALLOCATED=${WORKER_CPU_ALWAYS_ALLOCATED:-false}
	SCHEDULER_CPU=${SCHEDULER_CPU:-1}
	SCHEDULER_MEMORY=${SCHEDULER_MEMORY:-512Mi}
	SCHEDULER_CONCURRENCY=${SCHEDULER_CONCURRENCY:-1}
	SCHEDULER_MIN_INSTANCES=${SCHEDULER_MIN_INSTANCES:-0}
	SCHEDULER_MAX_INSTANCES=${SCHEDULER_MAX_INSTANCES:-1}
	SCHEDULER_CPU_ALWAYS_ALLOCATED=${SCHEDULER_CPU_ALWAYS_ALLOCATED:-false}
	;;
*)
	printf 'Unsupported DEPLOY_PROFILE=%s. Use default or single-user.\n' "${DEPLOY_PROFILE}" >&2
	exit 1
	;;
esac

WEB_CPU=${WEB_CPU:-2}
WEB_MEMORY=${WEB_MEMORY:-4Gi}
WEB_CONCURRENCY=${WEB_CONCURRENCY:-40}
WEB_MIN_INSTANCES=${WEB_MIN_INSTANCES:-1}
WEB_MAX_INSTANCES=${WEB_MAX_INSTANCES:-10}
WEB_TIMEOUT=${WEB_TIMEOUT:-3600}
WORKER_CPU=${WORKER_CPU:-2}
WORKER_MEMORY=${WORKER_MEMORY:-4Gi}
WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-1}
WORKER_MIN_INSTANCES=${WORKER_MIN_INSTANCES:-1}
WORKER_MAX_INSTANCES=${WORKER_MAX_INSTANCES:-1}
WORKER_TIMEOUT=${WORKER_TIMEOUT:-3600}
WORKER_CPU_ALWAYS_ALLOCATED=${WORKER_CPU_ALWAYS_ALLOCATED:-true}
SCHEDULER_CPU=${SCHEDULER_CPU:-1}
SCHEDULER_MEMORY=${SCHEDULER_MEMORY:-2Gi}
SCHEDULER_CONCURRENCY=${SCHEDULER_CONCURRENCY:-1}
SCHEDULER_MIN_INSTANCES=${SCHEDULER_MIN_INSTANCES:-1}
SCHEDULER_MAX_INSTANCES=${SCHEDULER_MAX_INSTANCES:-1}
SCHEDULER_TIMEOUT=${SCHEDULER_TIMEOUT:-3600}
SCHEDULER_CPU_ALWAYS_ALLOCATED=${SCHEDULER_CPU_ALWAYS_ALLOCATED:-true}
WORKER_CPU_THROTTLING_FLAG=--cpu-throttling
SCHEDULER_CPU_THROTTLING_FLAG=--cpu-throttling

if [[ "${WORKER_CPU_ALWAYS_ALLOCATED}" == "true" ]]; then
	WORKER_CPU_THROTTLING_FLAG=--no-cpu-throttling
fi

if [[ "${SCHEDULER_CPU_ALWAYS_ALLOCATED}" == "true" ]]; then
	SCHEDULER_CPU_THROTTLING_FLAG=--no-cpu-throttling
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

volume_arg="name=site,type=cloud-storage,bucket=${SITES_BUCKET},readonly=false,mount-options=implicit-dirs"
mount_arg="volume=site,mount-path=/home/frappe/frappe-bench/sites/${FRAPPE_SITE_NAME}"
common_env="FRAPPE_SITE_NAME=${FRAPPE_SITE_NAME},DB_TYPE=${DB_TYPE},DB_SETUP_MODE=${DB_SETUP_MODE},DB_HOST=127.0.0.1,DB_PORT=${DB_PORT},INSTANCE_CONNECTION_NAME=${CLOUDSQL_INSTANCE},HOST_NAME=${PUBLIC_URL}"
common_env="${common_env},FRAPPE_SITE_NAME_HEADER=${FRAPPE_SITE_NAME_HEADER:-${FRAPPE_SITE_NAME}}"
web_env=${common_env}
web_env=$(append_env_var "${web_env}" GUNICORN_WORKERS "${WEB_GUNICORN_WORKERS}")
web_env=$(append_env_var "${web_env}" GUNICORN_THREADS "${WEB_GUNICORN_THREADS}")
web_env=$(append_env_var "${web_env}" SSO_GATEWAY_ORIGIN "${SSO_GATEWAY_ORIGIN}")
redis_secrets="REDIS_CACHE_URL=${REDIS_CACHE_SECRET_NAME}:latest,REDIS_QUEUE_URL=${REDIS_QUEUE_SECRET_NAME}:latest,REDIS_SOCKETIO_URL=${REDIS_SOCKETIO_SECRET_NAME}:latest"

gcloud run jobs deploy "${BOOTSTRAP_JOB}" \
	--project "${PROJECT_ID}" \
	--region "${REGION}" \
	--image "${IMAGE_URI}" \
	--service-account "${RUNTIME_SERVICE_ACCOUNT}" \
	--task-timeout 3600 \
	--max-retries 0 \
	--vpc-connector "${VPC_CONNECTOR}" \
	--vpc-egress private-ranges-only \
	--add-volume "${volume_arg}" \
	--add-volume-mount "${mount_arg}" \
	--cpu 2 \
	--memory 4Gi \
	--set-env-vars "${common_env},DB_NAME=${DB_NAME},DB_USER=${DB_USER},DB_ROOT_USERNAME=${DB_ROOT_USERNAME}" \
	--set-secrets "DB_PASSWORD=${DB_PASSWORD_SECRET_NAME}:latest,ADMIN_PASSWORD=${ADMIN_PASSWORD_SECRET_NAME}:latest,${redis_secrets}" \
	--command /usr/local/bin/start-bootstrap.sh

gcloud run jobs execute "${BOOTSTRAP_JOB}" \
	--project "${PROJECT_ID}" \
	--region "${REGION}" \
	--wait

gcloud run deploy "${WEB_SERVICE}" \
	--project "${PROJECT_ID}" \
	--region "${REGION}" \
	--image "${IMAGE_URI}" \
	--service-account "${RUNTIME_SERVICE_ACCOUNT}" \
	--allow-unauthenticated \
	--ingress all \
	--port 8080 \
	--cpu "${WEB_CPU}" \
	--memory "${WEB_MEMORY}" \
	--concurrency "${WEB_CONCURRENCY}" \
	--min "${WEB_MIN_INSTANCES}" \
	--max "${WEB_MAX_INSTANCES}" \
	--timeout "${WEB_TIMEOUT}" \
	--execution-environment gen2 \
	--vpc-connector "${VPC_CONNECTOR}" \
	--vpc-egress private-ranges-only \
	--add-volume "${volume_arg}" \
	--add-volume-mount "${mount_arg}" \
	--set-env-vars "${web_env}" \
	--set-secrets "${redis_secrets}" \
	--startup-probe=timeoutSeconds=5,periodSeconds=10,failureThreshold=30,httpGet.port=8080,httpGet.path=/healthz \
	--command /usr/local/bin/start-web.sh

gcloud run deploy "${WORKER_SERVICE}" \
	--project "${PROJECT_ID}" \
	--region "${REGION}" \
	--image "${IMAGE_URI}" \
	--service-account "${RUNTIME_SERVICE_ACCOUNT}" \
	--no-allow-unauthenticated \
	--no-default-url \
	--ingress internal \
	--port 8080 \
	--cpu "${WORKER_CPU}" \
	--memory "${WORKER_MEMORY}" \
	--concurrency "${WORKER_CONCURRENCY}" \
	--min "${WORKER_MIN_INSTANCES}" \
	--max "${WORKER_MAX_INSTANCES}" \
	--timeout "${WORKER_TIMEOUT}" \
	"${WORKER_CPU_THROTTLING_FLAG}" \
	--execution-environment gen2 \
	--vpc-connector "${VPC_CONNECTOR}" \
	--vpc-egress private-ranges-only \
	--add-volume "${volume_arg}" \
	--add-volume-mount "${mount_arg}" \
	--set-env-vars "${common_env}" \
	--set-secrets "${redis_secrets}" \
	--startup-probe=timeoutSeconds=5,periodSeconds=10,failureThreshold=30,httpGet.port=8080,httpGet.path=/healthz \
	--command /usr/local/bin/start-worker.sh

gcloud run deploy "${SCHEDULER_SERVICE}" \
	--project "${PROJECT_ID}" \
	--region "${REGION}" \
	--image "${IMAGE_URI}" \
	--service-account "${RUNTIME_SERVICE_ACCOUNT}" \
	--no-allow-unauthenticated \
	--no-default-url \
	--ingress internal \
	--port 8080 \
	--cpu "${SCHEDULER_CPU}" \
	--memory "${SCHEDULER_MEMORY}" \
	--concurrency "${SCHEDULER_CONCURRENCY}" \
	--min "${SCHEDULER_MIN_INSTANCES}" \
	--max "${SCHEDULER_MAX_INSTANCES}" \
	--timeout "${SCHEDULER_TIMEOUT}" \
	"${SCHEDULER_CPU_THROTTLING_FLAG}" \
	--execution-environment gen2 \
	--vpc-connector "${VPC_CONNECTOR}" \
	--vpc-egress private-ranges-only \
	--add-volume "${volume_arg}" \
	--add-volume-mount "${mount_arg}" \
	--set-env-vars "${common_env}" \
	--set-secrets "${redis_secrets}" \
	--startup-probe=timeoutSeconds=5,periodSeconds=10,failureThreshold=30,httpGet.port=8080,httpGet.path=/healthz \
	--command /usr/local/bin/start-scheduler.sh

if [[ "${DOMAIN_MAPPING_MODE}" == "cloud_run" ]]; then
	if ! gcloud beta run domain-mappings describe \
		--project "${PROJECT_ID}" \
		--region "${REGION}" \
		--domain "${PUBLIC_DOMAIN}" >/tmp/domain-mapping.json 2>/dev/null; then
		gcloud beta run domain-mappings create \
			--project "${PROJECT_ID}" \
			--region "${REGION}" \
			--service "${WEB_SERVICE}" \
			--domain "${PUBLIC_DOMAIN}" >/dev/null
	fi

	gcloud beta run domain-mappings describe \
		--project "${PROJECT_ID}" \
		--region "${REGION}" \
		--domain "${PUBLIC_DOMAIN}" \
		--format=json > /tmp/domain-mapping.json

	if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
		"$(dirname "$0")/cloudflare_upsert_dns.sh" /tmp/domain-mapping.json
	else
		jq -r '.status.resourceRecords[] | "\(.type) \(.name) -> \(.rrdata)"' /tmp/domain-mapping.json
	fi
fi
