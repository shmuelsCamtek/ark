import type { StoryDraft, SuggestMessage } from '../types';

export class HttpDraftsService {
  async listDrafts(): Promise<StoryDraft[]> {
    const res = await fetch('/api/drafts');
    if (!res.ok) throw new Error(`listDrafts failed: ${res.status}`);
    return res.json();
  }

  async getDraft(id: string): Promise<StoryDraft | undefined> {
    const res = await fetch(`/api/drafts/${id}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`getDraft failed: ${res.status}`);
    return res.json();
  }

  async createDraft(draft: StoryDraft): Promise<StoryDraft> {
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!res.ok) throw new Error(`createDraft failed: ${res.status}`);
    return res.json();
  }

  async updateDraft(id: string, patch: Partial<StoryDraft>): Promise<StoryDraft> {
    const res = await fetch(`/api/drafts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`updateDraft failed: ${res.status}`);
    return res.json();
  }

  async deleteDraft(id: string): Promise<void> {
    const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`deleteDraft failed: ${res.status}`);
  }

  async getChat(draftId: string): Promise<SuggestMessage[]> {
    const res = await fetch(`/api/drafts/${draftId}/chat`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`getChat failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.messages) ? (data.messages as SuggestMessage[]) : [];
  }

  async putChat(draftId: string, messages: SuggestMessage[]): Promise<void> {
    const res = await fetch(`/api/drafts/${draftId}/chat`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`putChat failed: ${res.status}`);
  }
}
