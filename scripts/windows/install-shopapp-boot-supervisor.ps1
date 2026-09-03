$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$shopAppRoot = 'C:\ShopApp'
$maintenanceDirectory = Join-Path $shopAppRoot 'maintenance'
$logDirectory = Join-Path $shopAppRoot 'logs'
$supervisorPath = Join-Path $maintenanceDirectory 'boot-supervisor.ps1'
$supervisorLogPath = Join-Path $logDirectory 'boot-supervisor.log'
$adminWorkstationAddress = '192.168.254.132'
$shopSubnet = '192.168.254.0/24'

if (-not (Test-Path -LiteralPath $shopAppRoot)) {
  throw 'C:\ShopApp does not exist. Deploy ShopApp before installing its boot supervisor.'
}

New-Item -ItemType Directory -Path $maintenanceDirectory, $logDirectory -Force | Out-Null

$supervisor = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$logPath = 'C:\ShopApp\logs\boot-supervisor.log'

function Write-BootLog([string]$message) {
  Add-Content -LiteralPath $logPath -Value ((Get-Date).ToString('o') + ' ' + $message)
}

try {
  Write-BootLog 'Supervisor started.'

  Set-Service -Name sshd -StartupType Automatic
  if ((Get-Service sshd).Status -ne 'Running') {
    Start-Service sshd
  }

  Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -Enabled True -Profile Any -Action Allow
  Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' |
    Get-NetFirewallAddressFilter |
    Set-NetFirewallAddressFilter -RemoteAddress '192.168.254.132'

  Set-NetFirewallRule -Name 'ShopApp-LAN-In-TCP' -Enabled True -Profile Any -Action Allow
  Get-NetFirewallRule -Name 'ShopApp-LAN-In-TCP' |
    Get-NetFirewallAddressFilter |
    Set-NetFirewallAddressFilter -RemoteAddress '192.168.254.0/24'

  Set-Service -Name iphlpsvc -StartupType Automatic
  if ((Get-Service iphlpsvc).Status -ne 'Running') {
    Start-Service iphlpsvc
  }
  netsh.exe interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=80 | Out-Null
  netsh.exe interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=80 connectaddress=127.0.0.1 connectport=3000 | Out-Null
  netsh.exe interface portproxy delete v6tov4 listenaddress=:: listenport=80 | Out-Null
  netsh.exe interface portproxy add v6tov4 listenaddress=:: listenport=80 connectaddress=127.0.0.1 connectport=3000 | Out-Null

  if (-not (Get-NetFirewallRule -Name 'ShopApp-Friendly-LAN-In-TCP' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule `
      -Name 'ShopApp-Friendly-LAN-In-TCP' `
      -DisplayName 'ShopApp friendly LAN address (TCP 80)' `
      -Enabled True `
      -Direction Inbound `
      -Protocol TCP `
      -LocalPort 80 `
      -Profile Any `
      -Action Allow | Out-Null
  }
  Set-NetFirewallRule -Name 'ShopApp-Friendly-LAN-In-TCP' -Enabled True -Profile Any -Action Allow
  Get-NetFirewallRule -Name 'ShopApp-Friendly-LAN-In-TCP' |
    Get-NetFirewallAddressFilter |
    Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet

  $shopAppTask = Get-ScheduledTask -TaskName 'ShopApp'
  if ($shopAppTask.State -ne 'Running') {
    Start-ScheduledTask -TaskName 'ShopApp'
  }

  $healthy = $false
  for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $healthy = $true
        break
      }
    } catch {
      # Keep waiting while Windows and ShopApp finish starting.
    }
    Start-Sleep -Seconds 2
  }

  if (-not $healthy) {
    throw 'ShopApp health check did not pass within 60 seconds.'
  }

  $networkSummary = (Get-NetConnectionProfile | ForEach-Object {
      $_.InterfaceAlias + ':' + $_.NetworkCategory
    }) -join ','
  Write-BootLog ('Supervisor passed. Network=' + $networkSummary)
  exit 0
} catch {
  Write-BootLog ('Supervisor failed: ' + $_.Exception.Message)
  exit 1
}
'@

Set-Content -LiteralPath $supervisorPath -Value $supervisor -Encoding utf8

$supervisorAction = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\ShopApp\maintenance\boot-supervisor.ps1' `
  -WorkingDirectory $maintenanceDirectory
