interface IcoProps {
  size?: number;
}

interface DirIcoProps extends IcoProps {
  dir?: 'right' | 'down' | 'left' | 'up';
}

export const Ico = {
  chevron: ({ size = 12, dir = 'right' }: DirIcoProps) => {
    const rot = { right: 0, down: 90, left: 180, up: 270 }[dir!];
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${rot}deg)` }}>
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
  check: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12 13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  x: ({ size = 12 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  plus: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  sparkle: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" />
    </svg>
  ),
  link: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M7 9l2 2M9 4l2-2a2.8 2.8 0 014 4l-2 2M7 12l-2 2a2.8 2.8 0 01-4-4l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  info: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7v4M8 5.2v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  warn: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2l6.5 11.5H1.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7v3M8 12v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  user: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 14c.8-2.5 3-4 5.5-4s4.7 1.5 5.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  target: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
  heart: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 13.5S2 10 2 6a3 3 0 015-2.2A3 3 0 0114 6c0 4-6 7.5-6 7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  list: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  search: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  bolt: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" />
    </svg>
  ),
  doc: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 1h7l3 3v11H3V1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  arrow: ({ size = 14, dir = 'right' }: DirIcoProps) => {
    const rot = { right: 0, down: 90, left: 180, up: 270 }[dir!];
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${rot}deg)` }}>
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
  edit: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 14l3-1L13 5l-2-2-8 8-1 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  copy: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 11V3a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  gear: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 1v2M8 13v2M15 8h-2M3 8H1M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4M12.5 12.5l-1.4-1.4M4.9 4.9L3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  tree: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9.5" y="6.5" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9.5" y="11.5" width="5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5.5V9a1 1 0 001 1h4.5M4 9v3.5a1 1 0 001 1h4.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  board: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 5.5h13M5.5 5.5v8M10.5 5.5v8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  file: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 1.5h6.5L13 5v9.5H3v-13z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.5 1.5V5H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  image: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6" cy="6.5" r="1.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 12l3.5-3 3 2.5L11 8l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  upload: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 11V2M4.5 5.5L8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11v2.5h11V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  refresh: ({ size = 14 }: IcoProps) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 1.5l1.5 2.5-2.5 1M5 14.5l-1.5-2.5 2.5-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
