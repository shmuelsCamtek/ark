import type { WorkItemInfo } from '../types';

export interface AzureService {
  resolveWorkItem(id: string): Promise<WorkItemInfo | null>;
  searchWorkItems(query: string): Promise<WorkItemInfo[]>;
  createWorkItem(data: {
    title: string;
    description: string;
    type: string;
    acceptanceCriteria: string;
  }): Promise<{ id: string; url: string }>;
}
