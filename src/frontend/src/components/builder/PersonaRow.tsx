import { useState, useRef, useEffect } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';

const PRESETS = [
  'Support engineer',
  'Tier\u20112 billing support specialist',
  'Customer success manager',
  'Product manager',
  'Field service technician',
  'Operations analyst',
];

interface PersonaRowProps {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
}

export function PersonaRow({ value, onChange, onFocus }: PersonaRowProps) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: `1px solid ${ARK_TOKENS.border}`,
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, fontWeight: 500, paddingTop: 4 }}>As a</div>
      <div ref={ref} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: `1px solid ${focus || open ? ARK_TOKENS.azure : 'transparent'}`,
            paddingBottom: 4,
          }}
        >
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => { setFocus(true); onFocus?.(); }}
            onBlur={() => setFocus(false)}
            placeholder="Type a persona, or pick from suggestions"
            style={{
              flex: 1, border: 'none', background: 'transparent',
              padding: '4px 0', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5,
              color: ARK_TOKENS.ink, outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: ARK_TOKENS.inkMuted, padding: 4, borderRadius: 3,
              display: 'flex', alignItems: 'center',
            }}
            title="Choose from suggestions"
          >
            <Ico.chevron size={12} dir={open ? 'up' : 'down'} />
          </button>
        </div>

        {open && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: ARK_TOKENS.surface,
              border: `1px solid ${ARK_TOKENS.border}`,
              borderRadius: ARK_TOKENS.r2,
              boxShadow: ARK_TOKENS.shadow2,
              zIndex: 20,
              maxHeight: 240, overflowY: 'auto',
              padding: 4,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.6, padding: '6px 8px 4px' }}>
              COMMON IN YOUR BACKLOG
            </div>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 10px', border: 'none',
                  background: value === p ? ARK_TOKENS.azureFaint : 'transparent',
                  textAlign: 'left', fontFamily: 'inherit', fontSize: 13,
                  color: ARK_TOKENS.ink, cursor: 'pointer', borderRadius: 4,
                }}
                onMouseEnter={(e) => { if (value !== p) (e.currentTarget as HTMLElement).style.background = ARK_TOKENS.surfaceAlt; }}
                onMouseLeave={(e) => { if (value !== p) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Ico.user size={12} />
                <span style={{ flex: 1 }}>{p}</span>
                {value === p && <Ico.check size={11} />}
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${ARK_TOKENS.border}`, marginTop: 4, padding: '8px 10px', fontSize: 11, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ico.sparkle size={10} />
              <span>Or just type your own — free text is allowed.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
