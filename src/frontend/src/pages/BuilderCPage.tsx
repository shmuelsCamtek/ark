import { TopBar } from '../components/ui';

export function BuilderCPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F4F9' }}>
      <TopBar breadcrumbs={['Stories', 'Canvas Builder']} />
      <div style={{ padding: 32, textAlign: 'center', color: '#69707F' }}>
        <h2>Builder C — Card Canvas</h2>
        <p>Coming in Phase 11</p>
      </div>
    </div>
  );
}
