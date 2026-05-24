import { useMemo, useState, type ReactNode } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { ARK_TOKENS } from '../../tokens';
import { Btn, Ico } from '../ui';
import type { DraftMockup } from '../../types';

interface MockupTabsProps {
  storyContent: ReactNode;
  mockup: DraftMockup | undefined;
  showInsufficient: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

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

export function MockupTabs({
  storyContent,
  mockup,
  showInsufficient,
  onRefresh,
  refreshing,
}: MockupTabsProps) {
  const hasOk = mockup?.status === 'ok' && !!mockup.html;
  const hasInsufficient = mockup?.status === 'insufficient' && showInsufficient;
  const renderTabs = hasOk || hasInsufficient;

  const [active, setActive] = useState<'story' | 'mockup'>('story');

  const sanitizedHtml = useMemo(() => {
    if (!hasOk || !mockup?.html) return '';
    return DOMPurify.sanitize(mockup.html, SANITIZE_CONFIG);
  }, [hasOk, mockup?.html]);

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
          Story
        </TabButton>
        <TabButton active={isMockup} onClick={() => setActive('mockup')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Mockup
            <span
              style={{
                color: hasInsufficient ? ARK_TOKENS.danger : ARK_TOKENS.ai,
                fontWeight: ARK_TOKENS.weight.semibold,
              }}
            >
              {hasInsufficient ? '⚠' : '✷'}
            </span>
          </span>
        </TabButton>
      </div>

      {!isMockup && storyContent}

      {isMockup && hasOk && (
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
      )}

      {isMockup && hasInsufficient && mockup && (
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
                Not enough info to mock up yet
              </div>
              <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted }}>
                {mockup.insufficientReason || 'Story is too thin — add more detail and try again.'}
              </div>
            </div>
          </div>
          {onRefresh && (
            <div>
              <Btn onClick={onRefresh} disabled={refreshing}>
                {refreshing ? 'Refreshing…' : 'Refresh mockup'}
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
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
