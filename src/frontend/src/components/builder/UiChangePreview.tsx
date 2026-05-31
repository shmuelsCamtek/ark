import { useEffect, useRef, useState } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';
import { AnnotateModal } from './AnnotateModal';
import type { UiChange } from '../../types';

interface UiChangePreviewProps {
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
  pictures: UiChange[];
  onAdd?: (dataUrl: string, source?: 'paste' | 'upload') => void;
  onUpdateCaption?: (id: string, caption: string) => void;
  onRemove?: (id: string) => void;
  onAnnotate?: (id: string, dataUrl: string) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(r.error || new Error('Failed to read file'));
    r.readAsDataURL(file);
  });
}

export function UiChangePreview({
  enabled, onToggle, compact,
  pictures, onAdd, onUpdateCaption, onRemove, onAnnotate,
}: UiChangePreviewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [annotating, setAnnotating] = useState<UiChange | null>(null);

  // Ctrl+V paste → add a picture
  useEffect(() => {
    if (!enabled || compact || !onAdd) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          readFileAsDataUrl(file).then((url) => onAdd(url, 'paste')).catch((err) => {
            console.error('[ui-change] paste read failed', err);
          });
          return;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [enabled, compact, onAdd]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.forEach((file) => {
      readFileAsDataUrl(file)
        .then((url) => onAdd?.(url, 'upload'))
        .catch((err) => console.error('[ui-change] file read failed', err));
    });
  };

  // Compact (preview) mode: read-only gallery of thumbnails, no controls.
  if (compact) {
    if (pictures.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {pictures.map((p) => (
          <PicThumb key={p.id} src={p.dataUrl} caption={p.caption} height={96} />
        ))}
      </div>
    );
  }

  if (!enabled) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '14px 14px',
          border: `1px solid ${ARK_TOKENS.border}`,
          borderRadius: ARK_TOKENS.r2,
          background: ARK_TOKENS.surface,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
          <input
            type="checkbox"
            checked={false}
            onChange={onToggle}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: ARK_TOKENS.azure, cursor: 'pointer', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ARK_TOKENS.type.h2, fontWeight: ARK_TOKENS.weight.semibold, color: ARK_TOKENS.ink, marginBottom: 2 }}>
              This story includes a UI change
            </div>
            <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkMuted, lineHeight: ARK_TOKENS.leading.normal }}>
              Tick this to attach screenshots or pictures. Ark uses them as context; tickets without UI work can skip this.
            </div>
          </div>
        </label>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.ink }}>
        <input
          type="checkbox"
          checked
          readOnly
          onClick={onToggle}
          style={{ width: 16, height: 16, accentColor: ARK_TOKENS.azure, cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontWeight: 600 }}>This story includes a UI change</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onToggle}
          style={{
            border: 'none', background: 'transparent', color: ARK_TOKENS.inkSubtle,
            fontSize: ARK_TOKENS.type.label, cursor: 'pointer', padding: 4, fontFamily: 'inherit',
          }}
        >
          Remove
        </button>
      </label>

      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px',
          background: ARK_TOKENS.azureFaint,
          border: `1px dashed ${ARK_TOKENS.azure}`,
          borderRadius: ARK_TOKENS.r2,
          fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.azureDark,
        }}
      >
        <Ico.copy size={12} />
        <span style={{ flex: 1 }}>
          Paste a screenshot <span style={{ color: ARK_TOKENS.inkMuted }}>(Ctrl+V)</span> or upload — Ark adds it to the picture list.
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', border: `1px solid ${ARK_TOKENS.azure}`,
            background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r,
            fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.azure, cursor: 'pointer', fontFamily: 'inherit', fontWeight: ARK_TOKENS.weight.semibold,
          }}
        >
          <Ico.upload size={10} /> Add picture
        </button>
      </div>

      {pictures.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pictures.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: 'flex', gap: 10,
                padding: 8,
                border: `1px solid ${ARK_TOKENS.border}`,
                borderRadius: ARK_TOKENS.r2,
                background: ARK_TOKENS.surface,
              }}
            >
              <PicThumb src={p.dataUrl} height={84} width={120} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  type="text"
                  value={p.caption ?? ''}
                  placeholder={`Caption (optional) — picture ${i + 1}`}
                  onChange={(e) => onUpdateCaption?.(p.id, e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '5px 8px',
                    border: `1px solid ${ARK_TOKENS.border}`, borderRadius: ARK_TOKENS.r,
                    fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.ink, fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <ActionBtn icon="edit" label="Annotate" onClick={() => setAnnotating(p)} />
                  <ActionBtn icon="x" label="Remove" onClick={() => onRemove?.(p.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {annotating && (
        <AnnotateModal
          image={annotating.dataUrl}
          onSave={(dataUrl) => onAnnotate?.(annotating.id, dataUrl)}
          onClose={() => setAnnotating(null)}
        />
      )}
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, disabled, title,
}: {
  icon: 'upload' | 'edit' | 'x';
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', border: `1px solid ${ARK_TOKENS.border}`,
        background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2,
        fontSize: ARK_TOKENS.type.label, color: disabled ? ARK_TOKENS.inkSubtle : ARK_TOKENS.inkMuted,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon === 'upload' ? <Ico.upload size={10} /> : icon === 'edit' ? <Ico.edit size={10} /> : <Ico.x size={10} />} {label}
    </button>
  );
}

function PicThumb({ src, caption, height, width }: { src: string; caption?: string; height: number; width?: number }) {
  return (
    <div
      style={{
        border: `1px solid ${ARK_TOKENS.border}`,
        borderRadius: ARK_TOKENS.r2,
        background: ARK_TOKENS.surface,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        width: width ?? 'auto',
      }}
    >
      <div style={{ height, width: width ?? 'auto', minWidth: width ?? 120, background: '#F1F4F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={src}
          alt={caption || 'picture'}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
      {caption && (
        <div
          style={{
            padding: '4px 8px', maxWidth: width ?? 200,
            fontSize: ARK_TOKENS.type.micro, fontWeight: ARK_TOKENS.weight.medium,
            color: ARK_TOKENS.inkMuted, background: ARK_TOKENS.surfaceAlt,
            borderTop: `1px solid ${ARK_TOKENS.border}`,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title={caption}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
