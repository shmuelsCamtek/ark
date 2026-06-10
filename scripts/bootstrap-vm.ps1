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
# NSSM's --version writes its banner to stderr and exits non-zero. On
# PowerShell 7+ that would otherwise abort the script. Native command exit
# codes shouldn't be treated as terminating errors here.
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$arkRoot   = 'C:\Ark'
$appDir    = Join-Path $arkRoot 'app'
$dataDir   = Join-Path $arkRoot 'data'
$logsDir   = Join-Path $arkRoot 'logs'
$repoDir   = Join-Path $arkRoot 'repo'
$envFile   = Join-Path $appDir  '.env'
$nssmDir   = 'C:\Program Files\nssm'
$nssmExe   = Join-Path $nssmDir 'nssm.exe'
# The deploy pulls and builds from this clone. The remote URL carries a PAT
# (set once below) so deploy.ps1 never needs the token.
$repoSlug  = 'shmuelsCamtek/ark.git'

function Test-NodeOk {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $false }
  $v = (& node --version) -replace '^v', ''
  $p = $v.Split('.')
  $maj = [int]$p[0]; $min = [int]$p[1]
  # Need Node 20.19+ (several frontend deps require it, and older 20.x ships the
  # npm 10.8.x "Exit handler never called!" bug) or any newer LTS major.
  return ($maj -gt 20) -or ($maj -eq 20 -and $min -ge 19)
}

# 1. Node 20 LTS (latest patch) ---------------------------------------------
if (-not (Test-NodeOk)) {
  Write-Host "==> Installing the latest Node.js 20 LTS"
  $base = 'https://nodejs.org/dist/latest-v20.x/'
  $msiName = (Invoke-WebRequest -UseBasicParsing $base).Links.href |
    Where-Object { $_ -match '^node-v20\.\d+\.\d+-x64\.msi$' } | Select-Object -First 1
  if (-not $msiName) { throw "Could not find a Node 20 x64 MSI at $base" }
  $msi = Join-Path $env:TEMP $msiName
  Invoke-WebRequest -UseBasicParsing ($base + $msiName) -OutFile $msi
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
  Remove-Item $msi
  # Refresh PATH for current session.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Test-NodeOk)) {
    throw "Node 20.19+ install failed. Install manually from https://nodejs.org/."
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

# 3b. Defender exclusion -----------------------------------------------------
# Real-time AV scanning of the thousands of files npm writes into node_modules
# slows `npm ci` to a crawl (10+ min) and the file-lock contention can crash
# npm ("Exit handler never called!"). Exclude the app root. No-op / harmless if
# Defender isn't the active AV.
try {
  Add-MpPreference -ExclusionPath $arkRoot -ErrorAction Stop
  Write-Host "==> Added Defender exclusion for $arkRoot"
} catch {
  Write-Host "==> Could not set a Defender exclusion ($($_.Exception.Message)). If npm ci is slow or crashes, ask whoever manages AV to exclude $arkRoot."
}

# 4. Source clone ------------------------------------------------------------
# Deploys pull and build from C:\Ark\repo. Clone it once here with a GitHub PAT
# embedded in the remote URL; the token is then persisted in the clone's
# .git\config so deploy.ps1 only ever runs `git fetch`.
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is not installed / not on PATH. Install Git for Windows, then re-run."
}
if (-not (Test-Path (Join-Path $repoDir '.git'))) {
  Write-Host "==> Cloning $repoSlug into $repoDir (you will be prompted for a GitHub PAT)"
  $pat      = Read-Host -AsSecureString "GitHub PAT (repo read access)"
  $patPlain = [System.Net.NetworkCredential]::new('', $pat).Password
  $cloneUrl = "https://$patPlain@github.com/$repoSlug"
  git clone $cloneUrl $repoDir
  if ($LASTEXITCODE -ne 0) { throw "git clone failed ($LASTEXITCODE). Check the PAT and network." }
  # The PAT lives in $repoDir\.git\config, so drop inheritance (keeps the token
  # off ordinary Users). Grant the *current* account by name as well as
  # Administrators/SYSTEM: deploy.ps1 connects over SSH where an admin account
  # gets a UAC-filtered token, so an Administrators-group ACE alone would lock
  # the deploy user out of its own repo. The named-user ACE is unaffected by
  # token filtering. (Assumes you bootstrap and deploy as the same account.)
  $me = "$env:USERDOMAIN\$env:USERNAME"
  icacls $repoDir /inheritance:r `
    /grant:r "${me}:(OI)(CI)F" "Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)F" /T /C /Q | Out-Null
  Write-Host "==> Clone complete; repo ACL restricted to $me / Administrators / SYSTEM."
} else {
  Write-Host "==> $repoDir already cloned, leaving alone."
}

# 5. .env --------------------------------------------------------------------
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
  $lines += "PORT=8000"
  # DATA_DIR is set via the service env-extra below; including it here is
  # harmless but redundant.

  Set-Content -Path $envFile -Value $lines -Encoding utf8
  # Restrict ACL: only Administrators + SYSTEM can read.
  icacls $envFile /inheritance:r /grant:r "Administrators:R" "SYSTEM:R" | Out-Null
  Write-Host "==> .env written and ACL restricted to Administrators/SYSTEM."
} else {
  Write-Host "==> $envFile already exists, leaving alone."
}

# 6. Service registration ----------------------------------------------------
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
Write-Host "  .\scripts\deploy.ps1 -VmHost <this-vm-host> -VmUser <your-vm-user>"
Write-Host "to trigger the first build. The VM pulls from git, builds, and the"
Write-Host "service starts automatically."
