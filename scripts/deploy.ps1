#requires -Version 7.0
<#
.SYNOPSIS
  Build Ark Story Studio and deploy it to an internal Windows VM over SSH.

.PARAMETER VmHost
  Hostname or IP of the VM, e.g. ark-vm.camtek.local

.PARAMETER VmUser
  SSH username on the VM. Must be a member of Administrators
  (NSSM start/stop and Expand-Archive into Program-Files-adjacent paths
  need elevation).

.PARAMETER SkipBuild
  Skip the frontend build (useful for re-deploying after just an env change).

.EXAMPLE
  .\scripts\deploy.ps1 -VmHost ark-vm.camtek.local -VmUser CAMTEK\shmuels
#>
param(
  [Parameter(Mandatory = $true)] [string] $VmHost,
  [Parameter(Mandatory = $true)] [string] $VmUser,
  [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$staging  = Join-Path $env:TEMP "ark-deploy-$stamp"
$zip      = "$staging.zip"

try {
  Write-Host "==> Repo root: $repoRoot"

  if (-not $SkipBuild) {
    Write-Host "==> Building frontend"
    # --include=dev so build tools (vite, @types/react, etc.) install
    # even when NODE_ENV=production is set globally on this machine.
    npm --prefix src\frontend ci --include=dev
    if ($LASTEXITCODE -ne 0) { throw "npm ci (frontend) failed with exit code $LASTEXITCODE" }
    npm --prefix src\frontend run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build (frontend) failed with exit code $LASTEXITCODE" }
    if (-not (Test-Path src\frontend\dist\index.html)) {
      throw "Frontend build did not produce src\frontend\dist\index.html"
    }

    Write-Host "==> Copying dist into backend\public"
    if (Test-Path src\backend\public) {
      Remove-Item -Recurse -Force src\backend\public
    }
    Copy-Item -Recurse src\frontend\dist src\backend\public
  } else {
    Write-Host "==> -SkipBuild set: using existing src\backend\public"
    if (-not (Test-Path src\backend\public\index.html)) {
      throw "src\backend\public\index.html is missing; remove -SkipBuild and try again."
    }
  }

  Write-Host "==> Staging backend at $staging"
  New-Item -ItemType Directory -Path $staging | Out-Null
  # Copy backend tree but skip dev artifacts the VM doesn't need.
  $sourceItems = Get-ChildItem src\backend\* -Force | Where-Object {
    $_.Name -notin @('node_modules', 'data', '.env', '.env.example')
  }
  Copy-Item -Path $sourceItems -Destination $staging -Recurse -Force

  Write-Host "==> Installing production deps in staging"
  Push-Location $staging
  try {
    npm ci --omit=dev
    if ($LASTEXITCODE -ne 0) { throw "npm ci (backend staging) failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }

  Write-Host "==> Zipping staging -> $zip"
  Compress-Archive -Path "$staging\*" -DestinationPath $zip -Force

  Write-Host "==> SCPing $zip to ${VmHost}:C:/Ark/deploy.zip"
  & scp $zip "${VmUser}@${VmHost}:C:/Ark/deploy.zip"
  if ($LASTEXITCODE -ne 0) { throw "scp failed with exit code $LASTEXITCODE" }

  Write-Host "==> Running remote swap-and-restart"
  $remote = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'
$arkRoot = 'C:\Ark'
$newDir  = Join-Path $arkRoot 'app-new'
$curDir  = Join-Path $arkRoot 'app'
$oldDir  = Join-Path $arkRoot 'app-old'
$zip     = Join-Path $arkRoot 'deploy.zip'

# Clean any leftovers from a previous failed deploy.
if (Test-Path $newDir) { Remove-Item -Recurse -Force $newDir }
if (Test-Path $oldDir) { Remove-Item -Recurse -Force $oldDir }

# Expand new release.
Expand-Archive -Path $zip -DestinationPath $newDir -Force

# Carry the existing .env forward (it is intentionally NOT in the zip).
if (Test-Path (Join-Path $curDir '.env')) {
  Copy-Item (Join-Path $curDir '.env') (Join-Path $newDir '.env')
}
Write-Host "  [1/5] expanded release"

# Swap atomically. NSSM stop is required because nodejs locks files.
& nssm stop Ark 2>&1 | Out-Null
Write-Host "  [2/5] stopped Ark service"

if (Test-Path $curDir) { Rename-Item -Path $curDir -NewName 'app-old' }
Rename-Item -Path $newDir -NewName 'app'
Write-Host "  [3/5] swapped app folders"

& nssm start Ark 2>&1 | Out-Null

# Best-effort cleanup.
if (Test-Path $oldDir) { Remove-Item -Recurse -Force $oldDir }
Remove-Item -Force $zip
Write-Host "  [4/5] started Ark service"

# Health check (give the service ~5s to come up).
Start-Sleep -Seconds 5
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3001/api/health -TimeoutSec 5
  Write-Host "  [5/5] health $($resp.StatusCode) OK"
  Write-Host "Remote: swapped + service started, health $($resp.StatusCode) OK"
} catch {
  Write-Host "  [5/5] health check FAILED - $($_.Exception.Message)"
  Write-Host "Remote: health check failed - $($_.Exception.Message)"
  throw
}
'@

  # Send $remote to the VM via -EncodedCommand to sidestep all shell quoting.
  $b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
  & ssh "${VmUser}@${VmHost}" "powershell -NoProfile -EncodedCommand $b64"
  if ($LASTEXITCODE -ne 0) { throw "Remote swap failed with exit code $LASTEXITCODE" }

  Write-Host "==> Deploy complete."
}
finally {
  if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
  if (Test-Path $zip)     { Remove-Item -Force $zip }
}
