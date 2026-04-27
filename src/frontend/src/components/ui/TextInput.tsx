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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: ARK_TOKENS.ink }}>{label}</label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: ARK_TOKENS.surface,
          border: `1px solid ${focus ? ARK_TOKENS.azure : error ? ARK_TOKENS.danger : ARK_TOKENS.borderStrong}`,
          borderRadius: ARK_TOKENS.r,
          padding: '0 8px',
          height: 32,
          transition: 'border-color 0.12s',
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
          style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', outline: 'none', ...style }}
        />
      </div>
      {hint && !error && <span style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: ARK_TOKENS.danger }}>{error}</span>}
    </div>
  );
}
