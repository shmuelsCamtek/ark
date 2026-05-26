import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp, type AuthStatus } from '../context/AppContext';
import { ARK_TOKENS } from '../tokens';
import { ArkLogo, Btn, Ico, Modal } from './ui';
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

// navigator.clipboard.writeText only works in secure contexts (HTTPS or
// localhost). The VM serves over plain HTTP on the Camtek VPN, so on the
// deployed app it would throw "Cannot read properties of undefined" and the
// Copy button would silently fail. Fall back to execCommand('copy') via a
// hidden textarea, which still works in non-secure contexts. Must be called
// from within a user gesture.
async function copyToClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

export function AppInitializer({ children }: { children: ReactNode }) {
  const { setUser, setAuthStatus, authStatus } = useApp();
  const [device, setDevice] = useState<DeviceCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<Window | null>(null);

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

    setAuthStatus('unauthenticated');
  }

  function openSignInPopup(url: string): Window | null {
    const w = 520;
    const h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const win = window.open(
      url,
      'ark-azure-signin',
      `popup=yes,width=${w},height=${h},left=${left},top=${top}`,
    );
    popupRef.current = win;
    return win;
  }

  function handleSignInClick() {
    // Best-effort: copy the user_code once it arrives so the user can paste
    // it into the Microsoft popup. Runs after window.open below has stolen
    // focus, so it may not succeed in every browser/context — the modal's
    // Copy button is the always-available fallback.
    const flowPromise = startDeviceFlow();
    void flowPromise.then((code) => {
      if (!code?.userCode) return;
      void copyToClipboard(code.userCode);
    });

    openSignInPopup('about:blank');

    // The popup may sit on about:blank for several seconds while the backend
    // negotiates with Microsoft (and longer on networks that block one of the
    // Microsoft auth IP ranges, forcing fallbacks to alternative hostnames).
    // Render a minimal "Connecting…" page so the user knows it's working.
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.document.write(
          `<!doctype html><html><head><title>Signing in to Microsoft…</title>` +
            `<style>html,body{height:100%;margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f7f9fb;color:#1b2733}` +
            `.wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:18px;padding:24px;text-align:center}` +
            `.spin{width:36px;height:36px;border:3px solid #d0d7de;border-top-color:#008fbe;border-radius:50%;animation:s .8s linear infinite}` +
            `@keyframes s{to{transform:rotate(360deg)}}` +
            `.muted{color:#586675;font-size:13px;max-width:320px;line-height:1.4}</style></head>` +
            `<body><div class="wrap"><div class="spin"></div>` +
            `<div style="font-size:16px;font-weight:600">Connecting to Microsoft sign-in…</div>` +
            `<div class="muted">If this doesn't redirect in a few seconds, return to Ark and use the manual link in the sign-in card.</div>` +
            `</div></body></html>`,
        );
        popupRef.current.document.close();
      } catch {
        // Popup may have been closed or navigated away — best-effort only.
      }
    }
  }

  async function startDeviceFlow(): Promise<DeviceCode | null> {
    setAuthStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/device/start', { method: 'POST' });
      if (cancelRef.current) return null;
      if (!res.ok) {
        popupRef.current?.close();
        popupRef.current = null;
        setAuthStatus('unauthenticated');
        setErrorMessage('Could not start sign-in. Try again.');
        return null;
      }
      const code = (await res.json()) as DeviceCode;
      setDevice(code);
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.location.href = code.verificationUri;
      }
      schedulePoll();
      return code;
    } catch (err) {
      console.error('[auth] start failed', err);
      popupRef.current?.close();
      popupRef.current = null;
      if (!cancelRef.current) {
        setAuthStatus('unauthenticated');
        setErrorMessage('Network error. Try again.');
      }
      return null;
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
        try { popupRef.current?.close(); } catch { /* popup may already be closed */ }
        popupRef.current = null;
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
  return (
    <>
      <BrandSplash />
      <SignInModal
        device={device}
        authStatus={authStatus}
        errorMessage={errorMessage}
        onRetry={handleSignInClick}
        onCancel={() => location.reload()}
        onOpenPopup={openSignInPopup}
      />
    </>
  );
}

