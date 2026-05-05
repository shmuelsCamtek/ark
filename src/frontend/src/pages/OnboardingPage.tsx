import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ARK_TOKENS } from '../tokens';
import { ArkLogo, Btn, Badge, Ico } from '../components/ui';
import { useNavigate } from '../router';
import { useApp, createEmptyDraft } from '../context/AppContext';
import { HttpAzureService } from '../services/http-azure';
import type { WorkItemInfo, WorkItemAttachment, WorkItemComment } from '../types';

interface ResolvedItem {
  id: number;
  title: string;
  type: string;
  project: string;
  area: string;
  state: string;
  assignedTo?: string;
  description?: string;
  reproSteps?: string;
  technicalDescription?: string;
  children: number;
  color: string;
  notFound?: boolean;
  attachments?: WorkItemAttachment[];
  discussion?: WorkItemComment[];
  linkedWorkItems?: WorkItemInfo[];
}

function workItemColor(type: string): string {
  switch (type) {
    case 'Bug': return '#cc293d';
    case 'Epic': return '#ff7b00';
    case 'Task': return '#f2cb1d';
    default: return '#773b93';
  }
}

function toResolved(item: WorkItemInfo): ResolvedItem {
  return {
    id: parseInt(item.id, 10),
    title: item.title,
    type: item.type,
    project: item.areaPath?.split('\\')[0] || 'Project',
    area: item.areaPath || '',
    state: item.state,
    assignedTo: item.assignedTo,
    description: item.description,
    reproSteps: item.reproSteps,
    technicalDescription: item.technicalDescription,
    children: item.linkedWorkItems?.length ?? 0,
    color: workItemColor(item.type),
    attachments: item.attachments,
    discussion: item.discussion,
    linkedWorkItems: item.linkedWorkItems,
  };
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size,
        border: '2px solid currentColor', borderRightColor: 'transparent',
        borderRadius: '50%',
        animation: 'ark-spin 0.8s linear infinite',
        opacity: 0.7,
      }}
    />
  );
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { addDraft } = useApp();
  const azure = useMemo(() => new HttpAzureService(), []);
  const [workItemId, setWorkItemId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);
  const [searchResults, setSearchResults] = useState<WorkItemInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!workItemId || workItemId.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    // If we already have a resolved item matching the current input, don't search
    if (resolved && String(resolved.id) === workItemId) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const results = await azure.searchWorkItems(workItemId);
        if (cancelled) return;
        if (results.length > 0) {
          setSearchResults(results);
          setShowDropdown(true);
          setHighlightIndex(0);
        } else if (/^\d+$/.test(workItemId)) {
          // Fallback: try direct resolve for exact numeric IDs
          const item = await azure.resolveWorkItem(workItemId);
          if (cancelled) return;
          if (item) {
            setSearchResults([item]);
            setShowDropdown(true);
            setHighlightIndex(0);
          } else {
            setSearchResults([]);
            setShowDropdown(false);
            setResolved({
              id: parseInt(workItemId, 10),
              title: 'Item not found',
              type: '', project: '', area: '', state: '', children: 0, color: '',
              notFound: true,
            });
          }
        } else {
          setSearchResults([]);
          setShowDropdown(false);
        }
      } catch (err) {
        console.error('[onboarding] search failed:', err);
        if (cancelled) return;
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [workItemId, azure, resolved]);

  const selectItem = useCallback((item: WorkItemInfo) => {
    setWorkItemId(item.id);
    setResolved(toResolved(item));
    setShowDropdown(false);
    setSearchResults([]);

    // Re-resolve to get full data including attachments
    azure.resolveWorkItem(item.id).then((full) => {
      if (full) setResolved(toResolved(full));
    });
  }, [azure]);

  const handleFinish = () => {
    setConnecting(true);
    setTimeout(() => {
      const hasItem = resolved && !resolved.notFound;

      // Convert work item attachments to supporting docs
      const supportingDocs = (hasItem && resolved.attachments || []).map((att) => {
        const ext = att.name.split('.').pop()?.toLowerCase() || '';
        const type: 'pdf' | 'image' | 'other' = ext === 'pdf' ? 'pdf'
          : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext) ? 'image'
          : 'other';
        return {
          id: att.id,
          name: att.name,
          type,
          scanned: false,
        };
      });

      const draft = createEmptyDraft({
        title: hasItem ? resolved.title : '',
        workItemId: workItemId,
        workItemType: hasItem ? resolved.type : undefined,
        workItemState: hasItem ? resolved.state : undefined,
        workItemAssignedTo: hasItem ? resolved.assignedTo : undefined,
        workItemDescription: hasItem ? resolved.description : undefined,
        workItemReproSteps: hasItem ? resolved.reproSteps : undefined,
        workItemTechnicalDescription: hasItem ? resolved.technicalDescription : undefined,
        workItemDiscussion: hasItem ? resolved.discussion : undefined,
        linkedWorkItems: hasItem ? resolved.linkedWorkItems : undefined,
        epicId: hasItem ? String(resolved.id) : undefined,
        epicName: hasItem ? resolved.title : undefined,
        supportingDocs,
      });
      addDraft(draft);
      navigate(`/stories/${draft.id}/edit`);
    }, 900);
  };

  return (
    <div
      style={{
        width: '100%', height: '100vh',
        background: `linear-gradient(135deg, ${ARK_TOKENS.azureFaint} 0%, ${ARK_TOKENS.bg} 50%, ${ARK_TOKENS.aiFaint} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
      }}
    >
      <div
        style={{
          width: 600,
          background: ARK_TOKENS.surface,
          borderRadius: ARK_TOKENS.r3,
          boxShadow: ARK_TOKENS.shadow3,
          padding: 40,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <ArkLogo size={28} />
          <div style={{ display: 'flex', gap: 4 }} />
        </div>

        {/* Connect to Azure DevOps */}
        {(
          <div className="ark-fadein">
            <div style={{ fontSize: 13, fontWeight: 600, color: ARK_TOKENS.azure, letterSpacing: 0.8, marginBottom: 8 }}>CONNECT TO AZURE DEVOPS</div>
            <h1 style={{ fontSize: 29, fontWeight: 600, margin: '0 0 8px', letterSpacing: -0.4 }}>Where should your story go?</h1>
            <p style={{ fontSize: 17, color: ARK_TOKENS.inkMuted, margin: '0 0 24px' }}>
              Paste the Work Item ID this story belongs to, and pick the project type.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'block' }}>Parent Work Item</label>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center',
                      border: `1px solid ${resolved && !resolved.notFound ? ARK_TOKENS.success : ARK_TOKENS.borderStrong}`,
                      borderRadius: ARK_TOKENS.r,
                      background: ARK_TOKENS.surface, height: 36, overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '0 10px', color: ARK_TOKENS.inkSubtle, height: '100%',
                        display: 'flex', alignItems: 'center', fontSize: 17,
                        borderRight: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surfaceAlt,
                      }}
                    >
                      <Ico.search size={14} />
                    </div>
                    <input
                      ref={inputRef}
                      value={workItemId}
                      onChange={(e) => {
                        setWorkItemId(e.target.value);
                        // Clear resolved when user edits
                        if (resolved && e.target.value !== String(resolved.id)) {
                          setResolved(null);
                        }
                      }}
                      onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                      onBlur={() => setShowDropdown(false)}
                      onKeyDown={(e) => {
                        if (!showDropdown) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightIndex((i) => Math.min(i + 1, searchResults.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightIndex((i) => Math.max(i - 1, 0));
                        } else if (e.key === 'Enter' && searchResults[highlightIndex]) {
                          e.preventDefault();
                          selectItem(searchResults[highlightIndex]);
                        } else if (e.key === 'Escape') {
                          setShowDropdown(false);
                        }
                      }}
                      placeholder="Search by ID or title..."
                      style={{
                        flex: 1, border: 'none', height: '100%', padding: '0 12px',
                        background: 'transparent', outline: 'none',
                        fontFamily: ARK_TOKENS.mono, fontWeight: 600,
                      }}
                    />
                    {resolved && !resolved.notFound && (
                      <div style={{ color: ARK_TOKENS.success, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                        <Ico.check size={14} />
                      </div>
                    )}
                  </div>

                  {/* Search dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        marginTop: 4, background: ARK_TOKENS.surface,
                        border: `1px solid ${ARK_TOKENS.borderStrong}`,
                        borderRadius: ARK_TOKENS.r2,
                        boxShadow: ARK_TOKENS.shadow3,
                        zIndex: 50, maxHeight: 260, overflowY: 'auto',
                      }}
                    >
                      {searchResults.map((item, idx) => (
                        <div
                          key={item.id}
                          onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', cursor: 'pointer',
                            background: idx === highlightIndex ? ARK_TOKENS.surfaceAlt : 'transparent',
                          }}
                        >
                          <div style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, background: workItemColor(item.type) }} />
                          <div style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle, fontWeight: 600, flexShrink: 0 }}>
                            {item.type} #{item.id}
                          </div>
                          <div style={{
                            flex: 1, fontSize: 16, fontWeight: 500, minWidth: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 12, color: ARK_TOKENS.inkSubtle, flexShrink: 0 }}>
                            {item.state}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolved preview */}
                {resolved && (
                  <div
                    className="ark-fadein"
                    style={{
                      marginTop: 8, padding: 12,
                      background: resolved.notFound ? ARK_TOKENS.dangerBg : ARK_TOKENS.azureFaint,
                      border: `1px solid ${resolved.notFound ? ARK_TOKENS.danger : ARK_TOKENS.azureLight}`,
                      borderRadius: ARK_TOKENS.r2,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    {resolved.notFound ? (
                      <>
                        <span style={{ color: ARK_TOKENS.danger, display: 'flex' }}><Ico.warn size={16} /></span>
                        <div style={{ fontSize: 14, color: ARK_TOKENS.danger }}>
                          Couldn&apos;t find #{workItemId} in this organization. Check the ID or your permissions.
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 14, height: 14, background: resolved.color, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.5, marginBottom: 2 }}>
                            {resolved.type.toUpperCase()} · #{resolved.id}
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {resolved.title}
                          </div>
                          {resolved.attachments && resolved.attachments.length > 0 && (
                            <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Ico.file size={10} />
                              {resolved.attachments.length} attachment{resolved.attachments.length === 1 ? '' : 's'} will be imported
                            </div>
                          )}
                        </div>
                        <Badge tone="success">LINKED</Badge>
                      </>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Ico.info size={12} /> Your new story will be created as a child of this item.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => navigate('/stories')}>Cancel</Btn>
              <div style={{ flex: 1 }} />
              <Btn
                variant="primary"
                onClick={handleFinish}
                disabled={connecting || !resolved || resolved.notFound}
                icon={connecting ? <Spinner /> : <Ico.arrow size={14} />}
              >
                {connecting ? 'Connecting\u2026' : 'Start writing'}
              </Btn>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          fontSize: 13, color: ARK_TOKENS.inkSubtle,
        }}
      >
        Ark · For organization experts who speak business, not backlog
      </div>
    </div>
  );
}
