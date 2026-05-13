export const ARK_TOKENS = {
  // Neutrals — Basewell-inspired neutral scale
  bg: '#f5f5f5',
  surface: '#ffffff',
  surfaceAlt: '#fafafa',
  border: '#e5e5e5',
  borderStrong: '#d4d4d4',
  ink: '#0a0a0a',
  inkMuted: '#525252',
  inkSubtle: '#a3a3a3',

  // Sidebar / dark surfaces
  navBg: '#111111',
  navBgAlt: '#0a0a0a',
  navInk: '#fafafa',
  navInkMuted: '#a3a3a3',

  // Brand — Basewell blue gradient
  azure: '#1994FF',
  azureDark: '#157CFF',
  azureLight: '#dbeafe',
  azureFaint: '#eff6ff',
  markerRed: '#E11A22',
  markerRedDark: '#B81219',
  markerRedLight: '#FDE4E5',

  // Status
  success: '#10b981',
  successBg: '#ecfdf5',
  warning: '#f59e0b',
  warningBg: '#fffbeb',
  danger: '#ef4444',
  dangerBg: '#fef2f2',

  // AI accent
  ai: '#7E57C2',
  aiLight: '#EDE7F6',
  aiFaint: '#F6F3FB',

  // Radius & shadow — generous radii, blue-tinted layered shadows
  r: 8,
  r2: 12,
  r3: 16,
  shadow1: '0 1px 2px rgba(29,78,216,0.04), 0 1px 3px rgba(0,0,0,0.06)',
  shadow2: '0 5px 3px rgba(29,78,216,0.03), 0 10px 4px rgba(29,78,216,0.01), 0 2px 4px rgba(0,0,0,0.06)',
  shadow3: '0 15px 4px rgba(29,78,216,0.00), 0 10px 4px rgba(29,78,216,0.01), 0 5px 3px rgba(29,78,216,0.05), 0 2px 6px rgba(0,0,0,0.08)',

  font: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: '"SF Mono", "Roboto Mono", Consolas, monospace',

  type: {
    display: 22,
    h1: 18,
    h2: 15,
    body: 14,
    label: 13,
    micro: 12,
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  leading: { tight: 1.25, normal: 1.45 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
} as const;

export type ArkTokens = typeof ARK_TOKENS;
