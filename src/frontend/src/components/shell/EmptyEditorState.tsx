import { ARK_TOKENS } from '../../tokens';
import { Btn, Ico } from '../ui';

interface EmptyEditorStateProps {
  hasDrafts: boolean;
  onCreate: () => void;
}

export function EmptyEditorState({ hasDrafts, onCreate }: EmptyEditorStateProps) {
  const heading = hasDrafts ? 'Pick a story to edit' : 'No drafts yet';
  const body = hasDrafts
    ? 'Select a draft from the list on the left, or start a new one to begin shaping a user story.'
    : 'Start a new user story and Ark will guide you through writing one developers can pick up without questions.';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 48px',
        minHeight: 0,
      }}
    >
      <div
        style={{
          background: ARK_TOKENS.surface,
          border: `1px dashed ${ARK_TOKENS.borderStrong}`,
          borderRadius: ARK_TOKENS.r2,
          padding: '56px 32px',
          textAlign: 'center',
          maxWidth: 480,
          width: '100%',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            margin: '0 auto 16px',
            borderRadius: 24,
            background: ARK_TOKENS.azureFaint,
            color: ARK_TOKENS.azure,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ico.list size={20} />
        </div>
        <div style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, marginBottom: 6 }}>
          {heading}
        </div>
        <div
          style={{
            fontSize: ARK_TOKENS.type.body,
            color: ARK_TOKENS.inkMuted,
            margin: '0 auto 20px',
            maxWidth: 360,
            lineHeight: ARK_TOKENS.leading.normal,
          }}
        >
          {body}
        </div>
        <Btn variant="primary" size="lg" icon={<Ico.plus size={14} />} onClick={onCreate}>
          Create new story
        </Btn>
      </div>
    </div>
  );
}
