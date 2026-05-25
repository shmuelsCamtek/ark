# Ark Story Studio — Internal Windows VM Deployment

Production runs as a single Node 20 process under NSSM on a Camtek-managed
internal Windows VM. The same process serves `/api/*` and the React SPA on
port 3001. Reachable only on Camtek VPN / corp network. Plain HTTP — TLS is
expected to be added later via a reverse proxy if needed.

Deploys are manual from your Windows 11 laptop while connected to VPN:
`scripts\deploy.ps1` builds the frontend, bundles the backend, SCPs a zip to
the VM, and restarts the Ark service.

---

## 1. One-time VM bootstrap

Do this once, on the VM, with an Administrator account.

1. RDP into the VM (or SSH if your SSH session has admin rights).
2. Copy `scripts\bootstrap-vm.ps1` onto the VM (RDP copy-paste, or `scp` from
   the laptop, or `git clone` the repo if the VM has Git + internet).
3. From an elevated PowerShell:
   ```powershell
   .\bootstrap-vm.ps1
   ```
4. The script will prompt for `ANTHROPIC_API_KEY` (hidden input), the Azure
   DevOps org / project, optional `AZURE_TENANT_ID`, and optional
   `SHAREPOINT_SITE_URL`. It writes `C:\Ark\app\.env` and restricts its ACL
   to Administrators and SYSTEM.

After bootstrap, the VM has:
- Node 20 LTS installed system-wide.
- NSSM 2.24 at `C:\Program Files\nssm\nssm.exe` and on PATH.
- `C:\Ark\app\` (empty), `C:\Ark\data\`, `C:\Ark\logs\`.
- `C:\Ark\app\.env` with secrets.
- An `Ark` Windows Service registered with `Startup type: Automatic`, but
  not yet running (no code in `app\` yet).

---

## 2. First deploy from your laptop

1. Make sure your laptop is on Camtek VPN.
2. From the repo root:
   ```powershell
   .\scripts\deploy.ps1 -VmHost <vm-host> -VmUser CAMTEK\<your-user>
   ```
3. The script will:
   - `npm ci && npm run build` in `src\frontend`.
   - Copy `dist\` into `src\backend\public\`.
   - Stage `src\backend\` (sans `node_modules`, `data\`, and `.env`) into
     `$env:TEMP\ark-deploy-<timestamp>\`.
   - `npm ci --omit=dev` in staging (so prod-only `node_modules` ship).
   - Zip the staging folder.
   - `scp` the zip to `C:\Ark\deploy.zip` on the VM.
   - SSH a swap-and-restart: expand into `app-new\`, copy existing `.env`
     forward, stop `Ark`, rename `app -> app-old`, rename `app-new -> app`,
     start `Ark`, hit `/api/health` from the VM, print the result.
4. Expected on success: `Health: 200 {"status":"ok","timestamp":"..."}`.

Subsequent deploys: same command. The swap is atomic — if the upload or
expand fails, the previous version keeps running.

`-SkipBuild`: if you only changed backend env / config, you can re-deploy
without rebuilding the frontend:
```powershell
.\scripts\deploy.ps1 -VmHost <host> -VmUser <user> -SkipBuild
```

---

## 3. Verify

From any laptop on Camtek VPN:

```powershell
curl http://<vm-host>:3001/api/health
```
Expected: `{"status":"ok","timestamp":"..."}`

Open `http://<vm-host>:3001/` in a browser. Sign in via the device-code flow.
Confirm drafts list loads. Paste `http://<vm-host>:3001/stories` directly in
the URL bar to confirm the SPA fallback works.

---

## 4. Operations

### Tail logs

SSH to the VM, then:
```powershell
Get-Content -Wait -Tail 50 C:\Ark\logs\ark-stdout.log
```
Or `ark-stderr.log` for errors. NSSM auto-rotates each at 10 MiB.

### Restart the service

From SSH on the VM:
```powershell
nssm restart Ark
```
Or from your laptop, no rebuild:
```powershell
ssh CAMTEK\<user>@<vm-host> "nssm restart Ark"
```

### Rotate a secret (e.g. `ANTHROPIC_API_KEY`)

SSH to the VM, edit `C:\Ark\app\.env` (you'll need admin since the ACL is
restricted), save, then `nssm restart Ark`. No redeploy.

### Roll back

After a deploy, the previous version sits at `C:\Ark\app-old\` *until the
next deploy succeeds and overwrites it*. To roll back manually before then:
```powershell
nssm stop Ark
Rename-Item C:\Ark\app    -NewName app-bad
Rename-Item C:\Ark\app-old -NewName app
nssm start Ark
```

### Back up `C:\Ark\data\`

The drafts and chat history file-tree is the only stateful thing the app
owns. Periodic snapshot:
```powershell
robocopy C:\Ark\data \\<backup-share>\ark-data\$(Get-Date -Format yyyyMMdd) /MIR
```
Put this on a Task Scheduler nightly task if you care about it.

### Reset everything

```powershell
nssm stop Ark
nssm remove Ark confirm
Remove-Item -Recurse -Force C:\Ark
```

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `scp` hangs forever | Not on VPN, or VM hostname doesn't resolve | `ping <vm-host>` first; check `~\.ssh\config` |
| `nssm: command not found` over SSH | NSSM isn't on the SYSTEM PATH for the SSH user's session | Use full path `& 'C:\Program Files\nssm\nssm.exe' restart Ark`, or restart the SSH connection so PATH refreshes |
| Service "starts" then immediately stops | Likely a Node crash on boot — `.env` malformed or missing required key | Read `C:\Ark\logs\ark-stderr.log` |
| `/api/health` returns 404 | Service crashed; you reached a different listener (IIS default?) | `Get-Service Ark` + `nssm status Ark`; check `ark-stderr.log` |
| `/api/ai/*` returns 401 from Anthropic | `ANTHROPIC_API_KEY` is wrong or expired in `.env` | Edit `.env` and `nssm restart Ark` |
| Drafts vanish after a deploy | `.env` was deployed without `DATA_DIR=…` set, OR you deleted `C:\Ark\data` | NSSM sets `DATA_DIR=C:\Ark\data` via AppEnvironmentExtra; if you removed that, re-run the relevant `nssm set` line from `bootstrap-vm.ps1` |
| You changed `bootstrap-vm.ps1` and want to re-apply | The script is idempotent | Re-run it; it skips already-installed parts |
| Sign-in popup is blank from wired network, works from Wi-Fi | Backend can't reach `login.microsoftonline.com`. Camtek wired-network egress filter (Netskope on-prem mode hands the traffic to the corp gateway, which drops outbound to public Microsoft auth IPs in the `20.190.x.x` / `40.126.x.x` ranges). DNS falls through to public IPs because no private IP override is in place for the user's segment. Other corp users may have a working route via Azure Private Endpoint for `privatelink.msidentity.com`. | Network/Netskope ticket: allow outbound to `login.microsoftonline.com` / `login.microsoft.com` / `login.windows.net`, or fix the Azure Private Endpoint for `privatelink.msidentity.com`. Workaround: sign in once on Wi-Fi, then continue on wired — the in-memory token persists. |
