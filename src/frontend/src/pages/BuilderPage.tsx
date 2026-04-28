import { useState, useEffect } from 'react';
import { ARK_TOKENS } from '../tokens';
import { TopBar, Btn, Ico, TextInput, TextArea, AzureMark } from '../components/ui';
import { useParams, useNavigate } from '../router';
import { useApp, createEmptyDraft } from '../context/AppContext';
import { Field } from '../components/builder/Field';
import { PersonaRow } from '../components/builder/PersonaRow';
import { NarrativeRow } from '../components/builder/NarrativeRow';
import { DocsList, type DocItem, type ScanResult } from '../components/builder/DocsList';
import { UiChangePreview } from '../components/builder/UiChangePreview';
import { WorkItemPreview } from '../components/builder/WorkItemPreview';
import { SuggestChat } from '../components/builder/SuggestChat';

export function BuilderPage() {
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
  const [background, setBackground] = useState('');
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
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [showUiChange, setShowUiChange] = useState(false);
  const [scanSuggestionsForChat, setScanSuggestionsForChat] = useState<ScanResult[]>([]);

  // Sync back to draft on changes
  useEffect(() => {
    const id = editId || draftId;
    const filled = [title, persona, want, benefit].filter(Boolean).length;
    const total = 6;
    updateDraft(id, {
      title,
      persona,
      narrative: { asA: persona, iWantTo: want, soThat: benefit },
      acceptanceCriteria: criteria.map((c) => ({ id: String(c.id), text: c.text, source: 'manual' as const })),
      completionPct: Math.round((filled + (criteria.length >= 2 ? 1 : 0) + (background ? 1 : 0)) / total * 100),
    });
  }, [title, background, persona, want, benefit, criteria, editId, draftId, updateDraft]);

  const setters: Record<string, (v: string) => void> = { title: setTitle, background: setBackground, persona: setPersona, want: setWant, benefit: setBenefit };
  const applySuggestion = (field: string, value: string) => {
    if (field === 'criteria') {
      setCriteria((prev) => [...prev, { id: Date.now(), text: value }]);
    } else if (setters[field]) {
      setters[field](value);
    }
    setActiveField(field);
  };

  const handleDocScan = (doc: DocItem) => {
    // Mark doc as scanning
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, scanning: true } : d));

    // Simulate scan with mock results after delay
    setTimeout(() => {
      const result: ScanResult = {
        docId: doc.id,
        docName: doc.name,
        summary: `Scanned "${doc.name}" and extracted actionable criteria.`,
        acceptanceCriteria: [
          `Given the ${doc.kind === 'pdf' ? 'policy document' : 'screenshot'} is reviewed, when requirements are extracted, then all edge cases from the document are covered.`,
          'Given the extracted criteria conflict with existing ACs, when compared, then the user is prompted to resolve duplicates.',
        ],
        edgeCases: [
          'Legacy accounts on annual billing may have different retry windows.',
        ],
      };

      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, scanning: false, scanned: true } : d));
      setScanResults((prev) => [...prev, result]);
      setScanSuggestionsForChat((prev) => [...prev, result]);
    }, 1800);
  };

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

  const handlePush = () => {
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
            <Btn variant="primary" icon={<Ico.arrow size={14} />} onClick={handlePush}>
              Push to Azure
            </Btn>
          </div>
        }
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* LEFT: Form */}
        <div className="ark-scroll" style={{ flex: '1 1 520px', overflowY: 'auto', minWidth: 0 }}>
          <div style={{ maxWidth: 620, padding: '32px 40px 80px' }}>
            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 6px', letterSpacing: -0.4 }}>New user story</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: ARK_TOKENS.inkMuted }}>
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
                placeholder="I don\u2019t open a manual ticket for every card decline"
                multiline
                last
                onFocus={() => setActiveField('benefit')}
              />
            </Field>

            <Field
              label="Supporting documents"
              hint="Attach specs, screenshots, tickets, or recordings. The coach will read them and propose criteria."
              filled={docs.length > 0}
              active={activeField === 'docs'}
              onActivate={() => setActiveField('docs')}
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

            <Field
              label="UI change"
              hint="Optional. Tick this if your story changes the user interface, then paste or upload the current window."
              filled={showUiChange}
              active={activeField === 'ui'}
              onActivate={() => setActiveField('ui')}
            >
              <UiChangePreview enabled={showUiChange} onToggle={() => setShowUiChange(!showUiChange)} />
            </Field>

            <Field
              label="Acceptance criteria"
              hint="Use Given / When / Then. Each criterion should be pass/fail testable."
              filled={fields[5].filled}
              active={activeField === 'criteria'}
              onActivate={() => setActiveField('criteria')}
              last
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {criteria.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: '10px 0',
                      borderBottom: `1px solid ${ARK_TOKENS.border}`,
                      fontSize: 13, lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: ARK_TOKENS.inkSubtle, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 11, fontWeight: 600, marginTop: 2, width: 24 }}>
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
                      placeholder="Given\u2026 when\u2026 then\u2026"
                    />
                  </div>
                  <Btn onClick={addCriterion} icon={<Ico.plus size={12} />}>Add</Btn>
                </div>
              </div>
            </Field>
          </div>
        </div>

        {/* MIDDLE: AI Coach */}
        <SuggestChat
          storyState={{
            title, background, persona, want, benefit, criteria,
            workItemId: draft?.workItemId,
            workItemType: draft?.workItemType,
            workItemState: draft?.workItemState,
            workItemAssignedTo: draft?.workItemAssignedTo,
            workItemDescription: draft?.workItemDescription,
            workItemReproSteps: draft?.workItemReproSteps,
            epicName: draft?.epicName,
            supportingDocs: docs.map(d => ({ name: d.name, kind: d.kind, scanned: !!d.scanned })),
          }}
          onApply={applySuggestion}
          activeField={activeField}
          setActiveField={setActiveField}
          scanSuggestions={scanSuggestionsForChat}
        />

        {/* RIGHT: Azure DevOps preview */}
        <div style={{ flex: '0 0 520px', borderLeft: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surface, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ARK_TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AzureMark size={14} />
            <div style={{ fontSize: 12, fontWeight: 600, color: ARK_TOKENS.inkMuted, letterSpacing: 0.2 }}>Azure DevOps preview</div>
          </div>
          <div className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
            <WorkItemPreview
              title={title}
              background={background}
              persona={persona}
              want={want}
              benefit={benefit}
              criteria={criteria.map((c) => ({ id: c.id, text: c.text }))}
              docs={docs}
              showUiChange={showUiChange}
              workItemState={draft?.workItemState}
              workItemAssignedTo={draft?.workItemAssignedTo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
