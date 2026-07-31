Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot '.env.local.admin'
$targets = @(
  (Join-Path $projectRoot '.env.local'),
  (Join-Path $projectRoot '.env.development.local')
)

if (-not (Test-Path $source)) {
  throw "Arquivo nao encontrado: $source"
}

foreach ($target in $targets) {
  Copy-Item $source $target -Force
}

Write-Host '[univesp-frontend] Perfil Admin ativado em .env.local e .env.development.local'
Write-Host '[univesp-frontend] Reinicie o Vite se ele ja estiver em execucao.'
