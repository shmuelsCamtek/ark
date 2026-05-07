import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { StoryDraft, UserProfile } from '../types';
import { HttpDraftsService } from '../services/http-drafts';

interface AzureConnection {
  connected: boolean;
  orgUrl?: string;
  project?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AppState {
  drafts: StoryDraft[];
  draftsLoaded: boolean;
  azureConnection: AzureConnection;
  user: UserProfile | null;
  authStatus: AuthStatus;
}

type DraftUpdater = Partial<StoryDraft> | ((current: StoryDraft) => Partial<StoryDraft>);

interface AppActions {
  addDraft: (draft: StoryDraft) => void;
  updateDraft: (id: string, updates: DraftUpdater) => void;
  deleteDraft: (id: string) => void;
  getDraft: (id: string) => StoryDraft | undefined;
  loadDraft: (id: string) => Promise<StoryDraft | undefined>;
  setAzureConnection: (conn: AzureConnection) => void;
  setUser: (user: UserProfile | null) => void;
  setAuthStatus: (status: AuthStatus) => void;
}

type AppContextValue = AppState & AppActions;

const AppContext = createContext<AppContextValue | null>(null);

const PERSIST_DEBOUNCE_MS = 800;

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyDraft(overrides?: Partial<StoryDraft>): StoryDraft {
  const now = new Date().toISOString();
  return {
    id: randomId(),
    title: '',
    background: '',
    persona: '',
    narrative: { asA: '', iWantTo: '', soThat: '' },
    acceptanceCriteria: [],
    supportingDocs: [],
    uiChanges: [],
    contextLog: [],
    createdAt: now,
    updatedAt: now,
    completionPct: 0,
    ...overrides,
  };
}

export { createEmptyDraft };

export function AppProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [azureConnection, setAzureConnection] = useState<AzureConnection>({ connected: false });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  const draftsApi = useMemo(() => new HttpDraftsService(), []);
  const draftsRef = useRef<StoryDraft[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Track which ids the server already knows about so we can pick POST vs PUT.
  const knownOnServerRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  // Initial load once authenticated.
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    draftsApi
      .listDrafts()
      .then((list) => {
        if (cancelled) return;
        for (const d of list) knownOnServerRef.current.add(d.id);
        setDrafts(list);
        setDraftsLoaded(true);
      })
      .catch((err) => {
        console.error('[AppContext] listDrafts failed', err);
        if (!cancelled) setDraftsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, draftsApi]);

  const scheduleBackendUpdate = useCallback(
    (id: string) => {
      const timers = timersRef.current;
      const existing = timers.get(id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timers.delete(id);
        const draft = draftsRef.current.find((d) => d.id === id);
        if (!draft) return;
        const onServer = knownOnServerRef.current.has(id);
        const op = onServer
          ? draftsApi.updateDraft(id, draft)
          : draftsApi.createDraft(draft).then((created) => {
              knownOnServerRef.current.add(created.id);
              return created;
            });
        op.catch((err) => console.error('[AppContext] persist draft failed', err));
      }, PERSIST_DEBOUNCE_MS);
      timers.set(id, t);
    },
    [draftsApi],
  );

  const addDraft = useCallback(
    (draft: StoryDraft) => {
      setDrafts((prev) => [draft, ...prev]);
      scheduleBackendUpdate(draft.id);
    },
    [scheduleBackendUpdate],
  );

  const updateDraft = useCallback(
    (id: string, updates: DraftUpdater) => {
      setDrafts((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          const patch = typeof updates === 'function' ? updates(d) : updates;
          return { ...d, ...patch, updatedAt: new Date().toISOString() };
        }),
      );
      scheduleBackendUpdate(id);
    },
    [scheduleBackendUpdate],
  );

  const deleteDraft = useCallback(
    (id: string) => {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      const t = timersRef.current.get(id);
      if (t) {
        clearTimeout(t);
        timersRef.current.delete(id);
      }
      if (knownOnServerRef.current.has(id)) {
        knownOnServerRef.current.delete(id);
        draftsApi
          .deleteDraft(id)
          .catch((err) => console.error('[AppContext] deleteDraft failed', err));
      }
    },
    [draftsApi],
  );

  const getDraft = useCallback((id: string) => drafts.find((d) => d.id === id), [drafts]);

  const loadDraft = useCallback(
    async (id: string): Promise<StoryDraft | undefined> => {
      const local = draftsRef.current.find((d) => d.id === id);
      if (local) return local;
      try {
        const fetched = await draftsApi.getDraft(id);
        if (!fetched) return undefined;
        knownOnServerRef.current.add(fetched.id);
        setDrafts((prev) => (prev.some((d) => d.id === fetched.id) ? prev : [fetched, ...prev]));
        return fetched;
      } catch (err) {
        console.error('[AppContext] loadDraft failed', err);
        return undefined;
      }
    },
    [draftsApi],
  );

  return (
    <AppContext.Provider
      value={{
        drafts,
        draftsLoaded,
        azureConnection,
        user,
        authStatus,
        addDraft,
        updateDraft,
        deleteDraft,
        getDraft,
        loadDraft,
        setAzureConnection,
        setUser,
        setAuthStatus,
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
