import type { WorkItemInfo } from '../types';
import type { AzureConfig, AzureService, WorkItemTitle } from './azure';

let configPromise: Promise<AzureConfig | null> | null = null;

function normalizeWorkItem(raw: Record<string, unknown>): WorkItemInfo {
  const linked = Array.isArray(raw.linkedWorkItems)
    ? (raw.linkedWorkItems as Record<string, unknown>[]).map(normalizeWorkItem)
    : undefined;
  return {
    ...(raw as unknown as WorkItemInfo),
    id: String(raw.id),
    linkedWorkItems: linked,
  };
}

export class HttpAzureService implements AzureService {
  async resolveWorkItem(id: string): Promise<WorkItemInfo | null> {
    const res = await fetch(`/api/azure/workitems/${id}`);
    if (!res.ok) return null;
    const item = await res.json();
    return normalizeWorkItem(item);
  }

  async searchWorkItems(query: string): Promise<WorkItemInfo[]> {
    const res = await fetch(`/api/azure/workitems?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const items = await res.json();
    return items.map((item: Record<string, unknown>) => ({ ...item, id: String(item.id) }));
  }

  async createWorkItem(data: {
    title: string;
    description: string;
    type: string;
    acceptanceCriteria: string;
  }): Promise<{ id: string; url: string }> {
    const res = await fetch('/api/azure/workitems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create work item');
    const result = await res.json();
    return { id: String(result.id), url: result.url };
  }

  async getConfig(): Promise<AzureConfig | null> {
    if (!configPromise) {
      configPromise = fetch('/api/azure/config')
        .then((res) => (res.ok ? (res.json() as Promise<AzureConfig>) : null))
        .catch(() => null);
    }
    return configPromise;
  }

  async getWorkItemTitles(ids: string[]): Promise<WorkItemTitle[]> {
    const numeric = ids.map((s) => Number(s)).filter((n) => Number.isFinite(n));
    if (numeric.length === 0) return [];
    const res = await fetch('/api/azure/workitems/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: numeric }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ id: number; title: string; type: string }>;
    return data.map((d) => ({ id: String(d.id), title: d.title, type: d.type }));
  }
}
