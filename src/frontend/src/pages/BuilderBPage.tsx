import { TopBar } from '../components/ui';

export function BuilderBPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F4F9' }}>
      <TopBar breadcrumbs={['Stories', 'Chat Builder']} />
      <div style={{ padding: 32, textAlign: 'center', color: '#69707F' }}>
        <h2>Builder B — Chat-Driven</h2>
        <p>Coming in Phase 10</p>
      </div>
    </div>
  );
}
