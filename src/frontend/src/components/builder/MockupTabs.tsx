import { useState, type ReactNode } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Btn, Ico } from '../ui';
import type { DraftMockup } from '../../types';

interface MockupPanelProps {
  mockup: DraftMockup | undefined;
  showInsufficient: boolean;
  generating?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Renders the right-pane content for the Mockup tab: a spinner while
 * generating, the sanitized HTML when status === 'ok', or an inline
 * warn panel when status === 'insufficient' (gated on showInsufficient).
 * Returns null if there's nothing meaningful to show.
 */
export function MockupPanel({
  mockup,
  showInsufficient,
  generating,
  onRefresh,
  refreshing,
}: MockupPanelProps) {
  const hasOk = mockup?.status === 'ok' && !!mockup.html;
  const hasInsufficient = mockup?.status === 'insufficient' && showInsufficient;

  if (generating) {
    return (
      <div
        style={{
          border: `1px solid ${ARK_TOKENS.border}`,
          borderRadius: ARK_TOKENS.r2,
          background: ARK_TOKENS.surface,
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: `3px solid ${ARK_TOKENS.aiLight}`,
            borderTopColor: ARK_TOKENS.ai,
            borderRadius: '50%',
            animation: 'ark-spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted }}>
          Generating Interactive GUI…
        </div>
      </div>
    );
  }

  if (hasOk && mockup?.html) {
    // Render the full HTML document inside a sandboxed iframe so Claude's
    // <script>/<style>/event handlers run safely, isolated from the parent app.
    // sandbox="allow-scripts" (no allow-same-origin, no allow-forms, no allow-popups,
    // no allow-top-navigation) means the mockup runs in a unique opaque origin —
    // no access to cookies, localStorage, parent DOM, or top-frame navigation.
    //
    // Sized to the viewport so the prototype fills the browser window. The
    // 120px offset is approximately TopBar (56) + tab strip (40) + a small
    // breathing margin (24).
    return (
      <iframe
        title="Interactive GUI mockup"
        srcDoc={mockup.html}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: 'calc(100vh - 120px)',
          minHeight: 400,
          border: `1px solid ${ARK_TOKENS.border}`,
          borderRadius: ARK_TOKENS.r2,
          background: ARK_TOKENS.surface,
          display: 'block',
        }}
      />
    );
  }

  if (hasInsufficient && mockup) {
    return (
      <div
        style={{
          border: `1px solid ${ARK_TOKENS.danger}`,
          borderRadius: ARK_TOKENS.r2,
          background: ARK_TOKENS.dangerBg,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ color: ARK_TOKENS.danger, marginTop: 2, flexShrink: 0 }}>
            <Ico.warn size={16} />
          </span>
          <div>
            <div style={{ fontWeight: ARK_TOKENS.weight.semibold, marginBottom: 4 }}>
              Not enough info to build the Interactive GUI yet
            </div>
            <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted }}>
              {mockup.insufficientReason || 'Story is too thin — add more detail and try again.'}
            </div>
          </div>
        </div>
        {onRefresh && (
          <div>
            <Btn onClick={onRefresh} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh Interactive GUI'}
            </Btn>
          </div>
        )}
      </div>
    );
  }

  // Empty state — no mockup attempted yet.
  return (
    <div
      style={{
        border: `1px dashed ${ARK_TOKENS.borderStrong}`,
        borderRadius: ARK_TOKENS.r2,
        background: ARK_TOKENS.surfaceAlt,
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ color: ARK_TOKENS.ai, fontSize: 32, lineHeight: 1 }}>✷</div>
      <div style={{ fontSize: ARK_TOKENS.type.h2, fontWeight: ARK_TOKENS.weight.semibold }}>
        No Interactive GUI yet
      </div>
      <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, maxWidth: 420 }}>
        Generate an AI mockup of this story to validate the design before pushing.
      </div>
      {onRefresh && (
        <div style={{ marginTop: 8 }}>
          <Btn variant="primary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Generating…' : '✷ Generate Interactive GUI'}
          </Btn>
        </div>
      )}
    </div>
  );
}

interface MockupTabsProps {
  storyContent: ReactNode;
  mockup: DraftMockup | undefined;
  showInsufficient: boolean;
  generating?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function MockupTabs({
  storyContent,
  mockup,
  showInsufficient,
  generating,
  onRefresh,
  refreshing,
}: MockupTabsProps) {
  const hasInsufficient = mockup?.status === 'insufficient' && showInsufficient;

  const [active, setActive] = useState<'story' | 'mockup'>('story');
  const isMockup = active === 'mockup';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: `1px solid ${ARK_TOKENS.border}`,
          marginBottom: 16,
        }}
      >
        <TabButton active={!isMockup} onClick={() => setActive('story')}>
          User Story
        </TabButton>
        <TabButton active={isMockup} onClick={() => setActive('mockup')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Interactive GUI
            <MockupTabBadge generating={!!generating} hasInsufficient={hasInsufficient} />
          </span>
        </TabButton>
      </div>

      {!isMockup && storyContent}
      {isMockup && (
        <MockupPanel
          mockup={mockup}
          showInsufficient={showInsufficient}
          generating={generating}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      )}
    </div>
  );
}

interface MockupTabBadgeProps {
  generating: boolean;
  hasInsufficient: boolean;
}

export function MockupTabBadge({ generating, hasInsufficient }: MockupTabBadgeProps) {
  if (generating) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: 12,
          border: `2px solid ${ARK_TOKENS.aiLight}`,
          borderTopColor: ARK_TOKENS.ai,
          borderRadius: '50%',
          animation: 'ark-spin 0.8s linear infinite',
        }}
      />
    );
  }
  return (
    <span
      style={{
        color: hasInsufficient ? ARK_TOKENS.danger : ARK_TOKENS.ai,
        fontWeight: ARK_TOKENS.weight.semibold,
      }}
    >
      {hasInsufficient ? '⚠' : '✷'}
    </span>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function MockupTabButton({ active, onClick, children }: TabButtonProps) {
  return TabButton({ active, onClick, children });
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 'none',
        background: 'transparent',
        padding: '8px 14px',
        fontSize: ARK_TOKENS.type.label,
        fontWeight: active ? ARK_TOKENS.weight.semibold : ARK_TOKENS.weight.medium,
        color: active ? ARK_TOKENS.ink : ARK_TOKENS.inkMuted,
        cursor: 'pointer',
        borderBottom: `2px solid ${active ? ARK_TOKENS.azure : 'transparent'}`,
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}
