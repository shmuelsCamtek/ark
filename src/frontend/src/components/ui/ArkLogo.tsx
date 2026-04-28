import { ARK_TOKENS } from '../../tokens';

interface ArkLogoProps {
  size?: number;
}

export function ArkLogo({ size = 24 }: ArkLogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="url(#ark-grad)" />
        <path d="M6 17L12 6l6 11h-3l-3-5-3 5H6z" fill="#fff" />
        <circle cx="12" cy="14" r="1.4" fill="#fff" opacity="0.6" />
        <defs>
          <linearGradient id="ark-grad" x1="0" y1="0" x2="24" y2="24">
            <stop stopColor={ARK_TOKENS.azure} />
            <stop offset="1" stopColor={ARK_TOKENS.azureDark} />
          </linearGradient>
        </defs>
      </svg>
      <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: ARK_TOKENS.ink }}>Ark</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: ARK_TOKENS.inkSubtle,
          padding: '2px 8px',
          background: ARK_TOKENS.surfaceAlt,
          borderRadius: 6,
          border: `1px solid ${ARK_TOKENS.border}`,
          letterSpacing: '0.02em',
        }}
      >
        Story Studio
      </span>
    </div>
  );
}
