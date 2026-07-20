#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID=${GCP_PROJECT_ID:-${PROJECT_ID:-}}
REGION=${GCP_REGION:-us-east1}
ROLLBACK_IMAGE_URI=${ROLLBACK_IMAGE_URI:-}
CONFIRM_ROLLBACK=${CONFIRM_ROLLBACK:-}
WEB_SERVICE=${WEB_SERVICE:-crm-homolog-web}
WORKER_SERVICE=${WORKER_SERVICE:-crm-homolog-worker}
SCHEDULER_SERVICE=${SCHEDULER_SERVICE:-crm-homolog-scheduler}

if [[ -z "$PROJECT_ID" || -z "$ROLLBACK_IMAGE_URI" ]]; then
	printf 'GCP_PROJECT_ID and ROLLBACK_IMAGE_URI are required.\n' >&2
	exit 1
fi

if [[ "$CONFIRM_ROLLBACK" != "homolog" ]]; then
	printf 'Set CONFIRM_ROLLBACK=homolog to confirm this rollback.\n' >&2
	exit 1
fi

case "$ROLLBACK_IMAGE_URI" in
*:latest)
	printf 'ROLLBACK_IMAGE_URI must use an immutable SHA tag or digest, never latest.\n' >&2
	exit 1
	;;
*@sha256:*|*:*)
	;;
*)
	printf 'ROLLBACK_IMAGE_URI must include an immutable SHA tag or digest.\n' >&2
	exit 1
	;;
esac

services=("$WEB_SERVICE" "$WORKER_SERVICE" "$SCHEDULER_SERVICE")

printf 'Project: %s\nRegion: %s\nTarget image: %s\n' "$PROJECT_ID" "$REGION" "$ROLLBACK_IMAGE_URI"

for service in "${services[@]}"; do
	current_image=$(gcloud run services describe "$service" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.containers[0].image)')
	printf '%s: %s -> %s\n' "$service" "$current_image" "$ROLLBACK_IMAGE_URI"
done

for service in "${services[@]}"; do
	gcloud run services update "$service" --project "$PROJECT_ID" --region "$REGION" --image "$ROLLBACK_IMAGE_URI" --quiet
done

printf 'Rollback de imagem concluido. Execute smoke e valide banco, filas e scheduler.\n'
printf 'Este script nao desfaz migrations nem restaura dados.\n'