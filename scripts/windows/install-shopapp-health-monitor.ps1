$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$shopAppRoot = 'C:\ShopApp'
$maintenanceDirectory = Join-Path $shopAppRoot 'maintenance'
$logDirectory = Join-Path $shopAppRoot 'logs'
$monitorPath = Join-Path $maintenanceDirectory 'health-monitor.ps1'
$monitorLogPath = Join-Path $logDirectory 'health-monitor.log'
$monitorStatePath = Join-Path $logDirectory 'health-status.json'

New-Item -ItemType Directory -Path $maintenanceDirectory, $logDirectory -Force | Out-Null

$monitor = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$healthUri = 'http://127.0.0.1:3000/api/health'
$taskName = 'ShopApp'
$logPath = 'C:\ShopApp\logs\health-monitor.log'
$statePath = 'C:\ShopApp\logs\health-status.json'
$activityPaths = @(
  'C:\ShopApp\app\.runtime\drawing-import-active',
  'C:\ShopApp\app\.next\standalone\.runtime\drawing-import-active'
)
$activityMaxAgeMinutes = 45
$unresponsiveSincePath = 'C:\ShopApp\logs\health-unresponsive-since.txt'
$preRouteGraceMinutes = 5

function Write-MonitorLog([string]$message) {
  Add-Content -LiteralPath $logPath -Value ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $message)
}

function Write-HealthState([string]$status, [bool]$healthy, [bool]$restarted, [string]$detail) {
  [ordered]@{
    checkedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    computerName = $env:COMPUTERNAME
    status = $status
    healthy = $healthy
    restarted = $restarted
    detail = $detail
  } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
}

function Test-ShopAppHealth {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUri -TimeoutSec 4
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
      if ($attempt -lt 3) {
        Start-Sleep -Seconds 3
      }
    }
  }
  return $false
}

function Get-ActiveDrawingImports([int[]]$runtimeProcessIds) {
  $cutoff = (Get-Date).ToUniversalTime().AddMinutes(-$activityMaxAgeMinutes)
  $markers = @($activityPaths | ForEach-Object {
    if (Test-Path -LiteralPath $_) {
      Get-ChildItem -LiteralPath $_ -File -ErrorAction SilentlyContinue
    }
  })
  foreach ($marker in $markers) {
    $removeMarker = $marker.LastWriteTimeUtc -lt $cutoff
    if (-not $removeMarker) {
      try {
        $markerProcessId = [int](Get-Content -LiteralPath $marker.FullName -Raw | ConvertFrom-Json).processId
        $removeMarker = $runtimeProcessIds -notcontains $markerProcessId
      } catch {
        # A marker may be observed while its small JSON body is still being written.
      }
    }
    if ($removeMarker) {
      Remove-Item -LiteralPath $marker.FullName -Force -ErrorAction SilentlyContinue
    }
  }
  return @($markers | Where-Object { Test-Path -LiteralPath $_.FullName })
}

