import { ARK_TOKENS } from '../../tokens';
import { Ico } from './icons';

type DotState = 'pending' | 'active' | 'done' | 'warn';

interface StateDotProps {
  state: DotState;
}

const conf: Record<DotState, { ring: string; fill: string }> = {
  pending: { ring: ARK_TOKENS.borderStrong, fill: 'transparent' },
  active: { ring: ARK_TOKENS.azure, fill: ARK_TOKENS.azureLight },
  done: { ring: ARK_TOKENS.success, fill: ARK_TOKENS.success },
  warn: { ring: ARK_TOKENS.warning, fill: ARK_TOKENS.warningBg },
};

export function StateDot({ state }: StateDotProps) {
  const c = conf[state];
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        border: `1.5px solid ${c.ring}`,
        background: c.fill,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s',
      }}
    >
      {state === 'done' && <span style={{ color: '#fff' }}><Ico.check size={10} /></span>}
      {state === 'active' && <div style={{ width: 6, height: 6, borderRadius: 3, background: ARK_TOKENS.azure }} />}
      {state === 'warn' && <span style={{ color: ARK_TOKENS.warning, fontSize: 10, fontWeight: 700 }}>!</span>}
    </div>
  );
}
