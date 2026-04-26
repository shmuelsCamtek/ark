# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ark Story Studio** is a web app that helps non-technical users (PMs, support managers, ops leads) create well-formed Azure DevOps user stories. The core UX combines a checklist-based story form, a real-time Azure DevOps work item preview, and an AI coaching sidebar.

## Current State

The repository is in **design handoff phase**. No production source code exists yet. The `docs/design_handoff_ark_story_studio/` directory contains the full design spec:
- `README.md` — comprehensive spec (500+ lines), read this first before implementing anything
- `components/` — React prototype components (CDN React + Babel standalone, no build step)
- `Ark Story Studio.html` — open directly in a browser to view the interactive prototype
- `screenshots/` — high-fidelity UI mockups

The `src/CLAUDE.md` contains LLM behavioral guidelines that apply to all coding work in this repo (think before coding, simplicity first, surgical changes, goal-driven execution).

## Prototype / Development

To view the current design prototype, open the HTML file directly in a browser — no build step needed:
```
docs/design_handoff_ark_story_studio/Ark Story Studio.html
```

Once a production stack is chosen and scaffolded, build/test/lint commands will be added here.

## Application Architecture

### Screen Flow
```
My Stories (/stories)
  → Onboarding (/onboarding)     [Azure DevOps org connect + parent work item lookup]
    → Story Builder (/stories/new or /stories/:id/edit)
      → Push Flow (/stories/:id/push)
```

### Three-Column Builder Layout (core of the app)
The primary builder (`builder-a.jsx`) uses a fixed three-column layout:

| Column | Width | Role |
|--------|-------|------|
| Form | flex `1 1 520px`, max 620px | 6 sequential story sections |
| Live Preview | 400px fixed | Real-time Azure DevOps work item rendering |
| AI Coach | 360px fixed | Chat sidebar with personas, AC suggestions |

### Story Data Model
```typescript
type StoryDraft = {
  id: string;
  title: string;
  background: string;          // new context section (not in classic user story format)
  persona: string;             // free text + preset suggestions
  want: string;
  benefit: string;
  criteria: AcceptanceCriterion[];   // min 2 required
  docs: SupportingDoc[];
  uiChange: UiChange;                // optional before/after screenshots
  parentWorkItemId?: number;
  createdAt: string;
  updatedAt: string;
};
```

### Design Tokens
All colors, spacing, radii, shadows, and typography are defined in `docs/design_handoff_ark_story_studio/components/shared.jsx` under `ARK_TOKENS`. Key values:
- Primary brand: `#008FBE` (Azure/Bondi Blue), accent: `#E11A22` (Marker Red)
- AI accent (distinct from brand): `#7E57C2` (purple)
- Base font: Roboto 14px/1.5; mono: Roboto Mono
- Radii: 4px inputs/buttons, 6px cards, 8px modals

### Shared Primitives (from `shared.jsx`)
`Btn` (5 variants: primary/default/ghost/ai/danger), `Badge`, `Pill`, `TextInput`, `TextArea`, `Avatar`, `TopBar`, `ArkLogo`, `AzureMark`, `Ico.*` icon set (~24 Fluent-style stroke icons), `StateDot`.

## Implementation Guidance

The design doc (`docs/design_handoff_ark_story_studio/README.md`) recommends React 18 + TypeScript with a team-preferred styling solution (CSS Modules, Tailwind, or vanilla-extract). Suggested implementation order:

1. Design tokens → color/radius/shadow/type system
2. Shared primitives → Button, Input, Badge, Avatar, TopBar, icons
3. My Stories screen
4. Onboarding screen
5. Story Builder A (core complexity)
6. Push Flow

Key architectural decisions **not yet made**: routing (Next.js / React Router / TanStack), state management (Context / Zustand / Jotai), form library, draft persistence (IndexedDB vs. server), Azure DevOps API integration strategy.

## Coding Guidelines

See `src/CLAUDE.md` for full behavioral guidelines. Summary:
- State assumptions explicitly; surface tradeoffs before implementing
- Minimum code that solves the problem — no speculative features or abstractions
- Touch only what's required; match existing style
- Transform tasks into verifiable goals with explicit success criteria
