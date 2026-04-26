// Drafts dashboard — landing screen between Welcome and Connect.
// Lists saved drafts (Resume / Rename / Duplicate / Delete) and a "New story" CTA.

function DraftsDashboard({ drafts: draftsProp, onNewStory = () => {}, onResume = () => {}, empty = false }) {
  const SAMPLE_DRAFTS = [
    {
      id: 'd-204',
      title: 'Auto-retry failed Pro subscription renewals',
      persona: 'Support engineer',
      area: 'Support Platform · Billing',
      epic: { id: '#3994', title: 'Reduce involuntary churn on Pro renewals' },
      filled: 7, total: 9,
      lastEdited: '12 min ago',
      owner: 'Maya Patel',
      ownerColor: '#008FBE',
      acCount: 3,
    },
    {
      id: 'd-198',
      title: 'Bulk refund for failed onboarding charges',
      persona: 'Tier-2 support specialist',
      area: 'Support Platform · Billing',
      epic: { id: '#3712', title: 'Refund tooling consolidation' },
      filled: 5, total: 9,
      lastEdited: '2h ago',
      owner: 'Maya Patel',
      ownerColor: '#008FBE',
      acCount: 1,
    },
    {
      id: 'd-187',
      title: 'Surface SLA breach risk on the queue view',
      persona: 'CS manager',
      area: 'Support Platform · Operations',
      epic: null,
      filled: 3, total: 9,
      lastEdited: 'Yesterday',
      owner: 'Maya Patel',
      ownerColor: '#008FBE',
      acCount: 0,
    },
  ];

  const drafts = empty ? [] : (draftsProp || SAMPLE_DRAFTS);
  const [query, setQuery] = React.useState('');
  const [openMenuFor, setOpenMenuFor] = React.useState(null);

  const filtered = drafts.filter(d =>
    !query.trim() || d.title.toLowerCase().includes(query.toLowerCase())
  );

  React.useEffect(() => {
    if (!openMenuFor) return;
    const close = () => setOpenMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuFor]);

  return (
    <div className="ark-root" style={{
      width: '100%', height: '100%', background: ARK_TOKENS.bg,
      fontFamily: ARK_TOKENS.font, color: ARK_TOKENS.ink,
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar breadcrumbs={['Ark', 'My stories']} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px 80px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: ARK_TOKENS.azure, letterSpacing: 0.8, marginBottom: 6 }}>MY STORIES</div>
              <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: -0.4 }}>Pick up where you left off</h1>
              <p style={{ fontSize: 13, color: ARK_TOKENS.inkMuted, margin: '6px 0 0', lineHeight: 1.5 }}>
                Drafts stay here until you push them to Azure DevOps. Start a new story or resume one in progress.
              </p>
            </div>
            <Btn variant="primary" size="lg" icon={<Ico.plus size={14} />} onClick={onNewStory}>
              New story
            </Btn>
          </div>

          {/* Search bar */}
          {drafts.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: ARK_TOKENS.surface,
              border: `1px solid ${ARK_TOKENS.border}`,
              borderRadius: ARK_TOKENS.r2,
              padding: '8px 12px', marginBottom: 12,
            }}>
              <Ico.search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search drafts…"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, fontFamily: 'inherit', color: ARK_TOKENS.ink,
                }}
              />
              <span style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle, fontVariantNumeric: 'tabular-nums' }}>
                {filtered.length} of {drafts.length}
              </span>
            </div>
          )}

          {/* Drafts list — or empty state */}
          {drafts.length === 0 ? (
            <EmptyDraftsState onNewStory={onNewStory} />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column',
              background: ARK_TOKENS.surface,
              border: `1px solid ${ARK_TOKENS.border}`,
              borderRadius: ARK_TOKENS.r2,
              overflow: 'hidden',
            }}>
              {filtered.map((d, i) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  isFirst={i === 0}
                  onResume={() => onResume(d)}
                  menuOpen={openMenuFor === d.id}
                  onMenuToggle={(e) => { e.stopPropagation(); setOpenMenuFor(openMenuFor === d.id ? null : d.id); }}
                />
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: ARK_TOKENS.inkMuted, fontSize: 13 }}>
                  No drafts match “{query}”.
                </div>
              )}
            </div>
          )}

          {/* Footer hint */}
          {drafts.length > 0 && (
            <div style={{ marginTop: 16, fontSize: 12, color: ARK_TOKENS.inkSubtle, display: 'flex', gap: 16 }}>
              <span>{drafts.length} draft{drafts.length === 1 ? '' : 's'} · synced to your account</span>
              <span style={{ flex: 1 }} />
              <a style={{ color: ARK_TOKENS.azure, textDecoration: 'none' }} href="#">View pushed stories in Azure ↗</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftRow({ draft: d, isFirst, onResume, menuOpen, onMenuToggle }) {
  const [hover, setHover] = React.useState(false);
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
      }}>

      {/* Title + persona/area */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: ARK_TOKENS.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {d.title}
          </div>
          {d.acCount === 0 && (
            <Badge tone="warning">Needs ACs</Badge>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: ARK_TOKENS.inkMuted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Ico.user size={11} /> {d.persona}
          </span>
          <span style={{ color: ARK_TOKENS.inkSubtle }}>·</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.area}</span>
        </div>
        {d.epic && (
          <div style={{ marginTop: 4, fontSize: 11, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, background: '#773b93', borderRadius: 1, flexShrink: 0 }} />
            <span style={{ color: ARK_TOKENS.azure, fontVariantNumeric: 'tabular-nums' }}>Epic {d.epic.id}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.epic.title}</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: ARK_TOKENS.inkMuted, marginBottom: 4 }}>
          <span>{d.filled} of {d.total} fields</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: ARK_TOKENS.ink, fontWeight: 500 }}>{pct}%</span>
        </div>
        <div style={{ height: 4, background: ARK_TOKENS.surfaceAlt, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: pct >= 75 ? ARK_TOKENS.success : pct >= 40 ? ARK_TOKENS.azure : ARK_TOKENS.warning,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Last edited */}
      <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, fontVariantNumeric: 'tabular-nums' }}>
        {d.lastEdited}
      </div>

      {/* Owner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar name={d.owner} size={22} color={d.ownerColor} />
        <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.owner.split(' ')[0]}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <Btn size="sm" variant={hover ? 'primary' : 'default'} onClick={(e) => { e.stopPropagation(); onResume(); }}>
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
            <circle cx="3" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="13" cy="8" r="1.4"/>
          </svg>
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', right: 18, top: 'calc(100% - 6px)',
            background: ARK_TOKENS.surface,
            border: `1px solid ${ARK_TOKENS.border}`,
            borderRadius: ARK_TOKENS.r2,
            boxShadow: ARK_TOKENS.shadow2,
            padding: 4, minWidth: 140, zIndex: 10,
          }} onClick={(e) => e.stopPropagation()}>
            <DraftMenuItem icon={<Ico.edit size={12} />}>Rename</DraftMenuItem>
            <DraftMenuItem icon={<Ico.copy size={12} />}>Duplicate</DraftMenuItem>
            <DraftMenuItem icon={<TrashIcon size={12} />} danger>Delete draft</DraftMenuItem>
          </div>
        )}
      </div>
    </div>
  );
}

function TrashIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V2.5h4V4M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DraftMenuItem({ icon, children, danger }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', fontSize: 12.5,
        color: danger ? ARK_TOKENS.danger : ARK_TOKENS.ink,
        cursor: 'pointer', borderRadius: ARK_TOKENS.r,
        background: hover ? (danger ? ARK_TOKENS.dangerBg : ARK_TOKENS.surfaceAlt) : 'transparent',
      }}>
      {icon}
      <span>{children}</span>
    </div>
  );
}

function EmptyDraftsState({ onNewStory }) {
  return (
    <div style={{
      background: ARK_TOKENS.surface,
      border: `1px dashed ${ARK_TOKENS.borderStrong}`,
      borderRadius: ARK_TOKENS.r2,
      padding: '56px 32px', textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, margin: '0 auto 16px',
        borderRadius: 24, background: ARK_TOKENS.azureFaint,
        color: ARK_TOKENS.azure,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico.list size={20} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No drafts yet</div>
      <div style={{ fontSize: 13, color: ARK_TOKENS.inkMuted, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.5 }}>
        Start a new user story and Ark will guide you through writing one developers can pick up without questions.
      </div>
      <Btn variant="primary" size="lg" icon={<Ico.plus size={14} />} onClick={onNewStory}>
        New story
      </Btn>
    </div>
  );
}
