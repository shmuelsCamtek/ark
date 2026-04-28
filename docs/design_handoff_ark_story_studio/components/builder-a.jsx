// Story builder — variant A: Checklist + Live Preview + AI Chat (PRIMARY)
// Cleaner version: fewer surfaces, fewer accent colors, lighter chrome.

function StoryBuilderA({ onSubmit, onBack }) {
  const [title, setTitle] = React.useState('Auto-retry failed Pro subscription renewals');
  const [background, setBackground] = React.useState('Pro subscription renewals fail roughly 4% of the time — usually a soft card decline. Today, every failure becomes a Tier-1 ticket: an engineer manually retries days later and emails the customer. We lose ~5 hours/week per engineer and miss the recovery window on ~30% of cases, driving involuntary churn.');
  const [persona, setPersona] = React.useState('Support engineer');
  const [want, setWant] = React.useState('automatically retry a failed Pro renewal on a smart schedule and surface the result on the customer support timeline');
  const [benefit, setBenefit] = React.useState('I can resolve renewal failures without opening a manual ticket for each customer');
  const [criteria, setCriteria] = React.useState([
  { id: 1, text: 'A failed renewal triggers up to 3 retries over 7 days (1d, 3d, 7d) before escalation' },
  { id: 2, text: 'Each retry attempt and outcome is written to the customer\u2019s support timeline within 30 seconds' },
  { id: 3, text: 'After the final retry fails, a ticket is auto-created in the Billing-Support queue and assigned to a Tier\u20112 specialist' }]
  );
  const [newCriterion, setNewCriterion] = React.useState('');
  const [activeField, setActiveField] = React.useState('title');
  const [docs, setDocs] = React.useState([
    { id: 'd1', name: 'Billing-retry-policy.pdf', size: '184 KB', kind: 'pdf', source: 'upload' },
    { id: 'd2', name: 'Renewal flow — current.png', size: '92 KB', kind: 'image', source: 'upload' },
  ]);
  const [showUiChange, setShowUiChange] = React.useState(false);

  const fields = [
  { id: 'title', label: 'Title', filled: !!title },
  { id: 'background', label: 'Background', filled: !!background },
  { id: 'persona', label: 'Persona', filled: !!persona },
  { id: 'want', label: 'Desire', filled: !!want },
  { id: 'benefit', label: 'Benefit', filled: !!benefit },
  { id: 'criteria', label: 'Acceptance criteria', filled: criteria.length >= 2 }];

  const completion = fields.filter((f) => f.filled).length;

  const setters = { title: setTitle, background: setBackground, persona: setPersona, want: setWant, benefit: setBenefit };
  const applySuggestion = (field, value) => {
    if (field === 'criteria') {
      setCriteria((prev) => [...prev, { id: Date.now(), text: value }]);
    } else if (setters[field]) {
      setters[field](value);
    }
    setActiveField(field);
  };

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria([...criteria, { id: Date.now(), text: newCriterion.trim() }]);
    setNewCriterion('');
  };

  return (
    <div className="ark-root" style={{ width: '100%', height: '100%', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar
        breadcrumbs={['Support Platform', 'Billing', 'New story']}
        rightActions={
        <Btn variant="primary" icon={<Ico.arrow size={14} />} onClick={onSubmit}>Push to Azure</Btn>
        } />
      

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
                  <span style={{ display: 'block', height: '100%', width: `${completion / fields.length * 100}%`, background: ARK_TOKENS.azure, transition: 'width 0.3s' }} />
                </span>
              </div>
            </div>

            <Field
              label="Title"
              hint="A short, active-voice summary of what this story delivers."
              filled={fields[0].filled}
              active={activeField === 'title'}
              onActivate={() => setActiveField('title')}>
              
              <TextInput value={title} onChange={setTitle} placeholder="e.g. Auto-retry failed renewals" />
            </Field>

            <Field
              label="Background"
              hint="The context devs need before they read the rest. Why does this story exist? What's happening today?"
              filled={fields[1].filled}
              active={activeField === 'background'}
              onActivate={() => setActiveField('background')}>
              
              <TextArea value={background} onChange={setBackground} rows={4}
                placeholder="What's happening today, why it matters, and any data or constraints the team should know up front." />
            </Field>

            <Field
              label="The narrative"
              hint="Persona, desire, and benefit — what developers use to sanity-check tradeoffs."
              filled={fields[2].filled && fields[3].filled && fields[4].filled}
              active={['persona', 'want', 'benefit'].includes(activeField)}
              onActivate={() => setActiveField('persona')}>
              
              <PersonaRow value={persona} onChange={setPersona} onFocus={() => setActiveField('persona')} />
              <NarrativeRow label="I want to" value={want} onChange={setWant} placeholder="auto-retry failed Pro renewals before escalating" multiline onFocus={() => setActiveField('want')} />
              <NarrativeRow label="So that" value={benefit} onChange={setBenefit} placeholder="I don\u2019t open a manual ticket for every card decline" multiline onFocus={() => setActiveField('benefit')} last />
            </Field>

            <Field
              label="Supporting documents"
              hint="Attach specs, screenshots, tickets, or recordings. The coach will read them and propose criteria."
              filled={docs.length > 0}
              active={activeField === 'docs'}
              onActivate={() => setActiveField('docs')}>
              
              <DocsList docs={docs} onRemove={(id) => setDocs(docs.filter((d) => d.id !== id))} onAdd={(d) => setDocs([...docs, d])} />
            </Field>

            <Field
              label="UI change"
              hint="Optional. Tick this if your story changes the user interface, then paste or upload the current window."
              filled={showUiChange}
              active={activeField === 'ui'}
              onActivate={() => setActiveField('ui')}>
              
              <UiChangePreview enabled={showUiChange} onToggle={() => setShowUiChange(!showUiChange)} />
            </Field>

            <Field
              label="Acceptance criteria"
              hint="Use Given / When / Then. Each criterion should be pass/fail testable."
              filled={fields[5].filled}
              active={activeField === 'criteria'}
              onActivate={() => setActiveField('criteria')}
              last>
              
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {criteria.map((c, i) =>
                <div key={c.id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 0',
                  borderBottom: `1px solid ${ARK_TOKENS.border}`,
                  fontSize: 13, lineHeight: 1.5
                }}>
                    <span style={{ color: ARK_TOKENS.inkSubtle, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 11, fontWeight: 600, marginTop: 2, width: 24 }}>AC{i + 1}</span>
                    <span style={{ flex: 1 }}>{c.text}</span>
                    <button onClick={() => setCriteria(criteria.filter((x) => x.id !== c.id))}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: ARK_TOKENS.inkSubtle, padding: 4, borderRadius: 3, opacity: 0.6 }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}>
                      <Ico.x size={12} />
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <TextInput value={newCriterion} onChange={setNewCriterion} placeholder="Given… when… then…" />
                  </div>
                  <Btn onClick={addCriterion} icon={<Ico.plus size={12} />}>Add</Btn>
                </div>
              </div>
            </Field>
          </div>
        </div>

        {/* MIDDLE: Live preview */}
        <div style={{ flex: '0 0 400px', borderLeft: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surface, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${ARK_TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AzureMark size={14} />
            <div style={{ fontSize: 12, fontWeight: 600, color: ARK_TOKENS.inkMuted, letterSpacing: 0.2 }}>Azure DevOps preview</div>
          </div>
          <div className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
            <WorkItemPreview {...{ title, background, persona, want, benefit, criteria, docs, showUiChange }} />
          </div>
        </div>

        {/* RIGHT: AI Chat */}
        <SuggestChat
          storyState={{ title, background, persona, want, benefit, criteria }}
          onApply={applySuggestion}
          activeField={activeField}
          setActiveField={setActiveField} />
        
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// Field — flat row with subtle active marker, no boxed cards.
// ─────────────────────────────────────────────────────────────
function Field({ label, hint, filled, active, onActivate, children, last }) {
  return (
    <div onClick={onActivate} style={{
      paddingLeft: 16,
      marginLeft: -16,
      marginBottom: last ? 0 : 28,
      borderLeft: `2px solid ${active ? ARK_TOKENS.azure : 'transparent'}`,
      transition: 'border-color 0.15s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: ARK_TOKENS.ink }}>{label}</h3>
        {filled && <span style={{ color: ARK_TOKENS.success, display: 'flex' }}><Ico.check size={12} /></span>}
      </div>
      {hint && <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, marginBottom: 12, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>);

}

function PersonaRow({ value, onChange, onFocus }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const [focus, setFocus] = React.useState(false);

  const presets = [
    'Support engineer',
    'Tier-2 billing support specialist',
    'Customer success manager',
    'Product manager',
    'Field service technician',
    'Operations analyst',
  ];

  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'baseline',
      padding: '10px 0',
      borderBottom: `1px solid ${ARK_TOKENS.border}`,
      position: 'relative'
    }}>
      <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, fontWeight: 500, paddingTop: 4 }}>As a</div>
      <div ref={ref} style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          borderBottom: `1px solid ${focus || open ? ARK_TOKENS.azure : 'transparent'}`,
          paddingBottom: 4
        }}>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => { setFocus(true); onFocus && onFocus(); }}
            onBlur={() => setFocus(false)}
            placeholder="Type a persona, or pick from suggestions"
            style={{
              flex: 1, border: 'none', background: 'transparent',
              padding: '4px 0', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5,
              color: ARK_TOKENS.ink, outline: 'none'
            }} />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: ARK_TOKENS.inkMuted, padding: 4, borderRadius: 3,
              display: 'flex', alignItems: 'center'
            }}
            title="Choose from suggestions">
            <Ico.chevron size={12} dir={open ? 'up' : 'down'} />
          </button>
        </div>

        {open &&
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: ARK_TOKENS.surface,
            border: `1px solid ${ARK_TOKENS.border}`,
            borderRadius: ARK_TOKENS.r2,
            boxShadow: ARK_TOKENS.shadow2,
            zIndex: 20,
            maxHeight: 240, overflowY: 'auto',
            padding: 4
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.6, padding: '6px 8px 4px' }}>
              COMMON IN YOUR BACKLOG
            </div>
            {presets.map((p) =>
              <button key={p} type="button"
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 10px', border: 'none',
                  background: value === p ? ARK_TOKENS.azureFaint : 'transparent',
                  textAlign: 'left', fontFamily: 'inherit', fontSize: 13,
                  color: ARK_TOKENS.ink, cursor: 'pointer', borderRadius: 4
                }}
                onMouseEnter={(e) => { if (value !== p) e.currentTarget.style.background = ARK_TOKENS.surfaceAlt; }}
                onMouseLeave={(e) => { if (value !== p) e.currentTarget.style.background = 'transparent'; }}>
                <Ico.user size={12} />
                <span style={{ flex: 1 }}>{p}</span>
                {value === p && <Ico.check size={11} />}
              </button>
            )}
            <div style={{ borderTop: `1px solid ${ARK_TOKENS.border}`, marginTop: 4, paddingTop: 6, padding: '8px 10px', fontSize: 11, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ico.sparkle size={10} />
              <span>Or just type your own — free text is allowed.</span>
            </div>
          </div>
        }
      </div>
    </div>);
}

