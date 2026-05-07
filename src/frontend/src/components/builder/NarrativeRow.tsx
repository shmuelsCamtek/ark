import { useState } from 'react';
import { ARK_TOKENS } from '../../tokens';

interface NarrativeRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  last?: boolean;
  onFocus?: () => void;
}

export function NarrativeRow({ label, value, onChange, placeholder, multiline, last, onFocus }: NarrativeRowProps) {
  const [focus, setFocus] = useState(false);

  const inputStyle = {
    width: '100%',
    border: 'none',
    background: 'transparent',
    padding: '4px 0',
    fontFamily: 'inherit',
    fontSize: 17,
    lineHeight: 1.5,
    color: ARK_TOKENS.ink,
    outline: 'none',
    borderBottom: `1px solid ${focus ? ARK_TOKENS.azure : 'transparent'}`,
  };

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'baseline',
        padding: '10px 0',
        borderBottom: last ? 'none' : `1px solid ${ARK_TOKENS.border}`,
      }}
    >
      <div style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, fontWeight: 500, paddingTop: 4 }}>{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={1}
          onFocus={() => { setFocus(true); onFocus?.(); }}
          onBlur={() => setFocus(false)}
          style={{ ...inputStyle, resize: 'none' }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => { setFocus(true); onFocus?.(); }}
          onBlur={() => setFocus(false)}
          style={inputStyle}
        />
      )}
    </div>
  );
}
