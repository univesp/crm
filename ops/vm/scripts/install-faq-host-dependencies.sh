#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
	printf 'Execute como root para instalar dependências da VM.\n' >&2
	exit 1
fi

if [[ ! -r /etc/os-release ]]; then
	printf 'Não foi possível identificar o sistema operacional.\n' >&2
	exit 1
fi
# shellcheck disable=SC1091
source /etc/os-release
if [[ "${ID:-}" != "debian" || "${VERSION_ID:-}" != "12" ]]; then
	printf 'Host não homologado para instalação automática: %s %s.\n' "${ID:-desconhecido}" "${VERSION_ID:-}" >&2
	exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates docker.io docker-compose
systemctl enable --now docker
docker version --format '{{.Server.Version}}'
docker-compose version
printf 'Dependências dos serviços FAQ instaladas.\n'
