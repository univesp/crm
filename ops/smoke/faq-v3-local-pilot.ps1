param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$python = (Get-Command python -ErrorAction Stop).Source

function Invoke-Checked {
  param(
    [string]$Label,
    [string]$Directory,
    [scriptblock]$Command
  )
  Write-Host "==> $Label" -ForegroundColor Cyan
  Push-Location $Directory
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) {
      throw "$Label falhou com exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
  Write-Host "    OK" -ForegroundColor Green
}

Invoke-Checked "Contratos puros do backend FAQ v3" $repoRoot {
  $env:PYTHONPATH = (Resolve-Path "univesp_atendimento_app").Path
  & $python -m unittest `
    univesp_atendimento.tests.test_knowledge_blocks `
    univesp_atendimento.tests.test_knowledge_asset_security `
    univesp_atendimento.tests.test_cloud_service_auth `
    univesp_atendimento.tests.test_knowledge_graph `
    univesp_atendimento.tests.test_knowledge_migration `
    univesp_atendimento.tests.test_routing_engine `
    univesp_atendimento.tests.test_link_validation `
    univesp_atendimento.tests.test_public_email_security
}

Invoke-Checked "Autenticação, ingress e proteção do gateway" (Join-Path $repoRoot "sso-gateway") {
  npm test
}

Invoke-Checked "Lint e tipos do frontend" (Join-Path $repoRoot "univesp-frontend") {
  npm run lint
  if ($LASTEXITCODE -eq 0) { npm run typecheck }
}

Invoke-Checked "Contratos canônicos do CRM" (Join-Path $repoRoot "univesp-frontend") {
  npm run test:foundation
}

if (-not $SkipBuild) {
  Invoke-Checked "Build de produção" (Join-Path $repoRoot "univesp-frontend") {
    npm run build
  }
}

Invoke-Checked "Piloto E2E acesso-ava e personas" (Join-Path $repoRoot "univesp-frontend") {
  npx playwright test `
    e2e/admin-faq-library.spec.js `
    e2e/faq-sticky-version.spec.js `
    e2e/knowledge-collaboration.spec.js `
    e2e/published-faq-personas.spec.js `
    e2e/student-published-faq.spec.js `
    e2e/mvp-wiring.spec.js `
    --workers=1 `
    --reporter=line
}

Write-Host ""
Write-Host "Piloto local FAQ v3 concluído sem falhas." -ForegroundColor Green
Write-Host "O ensaio contra Frappe/GCS/SMTP reais usa ops/smoke/mvp-e2e.ps1 após o deploy."
