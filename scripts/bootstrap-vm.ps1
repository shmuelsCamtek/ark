#requires -Version 5.1
#requires -RunAsAdministrator
<#
.SYNOPSIS
  Bootstrap an internal Windows VM to host Ark Story Studio as a Windows Service.

.DESCRIPTION
  Idempotent. Safe to re-run. Installs Node 20 (if missing), installs NSSM
  (if missing), creates C:\Ark\{app,data,logs}, prompts for the production
  .env on first run, then registers + starts the 'Ark' service.

  Run order:
    1. RDP or SSH into the VM as a local admin.
    2. Copy this script onto the VM (or git clone the repo).
    3. From an *elevated* PowerShell: .\bootstrap-vm.ps1
    4. After this finishes, run scripts\deploy.ps1 from your laptop.
#>

$ErrorActionPreference = 'Stop'

$arkRoot   = 'C:\Ark'
$appDir    = Join-Path $arkRoot 'app'
$dataDir   = Join-Path $arkRoot 'data'
$logsDir   = Join-Path $arkRoot 'logs'
$envFile   = Join-Path $appDir  '.env'
$nssmDir   = 'C:\Program Files\nssm'
$nssmExe   = Join-Path $nssmDir 'nssm.exe'

function Test-NodeOk {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $false }
  $v = & node --version
  return $v -match '^v20\.'
}

# 1. Node 20 -----------------------------------------------------------------
if (-not (Test-NodeOk)) {
  Write-Host "==> Installing Node.js 20 LTS"
  $msi = Join-Path $env:TEMP 'node20.msi'
  Invoke-WebRequest -UseBasicParsing `
    -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' `
    -OutFile $msi
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
  Remove-Item $msi
  # Refresh PATH for current session.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Test-NodeOk)) {
    throw "Node 20 install failed. Install manually from https://nodejs.org/."
  }
}
Write-Host "Node version: $(node --version)"

# 2. NSSM --------------------------------------------------------------------
if (-not (Test-Path $nssmExe)) {
  Write-Host "==> Installing NSSM 2.24"
  $zip = Join-Path $env:TEMP 'nssm.zip'
  Invoke-WebRequest -UseBasicParsing `
    -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zip
  $tmp = Join-Path $env:TEMP 'nssm-extract'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp
  if (-not (Test-Path $nssmDir)) { New-Item -ItemType Directory -Path $nssmDir | Out-Null }
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'win64' } else { 'win32' }
  Copy-Item (Join-Path $tmp "nssm-2.24\$arch\nssm.exe") $nssmExe -Force
  # Add to PATH for current session and machine-wide.
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  if ($machinePath -notlike "*$nssmDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$machinePath;$nssmDir", 'Machine')
  }
  $env:Path += ";$nssmDir"
  Remove-Item -Recurse -Force $tmp
  Remove-Item $zip
}
Write-Host "NSSM: $(& $nssmExe --version 2>&1 | Select-Object -First 1)"

# 3. Directories -------------------------------------------------------------
foreach ($d in @($arkRoot, $appDir, $dataDir, $logsDir)) {
  if (-not (Test-Path $d)) {
    Write-Host "==> Creating $d"
    New-Item -ItemType Directory -Path $d | Out-Null
  }
}

# 4. .env --------------------------------------------------------------------
if (-not (Test-Path $envFile)) {
  Write-Host "==> Creating $envFile (you will be prompted for secrets)"
  $anthropic   = Read-Host -AsSecureString "ANTHROPIC_API_KEY"
  $devopsOrg   = Read-Host "AZURE_DEVOPS_ORG (e.g. https://dev.azure.com/AzCamtek)"
  $devopsProj  = Read-Host "AZURE_DEVOPS_PROJECT (e.g. Falcon)"
  $tenant      = Read-Host "AZURE_TENANT_ID (leave blank for multi-tenant)"
  $sharepoint  = Read-Host "SHAREPOINT_SITE_URL (or blank to leave unset)"

  $anthropicPlain =
    [System.Net.NetworkCredential]::new('', $anthropic).Password

  $lines = @(
    "ANTHROPIC_API_KEY=$anthropicPlain"
    "AZURE_DEVOPS_ORG=$devopsOrg"
    "AZURE_DEVOPS_PROJECT=$devopsProj"
  )
  if ($tenant)     { $lines += "AZURE_TENANT_ID=$tenant" }
  if ($sharepoint) { $lines += "SHAREPOINT_SITE_URL=$sharepoint" }
  $lines += "PORT=3001"
  # DATA_DIR is set via the service env-extra below; including it here is
  # harmless but redundant.

  Set-Content -Path $envFile -Value $lines -Encoding utf8
  # Restrict ACL: only Administrators + SYSTEM can read.
  icacls $envFile /inheritance:r /grant:r "Administrators:R" "SYSTEM:R" | Out-Null
  Write-Host "==> .env written and ACL restricted to Administrators/SYSTEM."
} else {
  Write-Host "==> $envFile already exists, leaving alone."
}

# 5. Service registration ----------------------------------------------------
$svc = Get-Service -Name Ark -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Host "==> Registering Ark service with NSSM"
  & $nssmExe install Ark "C:\Program Files\nodejs\node.exe" `
                       "node_modules\tsx\dist\cli.mjs src\index.ts" | Out-Null
  & $nssmExe set Ark AppDirectory         $appDir              | Out-Null
  & $nssmExe set Ark AppEnvironmentExtra  "DATA_DIR=$dataDir"  | Out-Null
  & $nssmExe set Ark Start                SERVICE_AUTO_START   | Out-Null
  & $nssmExe set Ark AppStdout            (Join-Path $logsDir 'ark-stdout.log') | Out-Null
  & $nssmExe set Ark AppStderr            (Join-Path $logsDir 'ark-stderr.log') | Out-Null
  & $nssmExe set Ark AppRotateFiles       1                    | Out-Null
  & $nssmExe set Ark AppRotateBytes       10485760             | Out-Null  # 10 MiB
  & $nssmExe set Ark AppExit              Default Restart      | Out-Null
  Write-Host "==> Service registered. It will auto-start at boot."
} else {
  Write-Host "==> Ark service already registered (status: $($svc.Status))."
}

Write-Host ""
Write-Host "Bootstrap complete. Next: from your laptop, run"
Write-Host "  .\scripts\deploy.ps1 -VmHost <this-vm-host> -VmUser <your-domain-user>"
Write-Host "to push the first build. The service will start automatically."
