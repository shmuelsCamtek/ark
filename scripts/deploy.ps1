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

.PARAMETER Password
  SSH password for $VmUser, as a [SecureString]. Used for both the SCP upload
  and the remote swap (via the Posh-SSH module) so the deploy runs without an
  interactive prompt. If omitted, the script prompts for it once.

.PARAMETER SkipBuild
  Skip the frontend build (useful for re-deploying after just an env change).

.EXAMPLE
  .\scripts\deploy.ps1 -VmHost 62f5fb5e3738 -VmUser me_admin

.EXAMPLE
  $pw = Read-Host 'VM password' -AsSecureString
  .\scripts\deploy.ps1 -VmHost 62f5fb5e3738 -VmUser me_admin -Password $pw
#>
param(
  [Parameter(Mandatory = $true)] [string] $VmHost,
  [Parameter(Mandatory = $true)] [string] $VmUser,
  [Parameter()] [SecureString] $Password,
  [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Posh-SSH lets us pass the password programmatically; OpenSSH's ssh/scp cannot.
try {
  Import-Module Posh-SSH -ErrorAction Stop
} catch {
  throw "Posh-SSH module is required (Install-Module Posh-SSH -Scope CurrentUser). $_"
}

if (-not $Password) {
  $Password = Read-Host "VM password for $VmUser@$VmHost" -AsSecureString
}
$cred = [System.Management.Automation.PSCredential]::new($VmUser, $Password)

# Named steps with an overall progress bar + per-step timing. Work runs in the
# foreground (& $Action) so npm/vite output streams live; Write-Progress is a
# no-op when output is redirected, leaving the "OK [k/N] ... 12.3s" lines as the
# log of record.
$script:deployTimer = [System.Diagnostics.Stopwatch]::StartNew()
$script:stepIndex   = 0
$script:totalSteps  = if ($SkipBuild) { 8 } else { 9 }

function Invoke-Step {
  param(
    [Parameter(Mandatory)] [string]      $Name,
    [Parameter(Mandatory)] [scriptblock] $Action
  )
  $script:stepIndex++
  $i = $script:stepIndex; $n = $script:totalSteps
  Write-Progress -Id 1 -Activity 'Deploying Ark Story Studio' `
    -Status ("[{0}/{1}] {2}  -  total {3:mm\:ss}" -f $i, $n, $Name, $script:deployTimer.Elapsed) `
    -PercentComplete ([int](($i - 1) / $n * 100))
  Write-Host ("  .. [{0}/{1}] {2}" -f $i, $n, $Name) -ForegroundColor Cyan
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    & $Action
  } catch {
    Write-Host ("  XX [{0}/{1}] {2}  failed after {3:n1}s" -f $i, $n, $Name, $sw.Elapsed.TotalSeconds) -ForegroundColor Red
    throw
  }
  $sw.Stop()
  Write-Host ("  OK [{0}/{1}] {2}  {3:n1}s" -f $i, $n, $Name, $sw.Elapsed.TotalSeconds) -ForegroundColor Green
}

$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$staging  = Join-Path $env:TEMP "ark-deploy-$stamp"
$zip      = "$staging.zip"

try {
  Write-Host "==> Repo root: $repoRoot"

  # Free the local dev ports before building/deploying. No-op if nothing is
  # listening (-ErrorAction SilentlyContinue keeps it non-fatal even though
  # $ErrorActionPreference is 'Stop').
  Invoke-Step 'Shutdown backend dev server (port 8000)' {
    $procs = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    if ($procs) {
      $procs | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
      Write-Host "     stopped PID(s): $($procs -join ', ')"
    } else {
      Write-Host "     nothing listening on 8000"
    }
  }

  Invoke-Step 'Shutdown frontend dev server (port 5173)' {
    $procs = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    if ($procs) {
      $procs | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
      Write-Host "     stopped PID(s): $($procs -join ', ')"
    } else {
      Write-Host "     nothing listening on 5173"
    }
  }

  if (-not $SkipBuild) {
    Invoke-Step 'Build frontend' {
      # --include=dev so build tools (vite, @types/react, etc.) install
      # even when NODE_ENV=production is set globally on this machine.
      npm --prefix src\frontend ci --include=dev
      if ($LASTEXITCODE -ne 0) { throw "npm ci (frontend) failed with exit code $LASTEXITCODE" }
      npm --prefix src\frontend run build
      if ($LASTEXITCODE -ne 0) { throw "npm run build (frontend) failed with exit code $LASTEXITCODE" }
      if (-not (Test-Path src\frontend\dist\index.html)) {
        throw "Frontend build did not produce src\frontend\dist\index.html"
      }
    }

    Invoke-Step 'Bundle frontend into backend\public' {
      if (Test-Path src\backend\public) {
        Remove-Item -Recurse -Force src\backend\public
      }
      Copy-Item -Recurse src\frontend\dist src\backend\public
    }
  } else {
    Invoke-Step 'Verify existing build' {
      if (-not (Test-Path src\backend\public\index.html)) {
        throw "src\backend\public\index.html is missing; remove -SkipBuild and try again."
      }
    }
  }

  Invoke-Step 'Stage backend' {
    New-Item -ItemType Directory -Path $staging | Out-Null
    # Copy backend tree but skip dev artifacts the VM doesn't need.
    $sourceItems = Get-ChildItem src\backend\* -Force | Where-Object {
      $_.Name -notin @('node_modules', 'data', '.env', '.env.example')
    }
    Copy-Item -Path $sourceItems -Destination $staging -Recurse -Force
  }

  Invoke-Step 'Install backend deps' {
    Push-Location $staging
    try {
      npm ci --omit=dev
      if ($LASTEXITCODE -ne 0) { throw "npm ci (backend staging) failed with exit code $LASTEXITCODE" }
    } finally { Pop-Location }
  }

  Invoke-Step 'Package release' {
    Compress-Archive -Path "$staging\*" -DestinationPath $zip -Force
  }

  Invoke-Step 'Upload to VM' {
    Set-SCPItem -ComputerName $VmHost -Credential $cred -Path $zip `
      -Destination 'C:/Ark' -NewName 'deploy.zip' -AcceptKey -Force
  }

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
  $resp = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:8000/api/health -TimeoutSec 5
  Write-Host "  [5/5] health $($resp.StatusCode) OK"
  Write-Host "Remote: swapped + service started, health $($resp.StatusCode) OK"
} catch {
  Write-Host "  [5/5] health check FAILED - $($_.Exception.Message)"
  Write-Host "Remote: health check failed - $($_.Exception.Message)"
  throw
}
'@

  Invoke-Step 'Swap & restart on VM' {
    # Send $remote to the VM via -EncodedCommand to sidestep all shell quoting.
    $b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
    $session = New-SSHSession -ComputerName $VmHost -Credential $cred -AcceptKey -Force
    try {
      $cmd = Invoke-SSHCommand -SSHSession $session -TimeOut 300 `
        -Command "powershell -NoProfile -EncodedCommand $b64"
      if ($cmd.Output) { $cmd.Output | ForEach-Object { Write-Host $_ } }
      if ($cmd.ExitStatus -ne 0) {
        if ($cmd.Error) { $cmd.Error | ForEach-Object { Write-Host $_ } }
        throw "Remote swap failed with exit status $($cmd.ExitStatus)"
      }
    } finally {
      Remove-SSHSession -SSHSession $session | Out-Null
    }
  }

  Write-Progress -Id 1 -Activity 'Deploying Ark Story Studio' -Completed
  $script:deployTimer.Stop()
  Write-Host ("==> Deploy complete in {0:mm\:ss}" -f $script:deployTimer.Elapsed) -ForegroundColor Green
}
finally {
  Write-Progress -Id 1 -Activity 'Deploying Ark Story Studio' -Completed
  if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
  if (Test-Path $zip)     { Remove-Item -Force $zip }
}
