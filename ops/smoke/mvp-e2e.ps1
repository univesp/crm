param(
  [string]$BaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")

function Invoke-Smoke {
  param([string]$Label, [scriptblock]$Block)
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Block
  Write-Host "    OK" -ForegroundColor Green
}

Invoke-Smoke "BFF health" {
  $r = Invoke-WebRequest -Uri "$base/api/app/v1/health" -UseBasicParsing
  if ($r.StatusCode -ge 400) { throw "HTTP $($r.StatusCode)" }
}

Invoke-Smoke "FAQ publico (visitante)" {
  $r = Invoke-WebRequest -Uri "$base/api/public/v1/knowledge/faq-published?faq_type=publico" -UseBasicParsing
  if ($r.StatusCode -ge 400) { throw "HTTP $($r.StatusCode)" }
}

Write-Host ""
Write-Host "Smoke automatico concluido. Proximos passos manuais:" -ForegroundColor Yellow
Write-Host "  - Dev bypass: VITE_SSO_DEV_BYPASS=true, VITE_ENABLE_MOCKS=false"
Write-Host "  - Fluxos UI: ver ops/smoke/mvp-e2e.md secoes 2-5"
