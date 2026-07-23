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

Invoke-Smoke "Stack health" {
  $healthPaths = @("$base/healthz", "$base/health")
  $ok = $false
  foreach ($path in $healthPaths) {
    try {
      $r = Invoke-WebRequest -Uri $path -UseBasicParsing
      if ($r.StatusCode -lt 400) { $ok = $true; break }
    } catch {
      continue
    }
  }
  if (-not $ok) { throw "Nenhum endpoint de health respondeu em $base" }
}

Invoke-Smoke "FAQ publico (visitante)" {
  try {
    $r = Invoke-WebRequest -Uri "$base/api/public/v1/knowledge/faq-published?faq_type=publico" -UseBasicParsing
    if ($r.StatusCode -ge 400) { throw "HTTP $($r.StatusCode)" }
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 404) {
      Write-Host "    AVISO: 404 - branch MVP ainda nao deployada neste ambiente" -ForegroundColor Yellow
      return
    }
    throw
  }
}

Invoke-Smoke "Academic stub (sessao requerida — skip se 401)" {
  try {
    $r = Invoke-WebRequest -Uri "$base/api/app/v1/students/HOMOLOG001/academic-summary" -UseBasicParsing
    if ($r.StatusCode -ge 400) { throw "HTTP $($r.StatusCode)" }
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401 -or $status -eq 403) {
      Write-Host "    SKIP: endpoint exige sessao BFF (testar manualmente com dev bypass)" -ForegroundColor Yellow
      return
    }
    if ($status -eq 404) {
      Write-Host "    AVISO: 404 - rota academic-summary ainda nao deployada" -ForegroundColor Yellow
      return
    }
    throw
  }
}

Write-Host ""
Write-Host "Smoke automatico concluido. Proximos passos manuais:" -ForegroundColor Yellow
Write-Host "  - Dev bypass: VITE_SSO_DEV_BYPASS=true, VITE_ENABLE_MOCKS=false"
Write-Host "  - GET /api/app/v1/students/HOMOLOG001/academic-summary (logado) — stub Fase D"
Write-Host "  - POST /api/app/v1/students/validate com CPF homolog apos seed student directory"
Write-Host "  - Fluxos UI: ver ops/smoke/mvp-e2e.md secoes 2-5"
