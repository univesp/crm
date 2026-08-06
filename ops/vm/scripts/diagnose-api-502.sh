#!/usr/bin/env bash
# Diagnostico rapido para HTTP 502 na cadeia nginx -> gateway -> frappe.
set -Eeuo pipefail

GATEWAY_ENV="${GATEWAY_ENV:-/var/crm/sso-gateway/.env}"
SITE="${SITE:-crm.localhost}"
DOMAIN="${DOMAIN:-homolog-crm.univesp.br}"

printf '=== 1. Portas ===\n'
curl -sf http://127.0.0.1:4000/health && printf ' gateway /health OK\n' || printf ' gateway /health FALHOU\n'
curl -sf -o /dev/null -w 'frappe responde HTTP %{http_code}\n' http://127.0.0.1:8000/ || true

printf '\n=== 2. Supervisor ===\n'
sudo supervisorctl status sso-gateway 'frappe-bench:*' 2>/dev/null || true

printf '\n=== 3. Bench em execucao (gunicorn) ===\n'
pid="$(pgrep -f 'gunicorn.*frappe\.app' 2>/dev/null | head -1 || true)"
if [[ -n "$pid" ]]; then
  printf 'pid=%s cwd=%s\n' "$pid" "$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || echo '?')"
else
  printf 'gunicorn nao encontrado\n'
fi

printf '\n=== 4. Paridade secrets (gateway .env vs site_config) ===\n'
if [[ ! -r "$GATEWAY_ENV" ]]; then
  printf 'Sem leitura em %s — use sudo\n' "$GATEWAY_ENV"
else
  EDGE_ENV="$(awk -F= '$1=="UNIVESP_EDGE_SHARED_SECRET"{print substr($0,index($0,"=")+1);exit}' "$GATEWAY_ENV")"
  BFF_ENV="$(awk -F= '$1=="UNIVESP_BFF_SHARED_SECRET"{print substr($0,index($0,"=")+1);exit}' "$GATEWAY_ENV")"
  for bench in /var/crm/frappe-bench /home/frappe/frappe-bench; do
    cfg="${bench}/sites/${SITE}/site_config.json"
    [[ -f "$cfg" ]] || continue
    read -r EDGE_SITE BFF_SITE < <(python3 - <<PY
import json
d=json.load(open("$cfg"))
print(d.get("univesp_edge_shared_secret",""), d.get("univesp_bff_shared_secret",""))
PY
)
    printf '%s\n' "$bench"
    printf '  edge: %s\n' "$([ "$EDGE_ENV" = "$EDGE_SITE" ] && echo OK || echo FALHA)"
    printf '  bff:  %s\n' "$([ "$BFF_ENV" = "$BFF_SITE" ] && echo OK || echo FALHA)"
  done
fi

printf '\n=== 5. API publica (gateway -> frappe, sem sessao) ===\n'
curl -sS -w '\nHTTP %{http_code}\n' -H "Host: ${DOMAIN}" \
  http://127.0.0.1:4000/api/public/v1/runtime/flags | tail -5

printf '\n=== 6. API publica via nginx ===\n'
curl -sS -w '\nHTTP %{http_code}\n' \
  --resolve "${DOMAIN}:443:127.0.0.1" \
  "https://${DOMAIN}/api/public/v1/runtime/flags" | tail -5

printf '\n=== 7. Ultimos erros gateway ===\n'
sudo tail -15 /var/log/supervisor/sso-gateway-err.log 2>/dev/null || true

printf '\n=== 8. Ultimos erros frappe web ===\n'
for log in /var/crm/frappe-bench/logs/web.error.log /home/frappe/frappe-bench/logs/web.error.log; do
  [[ -f "$log" ]] && { printf '-- %s\n' "$log"; sudo tail -10 "$log"; }
done
