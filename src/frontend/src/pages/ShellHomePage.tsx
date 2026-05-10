import { ARK_TOKENS } from '../tokens';
import { TopBar } from '../components/ui';
import { AppShell, useShell } from '../components/shell/AppShell';
import { EmptyEditorState } from '../components/shell/EmptyEditorState';
import { useApp } from '../context/AppContext';

function ShellHomeContent() {
  const { drafts } = useApp();
  const { openNewStoryModal } = useShell();
  return (
    <>
      <TopBar breadcrumbs={['Ark', 'My stories']} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: ARK_TOKENS.bg,
        }}
      >
        <EmptyEditorState hasDrafts={drafts.length > 0} onCreate={openNewStoryModal} />
      </div>
    </>
  );
}

export function ShellHomePage() {
  return (
    <AppShell>
      <ShellHomeContent />
    </AppShell>
  );
}
