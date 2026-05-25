import { useState, useEffect, useRef } from 'react';
import { ARK_TOKENS } from '../tokens';
import { TopBar, Btn, Ico, TextInput, TextArea, Splitter } from '../components/ui';
import { useParams, useNavigate } from '../router';
import { useApp, createEmptyDraft } from '../context/AppContext';
import { useServices } from '../context/ServicesContext';
import { Field } from '../components/builder/Field';
import { PersonaRow } from '../components/builder/PersonaRow';
import { NarrativeRow } from '../components/builder/NarrativeRow';
import { DocsList, type DocItem, type ScanResult, type UploadedDocPayload } from '../components/builder/DocsList';
import { UiChangePreview } from '../components/builder/UiChangePreview';
import { FlowEditor } from '../components/builder/FlowEditor';
import { SuggestChat } from '../components/builder/SuggestChat';
import { AppShell } from '../components/shell/AppShell';
import { evaluateCompletion } from '../lib/storyCompletion';
import { scanUploadedDoc, scanAzureAttachment, type ScanResultPayload } from '../services/scan';
import { appendContextEntry, appendOrReplaceFieldEditEntry } from '../lib/contextLog';
import { fieldLabel } from '../lib/fieldLabels';
import type { SupportingDoc } from '../types';

function docKindToSupportingType(kind: DocItem['kind']): SupportingDoc['type'] {
  return kind === 'pdf' ? 'pdf' : kind === 'image' ? 'image' : 'other';
}

const COACH_MIN_WIDTH = 280;
const COACH_MAX_WIDTH = 720;
const COACH_DEFAULT_WIDTH = COACH_MAX_WIDTH;
const COACH_WIDTH_KEY = 'ark.coachWidth';

function clampCoachWidth(w: number): number {
  if (!Number.isFinite(w)) return COACH_DEFAULT_WIDTH;
  return Math.min(COACH_MAX_WIDTH, Math.max(COACH_MIN_WIDTH, Math.round(w)));
}

function readPersistedCoachWidth(): number {
  try {
    const raw = window.localStorage.getItem(COACH_WIDTH_KEY);
    if (!raw) return COACH_DEFAULT_WIDTH;
    return clampCoachWidth(parseInt(raw, 10));
  } catch {
    return COACH_DEFAULT_WIDTH;
  }
}

// Wrapper: gate rendering on draft hydration so the body's useState initializers
// see the loaded draft. For /stories/:id/edit, wait for the initial listDrafts
// to complete and (if needed) directly fetch the draft. For /stories/new, render
// immediately — the body creates a fresh draft.
export function BuilderPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { draftsLoaded, getDraft, loadDraft } = useApp();
  const editId = params.id;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!editId) {
      setHydrated(true);
      return;
    }
    if (!draftsLoaded) return;
    if (getDraft(editId)) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    loadDraft(editId).then((d) => {
      if (cancelled) return;
      if (!d) {
        navigate('/');
        return;
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [editId, draftsLoaded, getDraft, loadDraft, navigate]);

  return (
    <AppShell>
      {!hydrated ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: ARK_TOKENS.bg,
            color: ARK_TOKENS.inkSubtle,
            fontSize: ARK_TOKENS.type.label,
          }}
        >
          Loading draft…
        </div>
      ) : (
        // Re-mount the body when the route's id changes so its useState initializers re-run.
        <BuilderPageBody key={editId || 'new'} />
      )}
    </AppShell>
  );
}

