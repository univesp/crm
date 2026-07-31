#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado. Instale Node 20 LTS antes de continuar." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm nao encontrado. Instale npm 10 ou superior antes de continuar." >&2
  exit 1
fi

echo "[univesp-frontend] Node: $(node --version)"
echo "[univesp-frontend] npm: $(npm --version)"

if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
  cp .env.example .env.local
  echo "[univesp-frontend] .env.local criado a partir de .env.example"
fi

if [ "${1:-}" != "--skip-install" ]; then
  echo "[univesp-frontend] Executando npm install"
  npm install
fi

echo "[univesp-frontend] Proximos comandos recomendados:"
echo "  npm run dev"
echo "  npm run lint"
echo "  npm run typecheck"
echo "  npm run build"
echo "  npm run preview"
