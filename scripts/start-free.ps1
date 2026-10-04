param([switch]$PublishGateway)
$ErrorActionPreference = 'Stop'
$taskWorkspace = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskWorkspace
$taskRuntime = Join-Path $taskWorkspace '.local/free'
New-Item -ItemType Directory -Force -Path $taskRuntime | Out-Null
$taskStatePath = Join-Path $taskRuntime 'processes.json'
if (Test-Path -LiteralPath $taskStatePath) {
  $taskPrevious = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
  foreach ($taskOwned in $taskPrevious.processes) {
    $taskRunning = Get-Process -Id $taskOwned.id -ErrorAction SilentlyContinue
    if ($taskRunning -and $taskRunning.StartTime.ToUniversalTime() -eq ([DateTime]$taskOwned.startedAt).ToUniversalTime()) {
      throw 'Os helpers já estão ativos. Use stop-free.ps1 antes de reiniciar.'
    }
  }
}
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskServerCLI = Join-Path $taskWorkspace 'node_modules/next/dist/bin/next'
$taskTunnelCLI = Join-Path $taskWorkspace '.local/tools/localtunnel/node_modules/localtunnel/bin/lt.js'
foreach ($taskCLI in @($taskServerCLI, $taskTunnelCLI)) {
  if (!(Test-Path -LiteralPath $taskCLI)) { throw "Ferramenta local ausente: $taskCLI" }
}
foreach ($taskContainer in @('eleicoes2026-redis-local','eleicoes2026-worker-local')) {
  $taskStatus = docker inspect $taskContainer --format '{{.State.Running}}' 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Container local ausente: $taskContainer" }
  if ($taskStatus -ne 'true') { docker start $taskContainer | Out-Null }
}
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  throw 'A porta 3000 já está em uso. Pare somente o servidor deste projeto antes de iniciar.'
}
$env:REDIS_URL = 'redis://127.0.0.1:6386/0'
$env:LIVE_TRANSPORT = 'polling'
$env:SITE_URL = 'https://eleicoes-2026-plum.vercel.app'
$env:NODE_OPTIONS = '--use-system-ca'
$taskTokenPath = Join-Path $taskRuntime 'gateway-token.txt'
if (!(Test-Path -LiteralPath $taskTokenPath)) { throw 'Segredo do gateway ausente; configure-o localmente e na Vercel antes de iniciar.' }
$env:FREE_GATEWAY_TOKEN = (Get-Content -LiteralPath $taskTokenPath -Raw).Trim()
$taskChatTokenPath = Join-Path $taskRuntime 'chat-admin-token.txt'
if (!(Test-Path -LiteralPath $taskChatTokenPath)) {
  [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant() | Set-Content -LiteralPath $taskChatTokenPath -Encoding utf8
}
$env:CHAT_ADMIN_TOKEN = (Get-Content -LiteralPath $taskChatTokenPath -Raw).Trim()
$taskProcesses = @()
function Save-Helpers {
  @{ processes = $taskProcesses } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $taskStatePath -Encoding utf8
}
$taskServer = Start-Process -FilePath $taskNode -ArgumentList @(('"' + $taskServerCLI + '"'),'start','--hostname','127.0.0.1') -WorkingDirectory $taskWorkspace -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'server.log') -RedirectStandardError (Join-Path $taskRuntime 'server.err.log')
$taskProcesses += @{ id = $taskServer.Id; startedAt = $taskServer.StartTime.ToUniversalTime().ToString('o'); role = 'server'; executable = $taskServerCLI }
Save-Helpers
$taskServerReady = $false
for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
  try { Invoke-WebRequest 'http://127.0.0.1:3000/api/catalog' -Headers @{ 'x-free-gateway-token' = $env:FREE_GATEWAY_TOKEN; 'x-free-gateway-nonce' = [Guid]::NewGuid().ToString() } -TimeoutSec 2 | Out-Null; $taskServerReady = $true; break } catch { Start-Sleep -Milliseconds 500 }
}
if (!$taskServerReady) { throw 'O servidor não iniciou. Consulte .local/free/server.err.log.' }
$taskServerOwner = (Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -First 1).OwningProcess
$taskRealServer = Get-Process -Id $taskServerOwner
$taskProcesses[0] = @{ id = $taskRealServer.Id; startedAt = $taskRealServer.StartTime.ToUniversalTime().ToString('o'); role = 'server'; executable = $taskServerCLI }
Save-Helpers
$taskTunnelLog = Join-Path $taskRuntime 'tunnel.log'
$taskTunnel = Start-Process -FilePath $taskNode -ArgumentList @(('"' + $taskTunnelCLI + '"'),'--port','3000','--local-host','127.0.0.1','--subdomain','tender-beans-juggle') -WorkingDirectory $taskWorkspace -WindowStyle Hidden -PassThru -RedirectStandardOutput $taskTunnelLog -RedirectStandardError (Join-Path $taskRuntime 'tunnel.err.log')
$taskProcesses += @{ id = $taskTunnel.Id; startedAt = $taskTunnel.StartTime.ToUniversalTime().ToString('o'); role = 'tunnel'; executable = $taskTunnelCLI }
Save-Helpers
$taskOrigin = $null
for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
  $taskLog = Get-Content -LiteralPath $taskTunnelLog -Raw -ErrorAction SilentlyContinue
  if ($taskLog -match 'https://[a-z0-9-]+\.loca\.lt') { $taskOrigin = $Matches[0]; break }
  Start-Sleep -Milliseconds 500
}
if (!$taskOrigin) { throw 'O túnel não abriu. Consulte .local/free/tunnel.err.log.' }
$taskRealTunnelInfo = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($taskTunnelCLI) } | Sort-Object CreationDate -Descending | Select-Object -First 1
if (!$taskRealTunnelInfo) { throw 'Não foi possível identificar o processo do túnel deste projeto.' }
$taskRealTunnel = Get-Process -Id $taskRealTunnelInfo.ProcessId
$taskProcesses[1] = @{ id = $taskRealTunnel.Id; startedAt = $taskRealTunnel.StartTime.ToUniversalTime().ToString('o'); role = 'tunnel'; executable = $taskTunnelCLI }
Save-Helpers
$taskHealthy = $false
$taskHealthDeadline = [DateTime]::UtcNow.AddSeconds(45)
while ([DateTime]::UtcNow -lt $taskHealthDeadline) {
  try {
    $taskNonce = [Guid]::NewGuid().ToString()
    $taskProbe = Invoke-WebRequest ($taskOrigin + '/api/health') -Headers @{ 'bypass-tunnel-reminder' = 'true'; 'x-free-gateway-token' = $env:FREE_GATEWAY_TOKEN; 'x-free-gateway-nonce' = $taskNonce } -TimeoutSec 3 -SkipHttpErrorCheck
    $taskHealth = $taskProbe.Content | ConvertFrom-Json
    $taskHmac = [Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($env:FREE_GATEWAY_TOKEN))
    try { $taskProof = [Convert]::ToHexString($taskHmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($taskNonce))).ToLowerInvariant() } finally { $taskHmac.Dispose() }
    if ($taskProbe.Headers['x-free-gateway-origin'] -eq $taskProof -and $taskHealth.heartbeatAt -and ([DateTime]$taskHealth.heartbeatAt).ToUniversalTime() -gt [DateTime]::UtcNow.AddSeconds(-45)) {
      $taskHealthy = $true
      break
    }
  } catch { Start-Sleep -Milliseconds 500 }
}
if (!$taskHealthy) { throw 'O worker ainda não tem heartbeat recente autenticado; confira o Docker e /api/health antes de publicar.' }
@{ origin = $taskOrigin; publicUrl = $env:SITE_URL; checkedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRuntime 'connection.json') -Encoding utf8
Write-Output "Servidor e túnel ativos: $taskOrigin"
if ($PublishGateway) {
  npx --yes vercel@62.2.0 env update GATEWAY_ORIGIN production --value $taskOrigin --yes --cwd deploy/free-gateway --scope otavio-junior-oliveira-linos-projects
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar o gateway; execute o login Vercel.' }
  npx --yes vercel@62.2.0 deploy --prod --yes --cwd deploy/free-gateway --scope otavio-junior-oliveira-linos-projects
  if ($LASTEXITCODE -ne 0) { throw 'Falha na publicação do gateway.' }
} else {
  Write-Output 'Após reiniciar um túnel, publique o gateway com -PublishGateway para atualizar sua origem.'
}
Write-Output "Site: $env:SITE_URL — mantenha este computador ligado e conectado."
