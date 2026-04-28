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
  epicName?: string;
  supportingDocs?: { name: string; kind: string; scanned: boolean; summary?: string; acceptanceCriteria?: string[]; edgeCases?: string[] }[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
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
    lines.push(`- **Repro steps / technical description**: ${stripHtml(ctx.workItemReproSteps)}`);
  }
  if (ctx.supportingDocs && ctx.supportingDocs.length > 0) {
    lines.push(`- Attached documents: ${ctx.supportingDocs.map(d => `${d.name} (${d.kind}${d.scanned ? ', scanned' : ''})`).join(', ')}`);
    for (const doc of ctx.supportingDocs) {
      if (!doc.scanned) continue;
      lines.push(`\n### Document: ${doc.name}`);
      if (doc.summary) lines.push(`**Summary**: ${doc.summary}`);
      if (doc.acceptanceCriteria?.length) {
        lines.push('**Extracted acceptance criteria**:');
        doc.acceptanceCriteria.forEach((ac, i) => lines.push(`  ${i + 1}. ${ac}`));
      }
      if (doc.edgeCases?.length) {
        lines.push('**Edge cases identified**:');
        doc.edgeCases.forEach((ec, i) => lines.push(`  ${i + 1}. ${ec}`));
      }
    }
  }
  lines.push('');
  lines.push('Use this context to inform your suggestions — the description often contains requirements, constraints, and stakeholder expectations that should be reflected in the user story fields.');

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

## Current draft state
### Filled fields
${filled.length > 0 ? filled.join('\n') : '_(none)_'}

### Empty fields
${empty.length > 0 ? empty.join('\n') : '_(all filled!)_'}
${activeFieldNote}
${buildWorkItemSection(draftContext)}
## Your behavior
- Be concise, helpful, and encouraging
- Proactively suggest improvements for weak fields
- Ask clarifying questions when the user's intent is ambiguous
- When you have concrete suggestions, return structured JSON:
  \`\`\`json
  { "text": "brief conversational intro", "suggestions": [{ "field": "fieldName", "options": ["option1", "option2", "option3"] }] }
  \`\`\`
  Valid field names: title, background, persona, want, benefit, criteria
- **When you need to ask a clarifying question**, return a quiz format — multiple-choice options where the last option is always "Something else…" (to let the user type a custom answer):
  \`\`\`json
  { "text": "brief intro", "quiz": { "question": "Your question here?", "options": ["Option A", "Option B", "Option C", "Something else\u2026"] } }
  \`\`\`
  Keep options to 3-5 (including "Something else…"). Make each option specific and actionable, not vague.
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