$supervisorTrigger = New-ScheduledTaskTrigger -AtStartup
$systemPrincipal = New-ScheduledTaskPrincipal `
  -UserId 'SYSTEM' `
  -LogonType ServiceAccount `
  -RunLevel Highest
$supervisorSettings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName 'ShopApp Boot Supervisor' `
  -Action $supervisorAction `
  -Trigger $supervisorTrigger `
  -Principal $systemPrincipal `
  -Settings $supervisorSettings `
  -Description 'Verifies ShopApp, SSH, firewall scope, and local health after Windows startup.' `
  -Force | Out-Null

# Make firewall behavior independent of Windows changing the network category.
# Access remains limited to the administrator workstation or the shop LAN.
Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -Enabled True -Profile Any -Action Allow
Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' |
  Get-NetFirewallAddressFilter |
  Set-NetFirewallAddressFilter -RemoteAddress $adminWorkstationAddress

Set-NetFirewallRule -Name 'ShopApp-LAN-In-TCP' -Enabled True -Profile Any -Action Allow
Get-NetFirewallRule -Name 'ShopApp-LAN-In-TCP' |
  Get-NetFirewallAddressFilter |
  Set-NetFirewallAddressFilter -RemoteAddress $shopSubnet

# Provide a persistent no-port-number HTTP entry point while ShopApp stays on 3000 internally.
Set-Service -Name iphlpsvc -StartupType Automatic
Start-Service -Name iphlpsvc
netsh.exe interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=80 | Out-Null
netsh.exe interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=80 connectaddress=127.0.0.1 connectport=3000 | Out-Null
netsh.exe interface portproxy delete v6tov4 listenaddress=:: listenport=80 | Out-Null
netsh.exe interface portproxy add v6tov4 listenaddress=:: listenport=80 connectaddress=127.0.0.1 connectport=3000 | Out-Null
if (-not (Get-NetFirewallRule -Name 'ShopApp-Friendly-LAN-In-TCP' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule `
    -Name 'ShopApp-Friendly-LAN-In-TCP' `
    -DisplayName 'ShopApp friendly LAN address (TCP 80)' `
    -Enabled True `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 80 `
    -Profile Any `
    -Action Allow | Out-Null
}
Set-NetFirewallRule -Name 'ShopApp-Friendly-LAN-In-TCP' -Enabled True -Profile Any -Action Allow
Get-NetFirewallRule -Name 'ShopApp-Friendly-LAN-In-TCP' |
  Get-NetFirewallAddressFilter |
  Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet

# Enable RDP with NLA as a separate fallback, restricted to the admin workstation.
Set-ItemProperty `
  -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' `
  -Name fDenyTSConnections `
  -Value 0
Set-ItemProperty `
  -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' `
  -Name UserAuthentication `
  -Value 1
Set-Service -Name TermService -StartupType Automatic
Start-Service -Name TermService
Get-NetFirewallRule -DisplayGroup 'Remote Desktop' |
  Set-NetFirewallRule -Enabled True -Profile Any -Action Allow
Get-NetFirewallRule -DisplayGroup 'Remote Desktop' |
  Get-NetFirewallAddressFilter |
  Set-NetFirewallAddressFilter -RemoteAddress $adminWorkstationAddress

# Run the supervisor once now to prove the script itself is healthy.
& $supervisorPath
if ($LASTEXITCODE -ne 0) {
  throw "The boot supervisor failed its immediate validation. Review $supervisorLogPath."
}

Write-Output 'SUPERVISOR_TASK:'
Get-ScheduledTask -TaskName 'ShopApp Boot Supervisor' |
  Select-Object TaskName, State |
  Format-Table -AutoSize
Write-Output 'SUPERVISOR_LOG:'
Get-Content -LiteralPath $supervisorLogPath -Tail 10
Write-Output 'FIREWALL:'
Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP', 'ShopApp-LAN-In-TCP', 'ShopApp-Friendly-LAN-In-TCP' |
  Select-Object Name, Enabled, Profile, Action |
  Format-Table -AutoSize
Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP', 'ShopApp-LAN-In-TCP', 'ShopApp-Friendly-LAN-In-TCP' |
  Get-NetFirewallAddressFilter |
  Select-Object InstanceID, RemoteAddress |
  Format-Table -AutoSize
Write-Output 'RDP:'
Get-Service TermService |
  Select-Object Status, StartType |
  Format-Table -AutoSize
Get-NetTCPConnection -LocalPort 3389 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess |
  Format-Table -AutoSize
