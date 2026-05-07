import { useEffect, useRef, useState } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';
import { AnnotateModal } from './AnnotateModal';

interface UiChangePreviewProps {
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
  before?: string;
  after?: string;
  onSetBefore?: (url: string) => void;
  onSetAfter?: (url: string) => void;
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
  before, after, onSetBefore, onSetAfter,
}: UiChangePreviewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<'before' | 'after'>('before');
  const [annotating, setAnnotating] = useState<'before' | 'after' | null>(null);

  // Ctrl+V paste → set Before
  useEffect(() => {
    if (!enabled || compact || !onSetBefore) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          readFileAsDataUrl(file).then(onSetBefore).catch((err) => {
            console.error('[ui-change] paste read failed', err);
          });
          return;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [enabled, compact, onSetBefore]);

  const pickFile = (slot: 'before' | 'after') => {
    slotRef.current = slot;
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    readFileAsDataUrl(file)
      .then((url) => {
        if (slotRef.current === 'before') onSetBefore?.(url);
        else onSetAfter?.(url);
      })
      .catch((err) => console.error('[ui-change] file read failed', err));
  };

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
            <div style={{ fontSize: 16, fontWeight: 600, color: ARK_TOKENS.ink, marginBottom: 2 }}>
              This story includes a UI change
            </div>
            <div style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, lineHeight: 1.5 }}>
              Tick this if you want to capture a before/after. Tickets without UI work can skip this.
            </div>
          </div>
        </label>
      </div>
    );
  }

  const annotateSource = annotating === 'before' ? before : annotating === 'after' ? after : undefined;
  const annotateTarget = before ? 'before' : after ? 'after' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 16, color: ARK_TOKENS.ink }}>
        <input
          type="checkbox"
          checked
          readOnly
          onClick={onToggle}
          style={{ width: 16, height: 16, accentColor: ARK_TOKENS.azure, cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontWeight: 600 }}>This story includes a UI change</span>
        <span style={{ flex: 1 }} />
        {!compact && (
          <button
            type="button"
            onClick={onToggle}
            style={{
              border: 'none', background: 'transparent', color: ARK_TOKENS.inkSubtle,
              fontSize: 13, cursor: 'pointer', padding: 4, fontFamily: 'inherit',
            }}
          >
            Remove
          </button>
        )}
      </label>

      {!compact && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px',
            background: ARK_TOKENS.azureFaint,
            border: `1px dashed ${ARK_TOKENS.azure}`,
            borderRadius: ARK_TOKENS.r2,
            fontSize: 14, color: ARK_TOKENS.azureDark,
          }}
        >
          <Ico.copy size={12} />
          <span style={{ flex: 1 }}>
            Paste a screenshot of the current window <span style={{ color: ARK_TOKENS.inkMuted }}>(Ctrl+V)</span> — Ark will set it as <b>Before</b>.
          </span>
          <button
            type="button"
            onClick={() => pickFile('before')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', border: `1px solid ${ARK_TOKENS.azure}`,
              background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r,
              fontSize: 13, color: ARK_TOKENS.azure, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            <Ico.upload size={10} /> Upload
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: compact ? 6 : 10, alignItems: 'stretch' }}>
        <UiThumb label="Before" variant="before" compact={compact} src={before} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: ARK_TOKENS.inkSubtle }}>
          <Ico.arrow size={14} />
        </div>
        <UiThumb label="After" variant="after" compact={compact} src={after} />
      </div>

      {!compact && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <ActionBtn icon="upload" label="Replace before" onClick={() => pickFile('before')} />
          <ActionBtn icon="upload" label="Replace after" onClick={() => pickFile('after')} />
          <ActionBtn
            icon="edit"
            label="Annotate"
            disabled={!annotateTarget}
            title={annotateTarget ? undefined : 'Add a Before or After image first'}
            onClick={() => annotateTarget && setAnnotating(annotateTarget)}
          />
        </div>
      )}

      {!compact && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      {annotating && annotateSource && (
        <AnnotateModal
          image={annotateSource}
          onSave={(dataUrl) => {
            if (annotating === 'before') onSetBefore?.(dataUrl);
            else onSetAfter?.(dataUrl);
          }}
          onClose={() => setAnnotating(null)}
        />
      )}
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, disabled, title,
}: {
  icon: 'upload' | 'edit';
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
        fontSize: 13, color: disabled ? ARK_TOKENS.inkSubtle : ARK_TOKENS.inkMuted,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon === 'upload' ? <Ico.upload size={10} /> : <Ico.edit size={10} />} {label}
    </button>
  );
}

function UiThumb({ label, variant, compact, src }: { label: string; variant: 'before' | 'after'; compact?: boolean; src?: string }) {
  const isAfter = variant === 'after';
  const h = compact ? 96 : 132;

  return (
    <div
      style={{
        border: `1px solid ${ARK_TOKENS.border}`,
        borderRadius: ARK_TOKENS.r2,
        background: ARK_TOKENS.surface,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: h, background: '#F1F4F9',
          display: 'flex', flexDirection: 'column',
          padding: src ? 0 : 8, gap: 4,
          position: 'relative',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={`${label} screenshot`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 3, background: '#fff', border: `1px solid ${ARK_TOKENS.border}` }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: isAfter ? '#388E3C' : '#E11A22' }} />
              <div style={{ height: 4, background: '#E3E6ED', flex: 1, borderRadius: 1 }} />
              <div style={{ height: 4, background: '#E3E6ED', width: 24, borderRadius: 1 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 3, background: '#fff', border: `1px solid ${ARK_TOKENS.border}` }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#E11A22' }} />
              <div style={{ height: 4, background: '#E3E6ED', flex: 1, borderRadius: 1 }} />
              <div style={{ height: 4, background: '#E3E6ED', width: 24, borderRadius: 1 }} />
            </div>
            {isAfter ? (
              <div
                style={{
                  position: 'absolute', right: 8, bottom: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px',
                  background: ARK_TOKENS.azure, color: '#fff',
                  borderRadius: 12, fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
                  boxShadow: '0 1px 3px rgba(0,143,190,0.4)',
                }}
              >
                <Ico.refresh size={8} /> AUTO-RETRY ON
              </div>
            ) : (
              <div
                style={{
                  position: 'absolute', right: 8, bottom: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px',
                  background: '#fff', color: ARK_TOKENS.inkMuted,
                  border: `1px solid ${ARK_TOKENS.border}`,
                  borderRadius: 12, fontSize: 11, fontWeight: 500,
                }}
              >
                Retry manually
              </div>
            )}
          </>
        )}
      </div>
      <div
        style={{
          padding: '4px 8px',
          fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
          color: isAfter ? ARK_TOKENS.azure : ARK_TOKENS.inkMuted,
          background: isAfter ? ARK_TOKENS.azureFaint : ARK_TOKENS.surfaceAlt,
          borderTop: `1px solid ${ARK_TOKENS.border}`,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
}
