#!/usr/bin/env bash
set -euo pipefail
INGRESS="$(openssl rand -hex 32)"
sudo -u frappe bash -lc "cd /var/crm/frappe-bench && bench --site crm.localhost set-config univesp_ingress_shared_secret '${INGRESS}'"
if sudo grep -q '^UNIVESP_INGRESS_SHARED_SECRET=' /var/crm/sso-gateway/.env; then
  sudo sed -i "s/^UNIVESP_INGRESS_SHARED_SECRET=.*/UNIVESP_INGRESS_SHARED_SECRET=${INGRESS}/" /var/crm/sso-gateway/.env
else
  echo "UNIVESP_INGRESS_SHARED_SECRET=${INGRESS}" | sudo tee -a /var/crm/sso-gateway/.env >/dev/null
fi
sudo supervisorctl restart sso-gateway
sleep 2
sudo supervisorctl status sso-gateway
curl -sf http://127.0.0.1:4000/health
echo ingress_secret_configured
