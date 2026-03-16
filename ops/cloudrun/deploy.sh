#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
IMAGE_URI=${IMAGE_URI:-}
FRAPPE_SITE_NAME=${FRAPPE_SITE_NAME:-homolog.crm.univesp.br}
PUBLIC_DOMAIN=${PUBLIC_DOMAIN:-${FRAPPE_SITE_NAME}}
PUBLIC_URL=${PUBLIC_URL:-https://${PUBLIC_DOMAIN}}
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

gcloud config set project "${PROJECT_ID}" >/dev/null

volume_arg="name=site,type=cloud-storage,bucket=${SITES_BUCKET},readonly=false,mount-options=implicit-dirs"
mount_arg="volume=site,mount-path=/home/frappe/frappe-bench/sites/${FRAPPE_SITE_NAME}"
common_env="FRAPPE_SITE_NAME=${FRAPPE_SITE_NAME},DB_TYPE=${DB_TYPE},DB_SETUP_MODE=${DB_SETUP_MODE},DB_HOST=127.0.0.1,DB_PORT=${DB_PORT},INSTANCE_CONNECTION_NAME=${CLOUDSQL_INSTANCE},HOST_NAME=${PUBLIC_URL}"
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
	--cpu 2 \
	--memory 4Gi \
	--concurrency 40 \
	--min 1 \
	--max 10 \
	--timeout 3600 \
	--execution-environment gen2 \
	--vpc-connector "${VPC_CONNECTOR}" \
	--vpc-egress private-ranges-only \
	--add-volume "${volume_arg}" \
	--add-volume-mount "${mount_arg}" \
	--set-env-vars "${common_env}" \
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
	--cpu 2 \
	--memory 4Gi \
	--concurrency 1 \
	--min 1 \
	--max 1 \
	--timeout 3600 \
	--no-cpu-throttling \
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
	--cpu 1 \
	--memory 2Gi \
	--concurrency 1 \
	--min 1 \
	--max 1 \
	--timeout 3600 \
	--no-cpu-throttling \
	--execution-environment gen2 \
	--vpc-connector "${VPC_CONNECTOR}" \
	--vpc-egress private-ranges-only \
	--add-volume "${volume_arg}" \
	--add-volume-mount "${mount_arg}" \
	--set-env-vars "${common_env}" \
	--set-secrets "${redis_secrets}" \
	--startup-probe=timeoutSeconds=5,periodSeconds=10,failureThreshold=30,httpGet.port=8080,httpGet.path=/healthz \
	--command /usr/local/bin/start-scheduler.sh

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
