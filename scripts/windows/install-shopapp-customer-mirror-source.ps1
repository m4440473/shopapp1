param(
  [Parameter(Mandatory = $true)]
  [string]$MirrorPassword
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$shopAppStorage = 'C:\ShopApp\storage'
$mirrorUser = 'shopapp_mirror'
$mirrorShare = 'ShopAppStorage$'
$mirrorAccount = "$env:COMPUTERNAME\$mirrorUser"
$unraidAddress = '192.168.254.10'

if (-not (Test-Path -LiteralPath $shopAppStorage -PathType Container)) {
  throw "$shopAppStorage does not exist."
}

$securePassword = ConvertTo-SecureString -String $MirrorPassword -AsPlainText -Force
$existingUser = Get-LocalUser -Name $mirrorUser -ErrorAction SilentlyContinue
if ($existingUser) {
  Set-LocalUser -Name $mirrorUser -Password $securePassword -PasswordNeverExpires $true
  Enable-LocalUser -Name $mirrorUser
} else {
  New-LocalUser `
    -Name $mirrorUser `
    -Password $securePassword `
    -PasswordNeverExpires `
    -UserMayNotChangePassword `
    -Description 'Read-only identity for Unraid file mirror.' | Out-Null
}

icacls.exe $shopAppStorage /grant "${mirrorAccount}:(OI)(CI)(RX)" /T /C | Out-Null

$existingShare = Get-SmbShare -Name $mirrorShare -ErrorAction SilentlyContinue
if ($existingShare -and $existingShare.Path -ne $shopAppStorage) {
  throw "The existing $mirrorShare share points to $($existingShare.Path), not $shopAppStorage."
}
if (-not $existingShare) {
  New-SmbShare `
    -Name $mirrorShare `
    -Path $shopAppStorage `
    -Description 'Read-only ShopApp customer files for the Unraid projects mirror.' `
    -ReadAccess $mirrorAccount `
    -FolderEnumerationMode AccessBased `
    -EncryptData $true | Out-Null
} else {
  Get-SmbShareAccess -Name $mirrorShare | ForEach-Object {
    if ($_.AccountName -ne $mirrorAccount) {
      Revoke-SmbShareAccess -Name $mirrorShare -AccountName $_.AccountName -Force -ErrorAction SilentlyContinue | Out-Null
    }
  }
  Grant-SmbShareAccess -Name $mirrorShare -AccountName $mirrorAccount -AccessRight Read -Force | Out-Null
  Set-SmbShare -Name $mirrorShare -FolderEnumerationMode AccessBased -EncryptData $true -Force | Out-Null
}

$firewallRuleName = 'ShopApp-Mirror-SMB-In-TCP'
if (-not (Get-NetFirewallRule -Name $firewallRuleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule `
    -Name $firewallRuleName `
    -DisplayName 'ShopApp read-only mirror from Unraid' `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 445 `
    -RemoteAddress $unraidAddress `
    -Profile Any `
    -Action Allow | Out-Null
} else {
  Set-NetFirewallRule -Name $firewallRuleName -Enabled True -Profile Any -Action Allow
  Get-NetFirewallRule -Name $firewallRuleName |
    Get-NetFirewallAddressFilter |
    Set-NetFirewallAddressFilter -RemoteAddress $unraidAddress
}

Write-Output "MIRROR_USER=$mirrorUser"
Write-Output "MIRROR_SHARE=$mirrorShare"
Write-Output "MIRROR_PATH=$shopAppStorage"
Write-Output "MIRROR_REMOTE=$unraidAddress"