function DocIcon({ kind, size = 14 }) {
  const color = kind === 'image' ? '#7E57C2' : kind === 'pdf' ? '#E11A22' : ARK_TOKENS.inkMuted;
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 4,
      background: ARK_TOKENS.surfaceAlt,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, flexShrink: 0
    }}>
      {kind === 'image' ? <Ico.image size={size} /> : <Ico.file size={size} />}
    </div>);
}

function DocsList({ docs, onRemove, onAdd }) {
  const fileRef = React.useRef(null);
  const handlePick = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const kind = f.type.startsWith('image') ? 'image' : f.name.endsWith('.pdf') ? 'pdf' : 'file';
      onAdd({ id: 'd' + Date.now() + Math.random(), name: f.name, size: Math.round(f.size / 1024) + ' KB', kind, source: 'upload' });
    });
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {docs.map((d) =>
        <div key={d.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px',
          border: `1px solid ${ARK_TOKENS.border}`,
          borderRadius: ARK_TOKENS.r2,
          background: ARK_TOKENS.surface
        }}>
          <DocIcon kind={d.kind} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: ARK_TOKENS.ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
            <div style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{d.size}</span>
              <span style={{ width: 2, height: 2, borderRadius: 1, background: ARK_TOKENS.inkSubtle }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: ARK_TOKENS.ai }}>
                <Ico.sparkle size={9} /> Read by Ark
              </span>
            </div>
          </div>
          <button onClick={() => onRemove(d.id)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: ARK_TOKENS.inkSubtle, padding: 4, borderRadius: 3, opacity: 0.6 }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}>
            <Ico.x size={12} />
          </button>
        </div>
      )}
      <button type="button" onClick={() => fileRef.current && fileRef.current.click()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 14px',
          border: `1px dashed ${ARK_TOKENS.borderStrong}`,
          background: 'transparent',
          borderRadius: ARK_TOKENS.r2,
          fontSize: 13, color: ARK_TOKENS.inkMuted, cursor: 'pointer',
          fontFamily: 'inherit'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = ARK_TOKENS.azure; e.currentTarget.style.color = ARK_TOKENS.azure; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = ARK_TOKENS.borderStrong; e.currentTarget.style.color = ARK_TOKENS.inkMuted; }}>
        <Ico.upload size={13} />
        <span>Add documents — Ark will read them and suggest criteria</span>
      </button>
      <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handlePick} />
      {docs.length > 0 &&
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '10px 12px', marginTop: 2,
          background: 'rgba(126, 87, 194, 0.07)',
          border: `1px solid rgba(126, 87, 194, 0.18)`,
          borderRadius: ARK_TOKENS.r2,
          fontSize: 12, lineHeight: 1.5, color: ARK_TOKENS.ink
        }}>
          <span style={{ color: ARK_TOKENS.ai, marginTop: 1, flexShrink: 0 }}>
            <Ico.sparkle size={12} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Ark scanned {docs.length} document{docs.length === 1 ? '' : 's'}</div>
            <div style={{ color: ARK_TOKENS.inkMuted }}>
              Found 3 likely acceptance criteria and 1 edge case (legacy plans on annual billing). See suggestions in the coach panel →
            </div>
          </div>
        </div>
      }
    </div>);
}

