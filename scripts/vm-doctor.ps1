#requires -Version 5.1
<#
.SYNOPSIS
  Diagnose + fix the frontend `npm ci` failure on the Ark VM
  ("Exit handler never called!").

  Run on the VM (in an SSH/elevated PowerShell):
    powershell -ExecutionPolicy Bypass -File C:\Ark\repo\scripts\vm-doctor.ps1

  It is read-mostly + low-risk: updates npm, sets a Defender exclusion for
  C:\Ark, clears the npm cache, then runs `npm ci` once and — if it still
  fails — prints the tail of npm's debug log (the real underlying error).
#>

# Keep going on native-command failures so we always reach the log dump.
$ErrorActionPreference = 'Continue'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$fe = 'C:\Ark\repo\src\frontend'
function Section($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

Section 'Environment'
Write-Host "node      : $(node --version)"
Write-Host "npm       : $(npm --version)"
Write-Host "where node: $((Get-Command node -ErrorAction SilentlyContinue).Source)"
Write-Host "where npm : $((Get-Command npm -ErrorAction SilentlyContinue).Source)"
Get-PSDrive C |
  Select-Object @{n='UsedGB';e={[math]::Round($_.Used/1GB,1)}},
                @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}} |
  Format-Table | Out-String | Write-Host

Section 'Antivirus / Defender'
try {
  $excl = (Get-MpPreference -ErrorAction Stop).ExclusionPath
  if ($excl -contains 'C:\Ark') {
    Write-Host "C:\Ark already excluded from Defender."
  } else {
    Add-MpPreference -ExclusionPath 'C:\Ark' -ErrorAction Stop
    Write-Host "Added C:\Ark to Defender exclusions."
  }
  $st = Get-MpComputerStatus -ErrorAction Stop
  Write-Host "Defender real-time protection enabled: $($st.RealTimeProtectionEnabled)"
  Write-Host "Antivirus product enabled            : $($st.AntivirusEnabled)"
} catch {
  Write-Host "Defender cmdlets unavailable/blocked: $($_.Exception.Message)"
  Write-Host "A third-party AV (or MDM policy) may be active. If npm ci stays slow, ask IT to exclude C:\Ark."
}

Section 'Update npm to latest'
npm install -g npm@latest --no-progress --no-audit --no-fund
Write-Host "npm now: $(npm --version)"

Section 'Clean npm cache'
npm cache clean --force

Section 'npm ci (frontend)'
$sw = [System.Diagnostics.Stopwatch]::StartNew()
Push-Location $fe
npm ci --include=dev --no-progress --no-audit --no-fund
$code = $LASTEXITCODE
Pop-Location
$sw.Stop()
Write-Host "`nnpm ci exit=$code in $([math]::Round($sw.Elapsed.TotalSeconds))s"

# Don't trust the exit code: npm can crash but still exit 0. The real test is
# whether the build tool actually landed.
$viteOk = Test-Path (Join-Path $fe 'node_modules\.bin\vite.cmd')
if ($code -eq 0 -and $viteOk) {
  Section 'Result'
  Write-Host "SUCCESS. vite present: True"
  Write-Host "You can now re-run scripts\deploy.ps1 from the laptop."
} else {
  Write-Host "INCOMPLETE: exit=$code, vite present=$viteOk (npm did not finish the install)"
  Section 'npm debug log (last 80 lines) - the real error'
  $logDir = Join-Path $env:LOCALAPPDATA 'npm-cache\_logs'
  $log = Get-ChildItem (Join-Path $logDir '*-debug-0.log') -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($log) {
    Write-Host "log: $($log.FullName)`n"
    Get-Content $log.FullName -Tail 80 | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "No debug log found under $logDir"
  }
}
