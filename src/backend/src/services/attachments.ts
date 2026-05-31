import Anthropic from '@anthropic-ai/sdk';

// A picture or document to show the model, carried as a base64 content block.
export interface CoachAttachment {
  name: string;
  mimeType: string;
  data: string;            // base64, no "data:" prefix
  kind: 'image' | 'pdf';
}

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set<Anthropic.Base64ImageSource['media_type']>([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]);
// Keep the whole request well under Anthropic's ~32 MiB body limit.
const MAX_ATTACH_BYTES = 20 * 1024 * 1024;
const MAX_ATTACH_COUNT = 10;

// Turn attachments into image/document content blocks, dropping anything past
// the size/count budget (logged, never silently truncated).
export function buildAttachmentBlocks(attachments?: CoachAttachment[]): Anthropic.ContentBlockParam[] {
  if (!attachments || attachments.length === 0) return [];
  const blocks: Anthropic.ContentBlockParam[] = [];
  let totalBytes = 0;
  for (const a of attachments) {
    if (!a?.data) continue;
    if (blocks.length >= MAX_ATTACH_COUNT) {
      console.warn(`[attachments] skipping "${a.name}" — over the ${MAX_ATTACH_COUNT}-attachment cap`);
      continue;
    }
    const approxBytes = Math.floor(a.data.length * 0.75);
    if (totalBytes + approxBytes > MAX_ATTACH_BYTES) {
      console.warn(`[attachments] skipping "${a.name}" — would exceed the ${Math.round(MAX_ATTACH_BYTES / 1024 / 1024)} MB request budget`);
      continue;
    }
    if (a.kind === 'pdf') {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } });
    } else {
      const media_type = SUPPORTED_IMAGE_MEDIA_TYPES.has(a.mimeType as Anthropic.Base64ImageSource['media_type'])
        ? (a.mimeType as Anthropic.Base64ImageSource['media_type'])
        : 'image/png';
      blocks.push({ type: 'image', source: { type: 'base64', media_type, data: a.data } });
    }
    totalBytes += approxBytes;
  }
  return blocks;
}

function mimeFromDataUrl(dataUrl: string): string {
  const m = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return m ? m[1] : 'application/octet-stream';
}

function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

// Extract attachments from a stored draft: the picture list (uiChanges) plus any
// image/PDF supporting docs that persisted their bytes. Tolerates the legacy
// before/after picture shape.
export function draftAttachments(draft: unknown): CoachAttachment[] {
  const out: CoachAttachment[] = [];
  const d = (draft ?? {}) as {
    uiChanges?: Array<{ dataUrl?: string; beforeUrl?: string; afterUrl?: string; caption?: string }>;
    supportingDocs?: Array<{ name?: string; type?: string; mimeType?: string; dataUrl?: string }>;
  };
  for (const e of d.uiChanges ?? []) {
    for (const url of [e.dataUrl, e.beforeUrl, e.afterUrl]) {
      if (!url) continue;
      out.push({ name: e.caption || 'picture', mimeType: mimeFromDataUrl(url), data: base64FromDataUrl(url), kind: 'image' });
    }
  }
  for (const doc of d.supportingDocs ?? []) {
    if (!doc.dataUrl) continue;
    if (doc.type !== 'image' && doc.type !== 'pdf') continue;
    out.push({
      name: doc.name || 'document',
      mimeType: doc.mimeType || mimeFromDataUrl(doc.dataUrl),
      data: base64FromDataUrl(doc.dataUrl),
      kind: doc.type === 'pdf' ? 'pdf' : 'image',
    });
  }
  return out;
}
