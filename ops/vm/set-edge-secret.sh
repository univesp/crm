#!/usr/bin/env bash
set -euo pipefail
EDGE="$(openssl rand -hex 32)"
sudo -u frappe bash -lc "cd /var/crm/frappe-bench && bench --site crm.localhost set-config univesp_edge_shared_secret '${EDGE}'"
if sudo grep -q '^UNIVESP_EDGE_SHARED_SECRET=' /var/crm/sso-gateway/.env; then
  sudo sed -i "s/^UNIVESP_EDGE_SHARED_SECRET=.*/UNIVESP_EDGE_SHARED_SECRET=${EDGE}/" /var/crm/sso-gateway/.env
else
  echo "UNIVESP_EDGE_SHARED_SECRET=${EDGE}" | sudo tee -a /var/crm/sso-gateway/.env >/dev/null
fi
sudo supervisorctl restart sso-gateway
sleep 2
sudo supervisorctl status sso-gateway
curl -sf http://127.0.0.1:4000/health
echo gateway_ok
