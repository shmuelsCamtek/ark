import type { WorkItemInfo } from '../types';

export interface AzureConfig {
  orgUrl: string;
  project: string;
}

export interface WorkItemTitle {
  id: string;
  title: string;
  type: string;
}

export interface AzureService {
  resolveWorkItem(id: string): Promise<WorkItemInfo | null>;
  searchWorkItems(query: string): Promise<WorkItemInfo[]>;
  createWorkItem(data: {
    title: string;
    description: string;
    type: string;
    acceptanceCriteria: string;
  }): Promise<{ id: string; url: string }>;
  getConfig(): Promise<AzureConfig | null>;
  getWorkItemTitles(ids: string[]): Promise<WorkItemTitle[]>;
}
