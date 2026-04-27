import { useEffect, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import type { UserProfile } from '../types';

export function AppInitializer({ children }: { children: ReactNode }) {
  const { setUser } = useApp();

  useEffect(() => {
    fetch('/api/azure/me')
      .then((res) => (res.ok ? (res.json() as Promise<UserProfile>) : null))
      .then((profile) => {
        if (profile) setUser(profile);
      })
      .catch(() => {
        // silently fail — avatar shows fallback
      });
  }, [setUser]);

  return <>{children}</>;
}
