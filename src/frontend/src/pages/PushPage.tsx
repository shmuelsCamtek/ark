import { useState, useEffect } from 'react';
import { ARK_TOKENS } from '../tokens';
import { TopBar, Btn, Ico, AzureMark } from '../components/ui';
import { WorkItemPreview, WorkItemHeader } from '../components/builder/WorkItemPreview';
import { MockupTabs } from '../components/builder/MockupTabs';
import { useParams, useNavigate } from '../router';
import { useApp } from '../context/AppContext';
import { useServices } from '../context/ServicesContext';
import { evaluateDraft } from '../lib/storyCompletion';
import { renderFlow } from '../lib/renderFlowSvg';
import { storyToHtml } from '../lib/storyToHtml';
import { draftPictures } from '../lib/pictures';
import type { GraphLoginInfo } from '../services/sharepoint';
import type { StoryDraft } from '../types';

type Stage = 'review' | 'publishing' | 'done' | 'consent' | 'error' | 'graph_login';

function slugify(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 100) || 'story'
  );
}

export function PushPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getDraft, updateDraft, user, isMockupGenerating, setMockupGenerating } = useApp();
  const { azure, sharepoint, ai } = useServices();
  const draft = getDraft(id);

  const [stage, setStage] = useState<Stage>('review');
  const [publishStatus, setPublishStatus] = useState<string>('Preparing…');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [workItemUrl, setWorkItemUrl] = useState<string | null>(null);
  const [graphLogin, setGraphLogin] = useState<GraphLoginInfo | null>(null);
  const [mockupError, setMockupError] = useState<string | null>(null);

  const generatingMockup = id ? isMockupGenerating(id) : false;

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

  const completion = evaluateDraft(draft);
  useEffect(() => {
    if (stage === 'review' && draft && !completion.complete) {
      navigate(`/stories/${id}/edit`);
    }
  }, [stage, draft, completion.complete, id, navigate]);

  const storyTitle = draft?.title || 'Untitled story';
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
    pictures: draftPictures(draft),
    workItemType: draft?.workItemType,
    workItemId: draft?.workItemId,
  };

  // Build the self-contained story HTML (story + pictures + optional mockup tab).
  // Shared by Push (upload to SharePoint) and Save (download locally).
  const buildStoryHtml = async (d: StoryDraft): Promise<string> => {
    const flowBlocks = await renderFlow(d.flow || '');
    return storyToHtml({
      title: d.title || 'Untitled story',
      background: d.background || '',
      scenario: d.scenario,
      flowBlocks,
      persona: d.persona || '',
      want: d.narrative.iWantTo || '',
      benefit: d.narrative.soThat || '',
      criteria: d.acceptanceCriteria.map((ac) => ({ id: ac.id, text: ac.text })),
      pictures: draftPictures(d).map((p) => ({ dataUrl: p.dataUrl, caption: p.caption })),
      workItemType: d.workItemType,
      workItemId: d.workItemId,
      mockupHtml: d.mockup?.status === 'ok' ? d.mockup.html : undefined,
      generatedBy: user?.email || 'Ark Story Studio',
      generatedAt: new Date().toISOString(),
    });
  };

  // Save the generated HTML to the user's machine (no SharePoint / auth needed).
  const handleSaveHtml = async () => {
    if (!draft) return;
    const html = await buildStoryHtml(draft);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(draft.title || 'untitled')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePush = async () => {
    if (!draft) return;
    if (!user?.email) {
      setErrorMessage('Cannot publish: missing user email.');
      setStage('error');
      return;
    }
    setStage('publishing');
    setPublishStatus('Generating HTML…');
    try {
      const html = await buildStoryHtml(draft);
      setPublishStatus('Uploading to SharePoint…');
      const slug = slugify(draft.title || 'untitled');
      const filename = `${slug}-${draft.id}.html`;
      const result = await sharepoint.publish({ html, filename, folderName: user.email });
      if (result.ok) {
        setPublishedUrl(result.webUrl);
        setStage('done');
        return;
      }
      if (result.error === 'graph_consent_required') {
        setErrorMessage(result.message);
        setStage('consent');
        return;
      }
      if (result.error === 'graph_login_required') {
        await beginGraphLogin();
        return;
      }
      setErrorMessage(result.message);
      setStage('error');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  };

  const beginGraphLogin = async () => {
    setStage('graph_login');
    setErrorMessage('');
    setGraphLogin(null);
    try {
      const info = await sharepoint.loginStart();
      setGraphLogin(info);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  };

  // Poll Graph device flow while on the graph_login stage. On success, retry publish.
  useEffect(() => {
    if (stage !== 'graph_login' || !graphLogin) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await sharepoint.loginPoll();
        if (cancelled) return;
        if (r.status === 'authenticated') {
          handlePush();
          return;
        }
        if (r.status === 'expired') {
          setErrorMessage('Login code expired. Please try again.');
          setStage('error');
          return;
        }
        if (r.status === 'error') {
          setErrorMessage(r.error);
          setStage('error');
          return;
        }
        timer = setTimeout(tick, 5000);
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStage('error');
      }
    };
    let timer = setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, graphLogin]);

  const handleBackToEditor = () => navigate(`/stories/${id}/edit`);
  const handleBackToDashboard = () => navigate('/stories');
  const handleNewStory = () => navigate('/?new=1');
  const handleRetry = () => {
    setStage('review');
    setErrorMessage('');
  };

  const handleGenerateMockup = async () => {
    if (!id || generatingMockup) return;
    setMockupGenerating(id, true);
    setMockupError(null);
    try {
      const result = await ai.generateMockup(id);
      updateDraft(id, { mockup: result });
    } catch (err) {
      setMockupError(err instanceof Error ? err.message : 'Interactive GUI generation failed');
    } finally {
      setMockupGenerating(id, false);
    }
  };

  const mockup = draft?.mockup;
  const hasInsufficientMockup = mockup?.status === 'insufficient';

  // ── Review stage ──
  if (stage === 'review') {
    return (
      <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          breadcrumbs={['Stories', 'Push to Azure']}
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
                <Btn variant="ghost" onClick={handleSaveHtml} icon={<Ico.download size={13} />}>
                  Save
                </Btn>
                <Btn onClick={handleBackToEditor} icon={<Ico.arrow size={12} dir="left" />}>
                  Back
                </Btn>
                <Btn variant="primary" onClick={handlePush} icon={<AzureMark size={14} />}>
                  Push
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
                ? `Interactive GUI error: ${mockupError}`
                : `Interactive GUI needs more story detail: ${mockup?.insufficientReason}`}
            </span>
          </div>
        )}
        <div className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 48px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880 }}>
              <div style={{ background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r2, border: `1px solid ${ARK_TOKENS.border}`, padding: 24 }}>
                <WorkItemHeader
                  title={storyTitle}
                  workItemType={draft?.workItemType}
                  workItemId={draft?.workItemId}
                />
                <MockupTabs
                  storyContent={<WorkItemPreview {...storyData} compact hideHeader />}
                  mockup={draft?.mockup}
                  showInsufficient={false}
                  generating={generatingMockup}
                  onRefresh={handleGenerateMockup}
                  refreshing={generatingMockup}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Publishing stage ──
  if (stage === 'publishing') {
    return (
      <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 440, background: '#fff', borderRadius: ARK_TOKENS.r3, padding: 32, boxShadow: ARK_TOKENS.shadow3, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 28, background: ARK_TOKENS.azureFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ark-spin" style={{ width: 28, height: 28, borderRadius: 14, border: `3px solid ${ARK_TOKENS.azureLight}`, borderTopColor: ARK_TOKENS.azure }} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold }}>Publishing to SharePoint…</h2>
          <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted }}>{publishStatus}</div>
        </div>
      </div>
    );
  }

  // ── Graph login stage (second device-code flow for SharePoint) ──
  if (stage === 'graph_login') {
    return (
      <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: ARK_TOKENS.r3, padding: 32, boxShadow: ARK_TOKENS.shadow3 }}>
          <h1 style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, margin: '0 0 8px' }}>Sign in to SharePoint</h1>
          <p style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, margin: '0 0 24px' }}>
            One-time sign-in to authorize uploading stories to your SharePoint site. Open the link below and enter the code.
          </p>
          {!graphLogin ? (
            <div style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted }}>Starting sign-in…</div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkSubtle, fontWeight: ARK_TOKENS.weight.semibold, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Code</div>
                <div style={{ fontFamily: ARK_TOKENS.mono, fontSize: 32, fontWeight: ARK_TOKENS.weight.semibold, letterSpacing: 4, color: ARK_TOKENS.azureDark }}>
                  {graphLogin.userCode}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <a
                  href={graphLogin.verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.azure }}
                >
                  {graphLogin.verificationUri}
                </a>
              </div>
              <div style={{ fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="ark-spin" style={{ width: 12, height: 12, borderRadius: 6, border: `2px solid ${ARK_TOKENS.azureLight}`, borderTopColor: ARK_TOKENS.azure }} />
                Waiting for you to complete sign-in…
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <Btn onClick={handleRetry} icon={<Ico.arrow size={12} dir="left" />}>Cancel</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── Consent-required stage ──
  if (stage === 'consent') {
    return (
      <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: ARK_TOKENS.r3, padding: 32, boxShadow: ARK_TOKENS.shadow3 }}>
          <h1 style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, margin: '0 0 8px' }}>SharePoint access not granted</h1>
          <p style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, margin: '0 0 16px' }}>
            Your tenant hasn't approved the <code>Sites.ReadWrite.All</code> permission this app needs to upload to SharePoint. Ask a tenant admin to grant consent, then try again.
          </p>
          {errorMessage && (
            <pre style={{ background: ARK_TOKENS.surfaceAlt, padding: 12, borderRadius: ARK_TOKENS.r, fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkMuted, whiteSpace: 'pre-wrap', margin: '0 0 20px' }}>{errorMessage}</pre>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleRetry} icon={<Ico.arrow size={12} dir="left" />}>Back to preview</Btn>
            <div style={{ flex: 1 }} />
            <Btn variant="primary" onClick={handlePush}>Try again</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── Error stage ──
  if (stage === 'error') {
    return (
      <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 560, width: '100%', background: '#fff', borderRadius: ARK_TOKENS.r3, padding: 32, boxShadow: ARK_TOKENS.shadow3 }}>
          <h1 style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, margin: '0 0 8px' }}>Publish failed</h1>
          <p style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, margin: '0 0 16px' }}>
            Something went wrong while uploading the story to SharePoint.
          </p>
          {errorMessage && (
            <pre style={{ background: ARK_TOKENS.surfaceAlt, padding: 12, borderRadius: ARK_TOKENS.r, fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkMuted, whiteSpace: 'pre-wrap', margin: '0 0 20px' }}>{errorMessage}</pre>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleRetry} icon={<Ico.arrow size={12} dir="left" />}>Back to preview</Btn>
            <div style={{ flex: 1 }} />
            <Btn variant="primary" onClick={handlePush}>Try again</Btn>
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
          <h1 style={{ fontSize: ARK_TOKENS.type.display, fontWeight: ARK_TOKENS.weight.semibold, margin: '0 0 8px', letterSpacing: -0.3, lineHeight: ARK_TOKENS.leading.tight }}>Saved to SharePoint</h1>
          <p style={{ fontSize: ARK_TOKENS.type.body, color: ARK_TOKENS.inkMuted, margin: 0 }}>
            Your story HTML is in your personal folder on SharePoint.
          </p>
        </div>

        {publishedUrl && (
          <div style={{ background: '#fff', borderRadius: ARK_TOKENS.r2, border: `1px solid ${ARK_TOKENS.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, background: ARK_TOKENS.azureLight, borderRadius: ARK_TOKENS.r2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico.file size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ARK_TOKENS.type.micro, color: ARK_TOKENS.inkSubtle, fontWeight: ARK_TOKENS.weight.semibold, letterSpacing: 0.5 }}>STORY HTML</div>
                <div style={{ fontSize: ARK_TOKENS.type.h1, fontWeight: ARK_TOKENS.weight.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{storyTitle}</div>
              </div>
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Btn size="sm" variant="ghost" icon={<Ico.link size={12} />}>Open in SharePoint</Btn>
              </a>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={handleBackToDashboard} icon={<Ico.arrow size={12} dir="left" />}>Back to dashboard</Btn>
          <div style={{ flex: 1 }} />
          <Btn variant="primary" onClick={handleNewStory} icon={<Ico.plus size={12} />}>Write another story</Btn>
        </div>
      </div>
    </div>
  );
}
