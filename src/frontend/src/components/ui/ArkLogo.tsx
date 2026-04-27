import { ARK_TOKENS } from '../../tokens';

interface ArkLogoProps {
  size?: number;
}

export function ArkLogo({ size = 24 }: ArkLogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill={ARK_TOKENS.azure} />
        <path d="M6 17L12 6l6 11h-3l-3-5-3 5H6z" fill="#fff" />
        <circle cx="12" cy="14" r="1.4" fill={ARK_TOKENS.markerRed} />
      </svg>
      <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0, color: ARK_TOKENS.ink }}>Ark</span>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          color: ARK_TOKENS.inkSubtle,
          padding: '2px 6px',
          background: ARK_TOKENS.surfaceAlt,
          borderRadius: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Story Studio
      </span>
    </div>
  );
}
