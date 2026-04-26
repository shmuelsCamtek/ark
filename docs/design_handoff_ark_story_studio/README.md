# Handoff: Ark Story Studio

## TL;DR — Requirements Summary

**What we're building:** a web app where non-technical org experts (PMs, support leads, ops) turn business problems into well-formed Azure DevOps user stories — guided by an AI "coach" that reads their backlog and suggests personas, copy, and acceptance criteria.

**Scope (ship in this order):**

| # | Surface | Route | Status |
|---|---|---|---|
| 1 | **My stories** dashboard | `/stories` | Hi-fi, ship |
| 2 | **Onboarding** (connect Azure + pick parent work item) | `/onboarding` | Hi-fi, ship |
| 3 | **Story builder — Variant A** (PRIMARY) | `/stories/new`, `/stories/:id/edit` | Hi-fi, ship |
| 4 | **Push flow** (review → pushing → done) | `/stories/:id/push` | Hi-fi, ship |
| 5 | Builder Variants B (chat) & C (cards) | — | Exploratory, defer |

**Story structure (Builder A — 6 required-ish sections, in order):**
1. **Title** — short active-voice summary
2. **Background** — *(new)* the context devs need before they read the rest. Why does this story exist? What's happening today?
3. **Narrative** — `As a … I want to … So that …`, with a persona dropdown that's *also* free text
4. **Supporting documents** — drag-drop / upload; the AI reads them and proposes ACs
5. **UI change** *(optional)* — opt-in checkbox; if ticked, paste/upload Before & After
6. **Acceptance criteria** — Given/When/Then list, pass/fail testable

**Three-column builder layout:** Form (left, ~620 max) · Live Azure preview (middle, 400px) · Ark Coach AI chat (right, 360px). Completion meter at the top counts how many of the 6 sections are filled.

