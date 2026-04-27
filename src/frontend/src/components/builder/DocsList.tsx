import { useRef } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';

interface DocItem {
  id: string;
  name: string;
  size: string;
  kind: 'pdf' | 'image' | 'file';
}

interface DocsListProps {
  docs: DocItem[];
  onRemove: (id: string) => void;
  onAdd: (doc: DocItem) => void;
}

function DocIcon({ kind }: { kind: string }) {
  const color = kind === 'image' ? '#7E57C2' : kind === 'pdf' ? '#E11A22' : ARK_TOKENS.inkMuted;
  return (
    <div
      style={{
        width: 22, height: 22, borderRadius: 4,
        background: ARK_TOKENS.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}
    >
      {kind === 'image' ? <Ico.image size={14} /> : <Ico.file size={14} />}
    </div>
  );
}

export function DocsList({ docs, onRemove, onAdd }: DocsListProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const kind: DocItem['kind'] = f.type.startsWith('image') ? 'image' : f.name.endsWith('.pdf') ? 'pdf' : 'file';
      onAdd({
        id: 'd' + Date.now() + Math.random(),
        name: f.name,
        size: Math.round(f.size / 1024) + ' KB',
        kind,
      });
    });
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {docs.map((d) => (
        <div
          key={d.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            border: `1px solid ${ARK_TOKENS.border}`,
            borderRadius: ARK_TOKENS.r2,
            background: ARK_TOKENS.surface,
          }}
        >
          <DocIcon kind={d.kind} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: ARK_TOKENS.ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
            <div style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{d.size}</span>
              <span style={{ width: 2, height: 2, borderRadius: 1, background: ARK_TOKENS.inkSubtle }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: ARK_TOKENS.ai }}>
                <Ico.sparkle size={9} /> Read by Ark
              </span>
            </div>
          </div>
          <button
            onClick={() => onRemove(d.id)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: ARK_TOKENS.inkSubtle, padding: 4, borderRadius: 3, opacity: 0.6 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
          >
            <Ico.x size={12} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 14px',
          border: `1px dashed ${ARK_TOKENS.borderStrong}`,
          background: 'transparent',
          borderRadius: ARK_TOKENS.r2,
          fontSize: 13, color: ARK_TOKENS.inkMuted, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.azure; (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.azure; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.borderStrong; (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.inkMuted; }}
      >
        <Ico.upload size={13} />
        <span>Add documents — Ark will read them and suggest criteria</span>
      </button>
      <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handlePick} />

      {docs.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px', marginTop: 2,
            background: 'rgba(126, 87, 194, 0.07)',
            border: '1px solid rgba(126, 87, 194, 0.18)',
            borderRadius: ARK_TOKENS.r2,
            fontSize: 12, lineHeight: 1.5, color: ARK_TOKENS.ink,
          }}
        >
          <span style={{ color: ARK_TOKENS.ai, marginTop: 1, flexShrink: 0 }}>
            <Ico.sparkle size={12} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Ark scanned {docs.length} document{docs.length === 1 ? '' : 's'}</div>
            <div style={{ color: ARK_TOKENS.inkMuted }}>
              Found 3 likely acceptance criteria and 1 edge case. See suggestions in the coach panel →
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
