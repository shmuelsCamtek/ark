import { useState, type ReactNode, type CSSProperties, type ButtonHTMLAttributes } from 'react';
import { ARK_TOKENS } from '../../tokens';

type BtnVariant = 'primary' | 'default' | 'ghost' | 'ai' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  fullWidth?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
}

const sizes: Record<BtnSize, CSSProperties> = {
  sm: { padding: '4px 12px', fontSize: 11.5, height: 26 },
  md: { padding: '6px 16px', fontSize: 13, height: 34 },
  lg: { padding: '8px 22px', fontSize: 13.5, height: 40 },
};

const variants: Record<BtnVariant, CSSProperties> = {
  primary: { background: ARK_TOKENS.azure, color: '#fff', border: '1px solid ' + ARK_TOKENS.azure, boxShadow: ARK_TOKENS.shadow1 },
  default: { background: ARK_TOKENS.surface, color: ARK_TOKENS.ink, border: '1px solid ' + ARK_TOKENS.borderStrong },
  ghost: { background: 'transparent', color: ARK_TOKENS.azure, border: '1px solid transparent' },
  ai: { background: ARK_TOKENS.ai, color: '#fff', border: '1px solid ' + ARK_TOKENS.ai, boxShadow: ARK_TOKENS.shadow1 },
  danger: { background: 'transparent', color: ARK_TOKENS.danger, border: '1px solid ' + ARK_TOKENS.borderStrong },
};

const hoverBg: Record<BtnVariant, string> = {
  primary: ARK_TOKENS.azureDark,
  default: ARK_TOKENS.surfaceAlt,
  ghost: ARK_TOKENS.azureFaint,
  ai: '#6E4FA0',
  danger: ARK_TOKENS.dangerBg,
};

export function Btn({ variant = 'default', size = 'md', icon, children, onClick, disabled, style, fullWidth, type }: BtnProps) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sizes[size],
        ...variants[variant],
        background: hover && !disabled ? hoverBg[variant] : variants[variant].background,
        borderRadius: ARK_TOKENS.r,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : 'auto',
        transition: 'background 0.15s, box-shadow 0.15s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
