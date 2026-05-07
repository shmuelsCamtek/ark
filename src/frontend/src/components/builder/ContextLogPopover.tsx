import { useEffect, useRef } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';
import type { ContextLogEntry, ContextLogKind } from '../../types';

interface ContextLogPopoverProps {
  entries: ContextLogEntry[];
  onClose: () => void;
}

const KIND_LABEL: Record<ContextLogKind, string> = {
  doc: 'Document',
  workItem: 'Work item',
  linkedWorkItem: 'Linked work item',
  uiBefore: 'Before screenshot',
  uiAfter: 'After screenshot',
};

function KindIcon({ kind }: { kind: ContextLogKind }) {
  if (kind === 'doc') return <Ico.file size={12} />;
  if (kind === 'workItem' || kind === 'linkedWorkItem') return <Ico.link size={12} />;
  return <Ico.image size={12} />;
}

function kindColor(kind: ContextLogKind): string {
  switch (kind) {
    case 'doc': return ARK_TOKENS.ai;
    case 'workItem': return ARK_TOKENS.azure;
    case 'linkedWorkItem': return ARK_TOKENS.azureDark;
    case 'uiBefore':
    case 'uiAfter': return ARK_TOKENS.markerRed;
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ContextLogPopover({ entries, onClose }: ContextLogPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const ordered = [...entries].reverse();

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 8,
        width: 320, maxHeight: 360,
        background: ARK_TOKENS.surface,
        border: `1px solid ${ARK_TOKENS.border}`,
        borderRadius: ARK_TOKENS.r2,
        boxShadow: ARK_TOKENS.shadow3,
        zIndex: 50,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${ARK_TOKENS.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: ARK_TOKENS.ink, flex: 1 }}>
          Coach context · {entries.length} item{entries.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: 'none', background: 'transparent',
            color: ARK_TOKENS.inkSubtle, cursor: 'pointer',
            padding: 4, borderRadius: 3,
          }}
        >
          <Ico.x size={11} />
        </button>
      </div>
      <div className="ark-scroll" style={{ overflowY: 'auto', flex: 1 }}>
        {ordered.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: 13, color: ARK_TOKENS.inkSubtle, lineHeight: 1.5 }}>
            No items in context yet — link a work item or upload a document to get started.
          </div>
        ) : (
          ordered.map((e) => (
            <div
              key={e.id}
              style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${ARK_TOKENS.border}`,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: ARK_TOKENS.surfaceAlt,
                  color: kindColor(e.kind),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}
                title={KIND_LABEL[e.kind]}
              >
                <KindIcon kind={e.kind} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13, fontWeight: 600, color: ARK_TOKENS.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={e.label}
                >
                  {e.label}
                </div>
                {e.summary && (
                  <div
                    style={{
                      fontSize: 12, color: ARK_TOKENS.inkMuted, marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={e.summary}
                  >
                    {e.summary}
                  </div>
                )}
              </div>
              <div
                style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle, flexShrink: 0, marginTop: 2 }}
                title={new Date(e.addedAt).toLocaleString()}
              >
                {formatRelative(e.addedAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
