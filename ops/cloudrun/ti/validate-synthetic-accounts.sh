#!/usr/bin/env bash
set -Eeuo pipefail

MANIFEST_PATH=${MANIFEST_PATH:-$(dirname "$0")/synthetic-accounts.example.json}
VALIDATION_MODE=${VALIDATION_MODE:-template}
OUTPUT_PATH=${OUTPUT_PATH:-}

command -v jq >/dev/null || { printf 'jq is required.\n' >&2; exit 1; }
[[ -f "$MANIFEST_PATH" ]] || { printf 'Manifest not found: %s\n' "$MANIFEST_PATH" >&2; exit 1; }
[[ "$VALIDATION_MODE" =~ ^(template|runtime)$ ]] || { printf 'VALIDATION_MODE must be template or runtime.\n' >&2; exit 1; }

jq -e '
  .schema_version == 1 and .environment == "homolog" and
  (.accounts | type == "array" and length == 4) and
  ([.accounts[].profile] | sort == ["admin","area","operator","student"]) and
  ([.accounts[].profile] | unique | length == 4) and
  (all(.accounts[];
    ((.idp == "azure_admin") or (.idp == "azure_academico") or (.idp == "saml")) and
    (.subject_email | type == "string" and length > 3) and
    (.owner | type == "string" and length > 3) and
    (.expires_on | type == "string" and length > 3) and
    (.expected_scopes | type == "array" and length > 0) and
    (if .profile == "student" then
      (((.idp == "azure_academico") or (.idp == "saml")) and .frappe_profile_key == "aluno" and .frappe_scopes == {})
    elif .profile == "operator" then
      (.idp == "azure_admin" and .frappe_profile_key == "op" and (.frappe_scopes.queues | type == "array" and length > 0))
    elif .profile == "area" then
      (.idp == "azure_admin" and .frappe_profile_key == "analista_area" and (.frappe_scopes.areas | type == "array" and length > 0))
    else
      (.idp == "azure_admin" and .frappe_profile_key == "admin_central" and .frappe_scopes == {})
    end))) and
  ([paths(scalars) as $p | ($p[-1] | tostring | ascii_downcase) | select(test("password|secret|token|cookie"))] | length == 0)
' "$MANIFEST_PATH" >/dev/null || {
  printf 'Synthetic account manifest schema is invalid or contains a forbidden credential field.\n' >&2
  exit 1
}

if [[ "$VALIDATION_MODE" == runtime ]]; then
  jq -e '
    ([.. | strings | select(startswith("REPLACE_"))] | length == 0) and
    all(.accounts[];
      (.subject_email | test("^[^@[:space:]]+@univesp\\.br$")) and
      (.expires_on | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")))
  ' "$MANIFEST_PATH" >/dev/null || {
    printf 'Runtime manifest contains placeholders or invalid institutional email/date fields.\n' >&2
    exit 1
  }
fi

result=$(jq -n --arg generated_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg mode "$VALIDATION_MODE" --arg manifest "$MANIFEST_PATH" \
  '{schema_version:1,generated_at:$generated_at,mode:$mode,manifest:$manifest,passed:true,profiles:["student","operator","area","admin"],credential_fields_present:false}')
if [[ -n "$OUTPUT_PATH" ]]; then
  mkdir -p "$(dirname "$OUTPUT_PATH")"
  printf '%s\n' "$result" >"$OUTPUT_PATH"
else
  printf '%s\n' "$result"
fi
