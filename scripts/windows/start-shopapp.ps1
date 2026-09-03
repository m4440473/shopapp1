$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$appRoot = 'C:\ShopApp\app'
$logRoot = 'C:\ShopApp\logs'
$reportRoot = Join-Path $logRoot 'node-reports'
$exitLog = Join-Path $logRoot 'runtime-exit.log'

New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
Set-Location -LiteralPath $appRoot
$env:NODE_ENV = 'production'
$env:HOSTNAME = '0.0.0.0'
$env:PORT = '3000'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:SHOPAPP_IMPORT_ACTIVITY_DIR = 'C:\ShopApp\app\.runtime\drawing-import-active'
$env:SHOPAPP_IMPORT_ACTIVITY_LOG = 'C:\ShopApp\app\.runtime\drawing-import-events.log'

& 'C:\Program Files\nodejs\node.exe' `
  '--max-old-space-size=12288' `
  '--report-on-fatalerror' `
  '--report-uncaught-exception' `
  "--report-directory=$reportRoot" `
  '--trace-uncaught' `
  'C:\ShopApp\app\.next\standalone\server.js' `
  1>> 'C:\ShopApp\logs\shopapp.out.log' `
  2>> 'C:\ShopApp\logs\shopapp.err.log'

$exitCode = $LASTEXITCODE
Add-Content -LiteralPath $exitLog -Value ((Get-Date).ToUniversalTime().ToString('o') + " node-exit-code=$exitCode")
exit $exitCode
