interface ContextComment {
  author: string;
  createdDate: string;
  text: string;
}

interface ContextWorkItemNode {
  id: number;
  title: string;
  type: string;
  state: string;
  description?: string;
  reproSteps?: string;
  technicalDescription?: string;
  linkType?: string;
  discussion?: ContextComment[];
  linkedWorkItems?: ContextWorkItemNode[];
}

interface DraftContext {
  title?: string;
  background?: string;
  persona?: string;
  want?: string;
  benefit?: string;
  criteria?: string[];
  activeField?: string;
  workItemId?: string;
  workItemType?: string;
  workItemState?: string;
  workItemAssignedTo?: string;
  workItemDescription?: string;
  workItemReproSteps?: string;
  workItemTechnicalDescription?: string;
  workItemDiscussion?: ContextComment[];
  linkedWorkItems?: ContextWorkItemNode[];
  epicName?: string;
  supportingDocs?: {
    name: string;
    kind: string;
    scanned: boolean;
    summary?: string;
    problemContext?: string;
    stakeholders?: string[];
    goals?: string[];
    acceptanceCriteria?: string[];
    edgeCases?: string[];
  }[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + '…';
}

function renderComments(
  comments: ContextComment[],
  maxItems: number,
  maxLen: number,
  indent: string,
): string[] {
  const lines: string[] = [];
  for (const c of comments.slice(0, maxItems)) {
    const txt = stripHtml(c.text || '');
    if (!txt) continue;
    const author = c.author || 'Unknown';
    const when = c.createdDate ? c.createdDate.slice(0, 10) : '';
    lines.push(`${indent}- **${author}**${when ? ` (${when})` : ''}: ${truncate(txt, maxLen)}`);
  }
  return lines;
}

function renderLinkedNode(node: ContextWorkItemNode, indent: string): string[] {
  const lines: string[] = [];
  const linkLabel = node.linkType ? `${node.linkType} · ` : '';
  lines.push(`${indent}- [${linkLabel}${node.type} #${node.id}] ${node.title} — ${node.state}`);
  const childIndent = indent + '  ';
  if (node.description) {
    lines.push(`${childIndent}${truncate(stripHtml(node.description), 300)}`);
  }
  if (node.technicalDescription) {
    lines.push(`${childIndent}Tech: ${truncate(stripHtml(node.technicalDescription), 300)}`);
  }
  if (node.reproSteps) {
    lines.push(`${childIndent}Repro: ${truncate(stripHtml(node.reproSteps), 300)}`);
  }
  if (node.discussion?.length) {
    lines.push(`${childIndent}Recent comments:`);
    lines.push(...renderComments(node.discussion, 3, 200, childIndent + '  '));
  }
  for (const child of node.linkedWorkItems ?? []) {
    lines.push(...renderLinkedNode(child, childIndent));
  }
  return lines;
}

function buildWorkItemSection(ctx: DraftContext): string {
  if (!ctx.workItemId && !ctx.workItemType) return '';

  const lines: string[] = ['## Source work item'];
  if (ctx.workItemType && ctx.workItemId) {
    lines.push(`- **${ctx.workItemType} #${ctx.workItemId}**`);
  }
  if (ctx.workItemState) lines.push(`- State: ${ctx.workItemState}`);
  if (ctx.workItemAssignedTo) lines.push(`- Assigned to: ${ctx.workItemAssignedTo}`);
  if (ctx.epicName) lines.push(`- Parent epic: ${ctx.epicName}`);
  if (ctx.workItemDescription) {
    lines.push(`- **Description**: ${stripHtml(ctx.workItemDescription)}`);
  }
  if (ctx.workItemReproSteps) {
    lines.push(`- **Repro steps**: ${stripHtml(ctx.workItemReproSteps)}`);
  }
  if (ctx.workItemTechnicalDescription) {
    lines.push(`- **Technical description**: ${stripHtml(ctx.workItemTechnicalDescription)}`);
  }
  if (ctx.workItemDiscussion && ctx.workItemDiscussion.length > 0) {
    lines.push('');
    lines.push('### Discussion (most recent first)');
    lines.push(...renderComments(ctx.workItemDiscussion, 10, 500, ''));
  }
  if (ctx.linkedWorkItems && ctx.linkedWorkItems.length > 0) {
    lines.push('');
    lines.push('### Linked items');
    for (const node of ctx.linkedWorkItems) {
      lines.push(...renderLinkedNode(node, ''));
    }
  }
  if (ctx.supportingDocs && ctx.supportingDocs.length > 0) {
    lines.push(`- Attached documents: ${ctx.supportingDocs.map(d => `${d.name} (${d.kind}${d.scanned ? ', scanned' : ''})`).join(', ')}`);
    for (const doc of ctx.supportingDocs) {
      if (!doc.scanned) continue;
      lines.push(`\n### Document: ${doc.name}`);
      if (doc.summary) lines.push(`**Summary**: ${doc.summary}`);
      if (doc.problemContext) lines.push(`**Problem context** (use to draft Background): ${doc.problemContext}`);
      if (doc.stakeholders?.length) {
        lines.push('**Stakeholders mentioned** (use to draft Persona):');
        doc.stakeholders.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      }
      if (doc.goals?.length) {
        lines.push('**Goals / desired outcomes** (use to draft Desire & Benefit):');
        doc.goals.forEach((g, i) => lines.push(`  ${i + 1}. ${g}`));
      }
      if (doc.acceptanceCriteria?.length) {
        lines.push('**Extracted acceptance criteria** (use during AC phase only):');
        doc.acceptanceCriteria.forEach((ac, i) => lines.push(`  ${i + 1}. ${ac}`));
      }
      if (doc.edgeCases?.length) {
        lines.push('**Edge cases identified** (use during AC phase only):');
        doc.edgeCases.forEach((ec, i) => lines.push(`  ${i + 1}. ${ec}`));
      }
    }
  }
  lines.push('');
  lines.push('Use the source work item **and any attached documents** to inform every field — summaries and descriptions help shape the Background; stakeholders and roles in the discussion hint at the Persona, Desire, and Benefit; extracted criteria and edge cases are reference material for the Acceptance Criteria phase only.');

  return '\n\n' + lines.join('\n');
}

export function buildCoachSystemPrompt(draftContext: DraftContext): string {
  const filled: string[] = [];
  const empty: string[] = [];

  const fields: { key: keyof DraftContext; label: string }[] = [
    { key: 'title', label: 'Title' },
    { key: 'background', label: 'Background' },
    { key: 'persona', label: 'Persona' },
    { key: 'want', label: 'Desire (I want to…)' },
    { key: 'benefit', label: 'Benefit (So that…)' },
  ];

  for (const { key, label } of fields) {
    const val = draftContext[key];
    if (val && typeof val === 'string' && val.trim()) {
      filled.push(`- **${label}**: ${val}`);
    } else {
      empty.push(`- **${label}**: _(empty)_`);
    }
  }

  const acList = draftContext.criteria ?? [];
  if (acList.length > 0) {
    filled.push(`- **Acceptance Criteria** (${acList.length}):\n${acList.map((ac, i) => `  ${i + 1}. ${ac}`).join('\n')}`);
  } else {
    empty.push('- **Acceptance Criteria**: _(none yet)_');
  }

  const activeFieldNote = draftContext.activeField
    ? `\n\nThe user is currently editing the **${draftContext.activeField}** field.`
    : '';

  return `You are Ark Coach, an AI assistant embedded in Ark Story Studio. You help non-technical professionals (PMs, support leads, ops managers) write well-formed Azure DevOps user stories.

## Your expertise
- INVEST criteria: Independent, Negotiable, Valuable, Estimable, Small, Testable
- User story anatomy: persona → narrative (As a… I want… So that…) → acceptance criteria
- Azure DevOps work item structure and conventions
- Domain-specific language and backlog patterns

## What "good" looks like
- **Title**: Action-oriented, concise (5-10 words), starts with a verb or describes the capability
- **Background**: 2-3 sentences of business context — why this matters now, what problem exists
- **Persona**: Specific role with enough context to understand their perspective (e.g., "Tier-2 billing support specialist" not just "user")
- **Desire (I want to…)**: One clear, testable capability — not a solution prescription
- **Benefit (So that…)**: Measurable business outcome tied to the persona's goals
- **Acceptance Criteria**: Given/When/Then format, covering happy path + key edge cases, each independently testable

## How to drive this conversation
Walk the user through filling the four fields in this order: **Background → Narrative (persona / want / benefit) → Title → Acceptance Criteria**.

For each field:
- **If empty**: draft a value from the source work item and its discussion / linked items. If you lack information you need to draft well (for example, the persona for the narrative), ask first with a quiz before drafting.
- **If already filled**: do not overwrite. Review what's there and offer an improvement as a \`suggestions\` JSON. The user decides whether to apply it.

**You drive the conversation forward.** After a field has been addressed (you drafted it, the user accepted a suggestion, or the user answered your quiz), immediately move to the **next empty field** in the order above — do not linger, do not wait for the user to ask "what's next?". A short acknowledgement plus the next question/draft is the right shape; never end a turn at "great, that's done" without advancing.

**Phase discipline.** Acceptance Criteria are the **last** phase. Do not surface AC suggestions (no \`field: "criteria"\` suggestions, no AC quizzes, no "here are likely ACs" prose) until **Background, Persona, Desire, Benefit, and Title** are all filled. If supporting documents contain extracted criteria or edge cases, hold them — use them only to inform earlier-phase drafts (Background framing, Persona hints, scope of the Desire/Benefit), and surface them as ACs only when the conversation reaches the AC phase.

**Doc content discipline.** When drafting Background, Persona, Desire, Benefit, or Title, **paraphrase** the document's \`problemContext\` / \`stakeholders\` / \`goals\` — do not quote the document verbatim. Background should read as your own framing of the situation; Persona / Desire / Benefit should read as one synthesised user story, not a copy of the doc. Verbatim document content is reserved for the AC phase, where you may surface \`acceptanceCriteria\` and \`edgeCases\` as-is via a \`criteria\` suggestions block.

**AC formatting (strict).** Every entry in a \`criteria\` suggestions array is exactly **one** Given / When / Then triple — one scenario, one entry. Never concatenate multiple Given/When/Then triples into a single string. If you have 4 scenarios, return 4 separate entries. Each entry should read like: "Given <single context>, when <single action>, then <single outcome>." (line breaks between Given/When/Then are fine). One entry covers one happy path **or** one edge case — never both. When surfacing extracted criteria from supporting documents, split any multi-scenario entries into one-per-triple before including them.

After producing initial Acceptance Criteria as a \`suggestions\` block with \`field: "criteria"\`, ask via quiz whether the user wants to add more. Loop until they say no, then stop.

If no work item is linked, or its content is unavailable, skip the ingestion and drive the conversation from whatever is already in the form, asking the user for what's missing.

## Current draft state
### Filled fields
${filled.length > 0 ? filled.join('\n') : '_(none)_'}

### Empty fields
${empty.length > 0 ? empty.join('\n') : '_(all filled!)_'}
${activeFieldNote}
${buildWorkItemSection(draftContext)}
## Response format — strict
Your entire reply is **either** a single JSON object **or** plain prose. Never both. Specifically:
- If you have suggestions or a quiz, your reply is **only** the JSON code block (\`\`\`json … \`\`\`) — no prose before it, no prose after it. Put the conversational text inside the JSON's \`"text"\` field, not outside.
- If you have no suggestions and no quiz, reply with plain prose — no JSON, no code fence.
- The JSON must be syntactically valid. Do not append extra brackets, commas, or stray characters.

## Your behavior
- Be concise, helpful, and encouraging
- Proactively suggest improvements for weak fields
- Ask clarifying questions when the user's intent is ambiguous
- When you have concrete suggestions, return structured JSON:
  \`\`\`json
  { "text": "brief conversational intro", "suggestions": [{ "field": "fieldName", "options": ["option1", "option2", "option3"] }] }
  \`\`\`
  Valid field names: title, background, persona, want, benefit, criteria
- **When you need to ask a clarifying question**, return a quiz format with multiple-choice options:
  \`\`\`json
  { "text": "brief intro", "quiz": { "question": "Your question here?", "options": ["Option A", "Option B", "Option C", "Something else\u2026"] } }
  \`\`\`
  **Mandatory:** at least 2 distinct concrete options PLUS a final option whose text is exactly "Something else…" — minimum 3 total, maximum 5. A quiz with only one option, or without "Something else…" as the last option, is invalid. Make each concrete option specific and actionable, not vague.
- For purely informational responses (explanations, feedback with no question), return plain text — no JSON wrapper
- Keep responses under 150 words unless the user asks for detail
- Focus on one or two improvements at a time, don't overwhelm`;
}

const FIELD_GUIDANCE: Record<string, string> = {
  title: `A good title is action-oriented (5-10 words), starts with a verb or describes the capability.
Bad: "Payment fix" / Good: "Auto-retry failed subscription renewals"
Consider: Does it tell an engineer what this story is about at a glance?`,

  background: `Background gives 2-3 sentences of business context: why this matters now, what problem exists, who's affected.
Consider: Would a new team member understand why this story exists just from the background?`,

  persona: `A good persona is a specific role with enough context to understand their perspective.
Bad: "user" / Good: "Tier-2 billing support specialist handling escalated payment disputes"
Consider: The persona drives the narrative — a vague persona leads to vague requirements.`,

  want: `The "I want to…" should describe one clear, testable capability — not a solution.
Bad: "I want a button that exports CSV" / Good: "I want to export pipeline results for offline analysis"
Consider: Does this describe the WHAT without prescribing the HOW?`,

  benefit: `The "So that…" should be a measurable business outcome tied to the persona's goals.
Bad: "so that it works better" / Good: "so that I can reduce manual triage from 2 hours to 15 minutes daily"
Consider: Can you measure whether this benefit was achieved after delivery?`,

  criteria: `Good acceptance criteria use Given/When/Then format, are independently testable, and cover:
- Happy path (the main success scenario)
- Key edge cases (what happens when things go wrong?)
- Boundary conditions (limits, empty states, permissions)

**Each suggestion entry is exactly ONE Given/When/Then triple.** Never concatenate multiple scenarios into one entry — if you have N scenarios, return N entries.
Consider: Could a QA engineer write test cases directly from these criteria?`,
};

export function buildFieldSuggestionPrompt(
  field: string,
  currentValue: string,
  draftContext: DraftContext,
): string {
  const guidance = FIELD_GUIDANCE[field] || `Provide suggestions for the ${field} field.`;

  const contextParts: string[] = [];
  if (draftContext.persona) contextParts.push(`Persona: ${draftContext.persona}`);
  if (draftContext.want) contextParts.push(`Desire: ${draftContext.want}`);
  if (draftContext.benefit) contextParts.push(`Benefit: ${draftContext.benefit}`);
  if (draftContext.background) contextParts.push(`Background: ${draftContext.background}`);
  if (draftContext.title) contextParts.push(`Title: ${draftContext.title}`);
  if (draftContext.workItemType && draftContext.workItemId) contextParts.push(`Source: ${draftContext.workItemType} #${draftContext.workItemId}`);
  if (draftContext.workItemDescription) contextParts.push(`Work item description: ${stripHtml(draftContext.workItemDescription)}`);
  if (draftContext.workItemReproSteps) contextParts.push(`Repro steps: ${stripHtml(draftContext.workItemReproSteps)}`);
  if (draftContext.supportingDocs?.length) {
    for (const doc of draftContext.supportingDocs) {
      if (!doc.scanned) continue;
      const parts: string[] = [`Document "${doc.name}"`];
      if (doc.summary) parts.push(`Summary: ${doc.summary}`);
      if (doc.problemContext) parts.push(`Problem context: ${doc.problemContext}`);
      if (doc.stakeholders?.length) parts.push(`Stakeholders: ${doc.stakeholders.join('; ')}`);
      if (doc.goals?.length) parts.push(`Goals: ${doc.goals.join('; ')}`);
      if (doc.acceptanceCriteria?.length) parts.push(`Extracted ACs: ${doc.acceptanceCriteria.join('; ')}`);
      if (doc.edgeCases?.length) parts.push(`Edge cases: ${doc.edgeCases.join('; ')}`);
      contextParts.push(parts.join(' — '));
    }
  }

  return `You are Ark Coach. The user needs help with the "${field}" field of their user story.

## Field guidance
${guidance}

## Current value
${currentValue ? `"${currentValue}"` : '_(empty)_'}

## Other fields for context
${contextParts.length > 0 ? contextParts.join('\n') : '_(no other fields filled yet)_'}

## Instructions
Provide 2-4 concrete suggestions that improve on the current value (or fill the gap if empty).
Each suggestion should be informed by the other filled fields.

Return JSON: { "text": "brief intro", "suggestions": ["option1", "option2", "option3"] }`;
}
