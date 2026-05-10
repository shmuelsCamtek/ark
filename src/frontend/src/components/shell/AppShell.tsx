import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { usePath } from '../../router';
import { DraftsRail } from './DraftsRail';
import { NewStoryModal } from './NewStoryModal';
import { RailCollapsedStrip } from './RailCollapsedStrip';

interface ShellContextValue {
  openNewStoryModal: () => void;
  closeNewStoryModal: () => void;
  railHidden: boolean;
  toggleRail: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within an AppShell');
  return ctx;
}

const RAIL_HIDDEN_KEY = 'ark.railHidden';

function readPersistedRailHidden(): boolean {
  try {
    return window.localStorage.getItem(RAIL_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [newStoryOpen, setNewStoryOpen] = useState(false);
  const [railHidden, setRailHidden] = useState<boolean>(() => readPersistedRailHidden());
  const path = usePath();

  // Auto-open the modal when the URL carries ?new=1 (used by /onboarding redirect).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === '1') {
      setNewStoryOpen(true);
      params.delete('new');
      const search = params.toString();
      const cleanUrl = window.location.pathname + (search ? `?${search}` : '');
      window.history.replaceState({}, '', cleanUrl);
    }
  }, [path]);

  const openNewStoryModal = useCallback(() => setNewStoryOpen(true), []);
  const closeNewStoryModal = useCallback(() => setNewStoryOpen(false), []);
  const toggleRail = useCallback(() => {
    setRailHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RAIL_HIDDEN_KEY, next ? '1' : '0');
      } catch {
        // ignore quota / private-mode failures
      }
      return next;
    });
  }, []);

  return (
    <ShellContext.Provider value={{ openNewStoryModal, closeNewStoryModal, railHidden, toggleRail }}>
      <div
        style={{
          width: '100%',
          height: '100vh',
          background: ARK_TOKENS.bg,
          display: 'flex',
          flexDirection: 'row',
          minHeight: 0,
        }}
      >
        {railHidden ? (
          <RailCollapsedStrip onExpand={toggleRail} />
        ) : (
          <DraftsRail onCreate={openNewStoryModal} />
        )}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {children}
        </div>
      </div>
      <NewStoryModal open={newStoryOpen} onClose={closeNewStoryModal} />
    </ShellContext.Provider>
  );
}
