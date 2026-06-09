# Ark Story Studio — Internal Windows VM Deployment

Production runs as a single Node 20 process under NSSM on a Camtek-managed
internal Windows VM. The same process serves `/api/*` and the React SPA on
port 8000. Reachable only on Camtek VPN / corp network. Plain HTTP — TLS is
expected to be added later via a reverse proxy if needed.

Deploys are **git-based and build on the VM**. From your Windows 11 laptop
(on VPN), `scripts\deploy.ps1` opens one SSH session and drives the deploy
on the VM, one titled step at a time: the VM pulls the latest code from git
(`C:\Ark\repo`), builds the frontend, assembles the backend release, swaps it
into place atomically, restarts the Ark service, and cleans up. Nothing is
built or uploaded from the laptop — the laptop only triggers and streams
progress.

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
4. The script requires **Git for Windows** to be installed. If `C:\Ark\repo`
   doesn't exist yet, it prompts for a **GitHub PAT** (repo read access) and
   clones `shmuelsCamtek/ark.git` into `C:\Ark\repo`. The PAT is embedded in
   the clone's remote URL (persisted in `C:\Ark\repo\.git\config`) so the
   recurring deploy never needs the token. The repo tree's ACL is restricted
   to Administrators and SYSTEM.
5. The script then prompts for `ANTHROPIC_API_KEY` (hidden input), the Azure
   DevOps org / project, optional `AZURE_TENANT_ID`, and optional
   `SHAREPOINT_SITE_URL`. It writes `C:\Ark\app\.env` and restricts its ACL
   to Administrators and SYSTEM.

After bootstrap, the VM has:
- Node 20 LTS installed system-wide.
- NSSM 2.24 at `C:\Program Files\nssm\nssm.exe` and on PATH.
- `C:\Ark\repo\` (git clone with PAT in its remote URL).
- `C:\Ark\app\` (empty), `C:\Ark\data\`, `C:\Ark\logs\`.
- `C:\Ark\app\.env` with secrets.
- An `Ark` Windows Service registered with `Startup type: Automatic`, but
  not yet running (no code in `app\` yet).

If `bootstrap-vm.ps1` halts midway, finish with the idempotent
`bootstrap-vm-finish.ps1` (it skips already-done steps, including the clone).

---

## 2. Deploy from your laptop

1. Make sure your laptop is on Camtek VPN. Make sure the code you want live is
   pushed to `main` (the VM deploys from git, not your working tree).
2. From the repo root:
   ```powershell
   $pw = Read-Host 'VM password' -AsSecureString
   .\scripts\deploy.ps1 -VmHost 10.5.0.19 -VmUser me_admin -Password $pw
   ```
   `-VmHost`, `-VmUser`, and `-Branch` default to `10.5.0.19`, `me_admin`, and
   `main`; pass `-Branch <name>` to deploy a different branch. If you omit
   `-Password` the script prompts once.
3. The script opens one SSH session and runs these six titled steps on the VM,
   streaming each step's output as it goes:
   1. **Update source from git** — `git fetch` + `reset --hard origin/<branch>`
      + `clean -fd` in `C:\Ark\repo`.
   2. **Build frontend** — `npm ci` + `vite build` in `repo\src\frontend`, then
      bundle `dist\` into `repo\src\backend\public\`.
   3. **Assemble release + install deps** — copy `repo\src\backend\` (sans
      `node_modules`, `data\`, `.env`) into `C:\Ark\app-new`, `npm ci
      --omit=dev` there, carry the live `.env` forward.
   4. **Install (swap + restart)** — stop `Ark`, rename `app -> app-old`,
      `app-new -> app`, start `Ark`.
   5. **Health check** — `GET /api/health` from the VM (port read from `.env`,
      default 8000).
   6. **Clean all** — remove the transient `app-old` / `app-new` folders.
4. Expected on success: `health 200 OK on port 8000` and
   `==> Deploy complete in MM:SS`.

The swap is atomic — if any step before the swap fails, the previous version
keeps running. The first deploy is the same command (the empty `app\` is just
replaced).

---

## 3. Verify

From any laptop on Camtek VPN:

```powershell
curl http://<vm-host>:8000/api/health
```
Expected: `{"status":"ok","timestamp":"..."}`

Open `http://<vm-host>:8000/` in a browser. Sign in via the device-code flow.
Confirm drafts list loads. Paste `http://<vm-host>:8000/stories` directly in
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

### Rotate the GitHub PAT

The deploy's PAT lives in `C:\Ark\repo\.git\config`. To rotate it, SSH to the
VM (as admin) and re-point the remote:
```powershell
git -C C:\Ark\repo remote set-url origin "https://<new-pat>@github.com/shmuelsCamtek/ark.git"
```
No service restart needed; it only affects the next deploy's `git fetch`.

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
| SSH session won't open / deploy hangs at step 1 | Not on VPN, or VM host doesn't resolve | `ping <vm-host>` first; confirm you're on Camtek VPN |
| `git fetch` fails in step 1 (auth) | PAT expired or revoked | Rotate the PAT (see Operations → Rotate the GitHub PAT) |
| `npm ci` fails in step 2/3 | VM lost internet, or `package-lock.json` out of sync | Check VM egress to the npm registry; ensure the lockfile is committed |
| `nssm: command not found` over SSH | NSSM isn't on the SYSTEM PATH for the SSH user's session | Use full path `& 'C:\Program Files\nssm\nssm.exe' restart Ark`, or restart the SSH connection so PATH refreshes |
| Service "starts" then immediately stops | Likely a Node crash on boot — `.env` malformed or missing required key | Read `C:\Ark\logs\ark-stderr.log` |
| `/api/health` returns 404 | Service crashed; you reached a different listener (IIS default?) | `Get-Service Ark` + `nssm status Ark`; check `ark-stderr.log` |
| `/api/ai/*` returns 401 from Anthropic | `ANTHROPIC_API_KEY` is wrong or expired in `.env` | Edit `.env` and `nssm restart Ark` |
| Drafts vanish after a deploy | `.env` was deployed without `DATA_DIR=…` set, OR you deleted `C:\Ark\data` | NSSM sets `DATA_DIR=C:\Ark\data` via AppEnvironmentExtra; if you removed that, re-run the relevant `nssm set` line from `bootstrap-vm.ps1` |
| You changed `bootstrap-vm.ps1` and want to re-apply | The script is idempotent | Re-run it; it skips already-installed parts |
| Sign-in popup is blank from wired network, works from Wi-Fi | Backend can't reach `login.microsoftonline.com`. Camtek wired-network egress filter (Netskope on-prem mode hands the traffic to the corp gateway, which drops outbound to public Microsoft auth IPs in the `20.190.x.x` / `40.126.x.x` ranges). DNS falls through to public IPs because no private IP override is in place for the user's segment. Other corp users may have a working route via Azure Private Endpoint for `privatelink.msidentity.com`. | Network/Netskope ticket: allow outbound to `login.microsoftonline.com` / `login.microsoft.com` / `login.windows.net`, or fix the Azure Private Endpoint for `privatelink.msidentity.com`. Workaround: sign in once on Wi-Fi, then continue on wired — the in-memory token persists. |
