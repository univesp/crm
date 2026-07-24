#!/usr/bin/env bash
# Deploy Knowledge Studio na VM homolog (supervisor + nginx, sem Docker).
set -euo pipefail

REPO="${CRM_REPO:-/var/crm/repository}"
STUDIO="${REPO}/tools/knowledge-studio"
PIN="${KNOWLEDGE_STUDIO_PIN:-univesp2026curadoria}"
PORT="${KNOWLEDGE_STUDIO_PORT:-8090}"

echo "==> Pull ${REPO}"
cd "$REPO"
git fetch origin
git pull --ff-only origin codex/crm-ux-simulator-foundation

echo "==> Python deps"
python3 -m pip install --user -r "${REPO}/ops/knowledge-ingest/requirements.txt"

echo "==> Node deps"
cd "$STUDIO"
npm install --omit=dev

echo "==> Supervisor program"
sudo tee /etc/supervisor/conf.d/knowledge-studio.conf >/dev/null <<EOF
[program:knowledge-studio]
command=/usr/bin/node ${STUDIO}/server/index.js
directory=${STUDIO}
user=bruno.miyasato
autostart=true
autorestart=true
startretries=5
stderr_logfile=/var/log/supervisor/knowledge-studio-err.log
stdout_logfile=/var/log/supervisor/knowledge-studio-out.log
environment=NODE_ENV="production",PORT="${PORT}",STUDIO_PIN="${PIN}",DATA_DIR="${STUDIO}/data/runs",PYTHON_BIN="python3",PIPELINE_PATH="${REPO}/ops/knowledge-ingest/pipeline.py"
EOF

echo "==> Nginx /studio/ (se ainda nao existir)"
NGINX_CONF="/etc/nginx/sites-available/homolog-crm.univesp.br.conf"
if ! sudo grep -q "location \^~ /studio/" "$NGINX_CONF"; then
  sudo sed -i '/location = \/healthz/i \
\tlocation ^~ /studio/ {\
\t\tproxy_pass http://127.0.0.1:'"${PORT}"'/;\
\t\tproxy_http_version 1.1;\
\t\tproxy_set_header Host $host;\
\t\tproxy_set_header X-Real-IP $remote_addr;\
\t\tproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
\t\tproxy_set_header X-Forwarded-Proto $scheme;\
\t\tclient_max_body_size 50m;\
\t}\
' "$NGINX_CONF"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "==> Start service"
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart knowledge-studio
sleep 2
sudo supervisorctl status knowledge-studio

echo ""
echo "Knowledge Studio: https://homolog-crm.univesp.br/studio/"
echo "PIN: ${PIN}"
