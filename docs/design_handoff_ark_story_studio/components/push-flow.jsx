// Azure push flow + confirmation screen

function PushFlow({ onDone, onBack, initialStage = 'review' }) {
  const [stage, setStage] = React.useState(initialStage); // review, pushing, done
  const [linkEpic, setLinkEpic] = React.useState(true);
  const [selectedEpic, setSelectedEpic] = React.useState('e-3994');
  const [iteration, setIteration] = React.useState('Sprint 42');
  const [progress, setProgress] = React.useState(initialStage === 'pushing' ? 70 : initialStage === 'done' ? 100 : 0);

  const storyData = {
    title: 'Auto-retry failed Pro subscription renewals',
    persona: 'Support engineer',
    want: 'automatically retry a failed Pro renewal on a smart schedule and route it to Tier\u20112 only if all retries fail',
    benefit: 'I can resolve renewal failures without opening a manual ticket for each customer',
    criteria: [
      { id: 1, text: 'A failed renewal triggers up to 3 retries over 7 days (1d, 3d, 7d) before escalation' },
      { id: 2, text: 'Each retry attempt and outcome is written to the customer\u2019s support timeline within 30s' },
      { id: 3, text: 'After the final retry fails, a ticket is auto-created in Billing-Support and assigned to Tier\u20112' },
    ],
  };

  const epics = [
    { id: 'e-3994', title: 'Reduce involuntary churn on Pro renewals', children: 7, suggested: true },
    { id: 'e-3801', title: 'Self-service support automation', children: 12 },
    { id: 'e-4102', title: 'Billing reliability Q3', children: 4 },
  ];

  const handlePush = () => {
    setStage('pushing');
    setProgress(0);
    const steps = [20, 45, 70, 90, 100];
    steps.forEach((p, i) => {
      setTimeout(() => {
        setProgress(p);
        if (p === 100) setTimeout(() => setStage('done'), 400);
      }, (i + 1) * 600);
    });
  };

  if (stage === 'review') {
    return (
      <div className="ark-root" style={{ width: '100%', height: '100%', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
        <TopBar breadcrumbs={['Support Platform', 'Billing', 'Story', 'Push to Azure']} />
        <div className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 80px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: ARK_TOKENS.azure, letterSpacing: 0.8, marginBottom: 6 }}>STEP 3 OF 3 · FINAL REVIEW</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 8px', letterSpacing: -0.4 }}>Send to Azure DevOps</h1>
            <p style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, margin: '0 0 28px' }}>
              Take a final look. You can still edit everything in Azure after push.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
              {/* User story preview */}
              <div style={{ background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2, border: `1px solid ${ARK_TOKENS.border}`, padding: 24 }}>
                <WorkItemPreview {...storyData} compact />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 32, paddingTop: 24, borderTop: `1px solid ${ARK_TOKENS.border}`, maxWidth: 720 }}>
              <Btn onClick={onBack} icon={<Ico.arrow size={14} dir="left" />}>Back to editor</Btn>
              <div style={{ flex: 1 }} />
              <Btn variant="ghost">Save as draft</Btn>
              <Btn variant="primary" size="lg" onClick={handlePush} icon={<AzureMark size={14} />}>
                Push to Azure DevOps
              </Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'pushing') {
    return (
      <div className="ark-root" style={{ width: '100%', height: '100%', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 440, background: '#fff', borderRadius: ARK_TOKENS.r3, padding: 32, boxShadow: ARK_TOKENS.shadow3, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 28, background: ARK_TOKENS.azureFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AzureMark size={32} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>Sending to Azure DevOps…</h2>
          <div style={{ fontSize: 13, color: ARK_TOKENS.inkMuted, marginBottom: 20 }}>This usually takes 2-3 seconds.</div>
          <div style={{ height: 6, background: ARK_TOKENS.border, borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: ARK_TOKENS.azure, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ textAlign: 'left', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Validating fields', done: progress >= 20 },
              { label: 'Creating Work Item', done: progress >= 45 },
              { label: 'Linking to Epic #3994 \u00b7 Pro renewals', done: progress >= 70 },
              { label: 'Adding acceptance criteria', done: progress >= 90 },
              { label: 'Assigning to Sprint 42', done: progress >= 100 },
            ].map((st, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, color: st.done ? ARK_TOKENS.ink : ARK_TOKENS.inkSubtle }}>
                {st.done ? (
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: ARK_TOKENS.success, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <Ico.check size={9} />
                  </div>
                ) : (
                  <div style={{ width: 14, height: 14, borderRadius: 7, border: `1.5px solid ${ARK_TOKENS.borderStrong}` }} />
                )}
                {st.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="ark-root" style={{ width: '100%', height: '100%', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 20px', borderRadius: 36, background: ARK_TOKENS.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ARK_TOKENS.success }}>
            <Ico.check size={32} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 8px', letterSpacing: -0.4 }}>Story #4187 is in the backlog.</h1>
          <p style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, margin: 0 }}>
            Your dev team will see it in their next backlog refinement.
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: ARK_TOKENS.r2, border: `1px solid ${ARK_TOKENS.border}`, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: ARK_TOKENS.azureLight, borderRadius: ARK_TOKENS.r2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AzureMark size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: ARK_TOKENS.inkSubtle, fontWeight: 600, letterSpacing: 0.4 }}>USER STORY · #4187</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Auto-retry failed Pro subscription renewals</div>
            </div>
            <Btn size="sm" variant="ghost" icon={<Ico.link size={12} />}>Open in Azure</Btn>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={onDone} icon={<Ico.arrow size={12} dir="left" />}>Back to dashboard</Btn>
          <div style={{ flex: 1 }} />
          <Btn variant="primary" onClick={onDone} icon={<Ico.plus size={12} />}>Write another story</Btn>
        </div>
      </div>
    </div>
  );
}

function PanelSection({ title, right, children }) {
  return (
    <div style={{ background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2, border: `1px solid ${ARK_TOKENS.border}`, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: ARK_TOKENS.inkMuted, letterSpacing: 0.6, flex: 1 }}>{title.toUpperCase()}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 32, height: 18, borderRadius: 9,
      background: on ? ARK_TOKENS.azure : ARK_TOKENS.borderStrong,
      border: 'none', position: 'relative', cursor: 'pointer', padding: 0,
      transition: 'background 0.15s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: 7, background: '#fff',
        transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function DoneStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: ARK_TOKENS.inkSubtle, fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

Object.assign(window, { PushFlow, PanelSection, Toggle, DoneStat });
