import { type ReactNode } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';

interface FieldProps {
  label: string;
  hint?: string;
  filled: boolean;
  active: boolean;
  onActivate: () => void;
  children: ReactNode;
  last?: boolean;
}

export function Field({ label, hint, filled, active, onActivate, children, last }: FieldProps) {
  return (
    <div
      onClick={onActivate}
      style={{
        paddingLeft: 16,
        marginLeft: -16,
        marginBottom: last ? 0 : 28,
        borderLeft: `2px solid ${active ? ARK_TOKENS.azure : 'transparent'}`,
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: ARK_TOKENS.ink }}>{label}</h3>
        {filled && (
          <span style={{ color: ARK_TOKENS.success, display: 'flex' }}>
            <Ico.check size={12} />
          </span>
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}
