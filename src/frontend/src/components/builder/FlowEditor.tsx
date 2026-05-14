import { useEffect, useRef, useState } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { FlowPreview } from './FlowPreview';

interface FlowEditorProps {
  value: string;
  onChange: (v: string) => void;
  onActiveFocus?: () => void;
}

export function FlowEditor({ value, onChange, onActiveFocus }: FlowEditorProps) {
  const [focused, setFocused] = useState(false);
  const [hoverEdit, setHoverEdit] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused) taRef.current?.focus();
  }, [focused]);

  if (focused) {
    const rows = Math.min(16, Math.max(6, value.split('\n').length + 1));
    return (
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={'```mermaid\nsequenceDiagram\n  User->>System: ...\n```'}
        onFocus={() => onActiveFocus?.()}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          resize: 'vertical',
          background: ARK_TOKENS.surface,
          border: `1px solid ${ARK_TOKENS.azure}`,
          borderRadius: ARK_TOKENS.r,
          padding: '8px 10px',
          fontSize: ARK_TOKENS.type.body,
          lineHeight: ARK_TOKENS.leading.normal,
          fontFamily: ARK_TOKENS.mono,
          outline: 'none',
        }}
      />
    );
  }

  const empty = !value.trim();
  return (
    <div
      onClick={() => {
        setFocused(true);
        onActiveFocus?.();
      }}
      onMouseEnter={() => setHoverEdit(true)}
      onMouseLeave={() => setHoverEdit(false)}
      style={{
        position: 'relative',
        cursor: 'text',
        padding: 16,
        borderRadius: ARK_TOKENS.r2,
        border: `1px ${empty ? 'dashed' : 'solid'} ${hoverEdit ? ARK_TOKENS.azure : ARK_TOKENS.border}`,
        background: empty ? 'transparent' : ARK_TOKENS.surfaceAlt,
        minHeight: 72,
        transition: 'border-color 0.12s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: ARK_TOKENS.type.micro,
            color: ARK_TOKENS.inkSubtle,
            fontWeight: ARK_TOKENS.weight.semibold,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          Preview
        </div>
        {hoverEdit && !empty && (
          <div
            style={{
              fontSize: ARK_TOKENS.type.micro,
              color: ARK_TOKENS.azure,
              fontWeight: ARK_TOKENS.weight.semibold,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            }}
          >
            Click to edit
          </div>
        )}
      </div>
      {empty ? (
        <div style={{ color: ARK_TOKENS.inkSubtle, fontSize: ARK_TOKENS.type.label }}>
          Click to add a flow diagram
        </div>
      ) : (
        <FlowPreview value={value} />
      )}
    </div>
  );
}
