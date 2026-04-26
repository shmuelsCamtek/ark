// Shared design tokens and primitives
// Material Admin Pro-inspired chassis (Roboto + Material elevations + cooler greys)
// with Camtek accents preserved (Bondi Blue + marker red).

const ARK_TOKENS = {
  // Material Admin Pro neutrals — cooler, slate-tinted greys
  bg: '#F1F4F9',
  surface: '#ffffff',
  surfaceAlt: '#F5F7FA',
  border: '#E3E6ED',
  borderStrong: '#C5CAD3',
  ink: '#212332',
  inkMuted: '#69707F',
  inkSubtle: '#9AA0AC',

  // Sidebar / dark surfaces (Material Admin Pro signature)
  navBg: '#212C3D',
  navBgAlt: '#1A2333',
  navInk: '#E1E5EE',
  navInkMuted: '#8A93A6',

  // Brand — Camtek Bondi Blue (primary) + marker red (accent from footer icon)
  azure: '#008FBE',
  azureDark: '#006C90',
  azureLight: '#D6EEF7',
  azureFaint: '#F1F8FB',
  // Camtek marker red — pulled from the footer crosshair icon
  markerRed: '#E11A22',
  markerRedDark: '#B81219',
  markerRedLight: '#FDE4E5',

  // Status (Material-leaning)
  success: '#1FAB6B',
  successBg: '#E3F6EE',
  warning: '#F4A100',
  warningBg: '#FFF3D6',
  danger: '#E11A22',
  dangerBg: '#FDE4E5',
  info: '#008FBE',
  infoBg: '#D6EEF7',

  // AI accent — distinct from azure brand
  ai: '#7E57C2',
  aiLight: '#EDE7F6',
  aiFaint: '#F6F3FB',

  // Radius & shadow — Material elevations (sharper corners, clearer drop)
  r: 4,
  r2: 6,
  r3: 8,
  shadow1: '0 1px 2px rgba(33,35,50,0.08), 0 1px 3px rgba(33,35,50,0.06)',
  shadow2: '0 2px 6px rgba(33,35,50,0.10), 0 4px 12px rgba(33,35,50,0.06)',
  shadow3: '0 8px 24px rgba(33,35,50,0.14), 0 2px 6px rgba(33,35,50,0.08)',

  font: 'Roboto, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: '"Roboto Mono", "SF Mono", Consolas, monospace',
};

// Global styles injection
if (typeof document !== 'undefined' && !document.getElementById('ark-styles')) {
  const s = document.createElement('style');
  s.id = 'ark-styles';
  s.textContent = `
    .ark-root { font-family: ${ARK_TOKENS.font}; color: ${ARK_TOKENS.ink}; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; letter-spacing: 0.01em; }
    .ark-root *, .ark-root *::before, .ark-root *::after { box-sizing: border-box; }
    .ark-root button { font-family: inherit; font-size: inherit; }
    .ark-root input, .ark-root textarea, .ark-root select { font-family: inherit; font-size: 14px; color: ${ARK_TOKENS.ink}; }
    .ark-root input:focus, .ark-root textarea:focus, .ark-root select:focus { outline: none; }
    .ark-root ::placeholder { color: ${ARK_TOKENS.inkSubtle}; }
    .ark-root h1, .ark-root h2, .ark-root h3 { font-weight: 500; letter-spacing: -0.01em; }
    .ark-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
    .ark-scroll::-webkit-scrollbar-thumb { background: ${ARK_TOKENS.borderStrong}; border-radius: 5px; border: 2px solid transparent; background-clip: padding-box; }
    .ark-scroll::-webkit-scrollbar-thumb:hover { background: ${ARK_TOKENS.inkSubtle}; background-clip: padding-box; border: 2px solid transparent; }
    .ark-scroll::-webkit-scrollbar-track { background: transparent; }
    @keyframes ark-spin { to { transform: rotate(360deg); } }
    @keyframes ark-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes ark-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes ark-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ark-slidein { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
    .ark-fadein { animation: ark-fadein 0.25s ease-out; }
  `;
  document.head.appendChild(s);
}

// Azure DevOps logo mark
function AzureMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M9 1L1 15h5l3-5 3 5h5L9 1z" fill="#0078d4"/>
      <path d="M9 1l4 8-7 6h11L9 1z" fill="#50e6ff" opacity="0.6"/>
    </svg>
  );
}

