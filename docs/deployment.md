# Ark Story Studio — Azure App Service Deployment

This is the one-time provisioning runbook plus ops notes. The app deploys as a
**single Azure App Service** (Linux, Node 20) where one Node process serves
both the React SPA and the `/api/*` Express routes. CI/CD is GitHub Actions —
see `.github/workflows/deploy.yml`.

---

## 1. One-time provisioning

Run these once per environment. They assume the `az` CLI is installed and you
have Contributor (or higher) on the target subscription.

### 1.1 Sign in and pick a subscription

```powershell
az login
az account set --subscription "<your-subscription-name-or-id>"
```

### 1.2 Fix the names (used everywhere below)

| Variable | Suggested value |
|---|---|
| Resource group | `rg-ark-prod` |
| Location | `westeurope` (or closest to users) |
| App Service Plan | `asp-ark-prod` (Linux, B1, ~$13/mo) |
| Web App name | `ark-story-studio` (globally unique — suffix if taken) |

### 1.3 Create resource group, plan, and web app

```powershell
az group create --name rg-ark-prod --location westeurope

az appservice plan create `
  --name asp-ark-prod `
  --resource-group rg-ark-prod `
  --is-linux `
  --sku B1

az webapp create `
  --name ark-story-studio `
  --resource-group rg-ark-prod `
  --plan asp-ark-prod `
  --runtime "NODE:20-lts"
```

### 1.4 Application settings (env vars + deploy mode)

Replace placeholders with real values. The Anthropic key never leaves this
step — it lives only in App Settings, never in git, never in the frontend
bundle.

```powershell
az webapp config appsettings set `
  --name ark-story-studio `
  --resource-group rg-ark-prod `
  --settings `
    ANTHROPIC_API_KEY="sk-ant-..." `
    AZURE_DEVOPS_ORG="https://dev.azure.com/AzCamtek" `
    AZURE_DEVOPS_PROJECT="Falcon" `
    AZURE_TENANT_ID="<your-tenant-guid-or-omit>" `
    DATA_DIR="/home/data" `
    WEBSITE_RUN_FROM_PACKAGE="1" `
    SCM_DO_BUILD_DURING_DEPLOYMENT="false"
```

Why the last two:
- `WEBSITE_RUN_FROM_PACKAGE=1` — App Service mounts the deployed zip read-only.
  Faster cold starts, atomic deploys, no leftover files from previous deploys.
- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` — disables Oryx server-side build. CI
  does all the building; nothing to build on the server.

`AZURE_TENANT_ID` is optional. Leave it unset for "any work/school account",
or pin it to your Camtek tenant GUID to reject foreign accounts at login.
Find it via `az account show --query tenantId -o tsv`.

### 1.5 Startup command and health-check path

```powershell
az webapp config set `
  --name ark-story-studio `
  --resource-group rg-ark-prod `
  --startup-file "npm start"

az webapp config set `
  --name ark-story-studio `
  --resource-group rg-ark-prod `
  --generic-configurations '{\"healthCheckPath\":\"/api/health\"}'
```

### 1.6 Enable HTTPS-only and grab the publish profile

```powershell
az webapp update `
  --name ark-story-studio `
  --resource-group rg-ark-prod `
  --https-only true

az webapp deployment list-publishing-profiles `
  --name ark-story-studio `
  --resource-group rg-ark-prod `
  --xml > publish-profile.xml
```

### 1.7 Add publish profile to GitHub Secrets

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
- Value: paste the full contents of `publish-profile.xml`

Then wipe the local copy — it contains a deployment credential:

```powershell
Remove-Item publish-profile.xml
```

After this, every push to `main` triggers `.github/workflows/deploy.yml` which
builds the frontend, bundles the backend, and zip-deploys to App Service.

---

## 2. Operations

### View live logs

```powershell
az webapp log tail --name ark-story-studio --resource-group rg-ark-prod
```

Expect to see `Ark server listening on port 8080` (App Service injects
`PORT=8080`). Ctrl-C to exit.

### Rotate the Anthropic API key

```powershell
az webapp config appsettings set `
  --name ark-story-studio `
  --resource-group rg-ark-prod `
  --settings ANTHROPIC_API_KEY="sk-ant-new..."

az webapp restart --name ark-story-studio --resource-group rg-ark-prod
```

No code change, no redeploy.

### Restart the app

```powershell
az webapp restart --name ark-story-studio --resource-group rg-ark-prod
```

Logged-in users will need to re-authenticate (token state is in-process memory).
Drafts persist because `DATA_DIR=/home/data` is on Azure's persistent storage.

### Back up `/home/data` (drafts + chats)

SSH into the running container and tar the data folder:

```powershell
az webapp ssh --name ark-story-studio --resource-group rg-ark-prod
# inside the SSH session:
cd /home && tar czf /tmp/ark-data-backup.tgz data && exit

# pull the file out (separate shell):
az webapp deployment list-publishing-credentials `
  --name ark-story-studio --resource-group rg-ark-prod --query scmUri -o tsv
# then use the Kudu API or FTP from the SCM URL to download /tmp/ark-data-backup.tgz
```

For a longer-term solution, replace the file-backed draft store with Cosmos DB.

### Manually trigger a deploy

In GitHub: **Actions → Deploy to Azure App Service → Run workflow → Run**.
This is also useful for redeploys after rotating App Settings if you just want
to be sure the running process saw the change.

### Reset everything (tear down)

```powershell
az group delete --name rg-ark-prod --yes --no-wait
```

Deletes the resource group and everything in it. `/home/data` contents are
lost. Do not run unless you intend full reset.

---

## 3. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Workflow fails on "Deploy to Azure Web App" | `AZURE_WEBAPP_PUBLISH_PROFILE` secret missing or stale | Re-download from step 1.6, re-paste into GitHub Secrets |
| Site returns 503 / "Application Error" | App didn't bind to `process.env.PORT` | Confirm `src/backend/src/index.ts:18` uses `process.env.PORT \|\| '3001'` |
| `/api/*` works but `/` is 404 | `public/` not in the deployed zip | Check Actions log for the "Copy frontend dist into backend/public" step |
| Drafts disappear after every deploy | `DATA_DIR` not set, or set to a path inside `wwwroot` | Confirm App Setting `DATA_DIR=/home/data` |
| Anthropic calls return 401 | Key not set, or set in wrong slot | `az webapp config appsettings list ...` and re-apply if missing |
| Login loops forever / "AADSTS9002313" | Tenant misconfigured | Either unset `AZURE_TENANT_ID` (defaults to multi-tenant `organizations`) or set to a valid tenant GUID |
