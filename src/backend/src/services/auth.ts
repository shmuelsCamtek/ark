// Microsoft's pre-registered Azure CLI public client. Has Azure DevOps
// user_impersonation pre-consented, so device flow works without an
// App Registration in the user's tenant.
const AZURE_CLI_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';
const AUTHORITY = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'organizations'}`;
const SCOPES = '499b84ac-1321-427f-aa17-267ca6975798/user_impersonation offline_access openid profile';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
}

type AuthState =
  | { status: 'idle' }
  | {
      status: 'device_pending';
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      message: string;
      expiresAt: number;
    }
  | {
      status: 'authenticated';
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      profile: UserProfile;
    };

let state: AuthState = { status: 'idle' };

export async function startDeviceFlow(): Promise<{ userCode: string; verificationUri: string; message: string }> {
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: AZURE_CLI_CLIENT_ID, scope: SCOPES }),
  });
  if (!res.ok) throw new Error(`devicecode failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    message: string;
  };
  state = {
    status: 'device_pending',
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    message: data.message,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return {
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    message: data.message,
  };
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'authenticated'; profile: UserProfile }
  | { status: 'expired' }
  | { status: 'error'; error: string };

export async function pollDeviceFlow(): Promise<PollResult> {
  if (state.status === 'authenticated') {
    return { status: 'authenticated', profile: state.profile };
  }
  if (state.status !== 'device_pending') {
    return { status: 'error', error: 'No device flow in progress' };
  }
  if (Date.now() > state.expiresAt) {
    state = { status: 'idle' };
    return { status: 'expired' };
  }

  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: AZURE_CLI_CLIENT_ID,
      device_code: state.deviceCode,
    }),
  });

  const data = (await res.json()) as Record<string, string | number>;
  if (!res.ok) {
    if (data.error === 'authorization_pending') return { status: 'pending' };
    if (data.error === 'expired_token' || data.error === 'code_expired') {
      state = { status: 'idle' };
      return { status: 'expired' };
    }
    if (data.error === 'slow_down') return { status: 'pending' };
    state = { status: 'idle' };
    return { status: 'error', error: String(data.error_description ?? data.error ?? 'unknown') };
  }

  const profile = decodeProfile(String(data.id_token));
  state = {
    status: 'authenticated',
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
    profile,
  };
  return { status: 'authenticated', profile };
}

export function getProfile(): UserProfile | null {
  return state.status === 'authenticated' ? state.profile : null;
}

export async function getAccessToken(): Promise<string | null> {
  if (state.status !== 'authenticated') return null;
  if (Date.now() > state.expiresAt - 60_000) {
    const ok = await refreshAccessToken();
    if (!ok) return null;
  }
  return state.status === 'authenticated' ? state.accessToken : null;
}

export function signOut(): void {
  state = { status: 'idle' };
}

async function refreshAccessToken(): Promise<boolean> {
  if (state.status !== 'authenticated') return false;
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: AZURE_CLI_CLIENT_ID,
      refresh_token: state.refreshToken,
      scope: SCOPES,
    }),
  });
  if (!res.ok) {
    state = { status: 'idle' };
    return false;
  }
  const data = (await res.json()) as Record<string, string | number>;
  state = {
    status: 'authenticated',
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token ?? state.refreshToken),
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
    profile: state.profile,
  };
  return true;
}

function decodeProfile(idToken: string): UserProfile {
  const segment = idToken.split('.')[1] ?? '';
  let s = segment.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const payload = JSON.parse(Buffer.from(s, 'base64').toString('utf8')) as Record<string, string>;
  return {
    id: payload.oid ?? payload.sub ?? '',
    displayName: payload.name ?? '',
    email: payload.preferred_username ?? payload.email ?? '',
  };
}
