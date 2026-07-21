#!/usr/bin/env bash
set -Eeuo pipefail
PUBLIC_URL=${PUBLIC_URL:-}
OUTPUT_PATH=${OUTPUT_PATH:-}
[[ "$PUBLIC_URL" =~ ^https://[^/]+/?$ ]] || { printf 'PUBLIC_URL must be an HTTPS origin.\n' >&2; exit 1; }
for command_name in curl jq; do command -v "$command_name" >/dev/null || { printf '%s is required.\n' "$command_name" >&2; exit 1; }; done
PUBLIC_URL=${PUBLIC_URL%/}; results='[]'; failures=0
check(){
 local profile=$1 path=$2 expected=$3 cookie_jar=${4:-}; local args=(-sS -o /dev/null --max-time 20 --connect-timeout 5 -w '%{http_code} %{time_total}' --request GET)
 [[ -z "$cookie_jar" ]] || args+=(-b "$cookie_jar")
 read -r status latency < <(curl "${args[@]}" "$PUBLIC_URL$path" || printf '000 0')
 local passed=false; IFS=',' read -ra expected_codes <<<"$expected"; for code in "${expected_codes[@]}"; do [[ "$status" == "$code" ]] && passed=true; done
 [[ "$passed" == true ]] || failures=$((failures+1))
 results=$(jq -c --arg profile "$profile" --arg path "$path" --arg status "${status:-0}" --arg expected "$expected" --arg latency "${latency:-0}" --argjson passed "$passed" '. + [{profile:$profile,path:$path,status:($status|tonumber),expected:$expected,latency_seconds:($latency|tonumber),passed:$passed}]' <<<"$results")
}
check anonymous / 200
check anonymous /login 200
check anonymous /healthz 200
check anonymous /api/me 401
check anonymous /api/app/v1/tickets 401
check anonymous /api/method/ping 404
check anonymous /api/resource/User 404
check anonymous /desk 404
check anonymous /files/private.txt 404
check anonymous /socket.io/ 404
check anonymous /api/internal/institutional 404
check anonymous /api/sso/azure/start 302,303,307,308
check anonymous /api/sso/saml/start 302,303,307,308
if [[ -n "${STUDENT_COOKIE_JAR:-}" ]]; then check student /api/me 200 "$STUDENT_COOKIE_JAR"; check student /api/app/v1/tickets 200 "$STUDENT_COOKIE_JAR"; check student /api/app/v1/knowledge/faq-published 200 "$STUDENT_COOKIE_JAR"; fi
if [[ -n "${OP_COOKIE_JAR:-}" ]]; then check op /api/me 200 "$OP_COOKIE_JAR"; check op /api/app/v1/queues 200 "$OP_COOKIE_JAR"; check op /api/app/v1/tickets 200 "$OP_COOKIE_JAR"; fi
if [[ -n "${AREA_COOKIE_JAR:-}" ]]; then check area /api/me 200 "$AREA_COOKIE_JAR"; check area /api/app/v1/queues 200 "$AREA_COOKIE_JAR"; fi
if [[ -n "${ADMIN_COOKIE_JAR:-}" ]]; then check admin /api/me 200 "$ADMIN_COOKIE_JAR"; check admin /api/app/v1/admin/catalogs 200 "$ADMIN_COOKIE_JAR"; check admin /api/app/v1/admin/runtime-settings 200 "$ADMIN_COOKIE_JAR"; fi
result=$(jq -n --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg origin "$PUBLIC_URL" --argjson failures "$failures" --argjson results "$results" '{schema_version:1,generated_at:$generated_at,origin:$origin,passed:($failures==0),failure_count:$failures,checks:$results}')
if [[ -n "$OUTPUT_PATH" ]]; then mkdir -p "$(dirname "$OUTPUT_PATH")"; printf '%s\n' "$result" >"$OUTPUT_PATH"; else printf '%s\n' "$result"; fi
((failures==0))
