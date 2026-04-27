import { TopBar } from '../components/ui';
import { useParams } from '../router';

export function PushPage() {
  const { id } = useParams();

  return (
    <div style={{ minHeight: '100vh', background: '#F1F4F9' }}>
      <TopBar breadcrumbs={['Stories', 'Push to Azure']} />
      <div style={{ padding: 32, textAlign: 'center', color: '#69707F' }}>
        <h2>Push Flow</h2>
        <p>Pushing draft {id}</p>
        <p>Coming in Phase 8</p>
      </div>
    </div>
  );
}
