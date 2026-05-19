export type FlowBlock = { kind: 'prose'; text: string } | { kind: 'svg'; svg: string };

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default;
      m.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
      return m;
    });
  }
  return mermaidPromise;
}

let idSeq = 0;

function parseChunks(input: string): { kind: 'prose' | 'mermaid'; text: string }[] {
  const chunks: { kind: 'prose' | 'mermaid'; text: string }[] = [];
  const openRe = /(?:^|\n)```mermaid[ \t]*\r?\n/i;
  let cursor = 0;
  while (cursor < input.length) {
    const opener = input.slice(cursor).match(openRe);
    if (!opener || opener.index === undefined) {
      chunks.push({ kind: 'prose', text: input.slice(cursor) });
      break;
    }
    const openAbs = cursor + opener.index + (opener[0].startsWith('\n') ? 1 : 0);
    if (openAbs > cursor) {
      chunks.push({ kind: 'prose', text: input.slice(cursor, openAbs) });
    }
    const bodyStart = cursor + opener.index + opener[0].length;
    const closeRe = /\n```[ \t]*(?:\r?\n|$)/;
    const closer = input.slice(bodyStart).match(closeRe);
    if (!closer || closer.index === undefined) {
      chunks.push({ kind: 'prose', text: input.slice(openAbs) });
      break;
    }
    const body = input.slice(bodyStart, bodyStart + closer.index);
    chunks.push({ kind: 'mermaid', text: body.trim() });
    cursor = bodyStart + closer.index + closer[0].length;
  }
  return chunks.filter((c) => c.text.length > 0);
}

export async function renderFlow(flow: string): Promise<FlowBlock[]> {
  const trimmed = (flow || '').trim();
  if (!trimmed) return [];
  const chunks = parseChunks(trimmed);
  const m = await getMermaid();
  const out: FlowBlock[] = [];
  for (const c of chunks) {
    if (c.kind === 'prose') {
      out.push({ kind: 'prose', text: c.text });
      continue;
    }
    try {
      const { svg } = await m.render(`ark-export-${++idSeq}`, c.text);
      out.push({ kind: 'svg', svg });
    } catch {
      // Skip blocks that don't parse — the user already sees the error in the editor.
    }
  }
  return out;
}
