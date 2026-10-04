$ErrorActionPreference = 'Stop'
$taskWorkspace = Split-Path -Parent $PSScriptRoot
$taskStatePath = Join-Path $taskWorkspace '.local/free/processes.json'
if (Test-Path -LiteralPath $taskStatePath) {
  $taskState = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
  foreach ($taskOwned in $taskState.processes) {
    $taskRunning = Get-Process -Id $taskOwned.id -ErrorAction SilentlyContinue
    if ($taskRunning -and $taskRunning.ProcessName -eq 'node' -and $taskRunning.StartTime.ToUniversalTime().ToString('o') -eq $taskOwned.startedAt) {
      $taskCommand = (Get-CimInstance Win32_Process -Filter "ProcessId=$($taskOwned.id)").CommandLine
      if ($taskCommand.Contains($taskOwned.executable) -and $taskOwned.executable.StartsWith($taskWorkspace + '\')) {
        Stop-Process -Id $taskOwned.id
      } else { throw 'Identidade do helper não corresponde ao projeto.' }
    }
  }
  Remove-Item -LiteralPath $taskStatePath
}
docker stop eleicoes2026-worker-local | Out-Null
docker stop eleicoes2026-redis-local | Out-Null
Write-Output 'Helpers e containers deste projeto parados; o site público ficará indisponível.'
