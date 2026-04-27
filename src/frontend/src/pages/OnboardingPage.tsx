import { useState, useEffect } from 'react';
import { ARK_TOKENS } from '../tokens';
import { ArkLogo, Btn, Badge, Ico } from '../components/ui';
import { useNavigate } from '../router';
import { useApp, createEmptyDraft } from '../context/AppContext';
import { useServices } from '../context/ServicesContext';

interface ResolvedItem {
  id: number;
  title: string;
  type: string;
  project: string;
  area: string;
  state: string;
  children: number;
  color: string;
  notFound?: boolean;
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
  const { azure } = useServices();
  const [step, setStep] = useState(1);
  const [workItemId, setWorkItemId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [resolved, setResolved] = useState<ResolvedItem | null>(null);

  // Debounced work item resolution
  useEffect(() => {
    if (!workItemId || workItemId.length < 2) {
      setResolved(null);
      return;
    }
    const t = setTimeout(async () => {
      const result = await azure.resolveWorkItem(workItemId);
      if (result) {
        setResolved({
          id: parseInt(result.id, 10),
          title: result.title,
          type: result.type,
          project: result.areaPath?.split('\\')[0] || 'Project',
          area: result.areaPath || '',
          state: result.state,
          children: 0,
          color: result.type === 'Bug' ? '#cc293d' : '#773b93',
        });
      } else {
        setResolved({
          id: parseInt(workItemId, 10),
          title: 'Item not found',
          type: '', project: '', area: '', state: '', children: 0, color: '',
          notFound: true,
        });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [workItemId, azure]);

  const handleFinish = () => {
    setConnecting(true);
    setTimeout(() => {
      const draft = createEmptyDraft({
        workItemId: workItemId,
        epicId: resolved && !resolved.notFound ? String(resolved.id) : undefined,
        epicName: resolved && !resolved.notFound ? resolved.title : undefined,
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
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2].map((n) => (
              <div
                key={n}
                style={{
                  width: 40, height: 3, borderRadius: 2,
                  background: step >= n ? ARK_TOKENS.azure : ARK_TOKENS.border,
                  transition: 'background 0.25s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="ark-fadein">
            <div style={{ fontSize: 11, fontWeight: 600, color: ARK_TOKENS.azure, letterSpacing: 0.8, marginBottom: 8 }}>WELCOME</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 12px', letterSpacing: -0.5, lineHeight: 1.15 }}>
              Turn your ideas into<br />stories developers love.
            </h1>
            <p style={{ fontSize: 15, color: ARK_TOKENS.inkMuted, margin: '0 0 28px', lineHeight: 1.55 }}>
              Ark guides you through writing clear, complete user stories — then pushes them straight to Azure DevOps. No more bounce-backs.
            </p>

            <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
              {[
                { icon: <Ico.target size={16} />, title: 'INVEST-checked', desc: 'Independent, valuable, testable — every time.' },
                { icon: <Ico.sparkle size={16} />, title: 'AI drafting & critique', desc: 'Turn rough notes into polished stories.' },
                { icon: <Ico.link size={16} />, title: 'Azure DevOps native', desc: 'Attach to any Work Item by ID.' },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: ARK_TOKENS.r2,
                      background: ARK_TOKENS.azureLight, color: ARK_TOKENS.azure,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{f.title}</div>
                    <div style={{ fontSize: 13, color: ARK_TOKENS.inkMuted }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Btn variant="primary" size="lg" onClick={() => setStep(2)} fullWidth icon={<Ico.arrow size={14} />}>
              Get started
            </Btn>
            <div style={{ textAlign: 'center', fontSize: 12, color: ARK_TOKENS.inkSubtle, marginTop: 16 }}>
              Signed in as <b style={{ color: ARK_TOKENS.inkMuted }}>maya.k@contoso.com</b>
            </div>
          </div>
        )}

        {/* Step 2: Connect */}
        {step === 2 && (
          <div className="ark-fadein">
            <div style={{ fontSize: 11, fontWeight: 600, color: ARK_TOKENS.azure, letterSpacing: 0.8, marginBottom: 8 }}>CONNECT TO AZURE DEVOPS</div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: '0 0 8px', letterSpacing: -0.4 }}>Where should your story go?</h1>
            <p style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, margin: '0 0 24px' }}>
              Paste the Work Item ID this story belongs to, and pick the project type.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Parent Work Item ID</label>
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
                      padding: '0 12px', color: ARK_TOKENS.inkSubtle, height: '100%',
                      display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600,
                      borderRight: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surfaceAlt,
                    }}
                  >
                    #
                  </div>
                  <input
                    value={workItemId}
                    onChange={(e) => setWorkItemId(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 3994"
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
                        <div style={{ fontSize: 12, color: ARK_TOKENS.danger }}>
                          Couldn&apos;t find #{workItemId} in this organization. Check the ID or your permissions.
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 14, height: 14, background: resolved.color, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.5, marginBottom: 2 }}>
                            {resolved.type.toUpperCase()} · #{resolved.id} · {resolved.state}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {resolved.title}
                          </div>
                          <div style={{ fontSize: 11, color: ARK_TOKENS.inkMuted, marginTop: 2 }}>
                            {resolved.project} · {resolved.area}{resolved.children ? ` · ${resolved.children} children` : ''}
                          </div>
                        </div>
                        <Badge tone="success">LINKED</Badge>
                      </>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 11, color: ARK_TOKENS.inkSubtle, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Ico.info size={12} /> Your new story will be created as a child of this item.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => setStep(1)}>Back</Btn>
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
          fontSize: 11, color: ARK_TOKENS.inkSubtle,
        }}
      >
        Ark · For organization experts who speak business, not backlog
      </div>
    </div>
  );
}
