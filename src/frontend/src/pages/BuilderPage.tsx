import { TopBar } from '../components/ui';
import { useParams } from '../router';

export function BuilderPage() {
  const params = useParams();
  const id = params.id;

  return (
    <div style={{ minHeight: '100vh', background: '#F1F4F9' }}>
      <TopBar breadcrumbs={['Stories', id ? 'Edit' : 'New Story']} />
      <div style={{ padding: 32, textAlign: 'center', color: '#69707F' }}>
        <h2>Builder A</h2>
        <p>{id ? `Editing draft ${id}` : 'New story'}</p>
        <p>Coming in Phase 6</p>
      </div>
    </div>
  );
}
