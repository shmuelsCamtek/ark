Ark Coach should guides the user through filling the User Story fields
# Ark Coach: User Story creation guide

## Goal

The Ark Coach guides the user through filling the four fields of the New User Story form, in this order:

1. **Background**
2. **Narrative** (As [persona], I want [X], so that [benefit])
3. **Title**
4. **Acceptance Criteria**

(The form's visual order may differ; the coach drives the conversation in this sequence.)

## Trigger

The coach engages when the Builder page mounts. It does not run on push.

## Step 1 — Ingest linked Work Item

If a Work Item is linked to this story, the coach reads:

1. Title
2. Description
3. Technical Description (when the work-item type has one)
4. Discussion (comments)
5. Attachments
6. Linked work items — recursively

**Linked-work-item policy:**

- **Depth:** maximum 3 hops from the linked item.
- **Link types in scope:** Parent, Child, Related, Predecessor, Successor. External links (URLs, files) are out of scope.
- **Cycle detection:** track visited IDs; never visit an ID twice.
- **Hard cap:** stop after 50 work items total across the whole graph.
- For each visited work item, read the same fields as the root (Title, Description, Technical Description, Discussion, Attachments).

This step requires backend work this task must implement: extend `src/backend/src/services/azureDevOps.ts` and the `/api/azure/workitems` route to fetch Discussion, Attachments, and recursive linked items. Today only the linked work item's basic fields are passed through (`workItemDescription`, `workItemReproSteps` — see `buildDraftContext` in `src/frontend/src/components/builder/SuggestChat.tsx:65`).

## Step 2 — Compose fields, in order

For each of Background → Narrative → Title → Acceptance Criteria:

- **If the field is empty:** draft from ingested content. If information is missing, ask the user with a `quiz` message (the multi-choice prompt that renders above the composer).
- **If the field already has content:** do not reimplement it. Review it and offer a `suggestion` message proposing an improvement. The user picks whether to apply it.

**Narrative-specific:** persona and benefit are often not derivable from Background alone. When they're missing, ask a `quiz` for each (persona options drawn from the project's existing personas if available; benefit answered via free text through the "something else" branch).

## Step 3 — Acceptance Criteria loop

After proposing initial ACs as a `criteria-bundle`, ask the user via `quiz` whether they want to add more. If yes, gather the next AC; loop until the user says no.

## Output shapes — reuse, do not reinvent

Map each step to the existing message kinds in `src/frontend/src/types.ts` (`CoachMessageType`) and `coachToSuggestMessage` in `src/frontend/src/components/builder/SuggestChat.tsx:97`:

- Multi-choice clarifying question → `quiz` (renders above the composer; A/B/C/"something else").
- Field draft or replacement → `suggestion` (with `field`).
- Acceptance-criteria batch → `criteria-bundle`.
- Confirmation receipt → `ack`.

For any `quiz` where the user should be able to type a free-text answer, make the last option's text match `/something else|other|custom/i` — `QuizOptions` (`SuggestChat.tsx:437`) already detects this and renders a custom-text input. Do not reimplement that pattern.

The coach's system prompt lives in `src/backend/src/services/coachPrompts.ts`; the new guidance should land there.

## Failure modes

- **No work item linked** → skip Step 1, start Step 2 from whatever is already in the form.
- **Azure DevOps unreachable** → skip Step 1, post a non-blocking note in the chat ("I couldn't reach Azure DevOps; I'll work from what's here").
- **User ignores a quiz** → don't block. The textarea remains usable for free-text input; the coach treats free text as an answer to the pending quiz.

## Out of scope

- Pushing to Azure DevOps (already covered by `PushPage.tsx`).
- Editing form fields by typing — the form remains directly editable; the coach only suggests.
