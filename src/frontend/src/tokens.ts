export const ARK_TOKENS = {
  // Neutrals — cool/slate axis
  bg: '#F1F4F9',
  surface: '#ffffff',
  surfaceAlt: '#F5F7FA',
  border: '#E3E6ED',
  borderStrong: '#C5CAD3',
  ink: '#212332',
  inkMuted: '#69707F',
  inkSubtle: '#9AA0AC',

  // Sidebar / dark surfaces
  navBg: '#212C3D',
  navBgAlt: '#1A2333',
  navInk: '#E1E5EE',
  navInkMuted: '#8A93A6',

  // Brand — Camtek Bondi Blue + marker red
  azure: '#008FBE',
  azureDark: '#006C90',
  azureLight: '#D6EEF7',
  azureFaint: '#F1F8FB',
  markerRed: '#E11A22',
  markerRedDark: '#B81219',
  markerRedLight: '#FDE4E5',

  // Status
  success: '#1FAB6B',
  successBg: '#E3F6EE',
  warning: '#F4A100',
  warningBg: '#FFF3D6',
  danger: '#E11A22',
  dangerBg: '#FDE4E5',
  info: '#008FBE',
  infoBg: '#D6EEF7',

  // AI accent
  ai: '#7E57C2',
  aiLight: '#EDE7F6',
  aiFaint: '#F6F3FB',

  // Radius & shadow
  r: 4,
  r2: 6,
  r3: 8,
  shadow1: '0 1px 2px rgba(33,35,50,0.08), 0 1px 3px rgba(33,35,50,0.06)',
  shadow2: '0 2px 6px rgba(33,35,50,0.10), 0 4px 12px rgba(33,35,50,0.06)',
  shadow3: '0 8px 24px rgba(33,35,50,0.14), 0 2px 6px rgba(33,35,50,0.08)',

  font: 'Roboto, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"Roboto Mono", "SF Mono", Consolas, monospace',
} as const;

export type ArkTokens = typeof ARK_TOKENS;
