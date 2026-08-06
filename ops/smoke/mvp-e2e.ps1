param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$AdminCookie = "",
  [string]$ForbiddenCookie = "",
  [string]$ResultPath = "",
  [switch]$IncludeIngress,
  [switch]$IncludePwa
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")
$matrix = New-Object System.Collections.Generic.List[object]

function Sanitize-Text {
  param([AllowNull()][string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
  $safe = [regex]::Replace($Value, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]')
  $safe = [regex]::Replace($safe, '(?<!\d)\d{11}(?!\d)', '[documento]')
  $safe = [regex]::Replace($safe, '(?i)(authorization|token|secret|password|cpf|senha)(\s*[:=]\s*)("[^"]*"|\S+)', '$1$2[redacted]')
  if ($safe.Length -gt 500) { return $safe.Substring(0, 500) + "..." }
  return $safe
}

function Get-HeaderValue {
  param($Headers, [string]$Name)
  if (-not $Headers) { return "" }
  try { return [string]$Headers[$Name] } catch { return "" }
}

function Invoke-MatrixRequest {
  param(
    [string]$Label,
    [string]$Method,
    [string]$Path,
    [string]$Context,
    [int[]]$Expected,
    [string]$Cookie = "",
    [string]$Body = "",
    [string]$ContentType = "",
    [scriptblock]$Validator = $null
  )

  $requestId = "smoke-" + [guid]::NewGuid().ToString("N")
  $headers = @{ "X-Request-ID" = $requestId }
  if ($Cookie) { $headers["Cookie"] = $Cookie }
  $status = $null
  $content = ""
  $responseHeaders = $null

  try {
    $requestArgs = @{
      Uri = "$base$Path"
      Method = $Method
      Headers = $headers
      UseBasicParsing = $true
    }
    if ($Body) {
      $requestArgs["Body"] = $Body
      $requestArgs["ContentType"] = if ($ContentType) { $ContentType } else { "application/json" }
    }
    $response = Invoke-WebRequest @requestArgs
    $status = [int]$response.StatusCode
    $content = [string]$response.Content
    $responseHeaders = $response.Headers
  } catch {
    $response = $_.Exception.Response
    if ($response) {
      $status = [int]$response.StatusCode
      $responseHeaders = $response.Headers
      try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Dispose()
      } catch {
        $content = $_.Exception.Message
      }
    } else {
      $content = $_.Exception.Message
    }
  }

  $responseRequestId = Get-HeaderValue $responseHeaders "X-Request-ID"
  $bodyObject = $null
  try { if ($content) { $bodyObject = $content | ConvertFrom-Json } } catch { $bodyObject = $null }
  $errorObject = if ($bodyObject) { $bodyObject.error } else { $null }
  $code = if ($errorObject) { [string]$errorObject.code } else { "" }
  $detail = ""
  if ($errorObject) {
    if ($errorObject.details) { $detail = [string]$errorObject.details }
    else { $detail = [string]$errorObject.message }
  }
  if (-not $detail -and $bodyObject) {
    if ($bodyObject.message) { $detail = [string]$bodyObject.message }
    else { $detail = [string]$bodyObject.exc_type }
  }
  $passed = $false
  if ($null -ne $status) { $passed = $Expected -contains [int]$status }
  if ($passed -and $Validator) {
    try { & $Validator $bodyObject }
    catch {
      $passed = $false
      $code = "CONTRACT_INVALID"
      $detail = $_.Exception.Message
    }
  }
  $logRequestId = if ($responseRequestId) { $responseRequestId } else { $requestId }
  $action = if ($passed) {
    "OK"
  } else {
    "Correlacionar $logRequestId no gateway e no Frappe; validar causa antes de patch"
  }
  $row = [pscustomobject]@{
    Rota = $Path
    Metodo = $Method
    Contexto = $Context
    Status = if ($null -eq $status) { "ERR" } else { [int]$status }
    Esperado = ($Expected -join "/")
    Ok = $passed
    RequestId = $logRequestId
    Codigo = Sanitize-Text $code
    Detalhe = Sanitize-Text $detail
    Acao = $action
    Log = "gateway: /var/log/supervisor/sso-gateway-*; frappe: /var/log/frappe/*"
  }
  $matrix.Add($row)
  return $row
}

function Add-Skipped {
  param([string]$Path, [string]$Method, [string]$Context, [string]$Reason)
  $row = [pscustomobject]@{
    Rota = $Path; Metodo = $Method; Contexto = $Context; Status = "SKIP"; Esperado = ""; Ok = $false
    RequestId = ""; Codigo = ""; Detalhe = $Reason; Acao = "Fornecer o cookie da persona e repetir"; Log = ""
  }
  $matrix.Add($row)
  return $row
}

Write-Host "=== BASELINE API / HOMOLOG ===" -ForegroundColor Cyan

foreach ($path in @("/healthz", "/health")) {
  Invoke-MatrixRequest "Health" "GET" $path "public" @(200) | Out-Null
}
Invoke-MatrixRequest "Frontend" "GET" "/" "public" @(200) | Out-Null
$flagsValidator = {
  param($payload)
  foreach ($field in @("faq_public_anonymous", "faq_public_documents", "faq_link_validation", "faq_public_email_thread")) {
    if ($payload.data.$field -ne $true) { throw "Flag publica inativa: $field" }
  }
}
$faqValidator = {
  param($payload)
  if ($payload.meta.runtime_schema -ne "3.0.0") { throw "Runtime FAQ nao esta em v3" }
  $pilot = @($payload.data | Where-Object {
    $_.bundle_id -eq "acesso-ava" -and $_.bundle_version_id -eq "acesso-ava-homolog-v1"
  })
  if ($pilot.Count -ne 1) { throw "Bundle acesso-ava-homolog-v1 nao publicado" }
}
Invoke-MatrixRequest "Flags publicas" "GET" "/api/public/v1/runtime/flags" "public" @(200) -Validator $flagsValidator | Out-Null
Invoke-MatrixRequest "FAQ publicada" "GET" "/api/public/v1/knowledge/faq-published?faq_type=publico" "public" @(200) -Validator $faqValidator | Out-Null

$adminRoutes = @(
  "/api/app/v1/admin/access-groups",
  "/api/app/v1/admin/permission-profiles",
  "/api/app/v1/admin/profile-assignments",
  "/api/app/v1/knowledge/v3/bundles?status=active&page_size=100",
  "/api/app/v1/knowledge/v3/bundles/teste/versions?page_size=100",
  "/api/app/v1/admin/runtime-settings"
)
foreach ($path in $adminRoutes) {
  Invoke-MatrixRequest "Sem sessao" "GET" $path "sem-sessao" @(401) | Out-Null
}

if ($AdminCookie) {
  foreach ($path in $adminRoutes) {
    Invoke-MatrixRequest "Admin" "GET" $path "admin-cookie" @(200) $AdminCookie | Out-Null
  }
} else {
  foreach ($path in $adminRoutes) { Add-Skipped $path "GET" "admin-cookie" "Cookie de admin nao informado" | Out-Null }
}

if ($ForbiddenCookie) {
  foreach ($path in @(
    "/api/app/v1/admin/access-groups",
    "/api/app/v1/admin/permission-profiles",
    "/api/app/v1/admin/profile-assignments"
  )) {
    Invoke-MatrixRequest "Sem escopo" "GET" $path "persona-sem-escopo" @(403) $ForbiddenCookie | Out-Null
  }
} else {
  foreach ($path in @(
    "/api/app/v1/admin/access-groups",
    "/api/app/v1/admin/permission-profiles",
    "/api/app/v1/admin/profile-assignments"
  )) { Add-Skipped $path "GET" "persona-sem-escopo" "Cookie de persona sem escopo nao informado" | Out-Null }
}

if ($IncludeIngress) {
  Invoke-MatrixRequest "Ingress" "POST" "/api/ingress/v1/tickets" "public-sem-segredo" @(401,403) "" '{"channel":"email","subject":"Smoke ingress","description":"Teste automatico","student":{"email":"smoke@invalid.local"}}' "application/json" | Out-Null
}
if ($IncludePwa) {
  Invoke-MatrixRequest "PWA manifest" "GET" "/crm/manifest.webmanifest" "public" @(200) | Out-Null
}

Write-Host ""
$matrix | Format-Table Rota, Metodo, Contexto, Status, Esperado, Ok, RequestId, Codigo, Detalhe -AutoSize
if ($ResultPath) {
  $matrix | ConvertTo-Json -Depth 8 | Set-Content -Path $ResultPath -Encoding UTF8
  Write-Host "Matriz salva em $ResultPath" -ForegroundColor Yellow
}

$failed = @($matrix | Where-Object { -not $_.Ok -and $_.Status -ne "SKIP" })
if ($failed.Count -gt 0) {
  throw "Smoke encontrou $($failed.Count) resultado(s) fora do esperado."
}
Write-Host "Smoke concluido. Linhas SKIP exigem cookie de persona para completar 200/403." -ForegroundColor Green
