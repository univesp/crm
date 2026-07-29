param(
  [string]$BaseUrl = "http://localhost:8080",
  [switch]$IncludeIngress,
  [switch]$IncludePwa
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
  $r = Invoke-WebRequest -Uri "$base/api/public/v1/knowledge/faq-published?faq_type=publico" -UseBasicParsing
  if ($r.StatusCode -ge 400) { throw "HTTP $($r.StatusCode)" }
  $payload = $r.Content | ConvertFrom-Json
  if ($payload.meta.runtime_schema -ne "3.0.0") {
    throw "Runtime FAQ nao esta em v3"
  }
  $pilot = @($payload.data | Where-Object {
    $_.bundle_id -eq "acesso-ava" -and $_.bundle_version_id -eq "acesso-ava-homolog-v1"
  })
  if ($pilot.Count -ne 1) {
    throw "Bundle acesso-ava-homolog-v1 nao publicado"
  }
}

Invoke-Smoke "Flags publicas FAQ v3" {
  $r = Invoke-WebRequest -Uri "$base/api/public/v1/runtime/flags" -UseBasicParsing
  $payload = $r.Content | ConvertFrom-Json
  foreach ($field in @(
    "faq_public_anonymous",
    "faq_public_documents",
    "faq_link_validation",
    "faq_public_email_thread"
  )) {
    if ($payload.data.$field -ne $true) {
      throw "Flag publica inativa: $field"
    }
  }
}

Invoke-Smoke "Academic stub (sessao requerida - skip se 401)" {
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

if ($IncludeIngress) {
  Invoke-Smoke "Ingress tickets (segredo requerido - skip se 401)" {
    try {
      $body = '{"channel":"email","subject":"Smoke ingress","description":"Teste automatico","student":{"email":"smoke@invalid.local"}}'
      $r = Invoke-WebRequest -Uri "$base/api/ingress/v1/tickets" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
      if ($r.StatusCode -ge 400) { throw "HTTP $($r.StatusCode)" }
    } catch {
      $status = $_.Exception.Response.StatusCode.value__
      if ($status -eq 401 -or $status -eq 403) {
        Write-Host "    SKIP: ingress exige X-Univesp-Ingress-Secret (configurar UNIVESP_INGRESS_SHARED_SECRET)" -ForegroundColor Yellow
        return
      }
      throw
    }
  }
}

if ($IncludePwa) {
Invoke-Smoke "PWA manifest" {
    $r = Invoke-WebRequest -Uri "$base/crm/manifest.webmanifest" -UseBasicParsing
    if ($r.StatusCode -ge 400) { throw "HTTP $($r.StatusCode)" }
  }
}

Write-Host ""
Write-Host "Smoke automatico concluido. Proximos passos manuais:" -ForegroundColor Yellow
Write-Host "  - Dev bypass: VITE_SSO_DEV_BYPASS=true, VITE_ENABLE_MOCKS=false"
Write-Host "  - GET /api/app/v1/students/HOMOLOG001/academic-summary (logado) - stub Fase D"
Write-Host "  - POST /api/app/v1/students/validate com CPF homolog apos seed student directory"
Write-Host "  - POST /api/ingress/v1/tickets com X-Univesp-Ingress-Secret (omnichannel)"
Write-Host "  - GET /crm/manifest.webmanifest (PWA shell OP/BPO)"
Write-Host "  - Flags opcionais: -IncludeIngress -IncludePwa"
