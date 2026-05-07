import { useRef } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';

export interface DocItem {
  id: string;
  name: string;
  size: string;
  kind: 'pdf' | 'image' | 'file';
  scanned?: boolean;
  scanning?: boolean;
}

export interface ScanResult {
  docId: string;
  docName: string;
  summary: string;
  problemContext?: string;
  stakeholders?: string[];
  goals?: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
}

export interface UploadedDocPayload {
  content: string;
  mimeType: string;
}

interface DocsListProps {
  docs: DocItem[];
  scanResults: ScanResult[];
  onRemove: (id: string) => void;
  onAdd: (doc: DocItem) => void;
  onScan: (doc: DocItem, payload?: UploadedDocPayload) => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function DocIcon({ kind }: { kind: string }) {
  const color = kind === 'image' ? '#7E57C2' : kind === 'pdf' ? '#E11A22' : ARK_TOKENS.inkMuted;
  return (
    <div
      style={{
        width: 18, height: 18, borderRadius: 4,
        background: ARK_TOKENS.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0,
      }}
    >
      {kind === 'image' ? <Ico.image size={12} /> : <Ico.file size={12} />}
    </div>
  );
}

function StatusDot({ scanning, scanned }: { scanning?: boolean; scanned?: boolean }) {
  if (scanning) {
    return (
      <span
        title="Scanning…"
        aria-label="Scanning"
        style={{
          width: 14, height: 14, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: ARK_TOKENS.ai,
        }}
      >
        <span
          style={{
            width: 10, height: 10,
            border: '1.5px solid currentColor', borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'ark-spin 0.8s linear infinite',
          }}
        />
      </span>
    );
  }
  if (scanned) {
    return (
      <span
        title="Read by Ark"
        aria-label="Read by Ark"
        style={{
          width: 14, height: 14, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: ARK_TOKENS.ai,
        }}
      >
        <Ico.sparkle size={11} />
      </span>
    );
  }
  return (
    <span
      title="Not scanned"
      aria-label="Not scanned"
      style={{
        width: 14, height: 14, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: '50%',
          border: `1.5px solid ${ARK_TOKENS.inkSubtle}`,
        }}
      />
    </span>
  );
}

export function DocsList({ docs, scanResults, onRemove, onAdd, onScan }: DocsListProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.forEach((f) => {
      const kind: DocItem['kind'] = f.type.startsWith('image') ? 'image' : f.name.endsWith('.pdf') ? 'pdf' : 'file';
      const doc: DocItem = {
        id: 'd' + Date.now() + Math.random(),
        name: f.name,
        size: Math.round(f.size / 1024) + ' KB',
        kind,
      };
      onAdd(doc);
      readFileAsBase64(f)
        .then((content) => {
          const mimeType = f.type || 'application/octet-stream';
          onScan(doc, { content, mimeType });
        })
        .catch((err) => {
          console.error('[docs] failed to read file', f.name, err);
          onScan(doc);
        });
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {docs.map((d) => (
        <div
          key={d.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 10px',
            border: `1px solid ${ARK_TOKENS.border}`,
            borderRadius: ARK_TOKENS.r2,
            background: ARK_TOKENS.surface,
          }}
        >
          <StatusDot scanning={d.scanning} scanned={d.scanned} />
          <DocIcon kind={d.kind} />
          <span
            style={{
              flex: 1, minWidth: 0,
              fontSize: 14, color: ARK_TOKENS.ink, fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {d.name}
          </span>
          {d.size && (
            <span style={{ fontSize: 12, color: ARK_TOKENS.inkSubtle, flexShrink: 0 }}>
              {d.size}
            </span>
          )}
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
          fontSize: 16, color: ARK_TOKENS.inkMuted, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.azure; (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.azure; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.borderStrong; (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.inkMuted; }}
      >
        <Ico.upload size={13} />
        <span>Add documents — Ark will read them and use them as context</span>
      </button>
      <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp" style={{ display: 'none' }} onChange={handlePick} />

      {scanResults.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 12px', marginTop: 2,
            background: 'rgba(126, 87, 194, 0.07)',
            border: '1px solid rgba(126, 87, 194, 0.18)',
            borderRadius: ARK_TOKENS.r2,
            fontSize: 14, lineHeight: 1.5, color: ARK_TOKENS.ink,
          }}
        >
          <span style={{ color: ARK_TOKENS.ai, marginTop: 1, flexShrink: 0 }}>
            <Ico.sparkle size={12} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              Ark scanned {scanResults.length} document{scanResults.length === 1 ? '' : 's'}
            </div>
            <div style={{ color: ARK_TOKENS.inkMuted }}>
              Using them as context across the whole story.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
