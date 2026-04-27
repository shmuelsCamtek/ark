interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
}

const COLORS = ['#008FBE', '#8764b8', '#107c10', '#E11A22', '#006C90', '#498205'];

export function Avatar({ name, size = 28, color }: AvatarProps) {
  const initials = (name || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const bg = color || COLORS[(name || '').length % COLORS.length];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
