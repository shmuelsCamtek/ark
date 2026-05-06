import { Fragment, useState, type ReactNode } from 'react';
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
  const [userOpen, setUserOpen] = useState(false);

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
        position: 'relative',
        zIndex: 20,
      }}
    >
      <div
        onMouseEnter={() => setUserOpen(true)}
        onMouseLeave={() => setUserOpen(false)}
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      >
        <Avatar name={user?.displayName ?? '?'} size={28} />
        {userOpen && user && (
          <div
            className="ark-fadein"
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              left: 0,
              minWidth: 240,
              background: ARK_TOKENS.surface,
              border: `1px solid ${ARK_TOKENS.border}`,
              borderRadius: ARK_TOKENS.r2,
              boxShadow: ARK_TOKENS.shadow3,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              zIndex: 30,
            }}
          >
            <Avatar name={user.displayName} size={40} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 14, fontWeight: 600, color: ARK_TOKENS.ink,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {user.displayName}
              </div>
              {user.email && (
                <div
                  title={user.email}
                  style={{
                    fontSize: 12, color: ARK_TOKENS.inkSubtle, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {user.email}
                </div>
              )}
              <div style={{ fontSize: 11, color: ARK_TOKENS.success, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, background: ARK_TOKENS.success, borderRadius: 3 }} />
                Signed in
              </div>
            </div>
          </div>
        )}
      </div>
      <ArkLogo />
      {breadcrumbs.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 12,
            fontSize: 16,
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
