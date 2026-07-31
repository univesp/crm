param(
  [ValidateSet('admin', 'op', 'aluno')]
  [string]$LocalProfile = 'admin',
  [int]$Port = 8081,
  [int]$MockApiPort = 8787
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot ".env.local.$LocalProfile"

if (-not (Test-Path $source)) {
  throw "Arquivo de perfil nao encontrado: $source"
}

$envContent = Get-Content $source -Raw
$envContent = $envContent -replace '(?m)^VITE_DEV_PORT=.*$', "VITE_DEV_PORT=$Port"
$envContent = $envContent -replace '(?m)^VITE_PREVIEW_PORT=.*$', "VITE_PREVIEW_PORT=$Port"
if ($envContent -notmatch '(?m)^VITE_SSO_GATEWAY_PROXY_TARGET=') {
  $envContent += "`nVITE_SSO_GATEWAY_PROXY_TARGET=http://127.0.0.1:$MockApiPort`n"
} else {
  $envContent = $envContent -replace '(?m)^VITE_SSO_GATEWAY_PROXY_TARGET=.*$', "VITE_SSO_GATEWAY_PROXY_TARGET=http://127.0.0.1:$MockApiPort"
}

$targets = @(
  (Join-Path $projectRoot '.env.local'),
  (Join-Path $projectRoot '.env.development.local')
)

foreach ($target in $targets) {
  Set-Content -Path $target -Value $envContent -Encoding utf8
}

Write-Host "[univesp-frontend] Perfil local: $LocalProfile"
Write-Host "[univesp-frontend] Frontend: http://localhost:$Port/crm/acesso-local"
Write-Host "[univesp-frontend] Biblioteca FAQ v3: http://localhost:$Port/crm/acesso-local/admin_central?redirect=%2Fadmin%2Ffaq"
Write-Host "[univesp-frontend] Editor FAQ v3: http://localhost:$Port/crm/acesso-local/admin_central?redirect=%2Fadmin%2Ffaq-editor%2Facesso-ava"
Write-Host "[univesp-frontend] Mock API: http://127.0.0.1:$MockApiPort"

Push-Location $projectRoot
try {
  $env:DEV_MOCK_API_PORT = "$MockApiPort"
  $mockRunning = $false
  try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:$MockApiPort/api/app/v1/knowledge/v3/catalogs" -UseBasicParsing -TimeoutSec 2
    $mockRunning = $true
    Write-Host '[univesp-frontend] Mock API ja ativo; reutilizando instancia existente.'
  } catch {
    $mockRunning = $false
  }

  if (-not $mockRunning) {
    Start-Process -FilePath 'node' -ArgumentList (Join-Path $PSScriptRoot 'dev-mock-api.mjs') -WorkingDirectory $projectRoot -WindowStyle Minimized | Out-Null
    Start-Sleep -Seconds 1
  }

  & npm.cmd run dev:local -- --port $Port
} finally {
  Pop-Location
}
