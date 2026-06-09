#requires -Version 7.0
<#
.SYNOPSIS
  Trigger a git-based, build-on-host deploy of Ark Story Studio on an internal
  Windows VM, over SSH.

  This script does NOT build anything locally. It opens one SSH session to the
  VM and drives the deploy there, one titled step at a time: the VM pulls the
  latest code from git, builds it, installs it (atomic swap + service restart),
  and cleans up. Each step streams its output as it runs.

.PARAMETER VmHost
  Hostname or IP of the VM. Defaults to 10.5.0.19.

.PARAMETER VmUser
  SSH username on the VM. Must be a member of Administrators (NSSM start/stop
  and writing under C:\Ark need elevation). Defaults to me_admin.

.PARAMETER Password
  SSH password for $VmUser, as a [SecureString]. Used for the remote session
  via the Posh-SSH module so the deploy runs without an interactive prompt.
  If omitted, the script prompts for it once. Never hardcode this into a
  committed file.

.PARAMETER Branch
  Git branch the VM should deploy. Defaults to main.

.EXAMPLE
  .\scripts\deploy.ps1

.EXAMPLE
  $pw = Read-Host 'VM password' -AsSecureString
  .\scripts\deploy.ps1 -VmHost 10.5.0.19 -VmUser me_admin -Password $pw
#>
param(
  [Parameter()] [string] $VmHost = '10.5.0.19',
  [Parameter()] [string] $VmUser = 'me_admin',
  [Parameter()] [SecureString] $Password,
  [Parameter()] [string] $Branch = 'main'
)

$ErrorActionPreference = 'Stop'

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

# Named steps with an overall progress bar + per-step timing. Each step runs as
# its own remote command on the shared SSH session, so the "[k/N] <title>"
# banner appears live as that step starts rather than all at once at the end.
$script:deployTimer = [System.Diagnostics.Stopwatch]::StartNew()
$script:stepIndex   = 0
$script:totalSteps  = 6

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

# Run a PowerShell snippet on the VM over the shared session. Sent base64 via
# -EncodedCommand to sidestep all shell quoting; throws on a non-zero exit.
function Invoke-Remote {
  param(
    [Parameter(Mandatory)] $Session,
    [Parameter(Mandatory)] [string] $Script,
    [int] $TimeoutSec = 600
  )
  $b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Script))
  $cmd = Invoke-SSHCommand -SSHSession $Session -TimeOut $TimeoutSec `
    -Command "powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand $b64"
  if ($cmd.Output) { $cmd.Output | ForEach-Object { Write-Host "     $_" } }
  if ($cmd.ExitStatus -ne 0) {
    if ($cmd.Error) { $cmd.Error | ForEach-Object { Write-Host "     $_" -ForegroundColor Yellow } }
    throw "remote step failed with exit status $($cmd.ExitStatus)"
  }
}

# --- Remote step scripts (run on the VM) ------------------------------------
# Each is self-contained and uses absolute paths: the SSH session does not
# preserve a working directory between commands.

# 1. Pull latest source. $Branch is injected locally; everything else is literal
#    so the VM's PowerShell evaluates it.
$gitScript = (@"
`$Branch = '$Branch'
"@) + @'

$ErrorActionPreference = 'Stop'
$repo = 'C:\Ark\repo'
if (-not (Test-Path (Join-Path $repo '.git'))) {
  throw "No git clone at $repo. Run the bootstrap clone step first (see docs/deployment.md)."
}
git -C $repo fetch --prune origin
if ($LASTEXITCODE -ne 0) { throw "git fetch failed ($LASTEXITCODE)" }
git -C $repo reset --hard "origin/$Branch"
if ($LASTEXITCODE -ne 0) { throw "git reset --hard origin/$Branch failed ($LASTEXITCODE)" }
git -C $repo clean -fd
if ($LASTEXITCODE -ne 0) { throw "git clean failed ($LASTEXITCODE)" }
Write-Host ("now at " + (git -C $repo log -1 --oneline))
'@

# 2. Build the frontend and bundle it into the backend's public/ folder.
$buildScript = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'
$fe = 'C:\Ark\repo\src\frontend'
# --include=dev so build tools (vite, @types/*) install even when NODE_ENV=production.
npm --prefix $fe ci --include=dev
if ($LASTEXITCODE -ne 0) { throw "npm ci (frontend) failed ($LASTEXITCODE)" }
npm --prefix $fe run build
if ($LASTEXITCODE -ne 0) { throw "vite build failed ($LASTEXITCODE)" }
$dist = Join-Path $fe 'dist'
if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  throw "frontend build did not produce dist\index.html"
}
$public = 'C:\Ark\repo\src\backend\public'
if (Test-Path $public) { Remove-Item -Recurse -Force $public }
Copy-Item -Recurse $dist $public
Write-Host "bundled frontend into backend\public"
'@

