import { Router } from './router';
import { AppProvider } from './context/AppContext';
import { ServicesProvider } from './context/ServicesContext';
import { StoriesPage } from './pages/StoriesPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { BuilderPage } from './pages/BuilderPage';
import { PushPage } from './pages/PushPage';
import { BuilderBPage } from './pages/BuilderBPage';
import { BuilderCPage } from './pages/BuilderCPage';
import { DevPage } from './pages/DevPage';

const routes = [
  { pattern: '/', component: StoriesPage },
  { pattern: '/stories', component: StoriesPage },
  { pattern: '/onboarding', component: OnboardingPage },
  { pattern: '/stories/new', component: BuilderPage },
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
        <Router routes={routes} fallback={StoriesPage} />
      </ServicesProvider>
    </AppProvider>
  );
}
