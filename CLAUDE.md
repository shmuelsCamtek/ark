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
```

By default the frontend runs with mock services. To use the real backend:
```bash
VITE_USE_MOCKS=false npm run dev
```

### Backend
```bash
cd src/backend
npm install
cp .env.example .env   # then fill in API keys
npm run dev             # starts Express on http://localhost:3001 (watch mode)
```

Required `.env` keys:
- `ANTHROPIC_API_KEY` — for AI coach (Claude API)
- `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT` — for Azure DevOps integration

The frontend Vite dev server proxies `/api` requests to `localhost:3001`.

No test framework is configured yet.

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
- **Auth:** Azure AD (user already logged in, token available)
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
│   │   ├── AppContext.tsx             # Global state: drafts, azure connection, user
│   │   └── ServicesContext.tsx         # DI for AI + Azure services (mock/real)
│   ├── services/
│   │   ├── ai.ts                      # AiService interface + MockAiService
│   │   └── azure.ts                   # AzureService interface + MockAzureService
│   ├── components/
│   │   ├── ui/                        # Shared primitives (Btn, Badge, TextInput, TopBar, icons, etc.)
│   │   └── builder/                   # Builder sub-components (Field, PersonaRow, SuggestChat, etc.)
│   └── pages/
│       ├── StoriesPage.tsx            # /stories — drafts dashboard
│       ├── OnboardingPage.tsx         # /onboarding — welcome + work item connect
│       ├── BuilderPage.tsx            # /stories/new, /stories/:id/edit — 3-column builder
│       ├── PushPage.tsx               # /stories/:id/push — review → pushing → done
│       ├── BuilderBPage.tsx           # /stories/new/chat — chat-driven builder
│       ├── BuilderCPage.tsx           # /stories/new/canvas — card canvas builder
│       └── DevPage.tsx                # /dev — component gallery
```

```
src/backend/                           # Express API server
├── src/
│   ├── index.ts                       # Express app entry point
│   ├── middleware/
│   │   └── auth.ts                    # Azure AD token validation (placeholder)
│   ├── routes/
│   │   ├── drafts.ts                  # GET/POST/PUT/DELETE /api/drafts
│   │   ├── ai.ts                      # POST /api/ai/chat, /api/ai/suggest
│   │   ├── azure.ts                   # GET/POST /api/azure/workitems
│   │   └── documents.ts              # POST /api/documents/upload, /:id/scan
│   └── services/
│       ├── claude.ts                  # Claude API wrapper
│       ├── azureDevOps.ts             # Azure DevOps REST client
│       └── documentScanner.ts         # PDF/image → AI AC extraction
```

**Key patterns:**
- Inline styles matching design spec (not Tailwind classes for component internals)
- Tailwind used for layout utilities and base styles
- Mock services in `services/` — switch to HTTP clients via `VITE_USE_MOCKS=false`
- Custom router with `useNavigate()`, `useParams()`, `usePath()`
- Design tokens in `tokens.ts` mirroring `ARK_TOKENS` from design handoff

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
