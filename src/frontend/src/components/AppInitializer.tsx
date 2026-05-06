import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { ARK_TOKENS } from '../tokens';
import { Btn, Ico } from './ui';
import type { UserProfile } from '../types';

interface DeviceCode {
  userCode: string;
  verificationUri: string;
  message: string;
}

type PollResult =
  | { status: 'pending' }
  | { status: 'authenticated'; profile: UserProfile }
  | { status: 'expired' }
  | { status: 'error'; error: string };

const POLL_INTERVAL_MS = 5000;

export function AppInitializer({ children }: { children: ReactNode }) {
  const { setUser, setAuthStatus, authStatus } = useApp();
  const [device, setDevice] = useState<DeviceCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelRef.current = false;
    void initAuth();
    return () => {
      cancelRef.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initAuth() {
    setAuthStatus('loading');
    setErrorMessage(null);

    const meRes = await fetch('/api/auth/me');
    if (cancelRef.current) return;
    if (meRes.ok) {
      const profile = (await meRes.json()) as UserProfile;
      setUser(profile);
      setDevice(null);
      setAuthStatus('authenticated');
      return;
    }

    await startDeviceFlow();
  }

  async function startDeviceFlow() {
    setAuthStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/device/start', { method: 'POST' });
      if (cancelRef.current) return;
      if (!res.ok) {
        setAuthStatus('unauthenticated');
        setErrorMessage('Could not start sign-in. Try again.');
        return;
      }
      const code = (await res.json()) as DeviceCode;
      setDevice(code);
      schedulePoll();
    } catch (err) {
      console.error('[auth] start failed', err);
      if (!cancelRef.current) {
        setAuthStatus('unauthenticated');
        setErrorMessage('Network error. Try again.');
      }
    }
  }

  function schedulePoll() {
    pollTimer.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
  }

  async function pollOnce() {
    if (cancelRef.current) return;
    try {
      const res = await fetch('/api/auth/device/poll', { method: 'POST' });
      if (cancelRef.current) return;
      const data = (await res.json()) as PollResult;
      if (data.status === 'pending') {
        schedulePoll();
        return;
      }
      if (data.status === 'authenticated') {
        setUser(data.profile);
        setDevice(null);
        setAuthStatus('authenticated');
        return;
      }
      // expired or error
      setDevice(null);
      setAuthStatus('unauthenticated');
      setErrorMessage(
        data.status === 'expired'
          ? 'Sign-in code expired. Try again.'
          : `Sign-in failed: ${data.error}`,
      );
    } catch (err) {
      console.error('[auth] poll failed', err);
      schedulePoll();
    }
  }

  if (authStatus === 'authenticated') return <>{children}</>;
  if (device) return <FullScreenDeviceCode device={device} onCancel={() => location.reload()} />;
  if (authStatus === 'loading') return <FullScreenLoading />;
  return <FullScreenSignIn onRetry={() => void startDeviceFlow()} errorMessage={errorMessage} />;
}

function FullScreenLoading() {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: ARK_TOKENS.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}
    >
      <div
        style={{
          width: 36, height: 36,
          border: `3px solid ${ARK_TOKENS.borderStrong}`,
          borderTopColor: ARK_TOKENS.azure,
          borderRadius: '50%',
          animation: 'ark-spin 0.8s linear infinite',
        }}
      />
      <div style={{ fontSize: 15, color: ARK_TOKENS.inkMuted }}>Signing in to Azure DevOps…</div>
      <style>{`@keyframes ark-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function FullScreenDeviceCode({ device, onCancel }: { device: DeviceCode; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(device.userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: ARK_TOKENS.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        style={{
          background: ARK_TOKENS.surface,
          border: `1px solid ${ARK_TOKENS.border}`,
          borderRadius: ARK_TOKENS.r2,
          padding: '40px 32px',
          maxWidth: 480,
          width: '100%',
          boxShadow: ARK_TOKENS.shadow1,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 48, height: 48, margin: '0 auto 16px',
            borderRadius: 24, background: ARK_TOKENS.azureFaint,
            color: ARK_TOKENS.azure,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ico.user size={20} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Sign in to continue</div>
        <div style={{ fontSize: 15, color: ARK_TOKENS.inkMuted, marginBottom: 24, lineHeight: 1.5 }}>
          Open the link below and enter this one-time code. We&rsquo;ll finish signing you in automatically.
        </div>

        <div
          style={{
            background: ARK_TOKENS.surfaceAlt,
            border: `1px dashed ${ARK_TOKENS.borderStrong}`,
            borderRadius: ARK_TOKENS.r,
            padding: '16px 20px',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              color: ARK_TOKENS.ink,
            }}
          >
            {device.userCode}
          </span>
          <Btn size="sm" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Btn>
        </div>

        <a
          href={device.verificationUri}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            color: ARK_TOKENS.azure,
            fontSize: 15,
            textDecoration: 'none',
            marginBottom: 20,
            wordBreak: 'break-all',
          }}
        >
          {device.verificationUri} ↗
        </a>

        <div style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle, marginBottom: 8 }}>
          Waiting for you to complete sign-in…
        </div>

        <button
          onClick={onCancel}
          style={{
            background: 'transparent', border: 'none',
            color: ARK_TOKENS.inkMuted, fontSize: 13,
            cursor: 'pointer', padding: 4,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FullScreenSignIn({ onRetry, errorMessage }: { onRetry: () => void; errorMessage: string | null }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: ARK_TOKENS.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        style={{
          background: ARK_TOKENS.surface,
          border: `1px solid ${ARK_TOKENS.border}`,
          borderRadius: ARK_TOKENS.r2,
          padding: '40px 32px',
          textAlign: 'center',
          maxWidth: 440,
          boxShadow: ARK_TOKENS.shadow1,
        }}
      >
        <div
          style={{
            width: 48, height: 48, margin: '0 auto 16px',
            borderRadius: 24, background: ARK_TOKENS.azureFaint,
            color: ARK_TOKENS.azure,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ico.user size={20} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>Sign in required</div>
        <div style={{ fontSize: 15, color: ARK_TOKENS.inkMuted, marginBottom: 20, lineHeight: 1.5 }}>
          {errorMessage ?? 'Sign in to Azure DevOps to continue.'}
        </div>
        <Btn variant="primary" size="lg" onClick={onRetry}>
          Sign in to Azure DevOps
        </Btn>
      </div>
    </div>
  );
}
