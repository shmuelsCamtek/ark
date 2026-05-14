import type { StoryDraft, ContextLogEntry } from '../types';

type DraftUpdater = (
  id: string,
  updates: Partial<StoryDraft> | ((current: StoryDraft) => Partial<StoryDraft>),
) => void;

function newEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendContextEntry(
  updateDraft: DraftUpdater,
  draftId: string,
  entry: Omit<ContextLogEntry, 'id' | 'addedAt'> & { id?: string; addedAt?: string },
): void {
  updateDraft(draftId, (current) => {
    const full: ContextLogEntry = {
      id: entry.id ?? newEntryId(),
      addedAt: entry.addedAt ?? new Date().toISOString(),
      kind: entry.kind,
      label: entry.label,
      summary: entry.summary,
    };
    const log = current.contextLog ?? [];
    return { contextLog: [...log, full] };
  });
}

export function buildContextEntry(
  entry: Omit<ContextLogEntry, 'id' | 'addedAt'> & { id?: string; addedAt?: string },
): ContextLogEntry {
  return {
    id: entry.id ?? newEntryId(),
    addedAt: entry.addedAt ?? new Date().toISOString(),
    kind: entry.kind,
    label: entry.label,
    summary: entry.summary,
  };
}

// One fieldEdit entry per logical field. Subsequent edits to the same field
// replace the prior entry (deterministic id: `field:<key>`) and bump its
// `addedAt`, so the popover stays compact rather than accumulating one row per
// keystroke burst.
export function appendOrReplaceFieldEditEntry(
  updateDraft: DraftUpdater,
  draftId: string,
  fieldKey: string,
  label: string,
  summary?: string,
): void {
  const entryId = `field:${fieldKey}`;
  updateDraft(draftId, (current) => {
    const log = current.contextLog ?? [];
    const filtered = log.filter((e) => e.id !== entryId);
    const next: ContextLogEntry = {
      id: entryId,
      kind: 'fieldEdit',
      label,
      summary,
      addedAt: new Date().toISOString(),
    };
    return { contextLog: [...filtered, next] };
  });
}
