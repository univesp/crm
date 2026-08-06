#!/usr/bin/env bash
set -euo pipefail
BENCH_DIR="${BENCH_DIR:-/var/crm/frappe-bench}"
SITE="${SITE:-crm.localhost}"
GATEWAY_ENV="${GATEWAY_ENV:-/var/crm/sso-gateway/.env}"

if pid="$(pgrep -f 'gunicorn.*frappe\.app' 2>/dev/null | head -1)" && [[ -n "$pid" ]]; then
  detected="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
  if [[ -n "$detected" && -f "${detected}/sites/${SITE}/site_config.json" ]]; then
    BENCH_DIR="$detected"
  fi
fi

EDGE="$(openssl rand -hex 32)"
sudo -u frappe bash -lc "cd '${BENCH_DIR}' && bench --site '${SITE}' set-config univesp_edge_shared_secret '${EDGE}'"
if sudo grep -q '^UNIVESP_EDGE_SHARED_SECRET=' "$GATEWAY_ENV"; then
  sudo sed -i "s/^UNIVESP_EDGE_SHARED_SECRET=.*/UNIVESP_EDGE_SHARED_SECRET=${EDGE}/" "$GATEWAY_ENV"
else
  echo "UNIVESP_EDGE_SHARED_SECRET=${EDGE}" | sudo tee -a "$GATEWAY_ENV" >/dev/null
fi
sudo supervisorctl restart sso-gateway 'frappe-bench:*'
sleep 2
sudo supervisorctl status sso-gateway
curl -sf http://127.0.0.1:4000/health
echo gateway_ok
