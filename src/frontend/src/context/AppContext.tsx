import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { StoryDraft, UserProfile } from '../types';

interface AzureConnection {
  connected: boolean;
  orgUrl?: string;
  project?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AppState {
  drafts: StoryDraft[];
  azureConnection: AzureConnection;
  user: UserProfile | null;
  authStatus: AuthStatus;
}

interface AppActions {
  addDraft: (draft: StoryDraft) => void;
  updateDraft: (id: string, updates: Partial<StoryDraft>) => void;
  deleteDraft: (id: string) => void;
  getDraft: (id: string) => StoryDraft | undefined;
  setAzureConnection: (conn: AzureConnection) => void;
  setUser: (user: UserProfile) => void;
  setAuthStatus: (status: AuthStatus) => void;
}

type AppContextValue = AppState & AppActions;

const AppContext = createContext<AppContextValue | null>(null);

function createEmptyDraft(overrides?: Partial<StoryDraft>): StoryDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: '',
    background: '',
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

export { createEmptyDraft };

export function AppProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [azureConnection, setAzureConnection] = useState<AzureConnection>({ connected: false });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

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
      value={{
        drafts, azureConnection, user, authStatus,
        addDraft, updateDraft, deleteDraft, getDraft,
        setAzureConnection, setUser, setAuthStatus,
      }}
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