try {
  # Check the out-of-band activity marker before making an HTTP request. Large
  # drawing work can temporarily monopolize the application route runtime; the
  # marker plus exact Node command line is the safer liveness signal during that
  # bounded operation window.
  $runtimeProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*C:\ShopApp\app*.next*standalone*server.js*' })
  $runtimeProcessIds = @($runtimeProcesses | ForEach-Object { [int]$_.ProcessId })
  $activeImports = @(Get-ActiveDrawingImports -runtimeProcessIds $runtimeProcessIds)
  $runtimePresent = $runtimeProcesses.Count -gt 0
  if ($activeImports.Count -gt 0 -and $runtimePresent) {
    Remove-Item -LiteralPath $unresponsiveSincePath -Force -ErrorAction SilentlyContinue
    Write-MonitorLog ("Skipped HTTP health probes during $($activeImports.Count) active drawing import(s); the exact ShopApp Node runtime remains present.")
    Write-HealthState -status 'busy-import' -healthy $true -restarted $false -detail 'HTTP health probes were skipped because an active drawing import marker and the exact ShopApp Node runtime are both present.'
    exit 0
  }

  if (Test-ShopAppHealth) {
    Remove-Item -LiteralPath $unresponsiveSincePath -Force -ErrorAction SilentlyContinue
    Write-HealthState -status 'healthy' -healthy $true -restarted $false -detail 'Health endpoint returned HTTP 200.'
    exit 0
  }

  if ($runtimePresent) {
    $nowUtc = (Get-Date).ToUniversalTime()
    $unresponsiveSinceUtc = $null
    if (Test-Path -LiteralPath $unresponsiveSincePath) {
      $rawTimestamp = (Get-Content -LiteralPath $unresponsiveSincePath -Raw -ErrorAction SilentlyContinue).Trim()
      $parsedTimestamp = [datetime]::MinValue
      if ([datetime]::TryParse($rawTimestamp, [ref]$parsedTimestamp)) {
        $unresponsiveSinceUtc = $parsedTimestamp.ToUniversalTime()
      }
    }
    if ($null -eq $unresponsiveSinceUtc) {
      $unresponsiveSinceUtc = $nowUtc
      Set-Content -LiteralPath $unresponsiveSincePath -Value $nowUtc.ToString('o') -Encoding ascii
    }
    $unresponsiveMinutes = ($nowUtc - $unresponsiveSinceUtc).TotalMinutes
    if ($unresponsiveMinutes -lt $preRouteGraceMinutes) {
      Write-MonitorLog ("Health delayed while the ShopApp runtime remains present; restart deferred for the pre-route upload grace window ($([math]::Round($unresponsiveMinutes, 1))/$preRouteGraceMinutes minutes).")
      Write-HealthState -status 'pre-route-grace' -healthy $true -restarted $false -detail 'The runtime is present and may be receiving a large request body before the import handler can create its activity marker.'
      exit 0
    }
  }

  Write-MonitorLog 'Health failed three times; restarting only the ShopApp scheduled task.'
  Remove-Item -LiteralPath $unresponsiveSincePath -Force -ErrorAction SilentlyContinue
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*C:\ShopApp\app*.next*standalone*server.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-ScheduledTask -TaskName $taskName

  $recovered = $false
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 2
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUri -TimeoutSec 3
      if ($response.StatusCode -eq 200) {
        $recovered = $true
        break
      }
    } catch {
      # Continue while the standalone server starts.
    }
  }

  if (-not $recovered) {
    Write-MonitorLog 'Recovery failed: ShopApp remained unhealthy after task restart.'
    Write-HealthState -status 'failed' -healthy $false -restarted $true -detail 'Health remained unavailable for 60 seconds after restart.'
    exit 1
  }

  Write-MonitorLog 'Recovery passed: ShopApp returned HTTP 200 after task restart.'
  Remove-Item -LiteralPath $unresponsiveSincePath -Force -ErrorAction SilentlyContinue
  Write-HealthState -status 'recovered' -healthy $true -restarted $true -detail 'Health returned after restarting the ShopApp task.'
  exit 0
} catch {
  Write-MonitorLog ('Monitor failed: ' + $_.Exception.Message)
  Write-HealthState -status 'monitor-error' -healthy $false -restarted $false -detail $_.Exception.Message
  exit 1
}
'@

Set-Content -LiteralPath $monitorPath -Value $monitor -Encoding utf8

$taskName = 'ShopApp Health Monitor'
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\ShopApp\maintenance\health-monitor.ps1' `
  -WorkingDirectory $maintenanceDirectory
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 2) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal `
  -UserId 'SYSTEM' `
  -LogonType ServiceAccount `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Checks ShopApp every two minutes and restarts only the ShopApp task after three failed health probes.' `
  -Force | Out-Null

& $monitorPath
if ($LASTEXITCODE -ne 0) {
  throw "The immediate ShopApp health monitor check failed. Review $monitorLogPath."
}

Write-Output "MONITOR_TASK=$taskName"
Write-Output "MONITOR_SCRIPT=$monitorPath"
Write-Output "MONITOR_STATUS=$monitorStatePath"
Get-Content -LiteralPath $monitorStatePath
