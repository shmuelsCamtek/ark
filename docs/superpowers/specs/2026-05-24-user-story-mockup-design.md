# Spec: AI-generated UI mockup as a tab on user-story preview + SharePoint HTML

**Date:** 2026-05-24
**Author:** Samuel Sayag (with Claude)
**Status:** Approved, ready for implementation planning

---

## Context

When an author has filled in enough of a user story, an AI-generated HTML/CSS
mockup of the proposed feature would help them validate the story before
publishing — both in-app (the builder preview and the push-page preview) and
on the published SharePoint page that downstream consumers read.

The current builder already determines "completeness" via `evaluateDraft()`
(`src/frontend/src/lib/storyCompletion.ts`), and `PushPage` already redirects
back to the builder when the draft isn't complete. The current SharePoint
HTML pipeline (`src/frontend/src/lib/storyToHtml.ts`) emits a single
scrolling document with sections Background / Scenario / Flow / Description /
AC / optional UI change. There is no mockup anywhere today.

Goal: let the author **manually trigger** a mockup generation from inside the
builder; render the result as a second tab alongside the existing story
preview in both the builder and the push page; include that tab in the
SharePoint export when present. If the AI judges the story too thin for a
mockup, return an "insufficient" verdict with a 1–2 sentence explanation so
the author can act on the feedback.

## Goal

- A "Generate mockup" / "Refresh mockup" button on the BuilderPage. No
  automatic generation.
- A `[ Story ] [ Mockup ✷ ]` tab strip appears in the builder preview, in
  the push-page preview, and in the SharePoint export — only when a mockup
  exists for the draft.
- Mockup is HTML/CSS (Claude generates it), sanitized server-side and
  rendered with `dangerouslySetInnerHTML` inside a scoped container in the
  app, and inlined into the SharePoint HTML behind a pure-CSS tab pattern.
- Insufficient-info results show inline in the builder with the AI's reason;
  they never surface on the push page or in the export.

## Data model

New optional state on `StoryDraft` (`src/frontend/src/types.ts`), persisted by
the existing draft store with no schema-validation changes:

```ts
export interface DraftMockup {
  status: 'ok' | 'insufficient';
  html?: string;               // present iff status === 'ok'
  insufficientReason?: string; // present iff status === 'insufficient'
  generatedAt: string;         // ISO timestamp
}

// On StoryDraft:
mockup?: DraftMockup;
```

## Backend

### Route: `POST /api/ai/mockup`

Added to `src/backend/src/routes/ai.ts`.

- Request body: `{ draftId: string }`.
- Loads the draft via the existing draft store. 404 if missing.
- Calls a new service `src/backend/src/services/mockupGenerator.ts` (kept
  separate from `claude.ts` to keep `chatWithCoach` and the new structured
  output cleanly distinct).
- Service makes one Claude call (`claude-sonnet-4-20250514`) with:
  - System prompt described below.
  - User message with the draft's `title`, `background`, `scenario`,
    `persona`, `narrative` (asA/iWantTo/soThat), `acceptanceCriteria`,
    `flow`, plus `workItemDescription` / `workItemReproSteps` when present.
- The model is told to return JSON in exactly one of two shapes:
  ```json
  { "status": "ok", "html": "<div class=\"ark-mockup\">…</div>" }
  { "status": "insufficient", "reason": "Needs more detail about what fields the form contains and the trigger that opens it." }
  ```
- HTML constraints baked into the system prompt:
  - Single root `<div class="ark-mockup">` element.
  - Allowed tags only: `div, span, p, h1, h2, h3, h4, ul, ol, li, table, thead, tbody, tr, td, th, button, input, label, hr, br, strong, em, code, small, figure, figcaption, img`.
  - No `<script>`, `<style>`, `<iframe>`, `<form>`, `<link>`, no event handlers (`onclick=` etc.), no external URLs.
  - Only inline `style="…"` attributes; lean set of properties (color, background, padding, margin, border, font-size/weight, display, flex, gap, width/max-width, text-align, border-radius).
  - Target ~480–680px wide so it fits the SharePoint column.
  - Use Camtek brand colors only as accent (`#008FBE` Bondi blue, `#E11A22` red sparingly).
- Existing JSON-mode handling from `claude.ts` is reused for parsing.
- **Server-side sanitize** the returned HTML with `sanitize-html` and the
  same allow-list as the prompt constraints. If sanitization reduces the
  HTML to empty, downgrade to
  `{ status: 'insufficient', reason: 'Model returned unsupported HTML.' }`.
