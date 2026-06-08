# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project Overview

**Ark Story Studio** — a web app where non-technical org experts (PMs, support leads, ops) turn business problems into well-formed Azure DevOps user stories, guided by an AI "coach" that reads their backlog and suggests personas, copy, and acceptance criteria.

## Build & Run

### Frontend
```bash
cd src/frontend
npm install
npm run dev        # starts Vite dev server on http://localhost:5173
npx tsc --noEmit   # type-check without emitting
npm run build      # production build (runs tsc + vite build)
```

Auth uses OAuth2 **device code flow** against Microsoft's pre-registered Azure CLI client (`04b07795-…`), so no Camtek App Registration is required. The backend (`services/auth.ts`) holds a single in-memory token state — when expired, the user re-authenticates. `AppInitializer` is the auth gate: it calls `GET /api/auth/me`, and on 401 starts the device flow (`POST /api/auth/device/start`) and polls (`POST /api/auth/device/poll`) until the user signs in via `microsoft.com/devicelogin`. The router only mounts when `authStatus === 'authenticated'`.

No frontend env vars are needed. Optionally pin the tenant via backend `AZURE_TENANT_ID` (defaults to `organizations`).

### Backend
```bash
cd src/backend
npm install
cp .env.example .env   # then fill in API keys
npm run dev             # starts Express on http://localhost:8000 (watch mode)
npm run typecheck       # tsc --noEmit
```

Required `.env` keys:
- `ANTHROPIC_API_KEY` — for AI coach (Claude API)
- `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT` — Azure DevOps target org/project. Auth uses the OAuth2 device-code flow via Microsoft's Azure CLI public client; no PAT or App Registration needed.
- `AZURE_TENANT_ID` *(optional)* — pin to your tenant GUID; defaults to `organizations` (any work/school account)
- `USER_MANUAL_PATH` *(optional, indexing-time only)* — absolute path to the Camtek User Manual PDF. Read by `npm run index-manual` to build a small text index; defaults to `src/backend/manual/camtek-user-manual.pdf`. The runtime never reads the PDF itself.
- `USER_MANUAL_INDEX_PATH` *(optional)* — override the runtime path to the generated `manual-index.json`. Defaults to `src/backend/manual/manual-index.json`.

The frontend Vite dev server proxies `/api` requests to `localhost:8000`.

### Indexing the User Manual (one-time / on update)

The Camtek User Manual is too large (~158 MiB) to inline on every Claude call — Anthropic's per-request body limit (~32 MiB) would reject it with HTTP 413. Instead the backend reads a pre-built searchable text index, and selects the top-4 relevant chunks per call.

```bash
cd src/backend
npm run index-manual          # interactive
npm run index-manual -- --yes # non-interactive
```

The script walks the PDF page-by-page and writes `src/backend/manual/manual-index.json` (gitignored). Re-run it whenever the source PDF changes; restart the backend to pick up the new index. If the index is missing the coach runs without product context (single warning logged at startup). See `src/backend/manual/README.md` for details.

No test framework is configured yet.

## Deployment

Production runs as a Node 20 process under NSSM on a Camtek-managed internal
Windows VM at `62f5fb5e3738` (10.5.0.19). One process serves `/api/*` and the
React SPA on port 8000, reachable only on Camtek VPN. See
`docs/deployment.md` for the full runbook.

### One-time VM bootstrap (already done)

Done by running `scripts\bootstrap-vm.ps1` from an elevated PowerShell on the
VM. It installs Node 20 LTS + NSSM, creates `C:\Ark\{app,data,logs}`, writes
`C:\Ark\app\.env` (ACL-restricted to Administrators/SYSTEM), and registers
the `Ark` Windows Service. If the script halts midway, finish with
`scripts\bootstrap-vm-finish.ps1` (idempotent rescue that skips already-done
steps). Also remember to add the inbound firewall rule once:
`New-NetFirewallRule -DisplayName "Ark TCP 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Any`.

### Recurring deploy (from your laptop, on Camtek VPN)

```powershell
cd C:\temp\Ark
$pw = Read-Host 'VM password' -AsSecureString
.\scripts\deploy.ps1 -VmHost 62f5fb5e3738 -VmUser me_admin -Password $pw
```

