# Spec: Replace per-call manual PDF inline with text+vision-caption RAG

**Date:** 2026-05-24
**Author:** Samuel Sayag (with Claude)
**Status:** Approved, ready for implementation planning

---

## Context

The Camtek User Manual is a 158 MiB PDF that the Ark Coach is supposed to ground its
suggestions in. Today (`src/backend/src/services/userManual.ts`,
`claude.ts:15-40`, `documentScanner.ts:213-238`) the backend loads the entire
PDF as base64 once at startup and prepends it to every Anthropic API call via
`manualPrefixMessages()` with `cache_control: { type: 'ephemeral' }`.

This is broken. The Anthropic API rejects every call with **HTTP 413
"Request exceeds the maximum size"** because:

- The per-PDF inline limit is ~32 MiB; the manual is 158 MiB.
- The per-request body limit is similar (~32 MiB enforced at the Cloudflare
  edge in front of `api.anthropic.com`).
- Base64 expands payloads ~33%, so 158 MiB → ~212 MiB on the wire.
- `cache_control: ephemeral` reduces **token cost** on cache hits but does
  **not** reduce HTTP body bytes — the full base64 still ships every call.

Both observed failures (`chatWithCoach` and `scanDocument`) share this root
cause: every code path that runs through `manualPrefixMessages()` is over the
limit, independent of conversation length or document attachment size.

Workarounds like "send a smaller PDF" or "use Anthropic Files API" miss the
deeper problem: the manual is also far beyond Sonnet 4's 200K-token context
window. **No approach that ships the whole manual per call can ever work.**
The model must be given selectively retrieved excerpts.

## Goal

Replace the "ship the whole manual every call" pattern with a
keyword-retrieval RAG architecture: extract the manual to text + image
captions once, build a small searchable index, and at runtime inline only the
4 most relevant chunks (~5–15K tokens) into each Claude request.

Success criteria:

- `chatWithCoach`, `suggestForField`, and `scanDocument` no longer 413.
- The system prompt visibly contains relevant manual excerpts on each call,
  with section/page citations.
- The original PDF is **never** sent to Anthropic; only excerpts as text.
- If the manual index is absent, the coach degrades gracefully (works
  without product context, logs a clear warning at startup).

## Architecture

Two fully decoupled phases:

### Phase 1: Indexing (one-shot CLI)

A new build step `npm run index-manual` runs `src/backend/scripts/index-manual.ts`:

1. Read PDF from `USER_MANUAL_PATH` (defaults to
   `src/backend/manual/camtek-user-manual.pdf`).
2. Refuse PDFs over 200 MiB (defensive — prevents accidental indexing-host DoS).
3. Walk every page with `pdfjs-dist`:
   - `page.getTextContent()` → page text (joined with whitespace heuristics).
   - `page.getOperatorList()` → iterate image XObjects, decode to PNG buffers.
   - Write each image to `manual/images/p{N}-img{M}.png`.
4. Chunk text into ~800–1500 token chunks, page-aware. Use the PDF outline
   (`pdf.getOutline()`) for heading-driven boundaries when available;
   fall back to fixed-window with 100-token overlap. Carry the closest
   preceding heading on each chunk for citation.
5. Caption every extracted image with Claude Vision (`claude-sonnet-4-20250514`):
   - Prompt: *"Caption this Camtek product manual image in 2-3 sentences.
     Name visible UI elements, buttons, labels, and what the screen
     represents. Be specific — say what feature this depicts, not 'a
     software screenshot'."*
   - Concurrency 3, exponential backoff on rate-limit.
   - Append the caption to its surrounding chunk's text so the caption is
     searchable alongside the page text.
6. Write `src/backend/manual/manual-index.json`:
   ```ts
   interface ManualIndexFile {
     manualPath: string;
     manualSizeBytes: number;
     manualSha256: string;
     generatedAt: string;
     chunks: ManualChunk[];
   }
   interface ManualChunk {
     id: string;             // "p42-c0"
     section: string;        // nearest heading
     page: number;
     text: string;           // page text + concatenated image captions
     imagePaths: string[];   // for traceability; never shipped to Claude
   }
   ```
7. Print stats (pages, chunks, images, total tokens, file size) and exit 0.

**Cost guardrail:** before captioning, the script prints
`N images × ~$0.005 ≈ $X. Continue? [y/N]` (interactive). Skippable with `--yes`.

**Resume-safe:** captions are written incrementally to
`manual-index.partial.json`, atomic-renamed to `manual-index.json` on success.
Re-running the script picks up where the previous attempt failed.

### Phase 2: Runtime retrieval (every Claude call)

New runtime service `src/backend/src/services/manualIndex.ts`:

```ts
function isManualLoaded(): boolean;
function searchManual(query: string, topK?: number): ManualChunk[];
function getManualSize(): { chunks: number; pages: number };
```

- Lazy-loads `manual-index.json` on first call. Path overridable via
  `USER_MANUAL_INDEX_PATH`.
