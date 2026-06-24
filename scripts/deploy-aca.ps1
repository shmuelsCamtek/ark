#requires -Version 5.1
<#
.SYNOPSIS
  Build and deploy Ark Story Studio to Azure Container Apps.

  Builds the Docker image locally, pushes it to ACR, and updates the Container
  App with the new image + all required environment variables. Running this
  script is the only step needed — no .env file is required.

.PARAMETER AzureDevOpsOrg
  Azure DevOps organisation URL, e.g. https://dev.azure.com/Camtek

.PARAMETER AzureDevOpsProject
  Azure DevOps project name, e.g. Software

.PARAMETER AzureTenantId
  Optional: pin to a specific AAD tenant GUID. Defaults to 'organizations'.

.PARAMETER SharePointSiteUrl
  Optional: SharePoint site URL for story publishing.

.PARAMETER Branch
  Git branch to deploy. Defaults to the current branch.

.EXAMPLE
  .\scripts\deploy-aca.ps1 `
    -AzureDevOpsOrg     https://dev.azure.com/Camtek `
    -AzureDevOpsProject Software
#>
param(
  [Parameter(Mandatory)] [string] $AzureDevOpsOrg,
  [Parameter(Mandatory)] [string] $AzureDevOpsProject,
  [Parameter()]          [string] $AzureTenantId      = '',
  [Parameter()]          [string] $SharePointSiteUrl  = '',
  [Parameter()]          [string] $Branch             = ''
)

$ErrorActionPreference = 'Stop'

# Constants — tied to the Azure resources already provisioned
$Acr           = 'ca13e4372bc2acr.azurecr.io'
$ImageName     = 'ark'
$ContainerApp  = 'ark'
$ResourceGroup = 'POC-Project'
$KeyVaultUri   = 'https://ark-kv-poc.vault.azure.net/'
$Port          = '8000'

# Resolve the image tag from git so the Container App revision is traceable
$Tag = (git rev-parse --short HEAD 2>&1).Trim()
if ($LASTEXITCODE -ne 0) { throw "git rev-parse failed — run from inside the repo" }
$Image = "${Acr}/${ImageName}:${Tag}"

if (-not $Branch) {
  $Branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
}

$timer = [System.Diagnostics.Stopwatch]::StartNew()
$step  = 0
$total = 3

function Step([string]$Name, [scriptblock]$Action) {
  $script:step++
  Write-Host ("  .. [{0}/{1}] {2}" -f $script:step, $total, $Name) -ForegroundColor Cyan
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  & $Action
  Write-Host ("  OK [{0}/{1}] {2}  {3:n1}s" -f $script:step, $total, $Name, $sw.Elapsed.TotalSeconds) -ForegroundColor Green
}

Write-Host "==> Deploying branch '$Branch' → $Image" -ForegroundColor White
Write-Host "    registry:       $Acr"
Write-Host "    container app:   $ContainerApp  (resource group: $ResourceGroup)"
Write-Host "    image tag:       $Tag"
Write-Host "    key vault:       $KeyVaultUri"

Step 'Build & push image (ACR cloud build)' {
  # az acr build runs the Docker build remotely in ACR Tasks — no local Docker
  # daemon required — and pushes the result straight into the registry.
  $repoRoot = Join-Path $PSScriptRoot '..'
  Write-Host "     uploading build context from $repoRoot (this can take a few minutes)..."
  az acr build `
    --registry ($Acr -split '\.')[0] `
    --image    "${ImageName}:${Tag}" `
    $repoRoot
  if ($LASTEXITCODE -ne 0) { throw "az acr build failed ($LASTEXITCODE)" }
  Write-Host "     image pushed: $Image"
}

Step 'Set environment variables on Container App' {
  # Build the env-vars string — only include optional vars when provided
  $envVars = @(
    "AZURE_DEVOPS_ORG=$AzureDevOpsOrg"
    "AZURE_DEVOPS_PROJECT=$AzureDevOpsProject"
    "KEYVAULT_URI=$KeyVaultUri"
    "PORT=$Port"
  )
  if ($AzureTenantId)     { $envVars += "AZURE_TENANT_ID=$AzureTenantId" }
  if ($SharePointSiteUrl) { $envVars += "SHAREPOINT_SITE_URL=$SharePointSiteUrl" }

  Write-Host "     applying $($envVars.Count) environment variables:"
  foreach ($e in $envVars) { Write-Host "       - $e" }
  Write-Host "     (ANTHROPIC_API_KEY is intentionally omitted — fetched from Key Vault at runtime)"

  # Pass the array directly — PowerShell expands each element into a separate
  # argument, which is what --set-env-vars expects. Joining into one space-
  # separated string instead would make az treat the whole thing as a single
  # KEY=VALUE, mashing every pair into the first variable's value.
  az containerapp update `
    --name            $ContainerApp `
    --resource-group  $ResourceGroup `
    --set-env-vars    $envVars
  if ($LASTEXITCODE -ne 0) { throw "az containerapp update (env vars) failed ($LASTEXITCODE)" }
  Write-Host "     environment variables applied"
}

Step 'Update Container App image' {
  Write-Host "     pointing $ContainerApp at $Image..."
  az containerapp update `
    --name           $ContainerApp `
    --resource-group $ResourceGroup `
    --image          $Image
  if ($LASTEXITCODE -ne 0) { throw "az containerapp update (image) failed ($LASTEXITCODE)" }

  # Wait for the new revision to be running
  Write-Host "     waiting for revision to become active..."
  Start-Sleep -Seconds 10
  $health = az containerapp show `
    --name           $ContainerApp `
    --resource-group $ResourceGroup `
    --query "properties.latestRevisionName" -o tsv
  Write-Host "     active revision: $health"
}

$timer.Stop()
Write-Host ("==> Deploy complete in {0:mm\:ss}" -f $timer.Elapsed) -ForegroundColor Green
Write-Host "    Image:    $Image"
Write-Host "    Tip: check startup logs with:" -ForegroundColor DarkGray
Write-Host "      az containerapp logs show --name $ContainerApp --resource-group $ResourceGroup --tail 50" -ForegroundColor DarkGray
