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
apt-get install -y --no-install-recommends ca-certificates curl docker.io docker-compose
systemctl enable --now docker

compose_version="v2.40.3"
compose_sha256="dba9d98e1ba5bfe11d88c99b9bd32fc4a0624a30fafe68eea34d61a3e42fd372"
compose_url="https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-linux-x86_64"
compose_dir="/usr/local/lib/docker/cli-plugins"
compose_tmp=$(mktemp)
trap 'rm -f "$compose_tmp"' EXIT
curl --fail --silent --show-error --location "$compose_url" --output "$compose_tmp"
printf '%s  %s\n' "$compose_sha256" "$compose_tmp" | sha256sum --check -
install -d -m 0755 "$compose_dir"
install -m 0755 "$compose_tmp" "$compose_dir/docker-compose"

docker version --format '{{.Server.Version}}'
docker compose version
docker-compose version
printf 'Dependências dos serviços FAQ instaladas.\n'