// Ark logo \u2014 Camtek-themed
function ArkLogo({ size = 24 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill={ARK_TOKENS.azure}/>
        <path d="M6 17L12 6l6 11h-3l-3-5-3 5H6z" fill="#fff"/>
        <circle cx="12" cy="14" r="1.4" fill={ARK_TOKENS.markerRed}/>
      </svg>
      <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0, color: ARK_TOKENS.ink }}>Ark</span>
      <span style={{ fontSize: 10.5, fontWeight: 500, color: ARK_TOKENS.inkSubtle, padding: '2px 6px', background: ARK_TOKENS.surfaceAlt, borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Story Studio</span>
    </div>
  );
}

// Buttons — Material-style: uppercase, tighter tracking, elevation on primary
function Btn({ variant = 'default', size = 'md', icon, children, onClick, disabled, style, fullWidth, type }) {
  const sizes = {
    sm: { padding: '4px 12px', fontSize: 11.5, height: 26 },
    md: { padding: '6px 16px', fontSize: 13, height: 34 },
    lg: { padding: '8px 22px', fontSize: 13.5, height: 40 },
  };
  const variants = {
    primary: { background: ARK_TOKENS.azure, color: '#fff', border: '1px solid ' + ARK_TOKENS.azure, boxShadow: ARK_TOKENS.shadow1 },
    default: { background: ARK_TOKENS.surface, color: ARK_TOKENS.ink, border: '1px solid ' + ARK_TOKENS.borderStrong },
    ghost:   { background: 'transparent', color: ARK_TOKENS.azure, border: '1px solid transparent' },
    ai:      { background: ARK_TOKENS.ai, color: '#fff', border: '1px solid ' + ARK_TOKENS.ai, boxShadow: ARK_TOKENS.shadow1 },
    danger:  { background: 'transparent', color: ARK_TOKENS.danger, border: '1px solid ' + ARK_TOKENS.borderStrong },
  };
  const [hover, setHover] = React.useState(false);
  const hoverBg = {
    primary: ARK_TOKENS.azureDark,
    default: ARK_TOKENS.surfaceAlt,
    ghost: ARK_TOKENS.azureFaint,
    ai: '#6E4FA0',
    danger: ARK_TOKENS.dangerBg,
  };
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

// Icon helpers — Fluent-style stroke icons
const Ico = {
  chevron: ({ size = 12, dir = 'right' }) => {
    const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
    return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${rot}deg)` }}><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  },
  check: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  x: ({ size = 12 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  plus: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  sparkle: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"/></svg>,
  link: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M7 9l2 2M9 4l2-2a2.8 2.8 0 014 4l-2 2M7 12l-2 2a2.8 2.8 0 01-4-4l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  info: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 7v4M8 5.2v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  warn: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 2l6.5 11.5H1.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 7v3M8 12v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  user: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 14c.8-2.5 3-4 5.5-4s4.7 1.5 5.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  target: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg>,
  heart: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 13.5S2 10 2 6a3 3 0 015-2.2A3 3 0 0114 6c0 4-6 7.5-6 7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  list: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  search: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  bolt: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L3 9h4l-1 6 6-8H8l1-6z"/></svg>,
  doc: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 1h7l3 3v11H3V1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/></svg>,
  arrow: ({ size = 14, dir = 'right' }) => {
    const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
    return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${rot}deg)` }}><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  },
  edit: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M2 14l3-1L13 5l-2-2-8 8-1 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  copy: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M3 11V3a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.3"/></svg>,
  gear: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M15 8h-2M3 8H1M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4M12.5 12.5l-1.4-1.4M4.9 4.9L3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  tree: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9.5" y="6.5" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9.5" y="11.5" width="5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5.5V9a1 1 0 001 1h4.5M4 9v3.5a1 1 0 001 1h4.5" stroke="currentColor" strokeWidth="1.3"/></svg>,
  board: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 5.5h13M5.5 5.5v8M10.5 5.5v8" stroke="currentColor" strokeWidth="1.3"/></svg>,
  file: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 1.5h6.5L13 5v9.5H3v-13z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  image: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.3"/><circle cx="6" cy="6.5" r="1.3" stroke="currentColor" strokeWidth="1.3"/><path d="M2 12l3.5-3 3 2.5L11 8l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  upload: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 11V2M4.5 5.5L8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 11v2.5h11V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  refresh: ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M11 1.5l1.5 2.5-2.5 1M5 14.5l-1.5-2.5 2.5-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// Badge / Pill