**Non-negotiables:**
- **Camtek brand:** Bondi-Blue (#008FBE) primary, marker-red (#E11A22) accent
- **Material Admin Pro chassis:** cool-slate neutrals, Roboto, 4px button radius, Material elevations
- **AI accent:** purple (#7E57C2) — distinct from azure so AI surfaces never look like primary actions
- **Free-text personas always allowed** — the dropdown is a suggestion list, not a constraint
- **Live Azure preview** mirrors the form 1:1 so the user always sees what will land in DevOps
- **Push animation:** staggered progress (validate → create → link → ACs → sprint) in ~3s, then a confirmation card with the work-item ID

---

## Screenshots

All seven artboards ship under `screenshots/`:

| File | What it shows |
|---|---|
| `01-drafts-populated.png` | My stories — 3 drafts in progress (primary state) |
| `02-drafts-empty.png` | My stories — empty state |
| `03-onboarding-connect.png` | Connect Azure DevOps + parent work item |
| `04-builder-a-checklist.png` | **Builder A** — full 3-column authoring screen (PRIMARY) |
| `05-push-review.png` | Push flow — final review |
| `06-push-pushing.png` | Push flow — animated push (mid-progress) |
| `07-push-done.png` | Push flow — success / done |

---

## Overview

**Ark Story Studio** is a web app that helps non-technical organisation experts (PMs, support managers, ops leads) turn business problems into well-formed Azure DevOps user stories. The product is opinionated about story structure (title → background → narrative → supporting docs → optional UI change → acceptance criteria) and uses an AI "coach" sidebar to suggest tighter copy, personas, and acceptance criteria pulled from the user's existing backlog.

The app covers four major surfaces:

1. **My stories** — dashboard of drafts and recently pushed stories
2. **Onboarding** — connect Azure DevOps org + pick a parent work item
3. **Story builder** — the core authoring screen (three variants explored: A, B, C)
4. **Push flow** — final review → animated push → confirmation

Variant **Builder A** ("Checklist + AI · Variant A") is the primary direction and the most polished.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX prototypes** — they show the intended look, copy, and behaviour but are not production code to copy verbatim.

Your job is to **recreate these designs in the target codebase using its existing patterns** (component library, state primitives, routing, etc.). If no framework is established yet, use **React 18 + TypeScript** with a styling solution that matches the team's preference (CSS Modules, Tailwind, or vanilla-extract are all fine fits — the design uses inline styles only because that's the prototyping environment).

The prototypes are wrapped in a "design canvas" host that lets reviewers see all four screens side-by-side. **Do not port the design canvas itself.** Each `<DCArtboard>` becomes a real route/screen in your app:

| Prototype artboard | Real screen |
|---|---|
| "My stories — landing" | `/stories` |
| "Onboarding — connect Azure DevOps" | `/onboarding` |
| "Checklist + AI · Variant A" (primary) | `/stories/new` (and `/stories/:id/edit`) |
| "Push to Azure — review → confirmation" | `/stories/:id/push` |

## Fidelity

**High-fidelity (hifi).** The mockups have final colors, spacing, typography, copy, and interaction states. Recreate pixel-perfectly using your codebase's component library — but **map design tokens to your existing token system** rather than hard-coding the values listed below.

The two non-primary builder variants (B: chat-driven, C: card canvas) are exploratory and **lower priority**. Ship Builder A first.

---

## Design Tokens

These come from `components/shared.jsx` (`ARK_TOKENS`). The chassis is **Material Admin Pro–inspired** (cooler slate-grey neutrals, Roboto, Material elevations) with **Camtek brand accents** (Bondi Blue + marker red).

### Colors

```
/* Neutrals — cool/slate axis */
--bg:            #F1F4F9   /* page background */
--surface:       #FFFFFF   /* cards, panels, inputs */
--surface-alt:   #F5F7FA   /* subtle fills, hover */
--border:        #E3E6ED
--border-strong: #C5CAD3
--ink:           #212332   /* primary text */
--ink-muted:     #69707F   /* secondary text */
--ink-subtle:    #9AA0AC   /* tertiary, placeholders */

/* Sidebar / dark surface — for future left-rail nav */
--nav-bg:        #212C3D
--nav-bg-alt:    #1A2333
--nav-ink:       #E1E5EE
--nav-ink-muted: #8A93A6

/* Brand — Camtek */
--azure:         #008FBE   /* primary action, focus, brand */
--azure-dark:    #006C90   /* primary hover */
--azure-light:   #D6EEF7   /* badge bg, mini surface */
--azure-faint:   #F1F8FB   /* subtle highlight */
--marker-red:    #E11A22   /* brand accent dot */
--marker-red-dk: #B81219
--marker-red-lt: #FDE4E5

/* Status — Material-leaning */
--success:       #1FAB6B
--success-bg:    #E3F6EE
--warning:       #F4A100
--warning-bg:    #FFF3D6
--danger:        #E11A22   /* same as marker-red */
--danger-bg:     #FDE4E5
--info:          #008FBE
--info-bg:       #D6EEF7

/* AI accent — distinct from azure */
--ai:            #7E57C2
--ai-light:      #EDE7F6
--ai-faint:      #F6F3FB
```

### Spacing & radius

- Radii: **`--r: 4px`** (buttons, inputs), **`--r2: 6px`** (cards, panels), **`--r3: 8px`** (modals, large surfaces)
- Spacing scale: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 / 32 / 40 / 48 (pixels) — applied directly inline in the prototypes; you can map this to your existing scale.

### Shadows (Material elevations)

```
--shadow-1: 0 1px 2px rgba(33,35,50,0.08), 0 1px 3px rgba(33,35,50,0.06);
--shadow-2: 0 2px 6px rgba(33,35,50,0.10), 0 4px 12px rgba(33,35,50,0.06);
--shadow-3: 0 8px 24px rgba(33,35,50,0.14), 0 2px 6px rgba(33,35,50,0.08);
```

### Typography

- **Font family:** `Roboto, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (loaded from Google Fonts in the host page; weights 300/400/500/700)
- **Mono font:** `"Roboto Mono", "SF Mono", Consolas, monospace`
- **Base size:** 14px, line-height 1.5, letter-spacing `0.01em`
- **Headings:** font-weight 500, letter-spacing `-0.01em`. Sizes used: H1 28px, H2 19–24px, H3 13–15px.
- **Buttons:** uppercase, font-weight 600, letter-spacing `0.04em`. Sizes: `sm 11.5px / 26px h`, `md 13px / 34px h`, `lg 13.5px / 40px h`.
- **Antialiasing:** `-webkit-font-smoothing: antialiased`

---

## Shared Primitives

These live in `components/shared.jsx`. Recreate them as your codebase's own components — they map to standard primitives in any UI library.

| Prototype | Recreate as | Notes |
|---|---|---|
| `<Btn variant size icon>` | Button | Variants: `primary` (Bondi-Blue fill + shadow-1), `default` (white + 1px border), `ghost` (transparent + azure text), `ai` (purple fill), `danger` (transparent + red text). Always uppercase, 4px radius. |
| `<Badge tone icon>` | Pill / Badge | Tones: `default`, `azure`, `success`, `warning`, `danger`, `ai`. 11px text, 600 weight, 10px radius. |
| `<TextInput>`, `<TextArea>` | Form fields | 32px height inputs, 1px border, focus turns border to `--azure`. |
| `<Avatar name size color>` | Avatar | Initials fallback, deterministic color from a 6-color palette. |
| `<StateDot state>` | Step indicator | States: `pending`, `active`, `done`, `warn`. Used in checklist UIs. |
| `<TopBar breadcrumbs rightActions>` | App header | 48px tall, contains `<ArkLogo>`, breadcrumbs, right-aligned actions, user avatar. |
| `<ArkLogo>` | Brand mark | SVG logo + "Ark" wordmark + "STORY STUDIO" tag pill. |
| `<AzureMark>` | Azure DevOps logo | Used on push CTAs and previews — replace with the official Azure DevOps SVG in production. |
| `Ico.*` | Icon set | ~24 stroke icons (Fluent-style). Replace with your icon library — see naming map below. |

### Icon name → Fluent / lucide mapping (suggested)

`chevron`, `check`, `x` (close), `plus`, `sparkle` (AI), `link`, `info`, `warn`, `user`, `target`, `heart`, `list`, `search`, `bolt`, `doc`, `arrow`, `edit`, `copy`, `gear`, `tree`, `board`, `file`, `image`, `upload`, `refresh`.

---

## Screens / Views

### 1. My stories — `/stories`

**Purpose:** landing page after login. Lists drafts in progress and a small "recently pushed" rail.

**Layout:**
- Full-bleed page on `--bg`. Top: `<TopBar>` with breadcrumb "My stories". Right action: `<Btn variant="primary" icon={Ico.plus}>New story</Btn>`.
- Below the bar: 32px padding, max-width 1100px centered.
- Two sections: **Drafts** (primary; cards with progress bar) and **Recently pushed** (secondary; compact list with Azure work-item IDs).

**Components:**
- **Draft card:** white surface, 6px radius, `--shadow-1`, 16px padding. Inside: persona meta (top, 11px uppercase muted), title (15px, 600), area + epic link, progress bar (3px tall, fills based on `filled/total` fields). Hover: shadow-2.
- **Pushed row:** flat list row, 1px bottom border, Azure mark on the left, story title, work-item ID (`#4187`), date.

**Source file:** `components/drafts.jsx`

---

### 2. Onboarding — `/onboarding`

**Purpose:** connect an Azure DevOps org and pick a parent work item before the user starts writing.

**Layout (centered single-column, max 560px):**
- Step pill at top ("STEP 1 OF 2 · CONNECT AZURE DEVOPS").
- H1 "Welcome to Ark Story Studio". Subtitle.
- Step 1 panel: org input (`contoso-corp` placeholder), connect button. Connected → green check + "Linked".
- Step 2 panel (revealed once connected): work-item ID input + auto-resolved card (title, type pill, project, area, state, child count). "Item not found" empty state if invalid ID.
- Footer: "Back" + "Start writing" CTA.

**Note: project type radios were removed.** A previous version had Application/Support cards under step 2 — these are gone.

**Source file:** `components/onboarding.jsx`

---

### 3. Story Builder · Variant A (PRIMARY) — `/stories/new`

**Purpose:** the heart of the app. Three-column layout:

| Column | Width | Contents |
|---|---|---|
| **Left — Form** | flex `1 1 520px`, max-width 620px content, 32×40px padding | The story being authored, broken into Fields. |
| **Middle — Live Azure preview** | `400px` fixed, white surface | Renders the work-item exactly as it will appear in Azure DevOps. |
| **Right — Ark Coach (AI)** | `360px` fixed, white surface | Chat sidebar with persona/title/AC suggestions and a composer. |

#### Form fields (top → bottom)

Each field uses the `<Field>` component: a 28px-margin row with a 2px `--azure` left-border that lights up when active. Header has a 13px label, optional 12px hint copy, and a small green check when "filled".

1. **Title** — single-line `<TextInput>`. Hint: *"A short, active-voice summary of what this story delivers."*

2. **Background** — multi-line `<TextArea rows={4}>`. Hint: *"The context devs need before they read the rest. Why does this story exist? What's happening today?"* Placeholder: *"What's happening today, why it matters, and any data or constraints the team should know up front."* Renders in the Azure preview as its own **Background** section between the meta grid and the Description (`whiteSpace: 'pre-wrap'` so paragraph breaks survive).

3. **The narrative** — three `<NarrativeRow>`s:
   - **As a** — **Persona dropdown with free-text input.** Implemented as `<PersonaRow>`:
     - The text input is always editable (free text always allowed).
     - A right-side chevron toggles a dropdown panel ("COMMON IN YOUR BACKLOG") with 6 preset personas. Selecting one fills the input.
     - Footer of the dropdown: muted helper text *"Or just type your own — free text is allowed."*
     - Presets: `Support engineer`, `Tier-2 billing support specialist`, `Customer success manager`, `Product manager`, `Field service technician`, `Operations analyst`.
   - **I want to** — `<textarea rows={2}>`, no border, animated underline on focus.
   - **So that** — same as above. `last` flag removes the bottom divider.

4. **Supporting documents** — `<DocsList>`:
   - Renders existing docs as 1-line cards: 22×22 file/image icon (red for PDF, purple for image), filename, size, *"Read by Ark"* purple badge.
   - Bottom: dashed-border upload button — *"Add documents — Ark will read them and suggest criteria."* Hover turns border + text azure. Multi-file `<input type="file">` triggered on click.
   - When ≥ 1 doc is attached: a purple-tinted "scan summary" callout *"Ark scanned N documents — Found 3 likely AC and 1 edge case (legacy plans on annual billing). See suggestions in the coach panel →"*
   - Two seed docs ship by default: `Billing-retry-policy.pdf · 184 KB` and `Renewal flow — current.png · 92 KB`.

5. **UI change** — `<UiChangePreview>`. **Opt-in.** The user only adds a before/after if their story actually changes the UI:
   - **Default (unchecked):** a single bordered row with a checkbox, label *"This story includes a UI change"*, and helper *"Tick this if you want to capture a before/after. Tickets without UI work can skip this."*
   - **When ticked:** the checkbox stays visible (with a "Remove" link to untick), then:
     - **Paste strip:** dashed azure-border row in `--azure-faint` — *"Paste a screenshot of the current window (⌘V) — Ark will set it as Before."* with an Upload button on the right. (In production, wire `paste` listener on the Field root; convert clipboard image data to a Blob/URL and use as the Before image.)
     - **Before/After thumbnails** in a 3-col grid (`1fr auto 1fr`) with a small arrow icon between. Each thumbnail is 132px tall (96 in compact preview), shows two stacked mock list rows with a status dot + a "chip" pinned bottom-right. The After chip is the azure pill *"AUTO-RETRY ON"*; the Before chip is the white pill *"Retry manually"*.
     - **Action row:** `Replace before`, `Replace after`, `Annotate` ghost buttons.

6. **Acceptance criteria** — list of pass/fail rows (AC1, AC2 …), each with a delete X. Add row at bottom: `<TextInput>` + `<Btn icon={Ico.plus}>Add</Btn>`. Hint: *"Use Given / When / Then. Each criterion should be pass/fail testable."*

#### Middle: Live Azure preview (`<WorkItemPreview>`)

Mirrors the form in real time. Sections render top → bottom:

1. Header strip: small azure square + "USER STORY · #4187 · NEW" (11px uppercase, letter-spacing 0.3).
2. Story title (19px, 600).
3. 2-col meta grid: Assigned (Avatar + name), State, Area, Iteration.
4. **Background** — paragraph block rendered with `whiteSpace: 'pre-wrap'`. Only renders when `background` is non-empty.
5. **Description** — `As a / I want to / So that` block. Empty fields render `<Placeholder>` shimmer bars.
6. **Acceptance criteria** — numbered AC1, AC2 … with 1px row dividers.
7. **UI change · Before → After** — only when the checkbox is ticked. Embeds the same `<UiThumb>` pair in `compact` mode.
8. **Attachments** — only when docs.length > 0. List of file rows (icon, name, size).
9. Footer: link icon + *"Will link to Feature #3994"* (azure).

#### Right: Ark Coach (`<SuggestChat>`)

- Header: 22px circle (purple `--ai` bg, white sparkle icon) + "Ark Coach" + subtle "Reading your backlog" + gear button.
- Scrollable message list. Three message types:
  - `user` — right-aligned chip on `--surface-alt`.
  - `ai` (default) — sparkle avatar + 13px text. Markdown-style `**bold**` is supported via a tiny `dangerouslySetInnerHTML` regex.
  - `ai` with `kind: 'suggestions' | 'criteria-bundle'` — same chrome + a stack of clickable cards. Each card has a `+` icon and applies the suggestion to the corresponding field on click. Used cards become muted with a check icon.
  - `ai` with `kind: 'ack'` — small inline confirmation ("Applied to Persona.").
- Quick-chip rail above composer: `Suggest more ACs`, `Tighten the benefit`, `Find similar stories`, `Split this story`. Clicking a chip pre-fills the composer.
- Composer: 1-row textarea + circular send button (dark on `--ink`, disabled grey when empty).

Persona / title / AC suggestions are seeded from the prototype data; in production they should come from your AI backend with the user's backlog as context.

**Source file:** `components/builder-a.jsx`

---

### 4. Push flow — `/stories/:id/push`

Three sub-states managed by a single `stage` state: `'review' | 'pushing' | 'done'`.

#### a. Review (`stage === 'review'`)

- Top: breadcrumb `Support Platform / Billing / Story / Push to Azure`.
- Step pill: "STEP 3 OF 3 · FINAL REVIEW".
- H1 *"Send to Azure DevOps"*. Subtitle *"Take a final look. You can still edit everything in Azure after push."*
- A single white card with the `<WorkItemPreview {...storyData} compact />` rendering inside.
- Footer row: "Back to editor" (ghost), `Save as draft` (ghost), `Push to Azure DevOps` (primary, large, with Azure mark icon).

**Note: the Tags panel was removed.** No tag chips, no "Add tag" button — review goes straight from heading to story preview.

#### b. Pushing (`stage === 'pushing'`)

- Centered modal-style card (440px wide, white, `--shadow-3`, `--r3` radius).
- Animated Azure mark in a faint-azure circle.
- H2 "Sending to Azure DevOps…" + "This usually takes 2-3 seconds."
- 6px progress bar — fills 0 → 100% via `setTimeout` ladder (`20, 45, 70, 90, 100`, each 600ms apart).
- Stepper list below tracks the same milestones:
  1. Validating fields
  2. Creating Work Item
  3. Linking to Epic #3994 · Pro renewals
  4. Adding acceptance criteria
  5. Assigning to Sprint 42
- Each step shows a green-fill check once `progress >= threshold`.

#### c. Done (`stage === 'done'`)

- Centered, max 640px.
- Big green check circle. H1 *"Story #4187 is in the backlog."* + "Your dev team will see it in their next backlog refinement."
- White summary card: small azure square containing the Azure mark, "USER STORY · #4187", title, ghost "Open in Azure" button.
- Footer row: "Back to dashboard" (ghost) + "Write another story" (primary, plus icon).

**Source file:** `components/push-flow.jsx`

---

### 5. (Exploratory) Builder Variants B & C

These are alt directions explored alongside Variant A. Lower priority — ship A first, revisit B/C if the team wants to A/B test.

- **Variant B (`builder-b.jsx`):** chat-driven authoring. Left = full-height conversation with the AI; right = the same `<WorkItemPreview>` rendered live as the conversation progresses.
- **Variant C (`builder-c.jsx`):** card canvas. Each story element (persona, problem, want, outcome, ACs) is a draggable colored card on a board. Designed for visual thinkers.

---

## Interactions & Behavior

### Animations / transitions

- **`@keyframes ark-fadein`** — `opacity 0 → 1`, `translateY(4px) → 0`, `0.25s ease-out`. Used for chat messages.
- **`@keyframes ark-pulse`** — typing dots; `opacity 1 ↔ 0.5`, `1.2s ease-in-out`, staggered `0.15s` delay per dot.
- **`@keyframes ark-shimmer`** — placeholder loading bars in the Azure preview.
- **`@keyframes ark-spin`** — onboarding "Connecting…" spinner.
- **Border colour transitions:** focus underline animates `0.12s` (`--border-strong → --azure`).
- **Field active-state border:** 2px left-border colour transitions `0.15s`.

### Suggestion-apply flow (Builder A coach)

1. User clicks a suggestion card.
2. The corresponding setter (`setTitle`, `setPersona`, `setWant`, `setBenefit`, or pushes to `criteria`) fires.
3. The clicked card transitions to a "used" state (muted bg, check icon, no longer clickable).
4. An inline `ack` message appears underneath the suggestion bundle.

### Persona dropdown

- Click chevron OR focus input → input is editable (free text always works).
- Click chevron → opens preset list. Click outside to close (ref + `mousedown` listener on `document`).
- Click preset → fills value, closes panel.
- Esc / blur logic is up to your component library.

### Document upload + AI scan

- Click "Add documents" → opens native multi-file picker.
- Each file is converted to `{ id, name, size, kind: 'pdf' | 'image' | 'file', source: 'upload' }` and appended to `docs`.
- The "Ark scanned N documents" callout appears as soon as `docs.length > 0`. In production, replace the static copy with real scan results from your AI backend.

### UI change — paste support

- When the field is enabled and the user pastes (`⌘V` / `Ctrl+V`), capture the clipboard image, set it as the Before image. Spec: listen on the field root once `enabled === true`; if the paste contains an image, read it as a Blob, generate an object URL, store as `beforeImg`. Show in the first thumbnail.

### Push animation

- Already documented above — staggered `setTimeout`s to fill the progress bar and tick off the stepper. After `progress === 100` wait 400ms then set `stage = 'done'`.

### Routing / state ownership

- **Auth + Azure DevOps connection** is global state — survives across all four screens.
- **Story draft** is local to `/stories/new` (or `/stories/:id/edit`); push to backend on every meaningful change so drafts persist.
- **Coach messages** are local to the builder session; not persisted between sessions in the prototype, but you may want to persist them.

### Form validation

The prototype keeps validation light; the design implies these rules:

| Field | Rule |
|---|---|
| Title | Required, non-empty. |
| Background | Required, non-empty. |
| Persona | Required (free text or preset). |
| Desire ("I want to") | Required. |
| Benefit ("So that") | Required. |
| Acceptance criteria | At least 2 ACs to mark the field "filled". |
| UI change | Optional. If checked, expects ≥ 1 image. |
| Documents | Optional. |

The completion meter at the top of Builder A (*"X of 6 sections complete"*) reflects this.

---

## Accessibility

The prototype meets the basics — focus rings on inputs, semantic buttons, alt text on the few `<svg>` icons. Production checklist:

- All `<button>`s have accessible names (icon-only buttons need `aria-label`).
- Persona dropdown should be a real `combobox` (`role="combobox"`, `aria-expanded`, `aria-controls`, keyboard nav: ↑/↓ to traverse, Enter to select, Esc to close).
- File upload button needs `aria-label="Add supporting documents"`.
- UI-change checkbox is a real `<input type="checkbox">` already.
- Live preview should be an `aria-live="polite"` region so screen-reader users are notified when it updates.
- Color contrast: `--ink-subtle (#9AA0AC)` on `--surface (#fff)` is 3.6:1 — fine for non-text UI but **avoid for body text**. Use `--ink-muted` or `--ink` instead.

---

## State Management

Suggested shape (TypeScript):

```ts
type Persona = string; // free text; presets are just suggestions

type AcceptanceCriterion = { id: string; text: string };

type SupportingDoc = {
  id: string;
  name: string;
  size: string;       // human-readable; or store bytes + format on render
  kind: 'pdf' | 'image' | 'file';
  source: 'upload' | 'paste' | 'azure';
  url?: string;       // backend URL once uploaded
};

type UiChange = {
  enabled: boolean;
  before?: { url: string; addedAt: string };
  after?:  { url: string; addedAt: string };
  annotations?: unknown[]; // shape depends on annotation impl
};

type StoryDraft = {
  id: string;
  title: string;
  background: string;
  persona: Persona;
  want: string;
  benefit: string;
  criteria: AcceptanceCriterion[];
  docs: SupportingDoc[];
  uiChange: UiChange;
  parentWorkItemId?: number; // chosen during onboarding
  createdAt: string;
  updatedAt: string;
};

type CoachMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'ai'; kind?: undefined; text: string }
  | { id: string; role: 'ai'; kind: 'suggestions' | 'criteria-bundle';
      intro?: string; field: keyof StoryDraft | 'criteria'; options: string[] }
  | { id: string; role: 'ai'; kind: 'ack'; text: string };

type PushStage = 'review' | 'pushing' | 'done';
```

State lives wherever your codebase puts form state — Redux, Zustand, TanStack Query + local state, etc. No special needs.

---

## Assets

The prototype draws everything via SVG. There are **no raster assets to copy**.

- **Ark logo** — inline SVG in `ArkLogo()` (shared.jsx). Bondi-Blue rounded square with a white "A"-shape and a marker-red dot at the centre.
- **Azure DevOps mark** — inline SVG in `AzureMark()` (shared.jsx). Replace with the official Microsoft asset in production.
- **Roboto** — Google Fonts. Loaded in the host HTML via `<link>` to `https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap`.

---

## Files in this bundle

```
design_handoff_ark_story_studio/
├── README.md                   ← you are here
├── Ark Story Studio.html       ← host page; mounts all four artboards on a design canvas
└── components/
    ├── shared.jsx              ← tokens (ARK_TOKENS), Btn, Badge, TopBar, Avatar, Ico, etc.
    ├── drafts.jsx              ← My Stories / drafts dashboard
    ├── onboarding.jsx          ← Connect Azure DevOps + parent work item
    ├── builder-a.jsx           ← PRIMARY builder (checklist + AI + live preview)
    ├── builder-b.jsx           ← (exploratory) chat-driven builder
    ├── builder-c.jsx           ← (exploratory) card-canvas builder
    └── push-flow.jsx           ← Review → Pushing → Done
```

The `.jsx` files use UMD React 18 + Babel-standalone (loaded by `Ark Story Studio.html`). They expose components onto `window` so they can be referenced across files. **Do not port that pattern** — convert to ESM imports / TypeScript modules in your codebase.

---

## Implementation order (recommended)

1. **Design tokens** — port colours / radii / shadows / type scale into your token system.
2. **Shared primitives** — `Btn`, `TextInput`, `TextArea`, `Badge`, `Avatar`, `StateDot`, `TopBar`, icon set.
3. **My stories (`/stories`)** — easiest screen, validates your shared primitives.
4. **Onboarding (`/onboarding`)** — exercises form validation + the connected/empty/not-found states.
5. **Builder A (`/stories/new`)** — the meat. Build the three columns, Field component, NarrativeRow, then PersonaRow, DocsList, UiChangePreview, SuggestChat in that order. WorkItemPreview can be a pure render of the draft state.
6. **Push flow (`/stories/:id/push`)** — straightforward; the staged animation can be a simple state machine.
7. **(Optional)** Builder variants B and C if the team wants to A/B test directions.

---

## Open questions for the dev team

These were not resolved in design — flag them in your first PR:

1. **Backlog source for AI suggestions:** Azure DevOps API directly, or a backend mirror? Latency budget for suggestion cards is < 1.5s.
2. **Document scanning:** which service? OCR for images, PDF text extraction, plus an LLM call to derive ACs.
3. **UI-change paste:** does the captured screenshot stay in our storage, or get pushed to Azure DevOps as an attachment on the work item?
4. **Multi-tenant orgs:** the prototype assumes one Azure DevOps org per user. Confirm.
5. **Draft persistence:** local-first (IndexedDB) or always-server? The "My stories" dashboard implies server-side.
