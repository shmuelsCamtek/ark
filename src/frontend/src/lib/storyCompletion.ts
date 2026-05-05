import type { StoryDraft } from '../types';

export interface CompletionInput {
  title?: string;
  background?: string;
  persona?: string;
  narrative?: { iWantTo?: string; soThat?: string };
  acceptanceCriteria?: { id: string | number; text: string }[];
}

export interface CompletionResult {
  complete: boolean;
  filled: number;
  total: number;
  missing: string[];
}

const SECTION_LABELS = {
  title: 'Title',
  background: 'Background',
  persona: 'Persona',
  want: 'I want to',
  benefit: 'So that',
  criteria: 'Acceptance criteria (need 2+)',
} as const;

export function evaluateCompletion(input: CompletionInput): CompletionResult {
  const checks: Array<[keyof typeof SECTION_LABELS, boolean]> = [
    ['title', !!input.title?.trim()],
    ['background', !!input.background?.trim()],
    ['persona', !!input.persona?.trim()],
    ['want', !!input.narrative?.iWantTo?.trim()],
    ['benefit', !!input.narrative?.soThat?.trim()],
    ['criteria', (input.acceptanceCriteria?.length ?? 0) >= 2],
  ];

  const filled = checks.filter(([, ok]) => ok).length;
  const missing = checks.filter(([, ok]) => !ok).map(([key]) => SECTION_LABELS[key]);

  return {
    complete: missing.length === 0,
    filled,
    total: checks.length,
    missing,
  };
}

export function evaluateDraft(draft: StoryDraft | undefined): CompletionResult {
  if (!draft) return { complete: false, filled: 0, total: 6, missing: Object.values(SECTION_LABELS) };
  return evaluateCompletion({
    title: draft.title,
    background: draft.background,
    persona: draft.persona,
    narrative: { iWantTo: draft.narrative.iWantTo, soThat: draft.narrative.soThat },
    acceptanceCriteria: draft.acceptanceCriteria,
  });
}
