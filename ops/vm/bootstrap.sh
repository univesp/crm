#!/usr/bin/env bash
# Bootstrap VM interim — sobe compose BFF + frontend + Redis.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.vm ]]; then
  echo "Copie .env.vm.example para .env.vm e preencha os secrets." >&2
  exit 1
fi

docker compose -f docker-compose.vm.yml --env-file .env.vm up -d --build

echo "Stack VM iniciada. Health: curl -sf http://127.0.0.1:\${VM_HTTP_PORT:-8080}/healthz"
echo "Frappe bench deve estar acessivel em FRAPPE_ORIGIN (padrao host.docker.internal:8000)."
