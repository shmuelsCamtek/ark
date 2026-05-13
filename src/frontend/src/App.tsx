import { Router } from './router';
import { AppProvider } from './context/AppContext';
import { ServicesProvider } from './context/ServicesContext';
import { AppInitializer } from './components/AppInitializer';
import { ShellHomePage } from './pages/ShellHomePage';
import { BuilderPage } from './pages/BuilderPage';
import { PushPage } from './pages/PushPage';

const routes = [
  { pattern: '/', component: ShellHomePage },
  { pattern: '/stories', component: ShellHomePage },
  { pattern: '/stories/:id/edit', component: BuilderPage },
  { pattern: '/stories/:id/push', component: PushPage },
];

export default function App() {
  return (
    <AppProvider>
      <ServicesProvider>
        <AppInitializer>
          <Router routes={routes} fallback={ShellHomePage} />
        </AppInitializer>
      </ServicesProvider>
    </AppProvider>
  );
}
