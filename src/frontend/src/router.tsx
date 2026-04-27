import { useState, useEffect, useContext, createContext, useCallback, type ReactNode } from 'react';

interface RouterState {
  path: string;
  params: Record<string, string>;
}

const RouterContext = createContext<{
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
}>({
  path: '/',
  params: {},
  navigate: () => {},
});

export function useNavigate() {
  const { navigate } = useContext(RouterContext);
  return navigate;
}

export function useParams() {
  const { params } = useContext(RouterContext);
  return params;
}

export function usePath() {
  const { path } = useContext(RouterContext);
  return path;
}

interface RouteConfig {
  pattern: string;
  component: React.ComponentType;
}

function matchRoute(path: string, pattern: string): Record<string, string> | null {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (pathParts.length !== patternParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function getPathFromUrl(): string {
  return window.location.pathname || '/';
}

export function Router({ routes, fallback: Fallback }: { routes: RouteConfig[]; fallback: React.ComponentType }) {
  const [state, setState] = useState<RouterState>(() => {
    const path = getPathFromUrl();
    return { path, params: {} };
  });

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    setState({ path: to, params: {} });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setState({ path: getPathFromUrl(), params: {} });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  let Matched: React.ComponentType | null = null;
  let matchedParams: Record<string, string> = {};

  for (const route of routes) {
    const params = matchRoute(state.path, route.pattern);
    if (params !== null) {
      Matched = route.component;
      matchedParams = params;
      break;
    }
  }

  return (
    <RouterContext.Provider value={{ path: state.path, params: matchedParams, navigate }}>
      {Matched ? <Matched /> : <Fallback />}
    </RouterContext.Provider>
  );
}

export function Link({ to, children, className, style }: {
  to: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { navigate } = useContext(RouterContext);
  return (
    <a
      href={to}
      className={className}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
