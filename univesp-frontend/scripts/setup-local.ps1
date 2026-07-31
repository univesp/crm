param(
  [switch]$SkipInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host "[univesp-frontend] $Message"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js nao encontrado. Instale Node 20 LTS antes de continuar.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm nao encontrado. Instale npm 10 ou superior antes de continuar.'
}

Write-Step "Node: $(node --version)"
Write-Step "npm: $(npm --version)"

if (-not (Test-Path '.env.local') -and (Test-Path '.env.example')) {
  Copy-Item '.env.example' '.env.local'
  Write-Step '.env.local criado a partir de .env.example'
}

if (-not $SkipInstall) {
  Write-Step 'Executando npm install'
  npm install
}

Write-Step 'Proximos comandos recomendados:'
Write-Host '  npm run dev'
Write-Host '  npm run lint'
Write-Host '  npm run typecheck'
Write-Host '  npm run build'
Write-Host '  npm run preview'
