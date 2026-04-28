import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';

interface UiChangePreviewProps {
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function UiChangePreview({ enabled, onToggle, compact }: UiChangePreviewProps) {
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
      </label>

      {/* Paste-current-window strip */}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: compact ? 6 : 10, alignItems: 'stretch' }}>
        <UiThumb label="Before" variant="before" compact={compact} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: ARK_TOKENS.inkSubtle }}>
          <Ico.arrow size={14} />
        </div>
        <UiThumb label="After" variant="after" compact={compact} />
      </div>

      {!compact && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {['Replace before', 'Replace after', 'Annotate'].map((label, i) => (
            <button
              key={label}
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', border: `1px solid ${ARK_TOKENS.border}`,
                background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2,
                fontSize: 13, color: ARK_TOKENS.inkMuted, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {i < 2 ? <Ico.upload size={10} /> : <Ico.edit size={10} />} {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UiThumb({ label, variant, compact }: { label: string; variant: 'before' | 'after'; compact?: boolean }) {
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
          padding: 8, gap: 4,
          position: 'relative',
        }}
      >
        {/* Fake rows */}
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
