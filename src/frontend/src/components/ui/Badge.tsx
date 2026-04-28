import { type ReactNode, type CSSProperties } from 'react';
import { ARK_TOKENS } from '../../tokens';

type BadgeTone = 'default' | 'azure' | 'success' | 'warning' | 'danger' | 'ai';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  style?: CSSProperties;
}

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  default: { bg: ARK_TOKENS.surfaceAlt, fg: ARK_TOKENS.inkMuted },
  azure: { bg: ARK_TOKENS.azureLight, fg: ARK_TOKENS.azure },
  success: { bg: ARK_TOKENS.successBg, fg: ARK_TOKENS.success },
  warning: { bg: ARK_TOKENS.warningBg, fg: '#8a6d00' },
  danger: { bg: ARK_TOKENS.dangerBg, fg: ARK_TOKENS.danger },
  ai: { bg: ARK_TOKENS.aiLight, fg: ARK_TOKENS.ai },
};

export function Badge({ tone = 'default', children, icon, style }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 6,
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
