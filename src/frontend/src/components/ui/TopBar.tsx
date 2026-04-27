import { Fragment, type ReactNode } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { useApp } from '../../context/AppContext';
import { ArkLogo } from './ArkLogo';
import { Avatar } from './Avatar';
import { Ico } from './icons';

interface TopBarProps {
  breadcrumbs?: string[];
  rightActions?: ReactNode;
  onBack?: () => void;
}

export function TopBar({ breadcrumbs = [], rightActions, onBack: _onBack }: TopBarProps) {
  const { user } = useApp();

  return (
    <div
      style={{
        height: 48,
        borderBottom: `1px solid ${ARK_TOKENS.border}`,
        background: ARK_TOKENS.surface,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        flexShrink: 0,
      }}
    >
      <Avatar name={user?.displayName ?? '?'} size={28} />
      <ArkLogo />
      {breadcrumbs.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 12,
            fontSize: 13,
            color: ARK_TOKENS.inkMuted,
          }}
        >
          {breadcrumbs.map((b, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span style={{ color: ARK_TOKENS.inkSubtle }}>
                  <Ico.chevron size={10} />
                </span>
              )}
              <span
                style={{
                  color: i === breadcrumbs.length - 1 ? ARK_TOKENS.ink : ARK_TOKENS.inkMuted,
                  fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                }}
              >
                {b}
              </span>
            </Fragment>
          ))}
        </div>
      )}
      <div style={{ flex: 1 }} />
      {rightActions}
    </div>
  );
}
