import type { WorkItemInfo } from '../types';

export interface AzureService {
  resolveWorkItem(id: string): Promise<WorkItemInfo | null>;
  createWorkItem(data: {
    title: string;
    description: string;
    type: string;
    acceptanceCriteria: string;
  }): Promise<{ id: string; url: string }>;
}

const MOCK_WORK_ITEMS: Record<string, WorkItemInfo> = {
  '3994': {
    id: '3994',
    title: 'Improve onboarding flow for new users',
    type: 'User Story',
    state: 'New',
    areaPath: 'Ark\\Frontend',
    iterationPath: 'Ark\\Sprint 14',
  },
  '4102': {
    id: '4102',
    title: 'Add batch export functionality',
    type: 'User Story',
    state: 'Active',
    areaPath: 'Ark\\Backend',
    iterationPath: 'Ark\\Sprint 15',
  },
  '3870': {
    id: '3870',
    title: 'Dashboard performance optimization',
    type: 'Bug',
    state: 'New',
    areaPath: 'Ark\\Platform',
    iterationPath: 'Ark\\Sprint 14',
  },
};

export class MockAzureService implements AzureService {
  async resolveWorkItem(id: string): Promise<WorkItemInfo | null> {
    await delay(400 + Math.random() * 200);
    return MOCK_WORK_ITEMS[id] ?? null;
  }

  async createWorkItem(_data: {
    title: string;
    description: string;
    type: string;
    acceptanceCriteria: string;
  }): Promise<{ id: string; url: string }> {
    await delay(1500 + Math.random() * 500);
    const newId = String(5000 + Math.floor(Math.random() * 1000));
    return {
      id: newId,
      url: `https://dev.azure.com/org/project/_workitems/edit/${newId}`,
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
