import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Badge, Btn, Ico, Modal } from '../ui';
import { useNavigate } from '../../router';
import { createEmptyDraft, useApp } from '../../context/AppContext';
import { HttpAzureService } from '../../services/http-azure';
import { buildContextEntry } from '../../lib/contextLog';
import type { ContextLogEntry, WorkItemAttachment, WorkItemComment, WorkItemInfo } from '../../types';

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

interface NewStoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewStoryModal({ open, onClose }: NewStoryModalProps) {
  const navigate = useNavigate();
  const { addDraft } = useApp();
  const azure = useMemo(() => new HttpAzureService(), []);
  const [workItemId, setWorkItemId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);
  const [searchResults, setSearchResults] = useState<WorkItemInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset modal state every time it reopens
  useEffect(() => {
    if (!open) {
      setWorkItemId('');
      setResolved(null);
      setSearchResults([]);
      setShowDropdown(false);
      setHighlightIndex(0);
      setSearching(false);
      setConnecting(false);
    }
  }, [open]);

  // Focus the input when the modal opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (!workItemId || workItemId.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setSearching(false);
      return;
    }
    if (resolved && String(resolved.id) === workItemId) {
      setSearching(false);
      return;
    }

    setSearching(true);
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
        console.error('[new-story-modal] search failed:', err);
        if (cancelled) return;
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, workItemId, azure, resolved]);

  const selectItem = useCallback((item: WorkItemInfo) => {
    setWorkItemId(item.id);
    setResolved(toResolved(item));
    setShowDropdown(false);
    setSearchResults([]);

    azure.resolveWorkItem(item.id).then((full) => {
      if (full) setResolved(toResolved(full));
    });
  }, [azure]);

  const handleFinish = () => {
    setConnecting(true);
    setTimeout(() => {
      const hasItem = resolved && !resolved.notFound;

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
          url: att.url,
        };
      });

      const contextLog: ContextLogEntry[] = [];
      if (hasItem) {
        const now = new Date().toISOString();
        contextLog.push(buildContextEntry({
          kind: 'workItem',
          label: `${resolved.type || 'Work item'} #${resolved.id} — ${resolved.title}`,
          summary: resolved.description?.replace(/\s+/g, ' ').slice(0, 140),
          addedAt: now,
        }));
        for (const linked of resolved.linkedWorkItems || []) {
          contextLog.push(buildContextEntry({
            kind: 'linkedWorkItem',
            label: `${linked.linkType ?? 'Linked'} · ${linked.type} #${linked.id} — ${linked.title}`,
            summary: linked.description?.replace(/\s+/g, ' ').slice(0, 140),
            addedAt: now,
          }));
        }
      }

      const draft = createEmptyDraft({
        title: hasItem ? resolved.title : '',
        workItemId: workItemId,
        workItemType: hasItem ? resolved.type : undefined,
        workItemTitle: hasItem ? resolved.title : undefined,
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
        contextLog,
      });
      addDraft(draft);
      navigate(`/stories/${draft.id}/edit`);
      onClose();
    }, 900);
  };

  return (
    <Modal open={open} onClose={onClose} width={600} closeOnBackdrop={!connecting} closeOnEscape={!connecting}>
      <div style={{ padding: 32, fontSize: ARK_TOKENS.type.body }}>
        <h1 style={{ fontSize: ARK_TOKENS.type.display, fontWeight: ARK_TOKENS.weight.semibold, margin: '0 0 6px', letterSpacing: -0.3, lineHeight: ARK_TOKENS.leading.tight }}>Pick a work item</h1>
        <p style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, margin: `0 0 ${ARK_TOKENS.space.xl}px` }}>
          Search by ID or title.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: ARK_TOKENS.space.lg, marginBottom: ARK_TOKENS.space.xl }}>
          <div>
            <label style={{ fontSize: ARK_TOKENS.type.label, fontWeight: ARK_TOKENS.weight.semibold, marginBottom: ARK_TOKENS.space.xs, display: 'block' }}>Parent Work Item</label>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center',
                  border: `1px solid ${resolved && !resolved.notFound ? ARK_TOKENS.success : ARK_TOKENS.borderStrong}`,
                  borderRadius: ARK_TOKENS.r,
                  background: ARK_TOKENS.surface, height: 32, overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '0 10px', color: ARK_TOKENS.inkSubtle, height: '100%',
                    display: 'flex', alignItems: 'center', fontSize: ARK_TOKENS.type.body,
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
                    fontFamily: ARK_TOKENS.mono, fontWeight: ARK_TOKENS.weight.semibold,
                    fontSize: ARK_TOKENS.type.body,
                  }}
                />
                {searching ? (
                  <div
                    title="Looking up…"
                    style={{ color: ARK_TOKENS.inkSubtle, padding: '0 12px', display: 'flex', alignItems: 'center' }}
                  >
                    <Spinner size={14} />
                  </div>
                ) : resolved && !resolved.notFound && (
                  <div style={{ color: ARK_TOKENS.success, padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                    <Ico.check size={14} />
                  </div>
                )}
              </div>

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
                      <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, fontWeight: ARK_TOKENS.weight.semibold, flexShrink: 0 }}>
                        {item.type} #{item.id}
                      </div>
                      <div style={{
                        flex: 1, fontSize: ARK_TOKENS.type.body, fontWeight: ARK_TOKENS.weight.medium, minWidth: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, flexShrink: 0 }}>
                        {item.state}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                    <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.danger }}>
                      Couldn&apos;t find #{workItemId} in this organization. Check the ID or your permissions.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: 14, height: 14, background: resolved.color, borderRadius: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ARK_TOKENS.type.micro, fontWeight: ARK_TOKENS.weight.semibold, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.5, marginBottom: 2 }}>
                        {resolved.type.toUpperCase()} · #{resolved.id}
                      </div>
                      <div style={{ fontSize: ARK_TOKENS.type.h2, fontWeight: ARK_TOKENS.weight.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resolved.title}
                      </div>
                      {resolved.attachments && resolved.attachments.length > 0 && (
                        <div style={{ fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
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
            <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ico.info size={12} /> Your new story will be created as a child of this item.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onClose} disabled={connecting}>Cancel</Btn>
          <div style={{ flex: 1 }} />
          <Btn
            variant="primary"
            onClick={handleFinish}
            disabled={connecting || !resolved || resolved.notFound}
            icon={connecting ? <Spinner /> : <Ico.arrow size={14} />}
          >
            {connecting ? 'Connecting…' : 'Start writing'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
