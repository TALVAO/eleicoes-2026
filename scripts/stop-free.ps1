$ErrorActionPreference = 'Stop'
$taskWorkspace = Split-Path -Parent $PSScriptRoot
$taskStatePath = Join-Path $taskWorkspace '.local/free/processes.json'
if (Test-Path -LiteralPath $taskStatePath) {
  $taskState = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
  foreach ($taskOwned in $taskState.processes) {
    $taskRunning = Get-Process -Id $taskOwned.id -ErrorAction SilentlyContinue
    if ($taskRunning -and $taskRunning.ProcessName -eq 'node' -and $taskRunning.StartTime.ToUniversalTime() -eq ([DateTime]$taskOwned.startedAt).ToUniversalTime()) {
      $taskCommand = (Get-CimInstance Win32_Process -Filter "ProcessId=$($taskOwned.id)").CommandLine
      if ($taskCommand.Contains($taskOwned.executable) -and $taskOwned.executable.StartsWith($taskWorkspace + '\')) {
        $taskChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($taskOwned.id)")
        $taskQueue = @($taskChildren)
        while ($taskQueue.Count -gt 0) {
          $taskChild = $taskQueue[0]
          $taskQueue = @($taskQueue | Select-Object -Skip 1)
          $taskDescendants = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($taskChild.ProcessId)")
          $taskChildren += $taskDescendants
          $taskQueue += $taskDescendants
        }
        foreach ($taskChild in ($taskChildren | Sort-Object CreationDate -Descending)) {
          $taskLiveChild = Get-CimInstance Win32_Process -Filter "ProcessId=$($taskChild.ProcessId)"
          if ($taskLiveChild -and $taskLiveChild.CreationDate -eq $taskChild.CreationDate) { Stop-Process -Id $taskChild.ProcessId -ErrorAction SilentlyContinue }
        }
        # A parent can exit while its workers are being stopped.
        Stop-Process -Id $taskOwned.id -ErrorAction SilentlyContinue
      } else { throw 'Identidade do helper não corresponde ao projeto.' }
    }
  }
  Remove-Item -LiteralPath $taskStatePath
}
docker stop eleicoes2026-worker-local | Out-Null
docker stop eleicoes2026-redis-local | Out-Null
Write-Output 'Helpers e containers deste projeto parados; o site público ficará indisponível.'
