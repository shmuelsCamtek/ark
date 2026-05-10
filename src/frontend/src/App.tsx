import { Router } from './router';
import { AppProvider } from './context/AppContext';
import { ServicesProvider } from './context/ServicesContext';
import { AppInitializer } from './components/AppInitializer';
import { ShellHomePage } from './pages/ShellHomePage';
import { OnboardingRedirect } from './pages/OnboardingRedirect';
import { BuilderPage } from './pages/BuilderPage';
import { PushPage } from './pages/PushPage';
import { BuilderBPage } from './pages/BuilderBPage';
import { BuilderCPage } from './pages/BuilderCPage';
import { DevPage } from './pages/DevPage';

const routes = [
  { pattern: '/', component: ShellHomePage },
  { pattern: '/stories', component: ShellHomePage },
  { pattern: '/onboarding', component: OnboardingRedirect },
  { pattern: '/stories/new/chat', component: BuilderBPage },
  { pattern: '/stories/new/canvas', component: BuilderCPage },
  { pattern: '/stories/:id/edit', component: BuilderPage },
  { pattern: '/stories/:id/push', component: PushPage },
  { pattern: '/dev', component: DevPage },
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
