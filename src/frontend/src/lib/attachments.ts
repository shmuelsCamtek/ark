import type { SupportingDoc } from '../types';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

// Classify an attachment by filename (and optional MIME) into the kinds the app
// distinguishes: 'image' → UI-change picture list, 'pdf'/'other' → Supporting documents.
export function classifyAttachment(name: string, mimeType?: string): SupportingDoc['type'] {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.includes(ext) || (mimeType?.startsWith('image/') ?? false)) return 'image';
  return 'other';
}

export function isImageAttachment(name: string, mimeType?: string): boolean {
  return classifyAttachment(name, mimeType) === 'image';
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// A stable key for an Azure attachment, so the same image referenced both inline
// and as a relation (or in multiple fields) is de-duplicated.
export function attachmentKey(url: string): string {
  const m = /\/attachments\/([0-9a-fA-F-]+)/.exec(url);
  return m ? m[1].toLowerCase() : url;
}

// Pull inline images out of a work-item HTML field. Azure stores pasted
// screenshots as <img src="…/_apis/wit/attachments/{guid}?fileName=…"> rather
// than as AttachedFile relations, so they must be scraped from the HTML.
export function extractInlineImageUrls(html?: string): { url: string; name: string }[] {
  if (!html) return [];
  const out: { url: string; name: string }[] = [];
  const re = /<img\b[^>]*?\bsrc=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = decodeHtmlEntities(m[1]);
    if (!/\/_apis\/wit\/attachments\//i.test(url)) continue; // only Azure attachment images
    const nameMatch = /[?&]fileName=([^&]+)/i.exec(url);
    let name = 'image.png';
    if (nameMatch) {
      try { name = decodeURIComponent(nameMatch[1]); } catch { name = nameMatch[1]; }
    }
    out.push({ url, name });
  }
  return out;
}