# 3. Assemble the runnable release into app-new and install prod-only deps.
$assembleScript = @'
$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'
$repoBackend = 'C:\Ark\repo\src\backend'
$app    = 'C:\Ark\app'
$appNew = 'C:\Ark\app-new'
$appOld = 'C:\Ark\app-old'
if (Test-Path $appNew) { Remove-Item -Recurse -Force $appNew }
if (Test-Path $appOld) { Remove-Item -Recurse -Force $appOld }
New-Item -ItemType Directory -Path $appNew | Out-Null
# Copy the backend tree (public included) but skip dev artifacts and runtime state.
$items = Get-ChildItem "$repoBackend\*" -Force | Where-Object {
  $_.Name -notin @('node_modules', 'data', '.env', '.env.example')
}
Copy-Item -Path $items -Destination $appNew -Recurse -Force
npm --prefix $appNew ci --omit=dev
if ($LASTEXITCODE -ne 0) { throw "npm ci (backend) failed ($LASTEXITCODE)" }
# Carry the live .env forward (it is intentionally not in git).
if (Test-Path (Join-Path $app '.env')) {
  Copy-Item (Join-Path $app '.env') (Join-Path $appNew '.env')
  Write-Host "carried .env forward"
} else {
  Write-Host "WARNING: no existing .env at $app\.env - the service may fail to start"
}
'@

# 4. Install: stop the service, atomic folder swap, start the service.
$installScript = @'
$ErrorActionPreference = 'Stop'
$app    = 'C:\Ark\app'
$appNew = 'C:\Ark\app-new'
if (-not (Test-Path $appNew)) { throw "app-new is missing; assemble step did not run" }
& nssm stop Ark 2>&1 | Out-Null
Write-Host "stopped Ark service"
if (Test-Path $app) { Rename-Item -Path $app -NewName 'app-old' }
Rename-Item -Path $appNew -NewName 'app'
Write-Host "swapped app folders"
& nssm start Ark 2>&1 | Out-Null
Write-Host "started Ark service"
'@

# 5. Health check against the port from .env (fallback 8000).
$healthScript = @'
$ErrorActionPreference = 'Stop'
$port = 8000
$envFile = 'C:\Ark\app\.env'
if (Test-Path $envFile) {
  $m = Select-String -Path $envFile -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
  if ($m) { $port = [int]$m.Matches[0].Groups[1].Value }
}
Start-Sleep -Seconds 5
try {
  $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/api/health" -TimeoutSec 5
  if ($resp.StatusCode -ne 200) { throw "status $($resp.StatusCode)" }
  Write-Host "health $($resp.StatusCode) OK on port $port"
} catch {
  Write-Host "health check FAILED on port $port - $($_.Exception.Message)"
  throw
}
'@

# 6. Clean all: drop the transient swap/rollback folders. The repo clone and its
#    cached node_modules are kept for fast subsequent builds.
$cleanScript = @'
$ErrorActionPreference = 'Stop'
foreach ($d in 'C:\Ark\app-old', 'C:\Ark\app-new') {
  if (Test-Path $d) { Remove-Item -Recurse -Force $d; Write-Host "removed $d" }
}
Write-Host "clean complete"
'@

try {
  Write-Host "==> Deploying branch '$Branch' to $VmUser@$VmHost (build runs on the VM)"

  $session = New-SSHSession -ComputerName $VmHost -Credential $cred -AcceptKey -Force
  try {
    Invoke-Step 'Update source from git'              { Invoke-Remote $session $gitScript      -TimeoutSec 300 }
    Invoke-Step 'Build frontend'                      { Invoke-Remote $session $buildScript     -TimeoutSec 900 }
    Invoke-Step 'Assemble release + install deps'     { Invoke-Remote $session $assembleScript  -TimeoutSec 900 }
    Invoke-Step 'Install (swap + restart service)'    { Invoke-Remote $session $installScript   -TimeoutSec 120 }
    Invoke-Step 'Health check'                        { Invoke-Remote $session $healthScript    -TimeoutSec 60  }
    Invoke-Step 'Clean all'                           { Invoke-Remote $session $cleanScript     -TimeoutSec 120 }
  } finally {
    Remove-SSHSession -SSHSession $session | Out-Null
  }

  Write-Progress -Id 1 -Activity 'Deploying Ark Story Studio' -Completed
  $script:deployTimer.Stop()
  Write-Host ("==> Deploy complete in {0:mm\:ss}" -f $script:deployTimer.Elapsed) -ForegroundColor Green
}
finally {
  Write-Progress -Id 1 -Activity 'Deploying Ark Story Studio' -Completed
}