Auth uses the **Posh-SSH** module (not OpenSSH `ssh`/`scp`, which can't take a
password programmatically). Pass the SSH password once via `-Password`
(a `[SecureString]`); if you omit it the script prompts for it once and reuses
it for both the upload and the remote swap. Never hardcode the password into a
command you commit or paste into a shared file.

What it does:
1. Frontend: `npm ci --include=dev` + `vite build` (no `tsc` — see frontend `package.json`).
2. Backend staging: copies `src/backend/` (minus `node_modules`, `data`, `.env`) to `$env:TEMP\ark-deploy-<stamp>\`, runs `npm ci --omit=dev` there.
3. Zips the staged folder, uploads it to `C:/Ark/deploy.zip` on the VM via `Set-SCPItem` (using the supplied credential — no prompt).
4. Runs a swap-and-restart on the VM via `Invoke-SSHCommand`: expand zip → preserve `.env` → `nssm stop Ark` → swap folders → `nssm start Ark` → health-check.

`--SkipBuild` re-uses the existing `src/backend/public` if you only need to redeploy backend changes.

### Secrets

In `C:\Ark\app\.env` on the VM. Rotate with: SSH to the VM, edit the file, `nssm restart Ark`. Never put secrets in the repo or the frontend bundle.

### Persistence

Drafts and chats persist to `C:\Ark\data\` (`DATA_DIR` set by NSSM's `AppEnvironmentExtra`). `C:\Ark\app-old\` exists transiently between deploys for rollback; everything else under `C:\Ark\app\` is replaced each deploy.

### Logs

NSSM rotates stdout/stderr at 10 MiB. Tail live: SSH to VM and `Get-Content -Wait -Tail 50 C:\Ark\logs\ark-stdout.log` (or `ark-stderr.log`).

### Built artifact

`src/backend/public/` is generated locally during deploy. Gitignored — never commit it.

### Gotchas the deploy scripts already handle

- **NODE_ENV=production** in the calling shell makes `npm ci` skip devDependencies; the script passes `--include=dev` explicitly.
- **PowerShell 7's `$PSNativeCommandUseErrorActionPreference`** aborts on NSSM's non-zero `--version` exit; the bootstrap disables it.
- **Native-command exit codes** don't trigger PowerShell's `Stop` preference; the script checks `$LASTEXITCODE` after every `npm` call and throws.

## Environment Constraints

- Machine may have no internet access — `npm install` can fail with ETIMEDOUT
- Cached packages available for core deps (react, vite, tailwindcss, typescript, etc.)
- Use `--prefer-offline` or `--offline` flags when possible
- If npm install fails, ask the user what to do

## Tech Stack

- **Frontend:** Vite 5 + React 18 + TypeScript + Tailwind CSS
- **Backend:** Node.js Express + tsx
- **AI Coach:** Claude API via Anthropic SDK
- **Persistence:** In-memory (ready for Cosmos DB swap)
- **Auth:** OAuth2 device-code flow (backend-driven) via Microsoft's Azure CLI public client; no App Registration required
- **No react-router-dom** — custom router in `src/router.tsx`

## Architecture

```
src/frontend/                          # Vite + React app
├── src/
│   ├── main.tsx                       # Entry point
│   ├── App.tsx                        # Router + routes
│   ├── index.css                      # Tailwind + CSS custom props + keyframes
│   ├── router.tsx                     # Custom BrowserRouter (no react-router-dom)
│   ├── types.ts                       # Domain types (StoryDraft, CoachMessage, etc.)
│   ├── tokens.ts                      # ARK_TOKENS design token object
│   ├── context/
│   │   ├── AppContext.tsx             # Global state: drafts, user, authStatus
│   │   └── ServicesContext.tsx         # DI for AI + Azure HTTP services
│   ├── services/
│   │   ├── ai.ts                      # AiService interface
│   │   ├── azure.ts                   # AzureService interface
│   │   ├── http-ai.ts                 # HttpAiService (calls /api/ai)
│   │   └── http-azure.ts              # HttpAzureService (calls /api/azure)
│   ├── components/
│   │   ├── ui/                        # Shared primitives (Btn, Badge, TextInput, TopBar, icons, etc.)
│   │   └── builder/                   # Builder sub-components (Field, PersonaRow, SuggestChat, etc.)
│   └── pages/
│       ├── ShellHomePage.tsx          # / and /stories — drafts dashboard + shell
│       ├── BuilderPage.tsx            # /stories/:id/edit — 3-column builder
│       └── PushPage.tsx               # /stories/:id/push — review → pushing → done
```

```
src/backend/                           # Express API server
├── scripts/
│   └── index-manual.ts                # One-shot: builds manual-index.json from the source PDF
├── manual/                            # Holds the source PDF (gitignored) + generated index
└── src/
    ├── index.ts                       # Express app entry point
    ├── routes/
    │   ├── auth.ts                    # /api/auth/me, /api/auth/device/start, /api/auth/device/poll
    │   ├── drafts.ts                  # GET/POST/PUT/DELETE /api/drafts
    │   ├── ai.ts                      # POST /api/ai/chat, /api/ai/suggest
    │   ├── azure.ts                   # GET/POST /api/azure/workitems (gated on cached token)
    │   └── documents.ts               # POST /api/documents/upload, /:id/scan
    └── services/
        ├── auth.ts                    # Device flow + in-memory token cache + silent refresh
        ├── claude.ts                  # Claude API wrapper (chatWithCoach, suggestForField)
        ├── azureDevOps.ts             # Azure DevOps REST client (each call takes a Bearer token)
        ├── documentScanner.ts         # PDF/image → AI AC extraction
        ├── manualIndex.ts             # Lazy-loaded minisearch index over manual-index.json
        └── manualContext.ts           # buildManualContext(query) — returns top-K excerpts to prepend to system prompts