- Builds an in-memory `minisearch` index (BM25 scoring) over chunk text.
- On `ENOENT`: logs once at warn level
  (*"Manual index not found — coach will run without product context.
  Run `npm run index-manual` to build it."*) and stays in the "no manual"
  state for the process lifetime.

New helper `src/backend/src/services/manualContext.ts`:

```ts
export function buildManualContext(query: string, topK = 4): string {
  if (!isManualLoaded()) return '';
  const chunks = searchManual(query, topK);
  if (chunks.length === 0) return '';
  return chunks
    .map(c => `[Manual · ${c.section} · p${c.page}]\n${c.text}`)
    .join('\n\n---\n\n');
}
```

The three runtime call sites lose `manualPrefixMessages()` and instead
prepend `buildManualContext(query)` to their existing system prompt under a
heading like `"Product reference (excerpts from the Camtek User Manual)"`.

**Per-site query construction:**

| Call site | Query |
|-----------|-------|
| `chatWithCoach` | `[ctx.title, ctx.activeField, ctx.want, messages.at(-1)?.content].filter(Boolean).join(' ')` |
| `suggestForField` | `[field, currentValue, ctx.title, ctx.activeField].filter(Boolean).join(' ')` |
| `scanDocument` | `[name, mimeType, 'Camtek product context for ' + name].join(' ')` |

The scan-document query is admittedly weak (we don't have the parsed doc
content when we build the query). It's a future improvement to extract a few
keywords from the parsed doc first; for v1, filename + mime is acceptable
and still adds product context.

## Files changed / added

| Path | Change |
|------|--------|
| `src/backend/package.json` | + `index-manual` npm script; + deps `pdfjs-dist`, `minisearch` |
| `src/backend/scripts/index-manual.ts` | NEW — one-shot index builder |
| `src/backend/manual/.gitignore` | + `manual-index.json`, `images/`, `*.partial.json` |
| `src/backend/manual/README.md` | update — explain `npm run index-manual` and the index file |
| `src/backend/src/services/userManual.ts` | DELETE |
| `src/backend/src/services/manualIndex.ts` | NEW — runtime index loader + search |
| `src/backend/src/services/manualContext.ts` | NEW — `buildManualContext(query)` helper |
| `src/backend/src/services/claude.ts` | delete `manualPrefixMessages`; prepend `buildManualContext(query)` to system prompt in `chatWithCoach` and `suggestForField` |
| `src/backend/src/services/documentScanner.ts` | delete `manualPrefixMessages`; prepend `buildManualContext(query)` to system prompt |
| `src/backend/src/index.ts` | replace the startup `getUserManual()` warm-up (currently line 47) with `isManualLoaded()` from the new `manualIndex.ts`; log `Manual index loaded: …` or the no-manual warning at startup |
| `src/backend/.env.example` | document that `USER_MANUAL_PATH` is now indexing-time only; add `USER_MANUAL_INDEX_PATH` |

## Defensive behavior

- Manual size guard remains at the **indexing** step, not the runtime —
  the runtime never reads the PDF.
- If the index JSON is missing, malformed, or empty, runtime falls back to
  "no manual context" with a single warning log.
- `buildManualContext` always returns a string (possibly empty); no
  exceptions propagate to call sites.

## Out of scope

- Embeddings-based retrieval (Voyage / OpenAI / local). The keyword approach is
  the v1; we can layer embeddings later as an opt-in improvement.
- Shipping image bytes to Claude at retrieval time. Captions only in v1.
- Auto re-indexing when the source PDF changes. The operator runs the script
  manually after replacing the PDF. The index file's `manualSha256` is
  recorded so we can detect drift later.
- Hot-reloading the index at runtime. Backend restart picks up a new index.

## Verification

1. `cd src/backend && npm install` (picks up the two new deps).
2. Confirm `USER_MANUAL_PATH=C:\temp\camtek-user-manual.pdf` in `.env`.
3. `npm run index-manual` — accept the cost prompt; watch progress; expect
   `manual-index.json` of low single-digit MB and a populated `images/` dir.
4. `npm run dev` — confirm startup log
   `Manual index loaded: N chunks, N images, N pages`.
5. In the app, open any draft and type in the coach chat. Confirm:
   - No 413.
   - Response returns within ~5 s.
   - Server log shows a `buildManualContext` debug line listing the chunk IDs
     selected for the query.
6. Attach a small doc to a work item and trigger scan. Confirm no 413 and a
   normal `ScanResult` is returned.
7. Move `manual-index.json` away → restart backend → confirm graceful
   fallback (coach works without product context, scan works, single warning
   logged at startup).
8. `npx tsc --noEmit` clean in both `src/backend` and `src/frontend`.

## Cost estimate

- One-time index build: ~$2.50 for ~500 image captions at Sonnet 4 vision
  pricing, plus ~30 min wall time.
- Per call at runtime: ~5–15K added input tokens (top-4 chunks at ~3K each).
  At Sonnet 4 prices that's ~$0.005–0.015 added per coach call. Materially
  cheaper than today's broken full-PDF inline (which would have been ~$1.50
  per call once it worked).
