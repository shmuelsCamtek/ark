import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { type AiService } from '../services/ai';
import { type AzureService } from '../services/azure';
import { HttpAiService } from '../services/http-ai';
import { HttpAzureService } from '../services/http-azure';

interface Services {
  ai: AiService;
  azure: AzureService;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const services = useMemo<Services>(
    () => ({ ai: new HttpAiService(), azure: new HttpAzureService() }),
    [],
  );

  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}
