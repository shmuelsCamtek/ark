import { useEffect, useMemo, useRef, useState } from 'react';
import { ARK_TOKENS } from '../../tokens';

interface Chunk {
  kind: 'prose' | 'mermaid';
  text: string;
}

// Split a scenario string into ordered prose / mermaid chunks. A mermaid chunk
// is the body of a fully-closed ```mermaid ... ``` fence. Unclosed fences fall
// through as prose so the live preview stays calm while the user is typing.
function parseScenarioChunks(input: string): Chunk[] {
  const chunks: Chunk[] = [];
  // Opening fence: line starts with ```mermaid (case-insensitive), trailing
  // whitespace OK, must be followed by a newline.
  const openRe = /(?:^|\n)```mermaid[ \t]*\r?\n/i;
  let rest = input;
  let cursor = 0;
  while (cursor < rest.length) {
    const opener = rest.slice(cursor).match(openRe);
    if (!opener || opener.index === undefined) {
      chunks.push({ kind: 'prose', text: rest.slice(cursor) });
      break;
    }
    const openAbs = cursor + opener.index + (opener[0].startsWith('\n') ? 1 : 0);
    if (openAbs > cursor) {
      chunks.push({ kind: 'prose', text: rest.slice(cursor, openAbs) });
    }
    const bodyStart = cursor + opener.index + opener[0].length;
    // Closing fence: ``` on its own line (allow trailing whitespace).
    const closeRe = /\n```[ \t]*(?:\r?\n|$)/;
    const closer = rest.slice(bodyStart).match(closeRe);
    if (!closer || closer.index === undefined) {
      // Unfinished — emit everything from the opener onward as prose so the
      // text the user is still typing stays visible.
      chunks.push({ kind: 'prose', text: rest.slice(openAbs) });
      break;
    }
    const body = rest.slice(bodyStart, bodyStart + closer.index);
    chunks.push({ kind: 'mermaid', text: body.trim() });
    cursor = bodyStart + closer.index + closer[0].length;
  }
  // Drop empty leading prose chunks that come from leading whitespace.
  return chunks.filter((c) => c.text.length > 0 || c.kind === 'mermaid');
}

// Lazy module-level cache so we pay the mermaid import + init cost once per session.
type MermaidApi = typeof import('mermaid').default;
let mermaidPromise: Promise<MermaidApi> | null = null;
function getMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default;
      m.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
      return m;
    });
  }
  return mermaidPromise;
}

let mermaidIdSeq = 0;

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${++mermaidIdSeq}`);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setError(null);
    let active = true;
    getMermaid()
      .then((m) => m.render(idRef.current, code))
      .then(({ svg }) => {
        if (!active || cancelledRef.current) return;
        setSvg(svg);
      })
      .catch((err: unknown) => {
        if (!active || cancelledRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setSvg(null);
      });
    return () => {
      active = false;
      cancelledRef.current = true;
    };
  }, [code]);

  if (error) {
    return (
      <div
        style={{
          border: `1px solid ${ARK_TOKENS.danger}`,
          background: ARK_TOKENS.dangerBg,
          borderRadius: ARK_TOKENS.r2,
          padding: 10,
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.danger, fontWeight: ARK_TOKENS.weight.semibold, marginBottom: 6 }}>
          Mermaid syntax error
        </div>
        <pre style={{ margin: 0, fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkMuted, whiteSpace: 'pre-wrap', fontFamily: ARK_TOKENS.mono }}>
          {code}
        </pre>
        <div style={{ marginTop: 6, fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.danger, fontFamily: ARK_TOKENS.mono, whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 8,
        overflowX: 'auto',
        background: '#fff',
        borderRadius: ARK_TOKENS.r2,
        padding: 8,
      }}
      // mermaid output is sanitized SVG (securityLevel: 'strict' blocks scripts).
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export function ScenarioPreview({ value }: { value: string }) {
  const chunks = useMemo(() => parseScenarioChunks(value || ''), [value]);
  if (chunks.length === 0) return null;
  return (
    <div>
      {chunks.map((c, i) =>
        c.kind === 'mermaid' ? (
          <MermaidBlock key={`m-${i}`} code={c.text} />
        ) : (
          <p
            key={`p-${i}`}
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontSize: ARK_TOKENS.type.body,
              lineHeight: 1.6,
              color: ARK_TOKENS.ink,
            }}
          >
            {c.text}
          </p>
        ),
      )}
    </div>
  );
}
