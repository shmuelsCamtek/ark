import { useState, type CSSProperties } from 'react';
import { ARK_TOKENS } from '../../tokens';

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  rows?: number;
  autoFocus?: boolean;
}

export function TextArea({ value, onChange, placeholder, style, rows = 3, autoFocus }: TextAreaProps) {
  const [focus, setFocus] = useState(false);

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      autoFocus={autoFocus}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: '100%',
        resize: 'vertical',
        background: ARK_TOKENS.surface,
        border: `1px solid ${focus ? ARK_TOKENS.azure : ARK_TOKENS.borderStrong}`,
        borderRadius: ARK_TOKENS.r,
        padding: '8px 10px',
        lineHeight: 1.5,
        transition: 'border-color 0.12s',
        fontFamily: 'inherit',
        ...style,
      }}
    />
  );
}
