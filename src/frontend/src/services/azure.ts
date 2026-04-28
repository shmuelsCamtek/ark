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

const MOCK_WORK_ITEMS: Record<string, WorkItemInfo> = {
  '3994': {
    id: '3994',
    title: 'Improve onboarding flow for new users',
    type: 'User Story',
    state: 'New',
    assignedTo: 'Dana Levy',
    areaPath: 'Ark\\Frontend',
    iterationPath: 'Ark\\Sprint 14',
  },
  '4102': {
    id: '4102',
    title: 'Add batch export functionality',
    type: 'User Story',
    state: 'Active',
    assignedTo: 'Shmuel S.',
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
  '4200': {
    id: '4200',
    title: 'User notification preferences',
    type: 'User Story',
    state: 'New',
    assignedTo: 'Noa Ben-David',
    areaPath: 'Ark\\Frontend',
    iterationPath: 'Ark\\Sprint 15',
  },
  '4301': {
    id: '4301',
    title: 'API rate limiting implementation',
    type: 'Task',
    state: 'Active',
    assignedTo: 'Yoni R.',
    areaPath: 'Ark\\Backend',
    iterationPath: 'Ark\\Sprint 15',
  },
  '4050': {
    id: '4050',
    title: 'Search results pagination bug',
    type: 'Bug',
    state: 'Active',
    areaPath: 'Ark\\Frontend',
    iterationPath: 'Ark\\Sprint 14',
  },
  '3950': {
    id: '3950',
    title: 'Feature flag management epic',
    type: 'Epic',
    state: 'New',
    areaPath: 'Ark\\Platform',
    iterationPath: 'Ark\\Sprint 16',
  },
};

export class MockAzureService implements AzureService {
  async resolveWorkItem(id: string): Promise<WorkItemInfo | null> {
    await delay(400 + Math.random() * 200);
    return MOCK_WORK_ITEMS[id] ?? null;
  }

  async searchWorkItems(query: string): Promise<WorkItemInfo[]> {
    await delay(300 + Math.random() * 200);
    const q = query.toLowerCase();
    return Object.values(MOCK_WORK_ITEMS).filter(
      (item) => item.id.includes(q) || item.title.toLowerCase().includes(q),
    );
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