function UiChangePreview({ enabled, onToggle, compact }) {
  if (!enabled) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '14px 14px',
        border: `1px solid ${ARK_TOKENS.border}`,
        borderRadius: ARK_TOKENS.r2,
        background: ARK_TOKENS.surface
      }}>
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          cursor: 'pointer', fontFamily: 'inherit'
        }}>
          <input type="checkbox" checked={false} onChange={onToggle}
            style={{
              marginTop: 2,
              width: 16, height: 16,
              accentColor: ARK_TOKENS.azure,
              cursor: 'pointer', flexShrink: 0
            }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: ARK_TOKENS.ink, marginBottom: 2 }}>
              This story includes a UI change
            </div>
            <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, lineHeight: 1.5 }}>
              Tick this if you want to capture a before/after. Tickets without UI work can skip this.
            </div>
          </div>
        </label>
      </div>);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Inline checked state — keeps the checkbox visible so user can untick */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        fontSize: 13, color: ARK_TOKENS.ink
      }}>
        <input type="checkbox" checked readOnly onClick={onToggle}
          style={{ width: 16, height: 16, accentColor: ARK_TOKENS.azure, cursor: 'pointer', flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>This story includes a UI change</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onToggle}
          style={{
            border: 'none', background: 'transparent', color: ARK_TOKENS.inkSubtle,
            fontSize: 11, cursor: 'pointer', padding: 4, fontFamily: 'inherit'
          }}>
          Remove
        </button>
      </label>

      {/* Paste-current-window strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: ARK_TOKENS.azureFaint,
        border: `1px dashed ${ARK_TOKENS.azure}`,
        borderRadius: ARK_TOKENS.r2,
        fontSize: 12, color: ARK_TOKENS.azureDark
      }}>
        <Ico.copy size={12} />
        <span style={{ flex: 1 }}>
          Paste a screenshot of the current window <span style={{ color: ARK_TOKENS.inkMuted }}>(⌘V)</span> — Ark will set it as <b>Before</b>.
        </span>
        <button type="button"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', border: `1px solid ${ARK_TOKENS.azure}`,
            background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r,
            fontSize: 11, color: ARK_TOKENS.azure, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600
          }}>
          <Ico.upload size={10} /> Upload
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: compact ? 6 : 10, alignItems: 'stretch'
      }}>
        <UiThumb label="Before" variant="before" compact={compact} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: ARK_TOKENS.inkSubtle }}>
          <Ico.arrow size={14} />
        </div>
        <UiThumb label="After" variant="after" compact={compact} />
      </div>
      {!compact &&
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', border: `1px solid ${ARK_TOKENS.border}`,
              background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2,
              fontSize: 11, color: ARK_TOKENS.inkMuted, cursor: 'pointer', fontFamily: 'inherit'
            }}>
            <Ico.upload size={10} /> Replace before
          </button>
          <button type="button"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', border: `1px solid ${ARK_TOKENS.border}`,
              background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2,
              fontSize: 11, color: ARK_TOKENS.inkMuted, cursor: 'pointer', fontFamily: 'inherit'
            }}>
            <Ico.upload size={10} /> Replace after
          </button>
          <button type="button"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', border: `1px solid ${ARK_TOKENS.border}`,
              background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2,
              fontSize: 11, color: ARK_TOKENS.inkMuted, cursor: 'pointer', fontFamily: 'inherit'
            }}>
            <Ico.edit size={10} /> Annotate
          </button>
        </div>
      }
    </div>);
}

function UiThumb({ label, variant, compact }) {
  const isAfter = variant === 'after';
  const h = compact ? 96 : 132;
  return (
    <div style={{
      border: `1px solid ${ARK_TOKENS.border}`,
      borderRadius: ARK_TOKENS.r2,
      background: ARK_TOKENS.surface,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        height: h, background: '#F1F4F9',
        display: 'flex', flexDirection: 'column',
        padding: 8, gap: 4,
        position: 'relative'
      }}>
        {/* fake row showing failed renewal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 3, background: '#fff', border: `1px solid ${ARK_TOKENS.border}` }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: isAfter ? '#388E3C' : '#E11A22' }} />
          <div style={{ height: 4, background: '#E3E6ED', flex: 1, borderRadius: 1 }} />
          <div style={{ height: 4, background: '#E3E6ED', width: 24, borderRadius: 1 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 3, background: '#fff', border: `1px solid ${ARK_TOKENS.border}` }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: '#E11A22' }} />
          <div style={{ height: 4, background: '#E3E6ED', flex: 1, borderRadius: 1 }} />
          <div style={{ height: 4, background: '#E3E6ED', width: 24, borderRadius: 1 }} />
        </div>
        {/* the only thing that's different: action chip */}
        {isAfter ?
          <div style={{
            position: 'absolute', right: 8, bottom: 8,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px',
            background: ARK_TOKENS.azure, color: '#fff',
            borderRadius: 12, fontSize: 9, fontWeight: 600, letterSpacing: 0.3,
            boxShadow: '0 1px 3px rgba(0,143,190,0.4)'
          }}>
            <Ico.refresh size={8} /> AUTO-RETRY ON
          </div> :
          <div style={{
            position: 'absolute', right: 8, bottom: 8,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px',
            background: '#fff', color: ARK_TOKENS.inkMuted,
            border: `1px solid ${ARK_TOKENS.border}`,
            borderRadius: 12, fontSize: 9, fontWeight: 500
          }}>
            Retry manually
          </div>
        }
      </div>
      <div style={{
        padding: '4px 8px',
        fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
        color: isAfter ? ARK_TOKENS.azure : ARK_TOKENS.inkMuted,
        background: isAfter ? ARK_TOKENS.azureFaint : ARK_TOKENS.surfaceAlt,
        borderTop: `1px solid ${ARK_TOKENS.border}`,
        textTransform: 'uppercase'
      }}>
        {label}
      </div>
    </div>);
}

