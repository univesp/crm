#!/usr/bin/env bash
# Readiness local — valida artefatos do repo sem deploy GCP.
set -Eeuo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
failures=0

check_file() {
  local label=$1 path=$2
  if [[ -f "$path" ]]; then
    printf 'OK   %s\n' "$label"
  else
    printf 'FALTA %s (%s)\n' "$label" "$path"
    failures=$((failures + 1))
  fi
}

check_executable() {
  local label=$1 path=$2
  if [[ -x "$path" ]]; then
    printf 'OK   %s\n' "$label"
  elif [[ -f "$path" ]]; then
    printf 'AVISO %s existe mas nao e executavel\n' "$label"
  else
    printf 'FALTA %s (%s)\n' "$label" "$path"
    failures=$((failures + 1))
  fi
}

printf '== Cloud Run local readiness ==\n'
check_file "preflight-homolog.sh" "$ROOT/ops/cloudrun/preflight-homolog.sh"
check_file "smoke-homolog.sh" "$ROOT/ops/cloudrun/smoke-homolog.sh"
check_file "deploy.sh" "$ROOT/ops/cloudrun/deploy.sh"
check_file "rollback.sh" "$ROOT/ops/cloudrun/rollback.sh"
check_file "env.vm.example" "$ROOT/env.vm.example"
check_file "docker-compose.vm.yml" "$ROOT/docker-compose.vm.yml"
check_file "sso-gateway Dockerfile" "$ROOT/sso-gateway/Dockerfile"
check_file "univesp-frontend Dockerfile" "$ROOT/univesp-frontend/Dockerfile"
check_file "TI handoff" "$ROOT/docs/TI_HOMOLOGACAO.md"
check_file "GCS site_config doc" "$ROOT/docs/ops/gcs-frappe-site-config.example.md"
check_executable "validate-gcs-site-config.sh" "$ROOT/ops/vm/scripts/validate-gcs-site-config.sh"

if command -v python3 >/dev/null 2>&1; then
  if python3 -m unittest discover -s "$ROOT/ops/cloudrun/tests" -p 'test_*.py' -q 2>/dev/null; then
    printf 'OK   ops/cloudrun/tests (unittest)\n'
  else
    printf 'FALHA ops/cloudrun/tests\n'
    failures=$((failures + 1))
  fi
fi

if [[ $failures -gt 0 ]]; then
  printf '\n%d falha(s). Corrija antes do handoff TI.\n' "$failures"
  exit 1
fi
printf '\nArtefatos locais OK. Proximo passo TI: PREFLIGHT_MODE=gcp ops/cloudrun/preflight-homolog.sh\n'
