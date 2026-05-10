import { useState } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Badge, Ico } from '../ui';
import { evaluateDraft } from '../../lib/storyCompletion';
import type { StoryDraft } from '../../types';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DraftRailItemProps {
  draft: StoryDraft;
  selected: boolean;
  onSelect: () => void;
}

export function DraftRailItem({ draft, selected, onSelect }: DraftRailItemProps) {
  const [hover, setHover] = useState(false);
  const completion = evaluateDraft(draft);
  const missingCount = completion.total - completion.filled;
  const title = draft.title?.trim() || 'Untitled story';

  const background = selected
    ? ARK_TOKENS.azureFaint
    : hover
      ? ARK_TOKENS.surfaceAlt
      : 'transparent';

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '12px 14px 12px 17px',
        borderTop: `1px solid ${ARK_TOKENS.border}`,
        background,
        cursor: 'pointer',
        transition: 'background 0.12s',
        borderLeft: `3px solid ${selected ? ARK_TOKENS.azure : 'transparent'}`,
        marginLeft: -3,
      }}
    >
      {/* Line 1: title + missing-fields badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <div
          title={title}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: ARK_TOKENS.type.body,
            fontWeight: selected ? ARK_TOKENS.weight.semibold : ARK_TOKENS.weight.medium,
            color: ARK_TOKENS.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {missingCount > 0 && (
          <Badge tone={missingCount >= 4 ? 'warning' : 'default'}>
            {missingCount} to fill
          </Badge>
        )}
      </div>

      {/* Line 2: parent type + workItemId + last edited */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: ARK_TOKENS.type.micro,
          color: ARK_TOKENS.inkSubtle,
          minWidth: 0,
        }}
      >
        {draft.workItemType && (
          <Badge tone="azure">{draft.workItemType}</Badge>
        )}
        {draft.workItemId && (
          <span
            style={{
              color: ARK_TOKENS.azure,
              fontFamily: ARK_TOKENS.mono,
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            #{draft.workItemId}
          </span>
        )}
        <span style={{ color: ARK_TOKENS.inkSubtle, flexShrink: 0 }}>·</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Ico.list size={9} />
          {formatTimeAgo(draft.updatedAt)}
        </span>
      </div>
    </div>
  );
}
