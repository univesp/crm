#!/usr/bin/env bash
# Deploy Knowledge Studio na VM de homolog (mesmo host do CRM).
set -euo pipefail

ROOT="${CRM_ROOT:-/var/crm}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vm.yml}"

cd "$ROOT"

echo "==> Atualizando repositório em $ROOT"
git fetch origin
git pull --ff-only

echo "==> Build knowledge-studio"
docker compose -f "$COMPOSE_FILE" build knowledge-studio

echo "==> Subindo knowledge-studio (porta \${KNOWLEDGE_STUDIO_PORT:-8090})"
docker compose -f "$COMPOSE_FILE" up -d knowledge-studio

echo "==> Status"
docker compose -f "$COMPOSE_FILE" ps knowledge-studio

STUDIO_PORT="${KNOWLEDGE_STUDIO_PORT:-8090}"
echo ""
echo "Knowledge Studio disponível em:"
echo "  http://$(hostname -I | awk '{print $1}'):${STUDIO_PORT}"
echo "  ou http://homolog-crm.univesp.br:${STUDIO_PORT}"
echo ""
echo "Configure KNOWLEDGE_STUDIO_PIN em .env.vm e reinicie se ainda não tiver PIN."
