import type { WorkItemInfo } from '../types';
import type { AzureService } from './azure';

export class HttpAzureService implements AzureService {
  async resolveWorkItem(id: string): Promise<WorkItemInfo | null> {
    const res = await fetch(`/api/azure/workitems/${id}`);
    if (!res.ok) return null;
    return res.json();
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

}
