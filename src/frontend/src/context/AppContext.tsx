import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { StoryDraft, UserProfile } from '../types';

interface AzureConnection {
  connected: boolean;
  orgUrl?: string;
  project?: string;
}

interface AppState {
  drafts: StoryDraft[];
  azureConnection: AzureConnection;
  user: UserProfile | null;
}

interface AppActions {
  addDraft: (draft: StoryDraft) => void;
  updateDraft: (id: string, updates: Partial<StoryDraft>) => void;
  deleteDraft: (id: string) => void;
  getDraft: (id: string) => StoryDraft | undefined;
  setAzureConnection: (conn: AzureConnection) => void;
  setUser: (user: UserProfile) => void;
}

type AppContextValue = AppState & AppActions;

const AppContext = createContext<AppContextValue | null>(null);

function createEmptyDraft(overrides?: Partial<StoryDraft>): StoryDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    persona: '',
    narrative: { asA: '', iWantTo: '', soThat: '' },
    acceptanceCriteria: [],
    supportingDocs: [],
    uiChanges: [],
    createdAt: now,
    updatedAt: now,
    completionPct: 0,
    ...overrides,
  };
}

const SAMPLE_DRAFTS: StoryDraft[] = [
  createEmptyDraft({
    id: 'draft-1',
    title: 'Enable batch export for monthly reports',
    persona: 'Operations Manager',
    narrative: {
      asA: 'Operations Manager',
      iWantTo: 'export multiple reports at once',
      soThat: 'I can share them with stakeholders without manual effort',
    },
    acceptanceCriteria: [
      { id: 'ac-1', text: 'User can select multiple reports from the list', source: 'manual' },
      { id: 'ac-2', text: 'Export generates a ZIP file with all selected reports', source: 'ai' },
    ],
    epicId: '3994',
    epicName: 'Reporting Improvements',
    completionPct: 72,
    createdAt: '2026-04-25T10:00:00Z',
    updatedAt: '2026-04-26T14:30:00Z',
  }),
  createEmptyDraft({
    id: 'draft-2',
    title: 'Improve error messages for API timeouts',
    persona: 'Support Lead',
    narrative: {
      asA: 'Support Lead',
      iWantTo: 'see clear error messages when API calls time out',
      soThat: '',
    },
    acceptanceCriteria: [
      { id: 'ac-3', text: 'Timeout errors display user-friendly message', source: 'manual' },
    ],
    epicId: '4102',
    epicName: 'Platform Reliability',
    completionPct: 45,
    createdAt: '2026-04-24T09:00:00Z',
    updatedAt: '2026-04-26T16:00:00Z',
  }),
  createEmptyDraft({
    id: 'draft-3',
    title: 'Add dashboard widget for deployment status',
    persona: 'DevOps Engineer',
    narrative: {
      asA: 'DevOps Engineer',
      iWantTo: 'see deployment status on my dashboard',
      soThat: 'I can quickly identify failed deployments',
    },
    acceptanceCriteria: [],
    supportingDocs: [],
    completionPct: 28,
    createdAt: '2026-04-23T11:00:00Z',
    updatedAt: '2026-04-25T08:00:00Z',
  }),
];

export { createEmptyDraft };

export function AppProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<StoryDraft[]>(SAMPLE_DRAFTS);
  const [azureConnection, setAzureConnection] = useState<AzureConnection>({
    connected: true,
    orgUrl: 'https://dev.azure.com/contoso',
    project: 'Ark',
  });
  const [user, setUser] = useState<UserProfile | null>(null);

  const addDraft = useCallback((draft: StoryDraft) => {
    setDrafts((prev) => [draft, ...prev]);
  }, []);

  const updateDraft = useCallback((id: string, updates: Partial<StoryDraft>) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d)),
    );
  }, []);

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const getDraft = useCallback(
    (id: string) => drafts.find((d) => d.id === id),
    [drafts],
  );

  return (
    <AppContext.Provider
      value={{ drafts, azureConnection, user, addDraft, updateDraft, deleteDraft, getDraft, setAzureConnection, setUser }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
