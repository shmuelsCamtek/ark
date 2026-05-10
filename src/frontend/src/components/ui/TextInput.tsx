import { useState, type ReactNode, type CSSProperties } from 'react';
import { ARK_TOKENS } from '../../tokens';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

export function TextInput({ value, onChange, placeholder, style, label, hint, error, icon }: TextInputProps) {
  const [focus, setFocus] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ARK_TOKENS.space.xs }}>
      {label && (
        <label style={{ fontSize: ARK_TOKENS.type.label, fontWeight: ARK_TOKENS.weight.semibold, color: ARK_TOKENS.ink }}>{label}</label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: ARK_TOKENS.surface,
          border: `1px solid ${focus ? ARK_TOKENS.azure : error ? ARK_TOKENS.danger : ARK_TOKENS.borderStrong}`,
          borderRadius: ARK_TOKENS.r,
          padding: '0 8px',
          height: 30,
          fontSize: ARK_TOKENS.type.body,
          transition: 'border-color 150ms ease-in-out, box-shadow 150ms ease-in-out',
        }}
      >
        {icon && (
          <span style={{ color: ARK_TOKENS.inkSubtle, marginRight: 6, display: 'flex' }}>{icon}</span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', outline: 'none', fontSize: 'inherit', ...style }}
        />
      </div>
      {hint && !error && <span style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle }}>{hint}</span>}
      {error && <span style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.danger }}>{error}</span>}
    </div>
  );
}