- Persist via `draftStore.update(draftId, { mockup: {...} })`. Return the
  same shape to the client.
- Errors (Claude rate-limit, JSON parse failure, etc.) → 500 with
  `{ error: string }`. Client surfaces this inline; no toast system change.

### `chatWithCoach` and friends — unchanged

The new endpoint is independent. `manualContext.buildManualContext(query)`
is **also** prepended to the mockup-generation system prompt with a query
built from `title + persona + activeField + first AC` — same pattern used
elsewhere in `claude.ts` after the RAG redesign — so the mockup is grounded
in product reference excerpts.

## Frontend

### Service wiring

- `src/frontend/src/services/ai.ts` — extend the `AiService` interface with
  `generateMockup(draftId: string): Promise<DraftMockup>` where `DraftMockup`
  matches the data-model type.
- `src/frontend/src/services/http-ai.ts` — implement `generateMockup` calling
  `POST /api/ai/mockup`. On success, the caller is responsible for dispatching
  a draft update via `useApp().updateDraft`.

### New shared component: `MockupTabs`

`src/frontend/src/components/builder/MockupTabs.tsx` (used by both
BuilderPage and PushPage, so it lives in the shared builder folder).

Props:
```ts
interface MockupTabsProps {
  storyContent: ReactNode;            // existing story preview
  mockup: DraftMockup | undefined;
  showInsufficient: boolean;          // true in BuilderPage, false in PushPage
}
```

Behaviour:
- `mockup` is `undefined` → render only `storyContent`. No tab strip.
- `mockup.status === 'ok'` → render `[ Story ] [ Mockup ✷ ]` tabs. Tabs are
  local React state, default "Story". Mockup tab renders the sanitized
  HTML inside a scoped `.ark-mockup-frame` div via `dangerouslySetInnerHTML`.
- `mockup.status === 'insufficient'` + `showInsufficient === true` → render
  `[ Story ] [ Mockup ⚠ ]` tabs. Mockup tab shows the reason + a "Refresh
  mockup" button that emits a callback (caller wires it to the generator).
- `mockup.status === 'insufficient'` + `showInsufficient === false` → behave
  as if `mockup` is `undefined` (no tab strip).

### BuilderPage

- Add a `Generate mockup` / `Refresh mockup` button at the top of the
  preview column. Three visual states:
  - No mockup yet → primary outline button `✷ Generate mockup`.
  - In-flight → disabled with spinner `⟳ Generating…`.
  - Mockup exists (`ok` or `insufficient`) → ghost button `Refresh mockup`.
- Wrap the existing preview content in `<MockupTabs ... showInsufficient />`.
- On button click: call `ai.generateMockup(draft.id)`, then
  `updateDraft({ mockup: result })`. Errors are caught and surfaced as a
  small inline message above the button.

### PushPage

- No new button. Wrap the existing `WorkItemPreview` (the review-stage
  preview) in `<MockupTabs ... showInsufficient={false} />`.
- Tab strip only appears when `draft.mockup?.status === 'ok'`.

### Sanitization on the frontend

Add `isomorphic-dompurify` (works in both browser and Node) and sanitize the
mockup HTML before injecting via `dangerouslySetInnerHTML`. Even though the
backend already sanitizes, the frontend re-sanitizes as defense-in-depth and
because the export path (`storyToHtml.ts`) also runs in the browser.

## Exported SharePoint HTML

`src/frontend/src/lib/storyToHtml.ts` extensions:

- `StoryHtmlInput` gains an optional `mockupHtml?: string` field. Caller in
  `PushPage` passes `draft.mockup?.status === 'ok' ? draft.mockup.html : undefined`.
- When `mockupHtml` is present, wrap the page contents in a pure-CSS tab
  pattern using hidden radio inputs and `:checked` sibling selectors. No
  `<script>`, no `:target` (which would cause URL hash side-effects in
  SharePoint). Conceptual markup:

  ```html
  <main class="page">
    <input type="radio" name="ark-tabs" id="t-story" checked hidden>
    <input type="radio" name="ark-tabs" id="t-mockup" hidden>
    <nav class="ark-tabs">
      <label for="t-story">Story</label>
      <label for="t-mockup">Mockup <span class="badge">✷</span></label>
    </nav>
    <div class="ark-panel ark-panel-story">… existing sections …</div>
    <div class="ark-panel ark-panel-mockup">
      <div class="ark-mockup-frame">{{sanitized mockup html}}</div>
    </div>
  </main>
  ```

