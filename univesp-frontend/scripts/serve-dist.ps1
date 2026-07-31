param(
  [string]$Root = '',
  [int]$Port = 8080,
  [string]$BasePath = '/crm/'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $Root) {
  $Root = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist'
}

if (-not (Test-Path $Root)) {
  throw "Pasta dist nao encontrada: $Root"
}

if (-not $BasePath.StartsWith('/')) {
  $BasePath = "/$BasePath"
}

if (-not $BasePath.EndsWith('/')) {
  $BasePath = "$BasePath/"
}

$contentTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'application/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif' = 'image/gif'
  '.webp' = 'image/webp'
  '.ico' = 'image/x-icon'
  '.txt' = 'text/plain; charset=utf-8'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
}

function Get-ContentType([string]$Path) {
  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($contentTypes.ContainsKey($extension)) {
    return $contentTypes[$extension]
  }

  return 'application/octet-stream'
}

function Write-Redirect($Response, [string]$Location) {
  $Response.StatusCode = 302
  $Response.RedirectLocation = $Location
  $Response.Close()
}

function Write-Bytes($Response, [byte[]]$Bytes, [string]$ContentType) {
  $Response.StatusCode = 200
  $Response.ContentType = $ContentType
  $Response.ContentLength64 = $Bytes.Length
  $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $Response.OutputStream.Close()
}

function Write-Text($Response, [int]$StatusCode, [string]$Body) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = 'text/plain; charset=utf-8'
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Response.OutputStream.Close()
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host "[univesp-frontend] Servindo dist estatico em http://localhost:$Port$BasePath"
Write-Host '[univesp-frontend] Pressione Ctrl + C para encerrar.'

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.AbsolutePath

    if ($path -eq '/') {
      Write-Redirect $response $BasePath
      continue
    }

    if (-not $path.StartsWith($BasePath, [System.StringComparison]::OrdinalIgnoreCase)) {
      Write-Text $response 404 'Rota fora do escopo do preview local.'
      continue
    }

    $relativePath = $path.Substring($BasePath.Length)
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = 'index.html'
    }

    $safeRelativePath = $relativePath -replace '/', '\'
    $candidatePath = Join-Path $Root $safeRelativePath

    if ((Test-Path $candidatePath) -and -not (Get-Item $candidatePath).PSIsContainer) {
      $bytes = [System.IO.File]::ReadAllBytes($candidatePath)
      Write-Bytes $response $bytes (Get-ContentType $candidatePath)
      continue
    }

    $hasExtension = [System.IO.Path]::GetExtension($candidatePath)
    $spaFallbackPath = Join-Path $Root 'index.html'

    if (-not $hasExtension -and (Test-Path $spaFallbackPath)) {
      $bytes = [System.IO.File]::ReadAllBytes($spaFallbackPath)
      Write-Bytes $response $bytes 'text/html; charset=utf-8'
      continue
    }

    Write-Text $response 404 'Arquivo nao encontrado no preview local.'
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }

  $listener.Close()
}