```

**Key patterns:**
- Inline styles matching design spec (not Tailwind classes for component internals)
- Tailwind used for layout utilities and base styles
- HTTP services in `services/http-*.ts` call the Express backend; no mock services
- Custom router with `useNavigate()`, `useParams()`, `usePath()`
- Design tokens in `tokens.ts` mirroring `ARK_TOKENS` from design handoff
- `AppInitializer` is the auth gate: it calls `/api/auth/me`; on 401 it starts the device flow (`/api/auth/device/start`), shows the user_code + verification URI, and polls `/api/auth/device/poll` every 5s until authenticated. The router only mounts when `authStatus === 'authenticated'`.

## Design Reference

Full design handoff lives in `docs/design_handoff_ark_story_studio/`. Key files:

| File | Used in |
|------|---------|
| `components/shared.jsx` | Tokens + UI primitives |
| `components/drafts.jsx` | Stories page |
| `components/onboarding.jsx` | Onboarding page |
| `components/builder-a.jsx` | Builder A (form + preview + coach) |
| `components/push-flow.jsx` | Push flow |
| `components/builder-b.jsx` | Builder B (chat-driven) |
| `components/builder-c.jsx` | Builder C (card canvas) |
| `README.md` | Master spec |

**Brand:** Camtek Bondi Blue (`#008FBE`) + marker red (`#E11A22`), AI accent purple (`#7E57C2`), Roboto font family


## Verification

Before considering any phase or task complete, the following must pass:

1. **Code must compile:** `cd src/frontend && npx tsc --noEmit` must exit with no errors.
2. **Unit tests must pass:** All unit tests must complete successfully (once a test framework is configured).

Do not commit or report completion until both checks pass.

## Behavioral Guidelines

- **Simplicity first:** minimum code that solves the problem, no speculative features or abstractions.
- **Surgical changes:** touch only what's needed, match existing style, don't "improve" adjacent code.
- **Ask before assuming:** if multiple interpretations exist, present them. If unclear, stop and ask.
- **Goal-driven:** define success criteria before implementing. For multi-step tasks, state a brief plan with verification steps.
- **Phase gate:** When work is broken into phases, STOP after completing each phase and ask the user to review before proceeding to the next one. Do not continue to the next phase without explicit user approval.
