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
  const { user, setUser, setAuthStatus } = useApp();
  const [userOpen, setUserOpen] = useState(false);
  const [signOutHover, setSignOutHover] = useState(false);

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('[auth] logout failed', err);
    }
    setUserOpen(false);
    setUser(null);
    setAuthStatus('unauthenticated');
  }

  return (
    <div
      style={{
        height: 44,
        borderBottom: `1px solid ${ARK_TOKENS.border}`,
        background: ARK_TOKENS.surface,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${ARK_TOKENS.space.lg}px`,
        gap: ARK_TOKENS.space.lg,
        flexShrink: 0,
        position: 'relative',
        zIndex: 20,
        fontSize: ARK_TOKENS.type.body,
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
              top: '100%',
              left: 0,
              minWidth: 240,
              background: ARK_TOKENS.surface,
              border: `1px solid ${ARK_TOKENS.border}`,
              borderRadius: ARK_TOKENS.r2,
              boxShadow: ARK_TOKENS.shadow3,
              padding: ARK_TOKENS.space.md,
              display: 'flex',
              flexDirection: 'column',
              gap: ARK_TOKENS.space.sm,
              zIndex: 30,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: ARK_TOKENS.space.md }}>
              <Avatar name={user.displayName} size={36} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: ARK_TOKENS.type.h2, fontWeight: ARK_TOKENS.weight.semibold, color: ARK_TOKENS.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {user.displayName}
                </div>
                {user.email && (
                  <div
                    title={user.email}
                    style={{
                      fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {user.email}
                  </div>
                )}
                <div style={{ fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.success, marginTop: 4, display: 'flex', alignItems: 'center', gap: ARK_TOKENS.space.xs }}>
                  <span style={{ width: 6, height: 6, background: ARK_TOKENS.success, borderRadius: 3 }} />
                  Signed in
                </div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${ARK_TOKENS.border}`, paddingTop: ARK_TOKENS.space.sm }}>
              <button
                onClick={handleSignOut}
                onMouseEnter={() => setSignOutHover(true)}
                onMouseLeave={() => setSignOutHover(false)}
                style={{
                  width: '100%',
                  background: signOutHover ? ARK_TOKENS.surfaceAlt : 'transparent',
                  border: 'none',
                  padding: '6px 8px',
                  borderRadius: ARK_TOKENS.r,
                  color: signOutHover ? ARK_TOKENS.ink : ARK_TOKENS.inkMuted,
                  fontSize: ARK_TOKENS.type.body,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
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
            marginLeft: ARK_TOKENS.space.md,
            fontSize: ARK_TOKENS.type.body,
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
                  fontWeight: i === breadcrumbs.length - 1 ? ARK_TOKENS.weight.semibold : ARK_TOKENS.weight.regular,
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
