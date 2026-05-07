import { useState, useEffect, useRef } from 'react';
import { ARK_TOKENS } from '../tokens';
import { TopBar, Btn, Ico, TextInput, TextArea } from '../components/ui';
import { useParams, useNavigate } from '../router';
import { useApp, createEmptyDraft } from '../context/AppContext';
import { Field } from '../components/builder/Field';
import { PersonaRow } from '../components/builder/PersonaRow';
import { NarrativeRow } from '../components/builder/NarrativeRow';
import { DocsList, type DocItem, type ScanResult, type UploadedDocPayload } from '../components/builder/DocsList';
import { UiChangePreview } from '../components/builder/UiChangePreview';
import { SuggestChat } from '../components/builder/SuggestChat';
import { evaluateCompletion } from '../lib/storyCompletion';
import { scanUploadedDoc, scanAzureAttachment, type ScanResultPayload } from '../services/scan';
import type { SupportingDoc } from '../types';

function docKindToSupportingType(kind: DocItem['kind']): SupportingDoc['type'] {
  return kind === 'pdf' ? 'pdf' : kind === 'image' ? 'image' : 'other';
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
        navigate('/stories');
        return;
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [editId, draftsLoaded, getDraft, loadDraft, navigate]);

  if (!hydrated) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: ARK_TOKENS.bg,
          color: ARK_TOKENS.inkSubtle,
          fontSize: 14,
        }}
      >
        Loading draft…
      </div>
    );
  }

  // Re-mount the body when the route's id changes so its useState initializers re-run.
  return <BuilderPageBody key={editId || 'new'} />;
}

function BuilderPageBody() {
  const params = useParams();
  const navigate = useNavigate();
  const { getDraft, updateDraft, addDraft } = useApp();

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

  const [title, setTitle] = useState(draft?.title || '');
  const [background, setBackground] = useState(draft?.background || '');
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
  const autoScanFiredRef = useRef(false);
  const pendingScanIdsRef = useRef<Set<string>>(new Set());
  const prevScanCountRef = useRef(0);

  // Sync back to draft on changes
  useEffect(() => {
    const id = editId || draftId;
    const result = evaluateCompletion({
      title, background, persona,
      narrative: { iWantTo: want, soThat: benefit },
      acceptanceCriteria: criteria,
    });
    updateDraft(id, {
      title,
      background,
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
  }, [title, background, persona, want, benefit, criteria, uiBefore, uiAfter, editId, draftId, updateDraft]);

  const setters: Record<string, (v: string) => void> = { title: setTitle, background: setBackground, persona: setPersona, want: setWant, benefit: setBenefit };
  const applySuggestion = (field: string, value: string) => {
    if (field === 'criteria') {
      setCriteria((prev) => [...prev, { id: Date.now(), text: value }]);
    } else if (setters[field]) {
      setters[field](value);
    }
    setActiveField(field);
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

  const fields = [
    { id: 'title', label: 'Title', filled: !!title },
    { id: 'background', label: 'Background', filled: !!background },
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

  const completionResult = evaluateCompletion({
    title, background, persona,
    narrative: { iWantTo: want, soThat: benefit },
    acceptanceCriteria: criteria,
  });

  const handlePush = () => {
    if (!completionResult.complete) return;
    navigate(`/stories/${editId || draftId}/push`);
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar
        breadcrumbs={['Stories', editId ? 'Edit' : 'New story']}
        rightActions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn icon={<Ico.check size={14} />} onClick={() => navigate('/stories')}>
              Save as draft
            </Btn>
            <Btn
              variant="primary"
              icon={<Ico.arrow size={14} />}
              onClick={handlePush}
              disabled={!completionResult.complete}
              title={completionResult.complete ? undefined : `Add: ${completionResult.missing.join(', ')}`}
            >
              Push to Azure
            </Btn>
          </div>
        }
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* LEFT: AI Coach */}
        <SuggestChat
          draftId={editId || draftId}
          storyState={{
            title, background, persona, want, benefit, criteria,
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
          attachmentsReady={attachmentsReady}
          scanningDocNames={scanningDocNames}
          recentlyAddedDocName={recentlyAdded}
        />

        {/* RIGHT: Form */}
        <div className="ark-scroll" style={{ flex: '1 1 0', overflowY: 'auto', minWidth: 0 }}>
          <div style={{ padding: '32px 40px 80px' }}>
            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 29, fontWeight: 600, margin: '0 0 6px', letterSpacing: -0.4 }}>New user story</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: ARK_TOKENS.inkMuted }}>
                <span>{completion} of {fields.length} sections complete</span>
                <span style={{ flex: 1, maxWidth: 120, height: 3, background: ARK_TOKENS.border, borderRadius: 2, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(completion / fields.length) * 100}%`, background: ARK_TOKENS.azure, transition: 'width 0.3s' }} />
                </span>
              </div>
            </div>

            <Field
              label="Title"
              hint="A short, active-voice summary of what this story delivers."
              filled={fields[0].filled}
              active={activeField === 'title'}
              onActivate={() => setActiveField('title')}
            >
              <TextInput value={title} onChange={setTitle} placeholder="e.g. Auto-retry failed renewals" />
            </Field>

            <Field
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
              label="The narrative"
              hint="Persona, desire, and benefit — what developers use to sanity-check tradeoffs."
              filled={fields[2].filled && fields[3].filled && fields[4].filled}
              active={['persona', 'want', 'benefit'].includes(activeField)}
              onActivate={() => setActiveField('persona')}
            >
              <PersonaRow value={persona} onChange={setPersona} onFocus={() => setActiveField('persona')} />
              <NarrativeRow
                label="I want to"
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
                onSetBefore={setUiBefore}
                onSetAfter={setUiAfter}
              />
            </Field>

            <Field
              label="Acceptance criteria"
              hint="Use Given / When / Then. Each criterion should be pass/fail testable."
              filled={fields[5].filled}
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
                      fontSize: 16, lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: ARK_TOKENS.inkSubtle, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 13, fontWeight: 600, marginTop: 2, width: 24 }}>
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
