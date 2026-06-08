#requires -Version 7.0
<#
.SYNOPSIS
  Update the Ark backend's listening PORT in the live .env on the internal VM,
  swap the inbound firewall rule to the new port, and restart the Ark service.

.PARAMETER VmHost
  Hostname or IP of the VM. Defaults to the known Ark VM.

.PARAMETER VmUser
  SSH username on the VM. Must be a member of Administrators (NSSM restart and
  firewall changes need elevation).

.PARAMETER Port
  New port to listen on. Defaults to 8000.

.PARAMETER OldPort
  Previous port whose firewall rule should be removed. Defaults to 3001.

.PARAMETER Password
  SSH password for $VmUser, as a [SecureString]. If omitted, prompts once.

.EXAMPLE
  .\scripts\set-vm-port.ps1
#>
param(
  [string] $VmHost  = '62f5fb5e3738',
  [string] $VmUser  = 'me_admin',
  [int]    $Port     = 8000,
  [int]    $OldPort  = 3001,
  [SecureString] $Password
)

$ErrorActionPreference = 'Stop'

try {
  Import-Module Posh-SSH -ErrorAction Stop
} catch {
  throw "Posh-SSH module is required (Install-Module Posh-SSH -Scope CurrentUser). $_"
}

if (-not $Password) {
  $Password = Read-Host "VM password for $VmUser@$VmHost" -AsSecureString
}
$cred = [System.Management.Automation.PSCredential]::new($VmUser, $Password)

# Remote script. $env vars below are expanded LOCALLY into the here-string, so
# bake the port numbers in as literals before sending.
$remote = @"
`$ErrorActionPreference = 'Stop'
`$ProgressPreference    = 'SilentlyContinue'
`$envFile = 'C:\Ark\app\.env'

# Rewrite (or append) the PORT line.
`$lines = Get-Content `$envFile
if (`$lines -match '^\s*PORT=') {
  `$lines = `$lines -replace '^\s*PORT=.*', 'PORT=$Port'
} else {
  `$lines += 'PORT=$Port'
}
Set-Content -Path `$envFile -Value `$lines -Encoding utf8
Write-Host "  [1/4] set PORT=$Port in `$envFile"

# Swap the inbound firewall rule.
Get-NetFirewallRule -DisplayName 'Ark TCP $OldPort' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if (-not (Get-NetFirewallRule -DisplayName 'Ark TCP $Port' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'Ark TCP $Port' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
}
Write-Host "  [2/4] firewall rule -> TCP $Port (removed $OldPort)"

& nssm restart Ark 2>&1 | Out-Null
Write-Host "  [3/4] restarted Ark service"

Start-Sleep -Seconds 5
try {
  `$resp = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:$Port/api/health -TimeoutSec 5
  Write-Host "  [4/4] health `$(`$resp.StatusCode) OK on port $Port"
} catch {
  Write-Host "  [4/4] health check FAILED on port $Port - `$(`$_.Exception.Message)"
  throw
}
"@

# Send via -EncodedCommand to sidestep all shell quoting (same as deploy.ps1).
$b64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($remote))
$session = New-SSHSession -ComputerName $VmHost -Credential $cred -AcceptKey -Force
try {
  $cmd = Invoke-SSHCommand -SSHSession $session -TimeOut 120 `
    -Command "powershell -NoProfile -EncodedCommand $b64"
  if ($cmd.Output) { $cmd.Output | ForEach-Object { Write-Host $_ } }
  if ($cmd.ExitStatus -ne 0) {
    if ($cmd.Error) { $cmd.Error | ForEach-Object { Write-Host $_ } }
    throw "Remote port update failed with exit status $($cmd.ExitStatus)"
  }
} finally {
  Remove-SSHSession -SSHSession $session | Out-Null
}

Write-Host "==> Done. Ark now listening on port $Port." -ForegroundColor Green
