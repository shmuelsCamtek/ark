import { useState, useEffect } from 'react';
import { ARK_TOKENS } from '../tokens';
import { TopBar, Btn, Ico, AzureMark } from '../components/ui';
import { WorkItemPreview } from '../components/builder/WorkItemPreview';
import { useParams, useNavigate } from '../router';
import { useApp } from '../context/AppContext';
import { evaluateDraft } from '../lib/storyCompletion';

type Stage = 'review' | 'pushing' | 'done';

export function PushPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getDraft } = useApp();
  const draft = getDraft(id);

  const [stage, setStage] = useState<Stage>('review');
  const [progress, setProgress] = useState(0);

  const completion = evaluateDraft(draft);
  useEffect(() => {
    if (stage === 'review' && draft && !completion.complete) {
      navigate(`/stories/${id}/edit`);
    }
  }, [stage, draft, completion.complete, id, navigate]);

  const storyTitle = draft?.title || 'Untitled story';
  const uiChange = draft?.uiChanges?.[0];
  const storyData = {
    title: storyTitle,
    background: draft?.background || '',
    scenario: draft?.scenario || '',
    flow: draft?.flow || '',
    persona: draft?.persona || '',
    want: draft?.narrative.iWantTo || '',
    benefit: draft?.narrative.soThat || '',
    criteria: draft?.acceptanceCriteria.map((ac) => ({ id: ac.id, text: ac.text })) || [],
    docs: [],
    showUiChange: !!(uiChange?.beforeUrl || uiChange?.afterUrl),
    uiBeforeUrl: uiChange?.beforeUrl,
    uiAfterUrl: uiChange?.afterUrl,
    workItemType: draft?.workItemType,
    workItemId: draft?.workItemId,
  };

  const newItemId = '#4187';

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

  const handleBackToEditor = () => navigate(`/stories/${id}/edit`);
  const handleBackToDashboard = () => navigate('/stories');
  const handleNewStory = () => navigate('/?new=1');

  // ── Review stage ──
  if (stage === 'review') {
    return (
      <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          breadcrumbs={['Stories', 'Push to Azure']}
          rightActions={
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={handleBackToEditor} icon={<Ico.arrow size={12} dir="left" />}>
                Back
              </Btn>
              <Btn variant="primary" onClick={handlePush} icon={<AzureMark size={14} />}>
                Push
              </Btn>
            </div>
          }
        />
        <div className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 48px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
              <div style={{ background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2, border: `1px solid ${ARK_TOKENS.border}`, padding: 24 }}>
                <WorkItemPreview {...storyData} compact />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pushing stage ──
  if (stage === 'pushing') {
    const steps = [
      { label: 'Validating fields', done: progress >= 20 },
      { label: 'Creating Work Item', done: progress >= 45 },
      { label: 'Linking to Epic #3994 · Pro renewals', done: progress >= 70 },
      { label: 'Adding acceptance criteria', done: progress >= 90 },
      { label: 'Assigning to Sprint 42', done: progress >= 100 },
    ];

    return (
      <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 440, background: '#fff', borderRadius: ARK_TOKENS.r3, padding: 32, boxShadow: ARK_TOKENS.shadow3, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 28, background: ARK_TOKENS.azureFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AzureMark size={32} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold }}>Sending to Azure DevOps…</h2>
          <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, marginBottom: 20 }}>This usually takes 2-3 seconds.</div>
          <div style={{ height: 6, background: ARK_TOKENS.border, borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: ARK_TOKENS.azure, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ textAlign: 'left', fontSize: ARK_TOKENS.type.label, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map((st, i) => (
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

  // ── Done stage ──
  return (
    <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ maxWidth: 640, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 20px', borderRadius: 36, background: ARK_TOKENS.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ARK_TOKENS.success }}>
            <Ico.check size={32} />
          </div>
          <h1 style={{ fontSize: ARK_TOKENS.type.display, fontWeight: ARK_TOKENS.weight.semibold, margin: '0 0 8px', letterSpacing: -0.3, lineHeight: ARK_TOKENS.leading.tight }}>Story {newItemId} is in the backlog.</h1>
          <p style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, margin: 0 }}>
            Your dev team will see it in their next backlog refinement.
          </p>
        </div>

        <div style={{ background: '#fff', borderRadius: ARK_TOKENS.r2, border: `1px solid ${ARK_TOKENS.border}`, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, background: ARK_TOKENS.azureLight, borderRadius: ARK_TOKENS.r2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AzureMark size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkSubtle, fontWeight: ARK_TOKENS.weight.semibold, letterSpacing: 0.5 }}>USER STORY · {newItemId}</div>
              <div style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold }}>{storyTitle}</div>
            </div>
            <Btn size="sm" variant="ghost" icon={<Ico.link size={12} />}>Open in Azure</Btn>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={handleBackToDashboard} icon={<Ico.arrow size={12} dir="left" />}>Back to dashboard</Btn>
          <div style={{ flex: 1 }} />
          <Btn variant="primary" onClick={handleNewStory} icon={<Ico.plus size={12} />}>Write another story</Btn>
        </div>
      </div>
    </div>
  );
}
