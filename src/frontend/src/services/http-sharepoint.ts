import type { GraphLoginInfo, GraphLoginPoll, PublishResult, SharepointService } from './sharepoint';

export class HttpSharepointService implements SharepointService {
  async publish(args: { html: string; filename: string; folderName: string }): Promise<PublishResult> {
    const res = await fetch('/api/sharepoint/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = (await res.json().catch(() => ({}))) as {
      webUrl?: string;
      error?: string;
      message?: string;
    };
    if (res.ok && data.webUrl) {
      return { ok: true, webUrl: data.webUrl };
    }
    if (res.status === 403 && data.error === 'graph_consent_required') {
      return { ok: false, error: 'graph_consent_required', message: data.message || 'Admin consent required' };
    }
    if (res.status === 401 && data.error === 'graph_login_required') {
      return { ok: false, error: 'graph_login_required', message: 'Sign in to SharePoint required' };
    }
    if (res.status === 401) {
      return { ok: false, error: 'not_authenticated', message: data.error || 'Not authenticated' };
    }
    return { ok: false, error: 'other', message: data.error || data.message || `HTTP ${res.status}` };
  }

  async loginStart(): Promise<GraphLoginInfo> {
    const res = await fetch('/api/sharepoint/login/start', { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }
    return (await res.json()) as GraphLoginInfo;
  }

  async loginPoll(): Promise<GraphLoginPoll> {
    const res = await fetch('/api/sharepoint/login/poll', { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { status: 'error', error: (body as { error?: string }).error || `HTTP ${res.status}` };
    }
    return (await res.json()) as GraphLoginPoll;
  }
}
