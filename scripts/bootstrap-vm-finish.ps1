#requires -RunAsAdministrator
<#
.SYNOPSIS
  Finish the bootstrap on the VM when bootstrap-vm.ps1 halts early.
  Idempotent. Skips work that's already done.

  Run from an *elevated* PowerShell on the VM.
#>

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

# 1. Directories
foreach ($d in 'C:\Ark','C:\Ark\app','C:\Ark\data','C:\Ark\logs') {
  if (-not (Test-Path $d)) {
    New-Item -ItemType Directory -Path $d | Out-Null
    Write-Host "Created $d"
  } else {
    Write-Host "Exists  $d"
  }
}

# 2. Source clone (prompts for a GitHub PAT if missing)
$repoDir  = 'C:\Ark\repo'
$repoSlug = 'shmuelsCamtek/ark.git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git is not installed / not on PATH. Install Git for Windows, then re-run."
}
if (-not (Test-Path (Join-Path $repoDir '.git'))) {
  Write-Host ""
  Write-Host "Cloning $repoSlug into $repoDir -- you will be prompted for a GitHub PAT."
  $pat      = Read-Host -AsSecureString "GitHub PAT (repo read access)"
  $patPlain = [System.Net.NetworkCredential]::new('', $pat).Password
  git clone "https://$patPlain@github.com/$repoSlug" $repoDir
  if ($LASTEXITCODE -ne 0) { throw "git clone failed ($LASTEXITCODE). Check the PAT and network." }
  icacls $repoDir /inheritance:r /grant:r "Administrators:F" "SYSTEM:F" | Out-Null
  Write-Host "Cloned $repoDir (ACL restricted)"
} else {
  Write-Host "Exists  $repoDir"
}

# 3. .env (prompts for secrets if missing)
$envFile = 'C:\Ark\app\.env'
if (-not (Test-Path $envFile)) {
  Write-Host ""
  Write-Host "Writing $envFile -- you will be prompted for secrets."
  $anthropic  = Read-Host -AsSecureString "ANTHROPIC_API_KEY"
  $devopsOrg  = Read-Host "AZURE_DEVOPS_ORG (e.g. https://dev.azure.com/AzCamtek)"
  $devopsProj = Read-Host "AZURE_DEVOPS_PROJECT (e.g. Falcon)"
  $tenant     = Read-Host "AZURE_TENANT_ID (blank for multi-tenant)"
  $sharepoint = Read-Host "SHAREPOINT_SITE_URL (blank to skip)"

  $plain = [System.Net.NetworkCredential]::new('', $anthropic).Password
  $lines = @(
    "ANTHROPIC_API_KEY=$plain"
    "AZURE_DEVOPS_ORG=$devopsOrg"
    "AZURE_DEVOPS_PROJECT=$devopsProj"
  )
  if ($tenant)     { $lines += "AZURE_TENANT_ID=$tenant" }
  if ($sharepoint) { $lines += "SHAREPOINT_SITE_URL=$sharepoint" }
  $lines += "PORT=8000"
  Set-Content -Path $envFile -Value $lines -Encoding utf8
  icacls $envFile /inheritance:r /grant:r "Administrators:R" "SYSTEM:R" | Out-Null
  Write-Host "Wrote $envFile (ACL restricted)"
} else {
  Write-Host "Exists  $envFile"
}

# 4. NSSM service
$nssm = 'C:\Program Files\nssm\nssm.exe'
if (-not (Test-Path $nssm)) { throw "NSSM not installed at $nssm" }

if (-not (Get-Service -Name Ark -ErrorAction SilentlyContinue)) {
  & $nssm install Ark "C:\Program Files\nodejs\node.exe" "node_modules\tsx\dist\cli.mjs src\index.ts" | Out-Null
  & $nssm set Ark AppDirectory        "C:\Ark\app"                       | Out-Null
  & $nssm set Ark AppEnvironmentExtra "DATA_DIR=C:\Ark\data"             | Out-Null
  & $nssm set Ark Start               SERVICE_AUTO_START                 | Out-Null
  & $nssm set Ark AppStdout           "C:\Ark\logs\ark-stdout.log"       | Out-Null
  & $nssm set Ark AppStderr           "C:\Ark\logs\ark-stderr.log"       | Out-Null
  & $nssm set Ark AppRotateFiles      1                                  | Out-Null
  & $nssm set Ark AppRotateBytes      10485760                           | Out-Null
  & $nssm set Ark AppExit             Default Restart                    | Out-Null
  Write-Host "Ark service registered"
} else {
  Write-Host "Exists  Ark service"
}

# 5. Verify
Write-Host ""
Write-Host "=== Verification ==="
Get-Service Ark | Format-List Name, Status, StartType
Write-Host "C:\Ark\app exists:        $(Test-Path C:\Ark\app)"
Write-Host "C:\Ark\data exists:       $(Test-Path C:\Ark\data)"
Write-Host "C:\Ark\logs exists:       $(Test-Path C:\Ark\logs)"
Write-Host "C:\Ark\repo exists:       $(Test-Path C:\Ark\repo\.git)"
Write-Host "C:\Ark\app\.env exists:   $(Test-Path C:\Ark\app\.env)"
Write-Host ""
Write-Host "Bootstrap finish complete. Next: from the laptop run scripts\deploy.ps1."
