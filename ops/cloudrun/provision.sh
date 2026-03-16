#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
ARTIFACT_REPOSITORY=${ARTIFACT_REPOSITORY:-crm}
RUNTIME_SERVICE_ACCOUNT=${CLOUDRUN_RUNTIME_SERVICE_ACCOUNT:-}
SITES_BUCKET=${SITES_BUCKET:-}
VPC_NETWORK=${VPC_NETWORK:-default}
VPC_CONNECTOR=${VPC_CONNECTOR:-}
VPC_CONNECTOR_RANGE=${VPC_CONNECTOR_RANGE:-10.8.0.0/28}
CREATE_REDIS=${CREATE_REDIS:-false}
REDIS_BACKEND=${REDIS_BACKEND:-vm}
REDIS_VM_NAME=${REDIS_VM_NAME:-}
REDIS_VM_ZONE=${REDIS_VM_ZONE:-${REGION}-d}
REDIS_VM_MACHINE_TYPE=${REDIS_VM_MACHINE_TYPE:-e2-small}
REDIS_VM_TAG=${REDIS_VM_TAG:-crm-homolog-redis}
REDIS_VM_PORT=${REDIS_VM_PORT:-6379}
REDIS_VM_STARTUP_SCRIPT=${REDIS_VM_STARTUP_SCRIPT:-$(dirname "$0")/redis-vm-startup.sh}

if [[ -z "${PROJECT_ID}" || -z "${RUNTIME_SERVICE_ACCOUNT}" || -z "${SITES_BUCKET}" || -z "${VPC_CONNECTOR}" ]]; then
	printf 'GCP_PROJECT_ID, CLOUDRUN_RUNTIME_SERVICE_ACCOUNT, SITES_BUCKET and VPC_CONNECTOR are required.\n' >&2
	exit 1
fi

gcloud config set project "${PROJECT_ID}" >/dev/null

gcloud services enable \
	run.googleapis.com \
	artifactregistry.googleapis.com \
	secretmanager.googleapis.com \
	sqladmin.googleapis.com \
	vpcaccess.googleapis.com \
	redis.googleapis.com \
	compute.googleapis.com \
	iam.googleapis.com \
	serviceusage.googleapis.com

if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" --location "${REGION}" >/dev/null 2>&1; then
	gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
		--repository-format docker \
		--location "${REGION}" \
		--description "Frappe CRM images for Cloud Run"
fi

if ! gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" >/dev/null 2>&1; then
	gcloud iam service-accounts create \
		"${RUNTIME_SERVICE_ACCOUNT%@*}" \
		--display-name "Cloud Run runtime for Frappe CRM"
fi

if ! gcloud storage buckets describe "gs://${SITES_BUCKET}" >/dev/null 2>&1; then
	gcloud storage buckets create "gs://${SITES_BUCKET}" \
		--location "${REGION}" \
		--default-storage-class STANDARD \
		--uniform-bucket-level-access \
		--public-access-prevention
fi

gcloud storage buckets add-iam-policy-binding "gs://${SITES_BUCKET}" \
	--member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
	--role roles/storage.objectAdmin >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
	--member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
	--role roles/cloudsql.client >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
	--member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
	--role roles/secretmanager.secretAccessor >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
	--member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
	--role roles/vpcaccess.user >/dev/null

if ! gcloud compute networks vpc-access connectors describe "${VPC_CONNECTOR}" --region "${REGION}" >/dev/null 2>&1; then
	gcloud compute networks vpc-access connectors create "${VPC_CONNECTOR}" \
		--region "${REGION}" \
		--network "${VPC_NETWORK}" \
		--range "${VPC_CONNECTOR_RANGE}"
fi

if [[ "${CREATE_REDIS}" == "true" ]]; then
	if [[ "${REDIS_BACKEND}" != "vm" ]]; then
		printf 'Unsupported REDIS_BACKEND=%s. Frappe bootstrap requires CLIENT commands that Cloud Memorystore blocks; use REDIS_BACKEND=vm.\n' "${REDIS_BACKEND}" >&2
		exit 1
	fi

	if [[ -z "${REDIS_VM_NAME}" ]]; then
		printf 'REDIS_VM_NAME is required when CREATE_REDIS=true.\n' >&2
		exit 1
	fi

	if [[ ! -f "${REDIS_VM_STARTUP_SCRIPT}" ]]; then
		printf 'Redis startup script not found: %s\n' "${REDIS_VM_STARTUP_SCRIPT}" >&2
		exit 1
	fi

	if ! gcloud compute firewall-rules describe "${REDIS_VM_TAG}-allow-cloudrun" >/dev/null 2>&1; then
		gcloud compute firewall-rules create "${REDIS_VM_TAG}-allow-cloudrun" \
			--network "${VPC_NETWORK}" \
			--direction INGRESS \
			--priority 900 \
			--action ALLOW \
			--rules "tcp:${REDIS_VM_PORT}" \
			--source-ranges "${VPC_CONNECTOR_RANGE}" \
			--target-tags "${REDIS_VM_TAG}"
	fi

	if ! gcloud compute firewall-rules describe "${REDIS_VM_TAG}-allow-iap-ssh" >/dev/null 2>&1; then
		gcloud compute firewall-rules create "${REDIS_VM_TAG}-allow-iap-ssh" \
			--network "${VPC_NETWORK}" \
			--direction INGRESS \
			--priority 900 \
			--action ALLOW \
			--rules tcp:22 \
			--source-ranges 35.235.240.0/20 \
			--target-tags "${REDIS_VM_TAG}"
	fi

	if ! gcloud compute firewall-rules describe "${REDIS_VM_TAG}-deny-public" >/dev/null 2>&1; then
		gcloud compute firewall-rules create "${REDIS_VM_TAG}-deny-public" \
			--network "${VPC_NETWORK}" \
			--direction INGRESS \
			--priority 1000 \
			--action DENY \
			--rules "tcp:${REDIS_VM_PORT},tcp:22" \
			--source-ranges 0.0.0.0/0 \
			--target-tags "${REDIS_VM_TAG}"
	fi

	if ! gcloud compute instances describe "${REDIS_VM_NAME}" --zone "${REDIS_VM_ZONE}" >/dev/null 2>&1; then
		gcloud compute instances create "${REDIS_VM_NAME}" \
			--zone "${REDIS_VM_ZONE}" \
			--network "${VPC_NETWORK}" \
			--machine-type "${REDIS_VM_MACHINE_TYPE}" \
			--tags "${REDIS_VM_TAG}" \
			--metadata-from-file startup-script="${REDIS_VM_STARTUP_SCRIPT}" \
			--image-family debian-12 \
			--image-project debian-cloud
	fi

	gcloud compute instances describe "${REDIS_VM_NAME}" --zone "${REDIS_VM_ZONE}" \
		--format="value(networkInterfaces[0].networkIP)"
fi