function NarrativeRow({ label, value, onChange, placeholder, multiline, last, onFocus }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'baseline',
      padding: '10px 0',
      borderBottom: last ? 'none' : `1px solid ${ARK_TOKENS.border}`
    }}>
      <div style={{ fontSize: 12, color: ARK_TOKENS.inkMuted, fontWeight: 500, paddingTop: 4 }}>{label}</div>
      {multiline ?
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        onFocus={() => {setFocus(true);onFocus && onFocus();}} onBlur={() => setFocus(false)}
        style={{
          width: '100%', resize: 'none',
          border: 'none', background: 'transparent',
          padding: '4px 0', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5,
          color: ARK_TOKENS.ink,
          outline: 'none',
          borderBottom: `1px solid ${focus ? ARK_TOKENS.azure : 'transparent'}`
        }}>automatically retry a failed Pro renewal on a smart schedule and surface the result on the customer support timeline</textarea> :


      <input
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => {setFocus(true);onFocus && onFocus();}} onBlur={() => setFocus(false)}
        style={{
          width: '100%', border: 'none', background: 'transparent',
          padding: '4px 0', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5,
          color: ARK_TOKENS.ink, outline: 'none',
          borderBottom: `1px solid ${focus ? ARK_TOKENS.azure : 'transparent'}`
        }} />

      }
    </div>);

}

