import { useState, useEffect } from 'react';
import { TopBar, Btn, Badge, Avatar, Ico } from '../components/ui';
import { ARK_TOKENS } from '../tokens';
import { useApp } from '../context/AppContext';
import { useNavigate } from '../router';
import { evaluateDraft } from '../lib/storyCompletion';

interface DraftDisplay {
  id: string;
  title: string;
  persona: string;
  area: string;
  epic: { id: string; title: string } | null;
  filled: number;
  total: number;
  lastEdited: string;
  owner: string;
  ownerColor: string;
  acCount: number;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function StoriesPage() {
  const { drafts } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  const displayDrafts: DraftDisplay[] = drafts.map((d) => {
    const c = evaluateDraft(d);
    return {
      id: d.id,
      title: d.title || 'Untitled story',
      persona: d.persona || 'No persona',
      area: d.epicName ? `Stories · ${d.epicName}` : 'Stories',
      epic: d.epicId ? { id: `#${d.epicId}`, title: d.epicName || '' } : null,
      filled: c.filled,
      total: c.total,
      lastEdited: formatTimeAgo(d.updatedAt),
      owner: 'Maya Kowalski',
      ownerColor: '#1994FF',
      acCount: d.acceptanceCriteria.length,
    };
  });

  const filtered = displayDrafts.filter(
    (d) => !query.trim() || d.title.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!openMenuFor) return;
    const close = () => setOpenMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuFor]);

  const handleNewStory = () => navigate('/onboarding');
  const handleResume = (id: string) => navigate(`/stories/${id}/edit`);

  return (
    <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar breadcrumbs={['Ark', 'My stories']} />

      <div className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '40px 48px 80px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: ARK_TOKENS.azure, letterSpacing: 0.8, marginBottom: 6 }}>MY STORIES</div>
              <h1 style={{ fontSize: 31, fontWeight: 600, margin: 0, letterSpacing: -0.4 }}>Pick up where you left off</h1>
              <p style={{ fontSize: 16, color: ARK_TOKENS.inkMuted, margin: '6px 0 0', lineHeight: 1.5 }}>
                Drafts stay here until you push them to Azure DevOps. Start a new story or resume one in progress.
              </p>
            </div>
            <Btn variant="primary" size="lg" icon={<Ico.plus size={14} />} onClick={handleNewStory}>
              New story
            </Btn>
          </div>

          {/* Search */}
          {displayDrafts.length > 0 && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: ARK_TOKENS.surface,
                border: `1px solid ${ARK_TOKENS.border}`,
                borderRadius: ARK_TOKENS.r2,
                padding: '8px 12px', marginBottom: 12,
              }}
            >
              <span style={{ color: ARK_TOKENS.inkSubtle, display: 'flex' }}><Ico.search size={14} /></span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search drafts…"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 16, fontFamily: 'inherit', color: ARK_TOKENS.ink,
                }}
              />
              <span style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle, fontVariantNumeric: 'tabular-nums' }}>
                {filtered.length} of {displayDrafts.length}
              </span>
            </div>
          )}

          {/* List or empty */}
          {displayDrafts.length === 0 ? (
            <EmptyDraftsState onNewStory={handleNewStory} />
          ) : (
            <div
              style={{
                display: 'flex', flexDirection: 'column',
                background: ARK_TOKENS.surface,
                border: `1px solid ${ARK_TOKENS.border}`,
                borderRadius: ARK_TOKENS.r2,
                overflow: 'hidden',
              }}
            >
              {filtered.map((d, i) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  isFirst={i === 0}
                  onResume={() => handleResume(d.id)}
                  menuOpen={openMenuFor === d.id}
                  onMenuToggle={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    setOpenMenuFor(openMenuFor === d.id ? null : d.id);
                  }}
                />
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: ARK_TOKENS.inkMuted, fontSize: 16 }}>
                  No drafts match &ldquo;{query}&rdquo;.
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {displayDrafts.length > 0 && (
            <div style={{ marginTop: 16, fontSize: 14, color: ARK_TOKENS.inkSubtle, display: 'flex', gap: 16 }}>
              <span>{displayDrafts.length} draft{displayDrafts.length === 1 ? '' : 's'} · synced to your account</span>
              <span style={{ flex: 1 }} />
              <a style={{ color: ARK_TOKENS.azure, textDecoration: 'none' }} href="#">View pushed stories in Azure ↗</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftRow({
  draft: d,
  isFirst,
  onResume,
  menuOpen,
  onMenuToggle,
}: {
  draft: DraftDisplay;
  isFirst: boolean;
  onResume: () => void;
  menuOpen: boolean;
  onMenuToggle: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  const pct = Math.round((d.filled / d.total) * 100);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onResume}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 160px 120px 110px 80px',
        gap: 16,
        alignItems: 'center',
        padding: '14px 18px',
        borderTop: isFirst ? 'none' : `1px solid ${ARK_TOKENS.border}`,
        background: hover ? ARK_TOKENS.surfaceAlt : 'transparent',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.12s',
      }}
    >
      {/* Title + persona/area */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div
            style={{
              fontSize: 17, fontWeight: 600, color: ARK_TOKENS.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {d.title}
          </div>
          {d.acCount === 0 && <Badge tone="warning">Needs ACs</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: ARK_TOKENS.inkMuted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Ico.user size={11} /> {d.persona}
          </span>
          <span style={{ color: ARK_TOKENS.inkSubtle }}>·</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.area}</span>
        </div>
        {d.epic && (
          <div style={{ marginTop: 4, fontSize: 13, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, background: '#773b93', borderRadius: 1, flexShrink: 0 }} />
            <span style={{ color: ARK_TOKENS.azure, fontVariantNumeric: 'tabular-nums' }}>Epic {d.epic.id}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.epic.title}</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: ARK_TOKENS.inkMuted, marginBottom: 4 }}>
          <span>{d.filled} of {d.total} fields</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: ARK_TOKENS.ink, fontWeight: 500 }}>{pct}%</span>
        </div>
        <div style={{ height: 4, background: ARK_TOKENS.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`, height: '100%',
              background: pct >= 75 ? ARK_TOKENS.success : pct >= 40 ? ARK_TOKENS.azure : ARK_TOKENS.warning,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      {/* Last edited */}
      <div style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
        {d.lastEdited}
      </div>

      {/* Owner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={d.owner} size={22} color={d.ownerColor} />
        <div style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.owner.split(' ')[0]}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <Btn
          size="sm"
          variant={hover ? 'primary' : 'default'}
          onClick={() => { onResume(); }}
        >
          Resume
        </Btn>
        <button
          onClick={onMenuToggle}
          style={{
            width: 28, height: 28, border: 'none', background: 'transparent',
            color: ARK_TOKENS.inkMuted, cursor: 'pointer', borderRadius: ARK_TOKENS.r,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="More actions"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" />
          </svg>
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute', right: 18, top: 'calc(100% - 6px)',
              background: ARK_TOKENS.surface,
              border: `1px solid ${ARK_TOKENS.border}`,
              borderRadius: ARK_TOKENS.r2,
              boxShadow: ARK_TOKENS.shadow2,
              padding: 4, minWidth: 140, zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <DraftMenuItem icon={<Ico.edit size={12} />}>Rename</DraftMenuItem>
            <DraftMenuItem icon={<Ico.copy size={12} />}>Duplicate</DraftMenuItem>
            <DraftMenuItem icon={<TrashIcon />} danger>Delete draft</DraftMenuItem>
          </div>
        )}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V2.5h4V4M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DraftMenuItem({ icon, children, danger }: { icon: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', fontSize: 15,
        color: danger ? ARK_TOKENS.danger : ARK_TOKENS.ink,
        cursor: 'pointer', borderRadius: ARK_TOKENS.r,
        background: hover ? (danger ? ARK_TOKENS.dangerBg : ARK_TOKENS.surfaceAlt) : 'transparent',
      }}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function EmptyDraftsState({ onNewStory }: { onNewStory: () => void }) {
  return (
    <div
      style={{
        background: ARK_TOKENS.surface,
        border: `1px dashed ${ARK_TOKENS.borderStrong}`,
        borderRadius: ARK_TOKENS.r2,
        padding: '56px 32px', textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 48, height: 48, margin: '0 auto 16px',
          borderRadius: 24, background: ARK_TOKENS.azureFaint,
          color: ARK_TOKENS.azure,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ico.list size={20} />
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>No drafts yet</div>
      <div style={{ fontSize: 16, color: ARK_TOKENS.inkMuted, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.5 }}>
        Start a new user story and Ark will guide you through writing one developers can pick up without questions.
      </div>
      <Btn variant="primary" size="lg" icon={<Ico.plus size={14} />} onClick={onNewStory}>
        New story
      </Btn>
    </div>
  );
}