- Driven by CSS like:
  ```css
  .ark-panel-mockup { display: none; }
  #t-mockup:checked ~ .ark-panel-story { display: none; }
  #t-mockup:checked ~ .ark-panel-mockup { display: block; }
  ```
- Sanitize the `mockupHtml` via DOMPurify before injection. Same allow-list
  as the backend.
- Extend the existing `STYLES` string with: `.ark-tabs` (flex row with bottom
  border, brand accent), `.ark-tabs label` (pill-style buttons, active state
  via `:checked ~ nav` selector), `.ark-panel-mockup` / `.ark-panel-story`
  (visibility driven by the radio state), `.ark-mockup-frame` (light border,
  scrollable container).
- Backwards compatible: when `mockupHtml` is undefined, none of the tab
  wrapper or new CSS classes are emitted — the export looks exactly like
  today.

## Files added / modified

| Path | Change |
|------|--------|
| `src/frontend/src/types.ts` | + `DraftMockup` interface; + `mockup?: DraftMockup` on `StoryDraft` |
| `src/frontend/src/services/ai.ts` | + `generateMockup` on `AiService` interface |
| `src/frontend/src/services/http-ai.ts` | + `generateMockup` impl (POST `/api/ai/mockup`) |
| `src/frontend/src/components/builder/MockupTabs.tsx` | NEW — shared tab component |
| `src/frontend/src/pages/BuilderPage.tsx` | + Generate/Refresh button; + wrap preview in MockupTabs |
| `src/frontend/src/pages/PushPage.tsx` | + wrap WorkItemPreview in MockupTabs |
| `src/frontend/src/lib/storyToHtml.ts` | + `mockupHtml?` input; + CSS-tab markup + styles when present; + sanitize |
| `src/frontend/package.json` | + `isomorphic-dompurify` |
| `src/backend/src/routes/ai.ts` | + `POST /api/ai/mockup` |
| `src/backend/src/services/mockupGenerator.ts` | NEW — Claude call + sanitization |
| `src/backend/package.json` | + `sanitize-html` |

## Out of scope (explicit non-goals)

- Auto-generating the mockup on draft completion or on PushPage entry.
  Stays manual-button-only.
- Editing the generated HTML in-app. The user re-generates if they want
  changes.
- Inline image generation (DALL-E etc.). The mockup is HTML/CSS only.
- A history of past mockups. Only the latest is stored.
- Refresh-on-content-change detection. The user clicks Refresh manually if
  they edit the story after generating.

## Verification

1. `cd src/frontend && npx tsc --noEmit` and `cd src/backend && npm run typecheck` — both clean.
2. `npm install` in both frontend and backend (picks up `isomorphic-dompurify` and `sanitize-html`).
3. `cd src/backend && npm run dev` and `cd src/frontend && npm run dev`.
4. **Happy path:**
   - Open a fully-filled draft in the builder.
   - Confirm preview column has no Mockup tab yet.
   - Click "Generate mockup". Confirm spinner, then a Mockup tab appears
     with rendered HTML.
   - Switch to Mockup tab; confirm content renders inside the bordered
     `.ark-mockup-frame` container.
   - Navigate to `/stories/:id/push`. Confirm the same Mockup tab appears
     in the push preview and switches correctly.
   - Click Push → publish to SharePoint. Open the published HTML in a
     browser. Confirm the tab strip is there, the Mockup tab toggles via
     pure CSS, and no scripts run.
5. **Insufficient path:**
   - Open a thin draft (e.g. only the title).
   - Click "Generate mockup". Confirm the AI returns `insufficient`; the
     builder shows the Mockup tab with ⚠ and the reason.
   - Navigate to `/stories/:id/push`. Confirm **no** Mockup tab on push.
   - Confirm the SharePoint export (publish or local preview) does **not**
     include the tab strip.
6. **Refresh path:**
   - Edit the AC list, click "Refresh mockup". Confirm the previous mockup
     is replaced and the tab updates.
7. **Security check:**
   - Use a debugging tool to inject a `<script>` into the AI response (e.g.
     via a fake backend) and confirm the frontend sanitizer strips it and
     nothing executes.
   - Confirm the SharePoint HTML never contains a `<script>` tag.

## Cost estimate

- Per "Generate mockup" click: ~1–2K input tokens + ~1–2K output tokens at
  Sonnet 4 pricing ≈ $0.01–$0.02 per generation. Predictable because of
  manual trigger.