// ─────────────────────────────────────────────────────────────
// Suggest Chat — calmer, no gradients, single accent.
// ─────────────────────────────────────────────────────────────
function SuggestChat({ storyState, onApply, activeField, setActiveField }) {
  const initialMessages = [
  {
    role: 'ai',
    text: "I scanned recent tickets and stories in **Support-Platform / Billing** and your area's glossary. A few suggestions:"
  },
  {
    role: 'ai',
    kind: 'suggestions',
    intro: 'Tighter **titles** for this story:',
    field: 'title',
    options: [
    'Smart retry for failed Pro renewals',
    'Auto-recover declined subscription payments',
    'Reduce involuntary churn from card declines']

  },
  {
    role: 'ai',
    kind: 'suggestions',
    intro: '**Personas** common in your backlog:',
    field: 'persona',
    options: [
    'Support engineer',
    'Tier\u20112 billing support specialist',
    'Customer success manager']

  },
  {
    role: 'ai',
    kind: 'criteria-bundle',
    intro: 'Likely **acceptance criteria** based on similar stories:',
    options: [
    'Given a card-decline failure, when the retry runs, then a follow-up email is sent to the customer with a payment-update link.',
    'Given a renewal succeeds on retry, when processed, then the support timeline shows the recovery and the open alert auto-closes.',
    'Given all retries fail, when escalated, then the ticket inherits the customer\u2019s tier and SLA from their account.']

  }];

  const [messages, setMessages] = React.useState(initialMessages);
  const [input, setInput] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [usedSuggestions, setUsedSuggestions] = React.useState(new Set());
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const handleApply = (msgIdx, optIdx, field, text) => {
    onApply(field, text);
    const key = `${msgIdx}-${optIdx}`;
    setUsedSuggestions((prev) => new Set(prev).add(key));
    setMessages((prev) => [...prev, {
      role: 'ai',
      kind: 'ack',
      text: field === 'criteria' ? 'Added.' : `Applied to ${fieldLabel(field)}.`
    }]);
  };

  const send = () => {
    if (!input.trim()) return;
    const userText = input;
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, {
        role: 'ai',
        kind: 'suggestions',
        intro: 'Tighter options for the **benefit**:',
        field: 'benefit',
        options: [
        'my team recovers 80% of declined renewals without human intervention.',
        'I can stop opening manual tickets for every card decline \u2014 saving ~5 hours per week per support engineer.',
        'customers on Pro stay in service through transient payment issues, reducing involuntary churn.']

      }]);
    }, 1100);
  };

  return (
    <div style={{
      flex: '0 0 360px',
      borderLeft: `1px solid ${ARK_TOKENS.border}`,
      background: ARK_TOKENS.surface,
      display: 'flex', flexDirection: 'column', minWidth: 0
    }}>
      {/* header */}
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${ARK_TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, background: ARK_TOKENS.ai, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ico.sparkle size={11} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Ark Coach</div>
          <div style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle }}>Reading your backlog</div>
        </div>
        <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: ARK_TOKENS.inkSubtle, padding: 4, borderRadius: 3 }}>
          <Ico.gear size={14} />
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((m, i) =>
        <SuggestMsg key={i} msg={m} msgIdx={i} onApply={handleApply} usedSuggestions={usedSuggestions} />
        )}
        {typing &&
        <div style={{ display: 'flex', gap: 4, padding: '4px 0 4px 32px', alignItems: 'center' }}>
            {[0, 1, 2].map((i) =>
          <div key={i} style={{ width: 5, height: 5, borderRadius: 3, background: ARK_TOKENS.inkSubtle, animation: `ark-pulse 1.2s ease-in-out ${i * 0.15}s infinite` }} />
          )}
          </div>
        }
      </div>

      {/* quick chips */}
      <div style={{ padding: '4px 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[
        'Suggest Background',
        'Suggest Narrative'].
        map((c) =>
        <button key={c} onClick={() => setInput(c)}
        style={{
          border: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surface,
          padding: '4px 10px', borderRadius: 12, fontSize: 11, color: ARK_TOKENS.inkMuted,
          cursor: 'pointer', fontFamily: 'inherit'
        }}>{c}</button>
        )}
      </div>

      {/* composer */}
      <div style={{ padding: '0 14px 14px' }}>
        <div style={{
          border: `1px solid ${ARK_TOKENS.borderStrong}`, borderRadius: ARK_TOKENS.r2,
          background: ARK_TOKENS.surface, padding: 8,
          display: 'flex', alignItems: 'flex-end', gap: 6
        }}>
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();send();}}}
            placeholder="Ask the coach…"
            rows={1}
            style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }} />
          
          <button onClick={send} disabled={!input.trim()}
          style={{
            width: 26, height: 26, borderRadius: 13, border: 'none',
            background: input.trim() ? ARK_TOKENS.ink : ARK_TOKENS.border,
            color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Ico.arrow size={11} dir="up" />
          </button>
        </div>
      </div>
    </div>);

}

