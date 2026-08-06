#!/usr/bin/env bash
# Sincroniza UNIVESP_EDGE/BFF do sso-gateway/.env para o site Frappe ativo.
set -Eeuo pipefail

GATEWAY_ENV="${GATEWAY_ENV:-/var/crm/sso-gateway/.env}"
SITE="${SITE:-crm.localhost}"

if [[ ! -f "$GATEWAY_ENV" ]]; then
  printf 'ERRO: %s nao encontrado\n' "$GATEWAY_ENV" >&2
  exit 1
fi

env_value() {
  awk -F= -v key="$1" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$GATEWAY_ENV"
}

EDGE="$(env_value UNIVESP_EDGE_SHARED_SECRET)"
BFF="$(env_value UNIVESP_BFF_SHARED_SECRET)"

if [[ -z "$EDGE" || -z "$BFF" ]]; then
  printf 'ERRO: UNIVESP_EDGE_SHARED_SECRET e UNIVESP_BFF_SHARED_SECRET obrigatorios em %s\n' "$GATEWAY_ENV" >&2
  exit 1
fi

detect_bench() {
  local pid bench
  pid="$(pgrep -f 'gunicorn.*frappe\.app' 2>/dev/null | head -1 || true)"
  if [[ -n "$pid" && -r "/proc/${pid}/cwd" ]]; then
    bench="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
    if [[ -n "$bench" && -f "${bench}/sites/${SITE}/site_config.json" ]]; then
      printf '%s' "$bench"
      return 0
    fi
  fi
  for candidate in /var/crm/frappe-bench /home/frappe/frappe-bench; do
    if [[ -f "${candidate}/sites/${SITE}/site_config.json" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

BENCH_DIR="${BENCH_DIR:-$(detect_bench || true)}"
if [[ -z "$BENCH_DIR" ]]; then
  printf 'ERRO: bench com site %s nao encontrado\n' "$SITE" >&2
  exit 1
fi

printf 'Bench ativo: %s\n' "$BENCH_DIR"

sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' set-config univesp_edge_shared_secret '$EDGE'"
sudo -u frappe bash -lc "cd '$BENCH_DIR' && bench --site '$SITE' set-config univesp_bff_shared_secret '$BFF'"

sudo supervisorctl restart 'frappe-bench:*' sso-gateway
sleep 3
curl -sf http://127.0.0.1:4000/health >/dev/null
printf 'Secrets sincronizados e servicos reiniciados.\n'