function BuilderPageBody() {
  const params = useParams();
  const navigate = useNavigate();
  const { getDraft, updateDraft, addDraft, isMockupGenerating, setMockupGenerating } = useApp();
  const { azure, ai } = useServices();
  const [workItemUrl, setWorkItemUrl] = useState<string | null>(null);
  const [mockupError, setMockupError] = useState<string | null>(null);

  const editId = params.id;
  const existing = editId ? getDraft(editId) : undefined;

  // Create a new draft if navigating to /stories/new without one
  const [draftId] = useState(() => {
    if (existing) return existing.id;
    const d = createEmptyDraft();
    return d.id;
  });

  useEffect(() => {
    if (!editId && !getDraft(draftId)) {
      const d = createEmptyDraft({ id: draftId });
      addDraft(d);
    }
  }, [editId, draftId, getDraft, addDraft]);

  const draft = getDraft(editId || draftId);
  const workItemId = draft?.workItemId;
  const workItemTitle = draft?.workItemTitle?.trim() || '';

  useEffect(() => {
    let cancelled = false;
    if (!workItemId) { setWorkItemUrl(null); return; }
    azure.getConfig().then((cfg) => {
      if (cancelled || !cfg) return;
      setWorkItemUrl(`${cfg.orgUrl}/${cfg.project}/_workitems/edit/${workItemId}`);
    });
    return () => { cancelled = true; };
  }, [azure, workItemId]);

  const [title, setTitle] = useState(draft?.title || '');
  const [background, setBackground] = useState(draft?.background || '');
  const [scenario, setScenario] = useState(draft?.scenario || '');
  const [flow, setFlow] = useState(draft?.flow || '');
  const [persona, setPersona] = useState(draft?.persona || '');
  const [want, setWant] = useState(draft?.narrative.iWantTo || '');
  const [benefit, setBenefit] = useState(draft?.narrative.soThat || '');
  const [criteria, setCriteria] = useState<{ id: string | number; text: string }[]>(
    draft?.acceptanceCriteria.map((ac) => ({ id: ac.id, text: ac.text })) || [],
  );
  const [newCriterion, setNewCriterion] = useState('');
  const [activeField, setActiveField] = useState('title');
  const [docs, setDocs] = useState<DocItem[]>(() => {
    if (!draft?.supportingDocs?.length) return [];
    return draft.supportingDocs.map((sd) => {
      const kind: DocItem['kind'] = sd.type === 'pdf' ? 'pdf' : sd.type === 'image' ? 'image' : 'file';
      return { id: sd.id, name: sd.name, size: '', kind, scanned: sd.scanned };
    });
  });
  const [scanResults, setScanResults] = useState<ScanResult[]>(() => {
    if (!draft?.supportingDocs?.length) return [];
    return draft.supportingDocs
      .filter((sd) => sd.scanned)
      .map((sd) => ({
        docId: sd.id,
        docName: sd.name,
        summary: sd.summary || '',
        problemContext: sd.problemContext,
        stakeholders: sd.stakeholders,
        goals: sd.goals,
        acceptanceCriteria: sd.acceptanceCriteria || [],
        edgeCases: sd.edgeCases || [],
      }));
  });
  const [showUiChange, setShowUiChange] = useState(
    () => !!(draft?.uiChanges?.[0]?.beforeUrl || draft?.uiChanges?.[0]?.afterUrl),
  );
  const [uiBefore, setUiBefore] = useState<string | undefined>(draft?.uiChanges?.[0]?.beforeUrl);
  const [uiAfter, setUiAfter] = useState<string | undefined>(draft?.uiChanges?.[0]?.afterUrl);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const [recentFieldEdit, setRecentFieldEdit] = useState<string | null>(null);
  const [coachWidth, setCoachWidth] = useState<number>(() => readPersistedCoachWidth());
  const autoScanFiredRef = useRef(false);
  const pendingScanIdsRef = useRef<Set<string>>(new Set());
  const prevScanCountRef = useRef(0);
  // Snapshot of field values as of the last fired field-edit detection. The
  // initial run only seeds this ref; it does not log anything.
  const lastSettledFieldsRef = useRef<{
    title: string;
    background: string;
    scenario: string;
    flow: string;
    persona: string;
    want: string;
    benefit: string;
    criteriaKey: string;
  } | null>(null);
  const fieldEditDebounceRef = useRef<number | null>(null);

  // Persist coach width (debounced) so dragging doesn't spam localStorage.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(COACH_WIDTH_KEY, String(coachWidth));
      } catch {
        // ignore quota / private-mode failures
      }
    }, 300);
    return () => clearTimeout(t);
  }, [coachWidth]);

  // Sync back to draft on changes
  useEffect(() => {
    const id = editId || draftId;
    const result = evaluateCompletion({
      title, background, scenario, persona,
      narrative: { iWantTo: want, soThat: benefit },
      acceptanceCriteria: criteria,
    });
    updateDraft(id, {
      title,
      background,
      scenario,
      flow,
      persona,
      narrative: { asA: persona, iWantTo: want, soThat: benefit },
      acceptanceCriteria: criteria.map((c) => ({ id: String(c.id), text: c.text, source: 'manual' as const })),
      uiChanges: (uiBefore || uiAfter)
        ? [{
            id: 'main',
            description: '',
            hasBefore: !!uiBefore,
            hasAfter: !!uiAfter,
            beforeUrl: uiBefore,
            afterUrl: uiAfter,
          }]
        : [],
      completionPct: Math.round((result.filled / result.total) * 100),
    });
  }, [title, background, scenario, flow, persona, want, benefit, criteria, uiBefore, uiAfter, editId, draftId, updateDraft]);

  const setters: Record<string, (v: string) => void> = { title: setTitle, background: setBackground, scenario: setScenario, flow: setFlow, persona: setPersona, want: setWant, benefit: setBenefit };
  const fieldToSection: Record<string, string> = {
    title: 'field-title',
    background: 'field-background',
    scenario: 'field-scenario',
    flow: 'field-flow',
    persona: 'field-persona',
    want: 'field-persona',
    benefit: 'field-persona',
    ui: 'field-ui',
    criteria: 'field-criteria',
    docs: 'field-docs',
  };
  const applySuggestion = (field: string, value: string) => {
    if (field === 'criteria') {
      setCriteria((prev) => [...prev, { id: Date.now(), text: value }]);
    } else if (setters[field]) {
      setters[field](value);
    }
    setActiveField(field);
    const sectionId = fieldToSection[field];
    if (sectionId) {
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const persistScanResult = (
    doc: DocItem,
    payload: ScanResultPayload,
    uploadedMimeType?: string,
  ) => {
    const id = editId || draftId;
    const sr: ScanResult = {
      docId: doc.id,
      docName: doc.name,
      summary: payload.summary,
      problemContext: payload.problemContext,
      stakeholders: payload.stakeholders,
      goals: payload.goals,
      acceptanceCriteria: payload.acceptanceCriteria,
      edgeCases: payload.edgeCases,
    };
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, scanning: false, scanned: true } : d)));
    setScanResults((prev) => (prev.some((p) => p.docId === doc.id) ? prev : [...prev, sr]));
    updateDraft(id, (current) => {
      const existing = current.supportingDocs || [];
      const idx = existing.findIndex((s) => s.id === doc.id);
      const merged: SupportingDoc = {
        id: doc.id,
        name: doc.name,
        type: docKindToSupportingType(doc.kind),
        scanned: true,
        url: existing[idx]?.url,
        mimeType: payload.mimeType ?? existing[idx]?.mimeType ?? uploadedMimeType,
        summary: payload.summary,
        problemContext: payload.problemContext,
        stakeholders: payload.stakeholders,
        goals: payload.goals,
        acceptanceCriteria: payload.acceptanceCriteria,
        edgeCases: payload.edgeCases,
      };
      const supportingDocs = idx >= 0 ? existing.map((s, i) => (i === idx ? merged : s)) : [...existing, merged];
      return { supportingDocs };
    });
    appendContextEntry(updateDraft, id, {
      kind: 'doc',
      label: doc.name,
      summary: payload.summary?.replace(/\s+/g, ' ').slice(0, 140),
    });
  };

  const handleDocScan = async (doc: DocItem, payload?: UploadedDocPayload) => {
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, scanning: true } : d)));
    try {
      let result: ScanResultPayload | null = null;
      if (payload) {
        result = await scanUploadedDoc(doc.name, payload.mimeType, payload.content);
      } else {
        const id = editId || draftId;
        const url = getDraft(id)?.supportingDocs?.find((s) => s.id === doc.id)?.url;
        if (url) result = await scanAzureAttachment(url, doc.name);
      }
      if (result) {
        persistScanResult(doc, result, payload?.mimeType);
        return;
      }
    } catch (err) {
      console.error('[builder] doc scan failed', err);
    }
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, scanning: false } : d)));
  };

  // Auto-scan: any unscanned supporting doc with a URL (Azure attachment) on mount
  useEffect(() => {
    if (autoScanFiredRef.current) return;
    const id = editId || draftId;
    const current = getDraft(id);
    if (!current?.supportingDocs?.length) return;
    autoScanFiredRef.current = true;
    const pending = new Set<string>();
    for (const sd of current.supportingDocs) {
      if (!sd.scanned && sd.url) pending.add(sd.id);
    }
    pendingScanIdsRef.current = pending;
    for (const sd of current.supportingDocs) {
      if (sd.scanned || !sd.url) continue;
      const docItem: DocItem = {
        id: sd.id,
        name: sd.name,
        size: '',
        kind: sd.type === 'pdf' ? 'pdf' : sd.type === 'image' ? 'image' : 'file',
      };
      void handleDocScan(docItem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, draftId]);

  const attachmentsReady = docs
    .filter((d) => pendingScanIdsRef.current.has(d.id))
    .every((d) => !d.scanning);

  const scanningDocNames = docs.filter((d) => d.scanning).map((d) => d.name);

  // Flash "Added <doc> to context" briefly whenever a new scan lands.
  useEffect(() => {
    if (scanResults.length > prevScanCountRef.current) {
      const last = scanResults[scanResults.length - 1];
      setRecentlyAdded(last.docName);
      prevScanCountRef.current = scanResults.length;
      const t = setTimeout(() => setRecentlyAdded(null), 3000);
      return () => clearTimeout(t);
    }
  }, [scanResults]);

  // Debounced field-edit detector. After ~600 ms of no further changes, diff
  // current values against the last settled snapshot, log one entry per
  // changed field, and flash the coach status with the most-recently-edited
  // field label. First run seeds the snapshot and does nothing else.
  useEffect(() => {
    const criteriaKey = JSON.stringify(criteria.map((c) => c.text));
    if (lastSettledFieldsRef.current === null) {
      lastSettledFieldsRef.current = { title, background, scenario, flow, persona, want, benefit, criteriaKey };
      return;
    }
    if (fieldEditDebounceRef.current !== null) {
      window.clearTimeout(fieldEditDebounceRef.current);
    }
    fieldEditDebounceRef.current = window.setTimeout(() => {
      const prev = lastSettledFieldsRef.current;
      if (!prev) return;
      const curr = { title, background, scenario, flow, persona, want, benefit, criteriaKey };
      const changed: string[] = [];
      if (prev.title !== curr.title) changed.push('title');
      if (prev.background !== curr.background) changed.push('background');
      if (prev.scenario !== curr.scenario) changed.push('scenario');
      if (prev.flow !== curr.flow) changed.push('flow');
      if (prev.persona !== curr.persona) changed.push('persona');
      if (prev.want !== curr.want) changed.push('want');
      if (prev.benefit !== curr.benefit) changed.push('benefit');
      if (prev.criteriaKey !== curr.criteriaKey) changed.push('criteria');
      lastSettledFieldsRef.current = curr;
      if (changed.length === 0) return;
      const id = editId || draftId;
      for (const f of changed) {
        appendOrReplaceFieldEditEntry(updateDraft, id, f, `Updated ${fieldLabel(f)}`);
      }
      const last = changed[changed.length - 1];
      setRecentFieldEdit(fieldLabel(last));
    }, 600);
    return () => {
      if (fieldEditDebounceRef.current !== null) {
        window.clearTimeout(fieldEditDebounceRef.current);
        fieldEditDebounceRef.current = null;
      }
    };
  }, [title, background, scenario, flow, persona, want, benefit, criteria, editId, draftId, updateDraft]);

  // Clear the "Updated X" status flash after 3 seconds, matching the doc-add flash.
  useEffect(() => {
    if (!recentFieldEdit) return;
    const t = setTimeout(() => setRecentFieldEdit(null), 3000);
    return () => clearTimeout(t);
  }, [recentFieldEdit]);

  const fields = [
    { id: 'title', label: 'Title', filled: !!title },
    { id: 'background', label: 'Background', filled: !!background },
    { id: 'scenario', label: 'The Scenario', filled: !!scenario },
    { id: 'persona', label: 'Persona', filled: !!persona },
    { id: 'want', label: 'Desire', filled: !!want },
    { id: 'benefit', label: 'Benefit', filled: !!benefit },
    { id: 'criteria', label: 'Acceptance criteria', filled: criteria.length >= 2 },
  ];
  const completion = fields.filter((f) => f.filled).length;

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria([...criteria, { id: Date.now(), text: newCriterion.trim() }]);
    setNewCriterion('');
  };

  const recordUiImage = (slot: 'before' | 'after', url: string, source?: 'replace' | 'annotate') => {
    const id = editId || draftId;
    const had = slot === 'before' ? !!uiBefore : !!uiAfter;
    if (slot === 'before') setUiBefore(url);
    else setUiAfter(url);
    appendContextEntry(updateDraft, id, {
      kind: slot === 'before' ? 'uiBefore' : 'uiAfter',
      label: slot === 'before' ? 'Before screenshot' : 'After screenshot',
      summary: source === 'annotate' ? 'Annotated' : had ? 'Replaced' : undefined,
    });
  };

  const completionResult = evaluateCompletion({
    title, background, scenario, persona,
    narrative: { iWantTo: want, soThat: benefit },
    acceptanceCriteria: criteria,
  });

  const handlePush = () => {
    if (!completionResult.complete) return;
    navigate(`/stories/${editId || draftId}/push`);
  };

  const targetDraftId = editId || draftId;
  const generatingMockup = isMockupGenerating(targetDraftId);

  const handleGenerateMockup = async () => {
    if (generatingMockup) return;
    setMockupGenerating(targetDraftId, true);
    setMockupError(null);
    try {
      const result = await ai.generateMockup(targetDraftId);
      updateDraft(targetDraftId, { mockup: result });
    } catch (err) {
      setMockupError(err instanceof Error ? err.message : 'Mockup generation failed');
    } finally {
      setMockupGenerating(targetDraftId, false);
    }
  };

  const mockup = draft?.mockup;
  const hasOkMockup = mockup?.status === 'ok';
  const hasInsufficientMockup = mockup?.status === 'insufficient';

  return (
    <div style={{ width: '100%', height: '100%', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <TopBar
        breadcrumbs={['Stories', editId ? 'Edit' : 'New story']}
        rightActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {workItemId && workItemUrl && (
              <a
                href={workItemUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={workItemTitle ? `Open #${workItemId} ${workItemTitle} in Azure DevOps` : `Open #${workItemId} in Azure DevOps`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  maxWidth: 320,
                  fontSize: ARK_TOKENS.type.label,
                  color: ARK_TOKENS.azureDark,
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontFamily: ARK_TOKENS.mono, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  #{workItemId}
                </span>
                {workItemTitle && (
                  <span style={{ color: ARK_TOKENS.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {workItemTitle}
                  </span>
                )}
                <span style={{ color: ARK_TOKENS.inkSubtle, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                  <Ico.link size={12} />
                </span>
              </a>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                onClick={handleGenerateMockup}
                disabled={generatingMockup}
                title={
                  hasOkMockup
                    ? 'Mockup ready — see it in Review. Click to regenerate.'
                    : hasInsufficientMockup
                    ? 'Mockup attempt was insufficient. Click to retry.'
                    : 'Generate an HTML mockup of this story'
                }
              >
                {generatingMockup
                  ? 'Generating…'
                  : hasOkMockup
                  ? 'Refresh mockup ✓'
                  : hasInsufficientMockup
                  ? 'Refresh mockup ⚠'
                  : '✷ Generate mockup'}
              </Btn>
              <Btn icon={<Ico.x size={12} />} onClick={() => navigate('/')}>
                Close
              </Btn>
              <Btn
                variant="primary"
                icon={<Ico.arrow size={14} />}
                onClick={handlePush}
                disabled={!completionResult.complete}
                title={completionResult.complete ? undefined : `Add: ${completionResult.missing.join(', ')}`}
              >
                Review
              </Btn>
            </div>
          </div>
        }
      />

      {(mockupError || hasInsufficientMockup) && (
        <div
          style={{
            background: ARK_TOKENS.dangerBg,
            borderBottom: `1px solid ${ARK_TOKENS.danger}`,
            color: ARK_TOKENS.ink,
            padding: '10px 20px',
            fontSize: ARK_TOKENS.type.label,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: ARK_TOKENS.danger, display: 'inline-flex', alignItems: 'center' }}>
            <Ico.warn size={14} />
          </span>
          <span>
            {mockupError
              ? `Mockup error: ${mockupError}`
              : `Mockup needs more story detail: ${mockup?.insufficientReason}`}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* LEFT: AI Coach (resizable) */}
        <SuggestChat
          width={coachWidth}
          draftId={editId || draftId}
          storyState={{
            title, background, scenario, flow, persona, want, benefit, criteria,
            workItemId: draft?.workItemId,
            workItemType: draft?.workItemType,
            workItemState: draft?.workItemState,
            workItemAssignedTo: draft?.workItemAssignedTo,
            workItemDescription: draft?.workItemDescription,
            workItemReproSteps: draft?.workItemReproSteps,
            workItemTechnicalDescription: draft?.workItemTechnicalDescription,
            workItemDiscussion: draft?.workItemDiscussion,
            linkedWorkItems: draft?.linkedWorkItems,
            epicName: draft?.epicName,
            supportingDocs: docs.map(d => {
              const scan = scanResults.find(s => s.docId === d.id);
              return {
                name: d.name, kind: d.kind, scanned: !!d.scanned,
                ...(scan && {
                  summary: scan.summary,
                  problemContext: scan.problemContext,
                  stakeholders: scan.stakeholders,
                  goals: scan.goals,
                  acceptanceCriteria: scan.acceptanceCriteria,
                  edgeCases: scan.edgeCases,
                }),
              };
            }),
          }}
          onApply={applySuggestion}
          activeField={activeField}
          setActiveField={setActiveField}
          contextLog={draft?.contextLog ?? []}
          attachmentsReady={attachmentsReady}
          scanningDocNames={scanningDocNames}
          recentlyAddedDocName={recentlyAdded}
          recentFieldEditLabel={recentFieldEdit}
        />
        <Splitter onDrag={(dx) => setCoachWidth((w) => clampCoachWidth(w + dx))} />

        {/* RIGHT: Form */}
        <div className="ark-scroll" style={{ flex: '1 1 0', overflowY: 'auto', minWidth: 0 }}>
          <div style={{ padding: '32px 40px 80px' }}>
            <Field
              id="field-title"
              label="Title"
              hint="A short, active-voice summary of what this story delivers."
              filled={fields[0].filled}
              active={activeField === 'title'}
              onActivate={() => setActiveField('title')}
              aside={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkMuted }}>
                  <span>{completion} of {fields.length} sections complete</span>
                  <span style={{ width: 120, height: 3, background: ARK_TOKENS.border, borderRadius: 2, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${(completion / fields.length) * 100}%`, background: ARK_TOKENS.azure, transition: 'width 0.3s' }} />
                  </span>
                </div>
              }
            >
              <TextInput value={title} onChange={setTitle} placeholder="e.g. Auto-retry failed renewals" />
            </Field>

            <Field
              id="field-background"
              label="Background"
              hint="The context devs need before they read the rest. Why does this story exist? What's happening today?"
              filled={fields[1].filled}
              active={activeField === 'background'}
              onActivate={() => setActiveField('background')}
            >
              <TextArea
                value={background}
                onChange={setBackground}
                rows={4}
                placeholder="What's happening today, why it matters, and any data or constraints the team should know up front."
              />
            </Field>

            <Field
              id="field-scenario"
              label="The Scenario"
              hint="Walk through one realistic end-to-end path. Refer to actors generically (&ldquo;the user&rdquo;, &ldquo;the system&rdquo;) — names belong in the Persona, not here."
              filled={fields[2].filled}
              active={activeField === 'scenario'}
              onActivate={() => setActiveField('scenario')}
            >
              <TextArea
                value={scenario}
                onChange={setScenario}
                rows={4}
                placeholder="e.g. The user opens a declined renewal, clicks Retry, and the system attempts the charge in the next available window…"
              />
            </Field>

            <Field
              id="field-flow"
              label="The Flow"
              hint="Optional. One or more mermaid diagrams illustrating the scenario (sequenceDiagram, flowchart, …). Click the preview to edit the markdown."
              filled={!!flow.trim()}
              active={activeField === 'flow'}
              onActivate={() => setActiveField('flow')}
            >
              <FlowEditor value={flow} onChange={setFlow} onActiveFocus={() => setActiveField('flow')} />
            </Field>

            <Field
              id="field-persona"
              label="As-a, I-want, So-that"
              hint="Persona, desire, and benefit — what developers use to sanity-check tradeoffs."
              filled={fields[3].filled && fields[4].filled && fields[5].filled}
              active={['persona', 'want', 'benefit'].includes(activeField)}
              onActivate={() => setActiveField('persona')}
            >
              <PersonaRow value={persona} onChange={setPersona} onFocus={() => setActiveField('persona')} />
              <NarrativeRow
                label="I want"
                value={want}
                onChange={setWant}
                placeholder="auto-retry failed Pro renewals before escalating"
                multiline
                onFocus={() => setActiveField('want')}
              />
              <NarrativeRow
                label="So that"
                value={benefit}
                onChange={setBenefit}
                placeholder="I don’t open a manual ticket for every card decline"
                multiline
                last
                onFocus={() => setActiveField('benefit')}
              />
            </Field>

            <Field
              id="field-ui"
              label="UI change"
              hint="Optional. Tick this if your story changes the user interface, then paste or upload the current window."
              filled={showUiChange}
              active={activeField === 'ui'}
              onActivate={() => setActiveField('ui')}
            >
              <UiChangePreview
                enabled={showUiChange}
                onToggle={() => {
                  const next = !showUiChange;
                  setShowUiChange(next);
                  if (!next) {
                    setUiBefore(undefined);
                    setUiAfter(undefined);
                  }
                }}
                before={uiBefore}
                after={uiAfter}
                onSetBefore={(url, source) => recordUiImage('before', url, source)}
                onSetAfter={(url, source) => recordUiImage('after', url, source)}
              />
            </Field>

            <Field
              id="field-criteria"
              label="Acceptance criteria"
              hint="Use Given / When / Then. Each criterion should be pass/fail testable."
              filled={fields[6].filled}
              active={activeField === 'criteria'}
              onActivate={() => setActiveField('criteria')}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {criteria.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: '10px 0',
                      borderBottom: `1px solid ${ARK_TOKENS.border}`,
                      fontSize: ARK_TOKENS.type.body, lineHeight: ARK_TOKENS.leading.normal,
                    }}
                  >
                    <span style={{ color: ARK_TOKENS.inkSubtle, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: ARK_TOKENS.type.micro, fontWeight: ARK_TOKENS.weight.semibold, marginTop: 2, width: 24 }}>
                      AC{i + 1}
                    </span>
                    <span style={{ flex: 1 }}>{c.text}</span>
                    <button
                      onClick={() => setCriteria(criteria.filter((x) => x.id !== c.id))}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: ARK_TOKENS.inkSubtle, padding: 4, borderRadius: 3, opacity: 0.6 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; }}
                    >
                      <Ico.x size={12} />
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <TextInput
                      value={newCriterion}
                      onChange={setNewCriterion}
                      placeholder="Given… when… then…"
                    />
                  </div>
                  <Btn onClick={addCriterion} icon={<Ico.plus size={12} />}>Add</Btn>
                </div>
              </div>
            </Field>

            <Field
              id="field-docs"
              label="Supporting documents"
              hint="Attach specs, screenshots, tickets, or recordings. The coach will read them and propose criteria."
              filled={docs.length > 0}
              active={activeField === 'docs'}
              onActivate={() => setActiveField('docs')}
              last
            >
              <DocsList
                docs={docs}
                scanResults={scanResults}
                onRemove={(id) => {
                  setDocs(docs.filter((d) => d.id !== id));
                  setScanResults((prev) => prev.filter((r) => r.docId !== id));
                }}
                onAdd={(d) => setDocs([...docs, d])}
                onScan={handleDocScan}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