function Badge({ tone = 'default', children, icon, style }) {
  const tones = {
    default: { bg: ARK_TOKENS.surfaceAlt, fg: ARK_TOKENS.inkMuted },
    azure: { bg: ARK_TOKENS.azureLight, fg: ARK_TOKENS.azure },
    success: { bg: ARK_TOKENS.successBg, fg: ARK_TOKENS.success },
    warning: { bg: ARK_TOKENS.warningBg, fg: '#8a6d00' },
    danger: { bg: ARK_TOKENS.dangerBg, fg: ARK_TOKENS.danger },
    ai: { bg: ARK_TOKENS.aiLight, fg: ARK_TOKENS.ai },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', background: t.bg, color: t.fg,
      fontSize: 11, fontWeight: 600, borderRadius: 10, letterSpacing: 0.1,
      ...style,
    }}>
      {icon}{children}
    </span>
  );
}

// Input
function TextInput({ value, onChange, placeholder, style, label, hint, error, icon }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: ARK_TOKENS.ink }}>{label}</label>}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: ARK_TOKENS.surface,
        border: `1px solid ${focus ? ARK_TOKENS.azure : error ? ARK_TOKENS.danger : ARK_TOKENS.borderStrong}`,
        borderRadius: ARK_TOKENS.r,
        padding: '0 8px', height: 32,
        transition: 'border-color 0.12s',
      }}>
        {icon && <span style={{ color: ARK_TOKENS.inkSubtle, marginRight: 6, display: 'flex' }}>{icon}</span>}
        <input
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, border: 'none', background: 'transparent', height: '100%', outline: 'none', ...style }}
        />
      </div>
      {hint && !error && <span style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: ARK_TOKENS.danger }}>{error}</span>}
    </div>
  );
}

function TextArea({ value, onChange, placeholder, style, rows = 3, autoFocus }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      autoFocus={autoFocus}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        width: '100%', resize: 'vertical',
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

// Avatar
function Avatar({ name, size = 28, color }) {
  const initials = (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#008FBE', '#8764b8', '#107c10', '#E11A22', '#006C90', '#498205'];
  const bg = color || colors[(name || '').length % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 600,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

// Check state dot
function StateDot({ state }) {
  // state: 'pending' | 'active' | 'done' | 'warn'
  const conf = {
    pending: { ring: ARK_TOKENS.borderStrong, fill: 'transparent' },
    active: { ring: ARK_TOKENS.azure, fill: ARK_TOKENS.azureLight },
    done: { ring: ARK_TOKENS.success, fill: ARK_TOKENS.success },
    warn: { ring: ARK_TOKENS.warning, fill: ARK_TOKENS.warningBg },
  }[state];
  return (
    <div style={{
      width: 18, height: 18, borderRadius: 9,
      border: `1.5px solid ${conf.ring}`,
      background: conf.fill,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      transition: 'all 0.2s',
    }}>
      {state === 'done' && <span style={{ color: '#fff' }}><Ico.check size={10} /></span>}
      {state === 'active' && <div style={{ width: 6, height: 6, borderRadius: 3, background: ARK_TOKENS.azure }} />}
      {state === 'warn' && <span style={{ color: ARK_TOKENS.warning, fontSize: 10, fontWeight: 700 }}>!</span>}
    </div>
  );
}

// App chrome — top bar
function TopBar({ breadcrumbs = [], rightActions, onBack }) {
  return (
    <div style={{
      height: 48, borderBottom: `1px solid ${ARK_TOKENS.border}`,
      background: ARK_TOKENS.surface,
      display: 'flex', alignItems: 'center', padding: '0 16px',
      gap: 16, flexShrink: 0,
    }}>
      <ArkLogo />
      {breadcrumbs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, fontSize: 13, color: ARK_TOKENS.inkMuted }}>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: ARK_TOKENS.inkSubtle }}><Ico.chevron size={10} /></span>}
              <span style={{ color: i === breadcrumbs.length - 1 ? ARK_TOKENS.ink : ARK_TOKENS.inkMuted, fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 }}>{b}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{ flex: 1 }} />
      {rightActions}
      <Avatar name="Maya Kowalski" size={28} />
    </div>
  );
}

Object.assign(window, { ARK_TOKENS, AzureMark, ArkLogo, Btn, Ico, Badge, TextInput, TextArea, Avatar, StateDot, TopBar });
