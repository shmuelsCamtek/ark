import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui';

interface RailCollapsedStripProps {
  onExpand: () => void;
}

export function RailCollapsedStrip({ onExpand }: RailCollapsedStripProps) {
  return (
    <div
      style={{
        flex: '0 0 44px',
        width: 44,
        background: ARK_TOKENS.surface,
        borderRight: `1px solid ${ARK_TOKENS.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
      }}
    >
      <button
        type="button"
        onClick={onExpand}
        title="Show My Stories"
        aria-label="Show My Stories"
        style={{
          width: 32, height: 32,
          border: 'none', background: ARK_TOKENS.azureFaint,
          color: ARK_TOKENS.azure,
          borderRadius: ARK_TOKENS.r,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ico.list size={14} />
      </button>
    </div>
  );
}
