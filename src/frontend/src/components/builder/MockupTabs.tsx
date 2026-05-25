import { useMemo, useState, type ReactNode } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { ARK_TOKENS } from '../../tokens';
import { Btn, Ico } from '../ui';
import type { DraftMockup } from '../../types';

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'button', 'input', 'label',
    'hr', 'br', 'strong', 'em', 'code', 'small',
    'figure', 'figcaption', 'img',
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'type', 'placeholder', 'value', 'checked',
    'disabled', 'alt', 'src', 'width', 'height', 'for', 'role', 'aria-label',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'link', 'meta', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit'],
};

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

  const sanitizedHtml = useMemo(() => {
    if (!hasOk || !mockup?.html) return '';
    return DOMPurify.sanitize(mockup.html, SANITIZE_CONFIG);
  }, [hasOk, mockup?.html]);

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

  if (hasOk) {
    return (
      <div
        className="ark-mockup-frame"
        style={{
          border: `1px solid ${ARK_TOKENS.border}`,
          borderRadius: ARK_TOKENS.r2,
          background: ARK_TOKENS.surface,
          padding: 16,
          overflowX: 'auto',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
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

  return null;
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
  const hasOk = mockup?.status === 'ok' && !!mockup.html;
  const hasInsufficient = mockup?.status === 'insufficient' && showInsufficient;
  const renderTabs = hasOk || hasInsufficient || !!generating;

  const [active, setActive] = useState<'story' | 'mockup'>('story');

  if (!renderTabs) {
    return <>{storyContent}</>;
  }

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
