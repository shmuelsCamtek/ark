// Microsoft's pre-registered Azure CLI public client. Has Azure DevOps
// user_impersonation pre-consented, so device flow works without an
// App Registration in the user's tenant.
const AZURE_CLI_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';
// Microsoft Office is in the same FOCI family as Azure CLI but is preauthorized
// by the Microsoft Graph resource owner. The device-flow refresh token issued
// to AZURE_CLI_CLIENT_ID is a Family Refresh Token (foci=1) and can be
// redeemed at this client's token endpoint to obtain Graph access tokens.
// Override with GRAPH_CLIENT_ID env var if you want to point at a custom AAD
// App Registration instead.
const GRAPH_CLIENT_ID = process.env.GRAPH_CLIENT_ID || 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const AUTHORITY = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'organizations'}`;
const SCOPES = '499b84ac-1321-427f-aa17-267ca6975798/user_impersonation offline_access openid profile';
const GRAPH_SCOPES = 'https://graph.microsoft.com/Sites.ReadWrite.All offline_access';

export class GraphConsentRequiredError extends Error {
  constructor(public readonly aadError: string, public readonly description: string) {
    super(`Microsoft Graph consent required: ${description}`);
    this.name = 'GraphConsentRequiredError';
  }
}

export class GraphLoginRequiredError extends Error {
  constructor() {
    super('Microsoft Graph login required');
    this.name = 'GraphLoginRequiredError';
  }
}

type GraphAuthState =
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
    };

let graphState: GraphAuthState = { status: 'idle' };

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
  graphState = { status: 'idle' };
}

export async function startGraphDeviceFlow(): Promise<{ userCode: string; verificationUri: string; message: string }> {
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: GRAPH_CLIENT_ID, scope: GRAPH_SCOPES }),
  });
  if (!res.ok) throw new Error(`graph devicecode failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    message: string;
  };
  graphState = {
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

export type GraphPollResult =
  | { status: 'pending' }
  | { status: 'authenticated' }
  | { status: 'expired' }
  | { status: 'error'; error: string };

export async function pollGraphDeviceFlow(): Promise<GraphPollResult> {
  if (graphState.status === 'authenticated') return { status: 'authenticated' };
  if (graphState.status !== 'device_pending') {
    return { status: 'error', error: 'No Graph device flow in progress' };
  }
  if (Date.now() > graphState.expiresAt) {
    graphState = { status: 'idle' };
    return { status: 'expired' };
  }

  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: GRAPH_CLIENT_ID,
      device_code: graphState.deviceCode,
    }),
  });
  const data = (await res.json()) as Record<string, string | number>;
  if (!res.ok) {
    if (data.error === 'authorization_pending') return { status: 'pending' };
    if (data.error === 'expired_token' || data.error === 'code_expired') {
      graphState = { status: 'idle' };
      return { status: 'expired' };
    }
    if (data.error === 'slow_down') return { status: 'pending' };
    graphState = { status: 'idle' };
    return { status: 'error', error: String(data.error_description ?? data.error ?? 'unknown') };
  }

  graphState = {
    status: 'authenticated',
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
  return { status: 'authenticated' };
}

export async function getGraphAccessToken(): Promise<string> {
  if (graphState.status !== 'authenticated') {
    throw new GraphLoginRequiredError();
  }
  if (Date.now() < graphState.expiresAt - 60_000) {
    return graphState.accessToken;
  }
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: GRAPH_CLIENT_ID,
      refresh_token: graphState.refreshToken,
      scope: GRAPH_SCOPES,
    }),
  });
  const data = (await res.json()) as Record<string, string | number>;
  if (!res.ok) {
    const err = String(data.error ?? 'unknown');
    const desc = String(data.error_description ?? err);
    if (err === 'invalid_grant' || err === 'consent_required' || err === 'interaction_required') {
      graphState = { status: 'idle' };
      throw new GraphConsentRequiredError(err, desc);
    }
    throw new Error(`Graph token refresh failed: ${err} ${desc}`);
  }
  graphState = {
    status: 'authenticated',
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token ?? graphState.refreshToken),
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
  return graphState.accessToken;
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
