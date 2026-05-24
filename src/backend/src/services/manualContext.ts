import { isManualLoaded, searchManual } from './manualIndex.ts';

export function buildManualContext(query: string, topK = 4): string {
  if (!isManualLoaded()) return '';
  const chunks = searchManual(query, topK);
  if (chunks.length === 0) return '';
  const body = chunks
    .map((c) => `[Manual · ${c.section || 'untitled'} · p${c.page}]\n${c.text}`)
    .join('\n\n---\n\n');
  return `Product reference (excerpts from the Camtek User Manual)\n\n${body}`;
}
