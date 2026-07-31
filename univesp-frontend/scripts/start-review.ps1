param(
  [ValidateSet('admin', 'op', 'aluno')]
  [string]$LocalProfile = 'aluno'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot ".env.local.$LocalProfile"
$targets = @(
  (Join-Path $projectRoot '.env.local'),
  (Join-Path $projectRoot '.env.development.local'),
  (Join-Path $projectRoot '.env.production.local')
)

if (-not (Test-Path $source)) {
  throw "Arquivo de perfil nao encontrado: $source"
}

foreach ($target in $targets) {
  Copy-Item $source $target -Force
}

Write-Host "[univesp-frontend] Perfil local ativado: $LocalProfile"
Write-Host '[univesp-frontend] Gerando build e iniciando preview local em http://localhost:8080/crm/'
Write-Host '[univesp-frontend] Mantenha este terminal aberto durante a homologacao.'

Push-Location $projectRoot
try {
  $buildSucceeded = $true

  try {
    & npm.cmd run build -- --mode development

    if ($LASTEXITCODE -ne 0) {
      $buildSucceeded = $false
    }
  } catch {
    $buildSucceeded = $false
    Write-Warning "[univesp-frontend] O build falhou. Vou tentar servir o dist existente para nao te bloquear."
  }

  $distIndex = Join-Path $projectRoot 'dist\index.html'

  if (Test-Path $distIndex) {
    if ($buildSucceeded) {
      Write-Host '[univesp-frontend] Build concluido. Servindo dist local em http://localhost:8080/crm/'
    } else {
      Write-Host '[univesp-frontend] Usando o ultimo dist disponivel em http://localhost:8080/crm/'
    }

    & node (Join-Path $PSScriptRoot 'serve-dist.mjs') --root (Join-Path $projectRoot 'dist') --port 8080 --base '/crm/'
  } else {
    Write-Host '[univesp-frontend] Fallback automatico: subindo Vite dev em http://localhost:8080/crm/'
    & npm.cmd run dev:local
  }
} finally {
  Pop-Location
}