function BrandSplash() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: `linear-gradient(135deg, ${ARK_TOKENS.azureFaint}, ${ARK_TOKENS.bg})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 0,
      }}
    >
      <ArkLogo size={56} />
    </div>
  );
}

interface SignInModalProps {
  device: DeviceCode | null;
  authStatus: AuthStatus;
  errorMessage: string | null;
  onRetry: () => void;
  onCancel: () => void;
  onOpenPopup: (url: string) => Window | null;
}

function SignInModal({ device, authStatus, errorMessage, onRetry, onCancel, onOpenPopup }: SignInModalProps) {
  return (
    <Modal open onClose={() => {}} width={480} closeOnBackdrop={false} closeOnEscape={false}>
      <div style={{ padding: '40px 32px', textAlign: 'center' }}>
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
        {device ? (
          <DeviceCodeContent device={device} onCancel={onCancel} onOpenPopup={onOpenPopup} />
        ) : authStatus === 'loading' ? (
          <LoadingContent />
        ) : (
          <RetryContent errorMessage={errorMessage} onRetry={onRetry} />
        )}
      </div>
      <style>{`@keyframes ark-spin { to { transform: rotate(360deg); } }`}</style>
    </Modal>
  );
}

function LoadingContent() {
  return (
    <>
      <div style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, marginBottom: 16 }}>Signing in…</div>
      <div
        style={{
          width: 36, height: 36, margin: '0 auto',
          border: `3px solid ${ARK_TOKENS.borderStrong}`,
          borderTopColor: ARK_TOKENS.azure,
          borderRadius: '50%',
          animation: 'ark-spin 0.8s linear infinite',
        }}
      />
      <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, marginTop: 16 }}>
        Connecting to Azure DevOps…
      </div>
    </>
  );
}

function DeviceCodeContent({
  device,
  onCancel,
  onOpenPopup,
}: {
  device: DeviceCode;
  onCancel: () => void;
  onOpenPopup: (url: string) => Window | null;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void copyToClipboard(device.userCode).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <div style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, marginBottom: 6 }}>Sign in to continue</div>
      <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, marginBottom: 24, lineHeight: ARK_TOKENS.leading.normal }}>
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
            fontSize: 24, // intentionally above the type scale — one-time auth code retyped into a browser
            fontWeight: ARK_TOKENS.weight.semibold,
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

      <div style={{ marginBottom: 20 }}>
        <Btn
          variant="primary"
          size="lg"
          onClick={() => {
            void copyToClipboard(device.userCode).then((ok) => {
              if (!ok) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 4000);
            });
            onOpenPopup(device.verificationUri);
          }}
        >
          Open Microsoft sign-in
        </Btn>
        <div style={{ fontSize: ARK_TOKENS.type.label, color: copied ? ARK_TOKENS.success : ARK_TOKENS.inkSubtle, marginTop: 8 }}>
          {copied ? 'Code copied — paste it in the Microsoft popup (Ctrl+V)' : 'Opening will copy the code so you can paste it.'}
        </div>
        <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, marginTop: 8, wordBreak: 'break-all' }}>
          If the popup is blank, open <a href={device.verificationUri} target="_blank" rel="noreferrer" style={{ color: ARK_TOKENS.azure }}>{device.verificationUri}</a> manually.
        </div>
      </div>

      <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, marginBottom: 8 }}>
        Waiting for you to complete sign-in…
      </div>

      <button
        onClick={onCancel}
        style={{
          background: 'transparent', border: 'none',
          color: ARK_TOKENS.inkMuted, fontSize: ARK_TOKENS.type.label,
          cursor: 'pointer', padding: 4,
        }}
      >
        Cancel
      </button>
    </>
  );
}

function RetryContent({ errorMessage, onRetry }: { errorMessage: string | null; onRetry: () => void }) {
  return (
    <>
      <div style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, marginBottom: 6 }}>Sign in required</div>
      <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, marginBottom: 20, lineHeight: ARK_TOKENS.leading.normal }}>
        {errorMessage ?? 'Sign in to Azure DevOps to continue.'}
      </div>
      <Btn variant="primary" size="lg" onClick={onRetry}>
        Sign in to Azure DevOps
      </Btn>
    </>
  );
}
