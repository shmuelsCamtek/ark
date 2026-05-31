import type { StoryDraft, UiChange } from '../types';

// Legacy shape: a single uiChanges entry held beforeUrl / afterUrl. The flat
// list model stores one entry per picture with a `dataUrl`.
type LegacyUiChange = UiChange & {
  beforeUrl?: string;
  afterUrl?: string;
};

// Read a draft's pictures as a flat list, migrating any legacy before/after
// entries on the fly so older drafts keep their images.
export function draftPictures(
  draft?: Pick<StoryDraft, 'uiChanges'> | null,
): UiChange[] {
  const list = (draft?.uiChanges ?? []) as LegacyUiChange[];
  const out: UiChange[] = [];
  for (const e of list) {
    if (e.dataUrl) {
      out.push({ id: e.id, dataUrl: e.dataUrl, caption: e.caption, addedAt: e.addedAt });
      continue;
    }
    if (e.beforeUrl) out.push({ id: `${e.id}-before`, dataUrl: e.beforeUrl, caption: e.caption || 'Before' });
    if (e.afterUrl) out.push({ id: `${e.id}-after`, dataUrl: e.afterUrl, caption: 'After' });
  }
  return out;
}

// Extract the MIME type from a data URL (e.g. "data:image/png;base64,…").
export function mimeFromDataUrl(dataUrl: string): string {
  const m = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return m ? m[1] : 'application/octet-stream';
}

// Strip the "data:…;base64," prefix, returning the raw base64 payload.
export function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