function fieldLabel(f) {
  return { title: 'Title', background: 'Background', persona: 'Persona', want: 'Desire', benefit: 'Benefit', criteria: 'Acceptance criteria' }[f] || f;
}

function SuggestMsg({ msg, msgIdx, onApply, usedSuggestions }) {
  const renderText = (t) => (t || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'ark-fadein 0.25s' }}>
        <div style={{ maxWidth: '88%', background: ARK_TOKENS.surfaceAlt, color: ARK_TOKENS.ink, padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
          {msg.text}
        </div>
      </div>);

  }

  if (msg.kind === 'ack') {
    return (
      <div className="ark-fadein" style={{ display: 'flex', gap: 6, paddingLeft: 32, fontSize: 11, color: ARK_TOKENS.inkSubtle, alignItems: 'center' }}>
        <Ico.check size={11} />
        <span>{msg.text}</span>
      </div>);

  }

  // Default AI message
  return (
    <div style={{ display: 'flex', gap: 10, animation: 'ark-fadein 0.25s' }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: ARK_TOKENS.ai, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <Ico.sparkle size={10} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {msg.text &&
        <div style={{ fontSize: 13, lineHeight: 1.55, color: ARK_TOKENS.ink, marginBottom: msg.kind ? 10 : 0 }}
        dangerouslySetInnerHTML={{ __html: renderText(msg.text) }} />
        }
        {msg.intro &&
        <div style={{ fontSize: 12, lineHeight: 1.5, color: ARK_TOKENS.inkMuted, marginBottom: 8 }}
        dangerouslySetInnerHTML={{ __html: renderText(msg.intro) }} />
        }

        {(msg.kind === 'suggestions' || msg.kind === 'criteria-bundle') &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {msg.options.map((opt, i) => {
            const used = usedSuggestions.has(`${msgIdx}-${i}`);
            const targetField = msg.kind === 'criteria-bundle' ? 'criteria' : msg.field;
            return (
              <button key={i} onClick={() => onApply(msgIdx, i, targetField, opt)} disabled={used}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                border: `1px solid ${ARK_TOKENS.border}`,
                background: used ? ARK_TOKENS.surfaceAlt : ARK_TOKENS.surface,
                borderRadius: ARK_TOKENS.r2, fontSize: 12.5, lineHeight: 1.5,
                color: used ? ARK_TOKENS.inkMuted : ARK_TOKENS.ink,
                cursor: used ? 'default' : 'pointer', fontFamily: 'inherit',
                display: 'flex', gap: 8, alignItems: 'flex-start',
                transition: 'all 0.12s'
              }}
              onMouseEnter={(e) => {if (!used) {e.currentTarget.style.borderColor = ARK_TOKENS.borderStrong;e.currentTarget.style.background = ARK_TOKENS.surfaceAlt;}}}
              onMouseLeave={(e) => {if (!used) {e.currentTarget.style.borderColor = ARK_TOKENS.border;e.currentTarget.style.background = ARK_TOKENS.surface;}}}>
                  <span style={{ color: used ? ARK_TOKENS.inkSubtle : ARK_TOKENS.inkMuted, flexShrink: 0, marginTop: 1 }}>
                    {used ? <Ico.check size={11} /> : <Ico.plus size={11} />}
                  </span>
                  <span style={{ flex: 1 }}>{opt}</span>
                </button>);

          })}
          </div>
        }
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// Live preview — flatter, fewer blocks.
// ─────────────────────────────────────────────────────────────
function WorkItemPreview({ title, background, persona, want, benefit, criteria, docs, showUiChange, compact }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 11, color: ARK_TOKENS.inkSubtle, fontWeight: 500, letterSpacing: 0.3 }}>
        <span style={{ width: 10, height: 10, background: ARK_TOKENS.azure, borderRadius: 1 }} />
        <span>USER STORY · #4187 · NEW</span>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 600, margin: '0 0 16px', letterSpacing: -0.3, lineHeight: 1.3 }}>
        {title || <span style={{ color: ARK_TOKENS.inkSubtle, fontWeight: 400 }}>Untitled story</span>}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 20, fontSize: 12 }}>
        <PreviewMeta label="Assigned" value={<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Avatar name="Unassigned" size={16} color="#a19f9d" /> Unassigned</div>} />
        <PreviewMeta label="State" value="New" />
        <PreviewMeta label="Area" value="Billing" />
        <PreviewMeta label="Iteration" value="Sprint 42" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Background</SectionLabel>
        {background ?
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: ARK_TOKENS.ink, whiteSpace: 'pre-wrap' }}>{background}</p> :
          <Placeholder w={260} />
        }
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Description</SectionLabel>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: ARK_TOKENS.ink }}>
          <b>As a</b> {persona || <Placeholder w={80} />}
          <br /><b>I want to</b> {want || <Placeholder w={200} />}
          <br /><b>So that</b> {benefit || <Placeholder w={180} />}.
        </p>
      </div>

      <div>
        <SectionLabel>Acceptance criteria</SectionLabel>
        {criteria.length === 0 ? <Placeholder w={240} /> :
        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {criteria.map((c, i) =>
          <li key={c.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${ARK_TOKENS.border}`, fontSize: 12.5, lineHeight: 1.55 }}>
                <span style={{ color: ARK_TOKENS.inkSubtle, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: 11, marginTop: 2, width: 24 }}>AC{i + 1}</span>
                <span style={{ flex: 1 }}>{c.text}</span>
              </li>
          )}
          </ol>
        }
      </div>

      {showUiChange &&
        <div style={{ marginTop: 22 }}>
          <SectionLabel>UI change · Before → After</SectionLabel>
          <UiChangePreview enabled compact />
        </div>
      }

      {docs && docs.length > 0 &&
        <div style={{ marginTop: 22 }}>
          <SectionLabel>Attachments</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {docs.map((d) =>
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ARK_TOKENS.ink, padding: '4px 0' }}>
                <DocIcon kind={d.kind} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ color: ARK_TOKENS.inkSubtle, fontSize: 11 }}>{d.size}</span>
              </div>
            )}
          </div>
        </div>
      }

      {!compact &&
      <div style={{ marginTop: 22, fontSize: 12, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Ico.link size={11} />
          <span>Will link to <span style={{ color: ARK_TOKENS.azure, fontWeight: 500 }}>Feature #3994</span></span>
        </div>
      }
    </div>);

}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 600, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.7, marginBottom: 8, textTransform: 'uppercase' }}>{children}</div>;
}

function PreviewMeta({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: ARK_TOKENS.inkSubtle, fontWeight: 600, letterSpacing: 0.6, marginBottom: 3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: ARK_TOKENS.ink }}>{value}</div>
    </div>);

}

function Placeholder({ w = 140 }) {
  return <span style={{ display: 'inline-block', width: w, height: 10, background: 'linear-gradient(90deg, #eee 0%, #f8f8f8 50%, #eee 100%)', backgroundSize: '200% 100%', animation: 'ark-shimmer 1.6s linear infinite', borderRadius: 2, verticalAlign: 'middle' }} />;
}

Object.assign(window, { StoryBuilderA, WorkItemPreview, Field, NarrativeRow, PersonaRow, DocsList, DocIcon, UiChangePreview, UiThumb, PreviewMeta, Placeholder, SuggestChat, SectionLabel });