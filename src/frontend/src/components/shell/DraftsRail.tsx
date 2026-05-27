import { useMemo, useState } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Btn, Ico } from '../ui';
import { useApp } from '../../context/AppContext';
import { useNavigate, useParams } from '../../router';
import { DraftRailItem } from './DraftRailItem';
import { useShell } from './AppShell';

interface DraftsRailProps {
  onCreate: () => void;
}

export function DraftsRail({ onCreate }: DraftsRailProps) {
  const { drafts } = useApp();
  const { id: selectedId } = useParams();
  const navigate = useNavigate();
  const { toggleRail } = useShell();
  const [query, setQuery] = useState('');
  const [hideHover, setHideHover] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().replace(/^#/, '').toLowerCase();
    const matched = q
      ? drafts.filter((d) => {
          const title = (d.title || 'Untitled story').toLowerCase();
          const wid = d.workItemId?.toLowerCase() ?? '';
          return title.includes(q) || wid.includes(q);
        })
      : drafts;
    // Most recently changed first. Copy before sorting — `drafts` is context state.
    return [...matched].sort(
      (a, b) =>
        (Date.parse(b.updatedAt || b.createdAt) || 0) -
        (Date.parse(a.updatedAt || a.createdAt) || 0),
    );
  }, [drafts, query]);

  return (
    <div
      style={{
        flex: '0 0 300px',
        width: 300,
        height: '100%',
        background: ARK_TOKENS.surface,
        borderRight: `1px solid ${ARK_TOKENS.border}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${ARK_TOKENS.space.lg}px ${ARK_TOKENS.space.lg}px ${ARK_TOKENS.space.md}px`,
          borderBottom: `1px solid ${ARK_TOKENS.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: ARK_TOKENS.space.md,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: ARK_TOKENS.space.sm,
          }}
        >
          <div
            style={{
              fontSize: ARK_TOKENS.type.micro,
              fontWeight: ARK_TOKENS.weight.semibold,
              color: ARK_TOKENS.azureDark,
              letterSpacing: 0.8,
            }}
          >
            MY STORIES
          </div>
          <button
            type="button"
            onClick={toggleRail}
            onMouseEnter={() => setHideHover(true)}
            onMouseLeave={() => setHideHover(false)}
            title="Hide sidebar"
            aria-label="Hide sidebar"
            style={{
              width: 26, height: 26,
              border: 'none',
              background: hideHover ? ARK_TOKENS.surfaceAlt : 'transparent',
              color: ARK_TOKENS.inkMuted,
              borderRadius: ARK_TOKENS.r,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <Ico.chevron size={14} dir="left" />
          </button>
        </div>
        <Btn
          variant="primary"
          size="md"
          icon={<Ico.plus size={14} />}
          onClick={onCreate}
          fullWidth
        >
          Create new story
        </Btn>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: `1px solid ${ARK_TOKENS.border}`,
            borderRadius: ARK_TOKENS.r,
            background: ARK_TOKENS.surfaceAlt,
            height: 30,
            padding: '0 10px',
            gap: 6,
          }}
        >
          <span style={{ color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center' }}>
            <Ico.search size={12} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drafts or #id"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: ARK_TOKENS.type.label,
              fontFamily: 'inherit',
              color: ARK_TOKENS.ink,
              minWidth: 0,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                border: 'none',
                background: 'transparent',
                color: ARK_TOKENS.inkSubtle,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Ico.x size={12} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div
        className="ark-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              fontSize: ARK_TOKENS.type.label,
              color: ARK_TOKENS.inkSubtle,
              textAlign: 'center',
            }}
          >
            {drafts.length === 0
              ? 'No drafts yet. Create one to get started.'
              : 'No drafts match your search.'}
          </div>
        ) : (
          filtered.map((draft) => (
            <DraftRailItem
              key={draft.id}
              draft={draft}
              selected={draft.id === selectedId}
              onSelect={() => navigate(`/stories/${draft.id}/edit`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
