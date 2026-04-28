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
  sm: { padding: '5px 14px', fontSize: 14, height: 28 },
  md: { padding: '7px 18px', fontSize: 16, height: 36 },
  lg: { padding: '10px 24px', fontSize: 17, height: 40 },
};

const variants: Record<BtnVariant, CSSProperties> = {
  primary: {
    background: `linear-gradient(135deg, ${ARK_TOKENS.azure}, ${ARK_TOKENS.azureDark})`,
    color: '#fff',
    border: 'none',
    boxShadow: ARK_TOKENS.shadow1,
  },
  default: {
    background: ARK_TOKENS.surface,
    color: ARK_TOKENS.ink,
    border: `1px solid ${ARK_TOKENS.borderStrong}`,
  },
  ghost: {
    background: 'transparent',
    color: ARK_TOKENS.ink,
    border: '1px solid transparent',
  },
  ai: {
    background: `linear-gradient(135deg, ${ARK_TOKENS.ai}, #6E4FA0)`,
    color: '#fff',
    border: 'none',
    boxShadow: ARK_TOKENS.shadow1,
  },
  danger: {
    background: 'transparent',
    color: ARK_TOKENS.danger,
    border: `1px solid ${ARK_TOKENS.borderStrong}`,
  },
};

const hoverStyles: Record<BtnVariant, CSSProperties> = {
  primary: { transform: 'scale(0.98)', boxShadow: ARK_TOKENS.shadow2 },
  default: { background: ARK_TOKENS.surfaceAlt, transform: 'scale(0.98)' },
  ghost: { background: ARK_TOKENS.surfaceAlt, transform: 'scale(0.98)' },
  ai: { transform: 'scale(0.98)', boxShadow: ARK_TOKENS.shadow2 },
  danger: { background: ARK_TOKENS.dangerBg, transform: 'scale(0.98)' },
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
        ...(hover && !disabled ? hoverStyles[variant] : {}),
        borderRadius: ARK_TOKENS.r,
        fontWeight: 500,
        letterSpacing: '0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : 'auto',
        transition: 'transform 150ms ease-in-out, box-shadow 150ms ease-in-out, background 150ms ease-in-out',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
