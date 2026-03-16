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
REDIS_INSTANCE=${REDIS_INSTANCE:-}
REDIS_SIZE_GB=${REDIS_SIZE_GB:-1}
REDIS_TIER=${REDIS_TIER:-basic}

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
	if [[ -z "${REDIS_INSTANCE}" ]]; then
		printf 'REDIS_INSTANCE is required when CREATE_REDIS=true.\n' >&2
		exit 1
	fi

	if ! gcloud redis instances describe "${REDIS_INSTANCE}" --region "${REGION}" >/dev/null 2>&1; then
		gcloud redis instances create "${REDIS_INSTANCE}" \
			--region "${REGION}" \
			--network "${VPC_NETWORK}" \
			--size "${REDIS_SIZE_GB}" \
			--tier "${REDIS_TIER}" \
			--redis-version redis_7_2
	fi

	gcloud redis instances describe "${REDIS_INSTANCE}" --region "${REGION}" \
		--format='value(host,port)'
fi
