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
    if ($taskRunning -and $taskRunning.StartTime.ToUniversalTime().ToString('o') -eq $taskOwned.startedAt) {
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
$taskProcesses = @()
function Save-Helpers {
  @{ processes = $taskProcesses } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $taskStatePath -Encoding utf8
}
$taskServer = Start-Process -FilePath $taskNode -ArgumentList @(('"' + $taskServerCLI + '"'),'start','--hostname','127.0.0.1') -WorkingDirectory $taskWorkspace -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'server.log') -RedirectStandardError (Join-Path $taskRuntime 'server.err.log')
$taskProcesses += @{ id = $taskServer.Id; startedAt = $taskServer.StartTime.ToUniversalTime().ToString('o'); role = 'server'; executable = $taskServerCLI }
Save-Helpers
$taskServerReady = $false
for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
  try { Invoke-WebRequest 'http://127.0.0.1:3000/api/catalog' -TimeoutSec 2 | Out-Null; $taskServerReady = $true; break } catch { Start-Sleep -Milliseconds 500 }
}
if (!$taskServerReady) { throw 'O servidor não iniciou. Consulte .local/free/server.err.log.' }
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
Invoke-WebRequest ($taskOrigin + '/api/health') -Headers @{ 'bypass-tunnel-reminder' = 'true' } -TimeoutSec 15 | Out-Null
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
