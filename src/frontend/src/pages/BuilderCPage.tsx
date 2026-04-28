import { ARK_TOKENS } from '../tokens';
import { TopBar, Btn, Ico } from '../components/ui';
import { useNavigate } from '../router';

interface CardData {
  title: string;
  sub: string;
  content: string;
  color: string;
  icon: string;
  kind?: 'ac';
}

const CARDS: Record<string, CardData> = {
  persona: { title: 'Support engineer', sub: 'The user', content: 'Triages 30\u201360 billing tickets a day. Most card-decline cases are routine retries handled by hand.', color: '#1994FF', icon: 'user' },
  problem: { title: "Today's pain", sub: 'What hurts', content: 'Every Pro renewal that declines becomes a ticket. Engineers spend hours per week clicking \u201cretry\u201d and emailing customers.', color: '#E11A22', icon: 'warn' },
  want: { title: 'The ask', sub: 'The desire', content: 'Auto-retry failed renewals on a smart schedule, log each attempt, and only escalate if all retries fail.', color: '#8764b8', icon: 'bolt' },
  outcome: { title: 'The win', sub: 'Why it matters', content: 'Recover 80% of declined renewals without human touch. Support engineers focus on real issues; involuntary churn drops.', color: '#107c10', icon: 'heart' },
  ac1: { title: 'AC \u00b7 Retry schedule', sub: 'Acceptance criterion', content: 'Given a renewal fails, when the engine runs, then it retries at 1, 3, and 7 days before escalating.', color: '#038387', icon: 'check', kind: 'ac' },
  ac2: { title: 'AC \u00b7 Customer timeline', sub: 'Acceptance criterion', content: 'Given a retry runs, when complete, then the attempt + outcome appears on the support timeline within 30s.', color: '#038387', icon: 'check', kind: 'ac' },
  ac3: { title: 'AC \u00b7 Escalation', sub: 'Acceptance criterion', content: 'Given all retries fail, when escalated, then a ticket is opened in Billing-Support, assigned to Tier\u20112, with the customer\u2019s SLA attached.', color: '#038387', icon: 'check', kind: 'ac' },
};

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  user: Ico.user,
  warn: Ico.warn,
  bolt: Ico.bolt,
  heart: Ico.heart,
  check: Ico.check,
};

export function BuilderCPage() {
  const navigate = useNavigate();
  const narrativeCards = ['persona', 'problem', 'want', 'outcome'];
  const acCards = ['ac1', 'ac2', 'ac3'];

  return (
    <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar
        breadcrumbs={['Stories', 'Story canvas']}
        rightActions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 0, border: `1px solid ${ARK_TOKENS.borderStrong}`, borderRadius: ARK_TOKENS.r, overflow: 'hidden' }}>
              <button style={{ padding: '5px 10px', background: ARK_TOKENS.azureLight, color: ARK_TOKENS.azure, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Canvas</button>
              <button style={{ padding: '5px 10px', background: '#fff', color: ARK_TOKENS.inkMuted, border: 'none', borderLeft: `1px solid ${ARK_TOKENS.borderStrong}`, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Document</button>
            </div>
            <Btn variant="ghost" icon={<Ico.sparkle size={14} />} style={{ color: ARK_TOKENS.ai }}>Fill gaps with AI</Btn>
            <Btn variant="primary" icon={<Ico.arrow size={14} />} onClick={() => navigate('/stories/new/push')}>Push to Azure</Btn>
          </div>
        }
      />

      {/* Sub-header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surface, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: -0.2 }}>Auto-retry failed Pro subscription renewals</h2>
          <div style={{ fontSize: 14, color: ARK_TOKENS.inkMuted, marginTop: 2, display: 'flex', gap: 10 }}>
            <span>7 cards</span>
            <span>&middot;</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, background: ARK_TOKENS.success, borderRadius: 3 }} /> Complete story
            </span>
            <span>&middot;</span>
            <span>Est. 5 story points</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <LegendTag color="#1994FF" label="Persona" />
          <LegendTag color="#E11A22" label="Problem" />
          <LegendTag color="#8764b8" label="Ask" />
          <LegendTag color="#107c10" label="Outcome" />
          <LegendTag color="#038387" label="AC" />
        </div>
      </div>

      {/* Canvas */}
      <div
        className="ark-scroll"
        style={{
          flex: 1, overflow: 'auto', position: 'relative',
          background: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          padding: 40,
        }}
      >
        {/* Row 1: Narrative cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 28, minWidth: 980, maxWidth: 1400, margin: '0 auto' }}>
          {narrativeCards.map((key) => (
            <IdxCard key={key} data={CARDS[key]} />
          ))}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0 20px', gap: 12, alignItems: 'center' }}>
          <div style={{ height: 1, flex: 0.2, background: ARK_TOKENS.border }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: ARK_TOKENS.inkMuted, letterSpacing: 0.8, padding: '4px 12px', background: ARK_TOKENS.surfaceAlt, borderRadius: 12 }}>
            HOW WE KNOW IT WORKS
          </div>
          <div style={{ height: 1, flex: 0.2, background: ARK_TOKENS.border }} />
        </div>

        {/* Row 2: AC cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28, minWidth: 720, maxWidth: 1100, margin: '0 auto' }}>
          {acCards.map((key) => (
            <IdxCard key={key} data={CARDS[key]} />
          ))}
        </div>

        {/* Add another */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <button
            style={{
              padding: '10px 16px', border: `1.5px dashed ${ARK_TOKENS.borderStrong}`, background: 'transparent',
              borderRadius: ARK_TOKENS.r2, cursor: 'pointer', color: ARK_TOKENS.inkMuted, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontSize: 16,
            }}
          >
            <Ico.plus size={12} /> Add acceptance criterion
          </button>
        </div>

        {/* Floating AI coach sticky note */}
        <div
          style={{
            position: 'absolute', top: 40, right: 40,
            width: 220, padding: 14,
            background: '#fff', borderRadius: ARK_TOKENS.r2,
            border: `1.5px solid ${ARK_TOKENS.aiLight}`, boxShadow: ARK_TOKENS.shadow2,
            transform: 'rotate(1deg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: ARK_TOKENS.ai, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
            <Ico.sparkle size={12} /> COACH NOTE
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: ARK_TOKENS.ink }}>
            Your story is well-shaped, but consider splitting out the <b>customer notification email</b> piece — it may belong to a separate story owned by the Notifications team.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <Btn size="sm">Split it</Btn>
            <Btn size="sm" variant="ghost">Dismiss</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdxCard({ data }: { data: CardData }) {
  const IconComp = ICON_MAP[data.icon];
  return (
    <div
      style={{
        background: ARK_TOKENS.surface,
        borderRadius: ARK_TOKENS.r2,
        border: `1px solid ${ARK_TOKENS.border}`,
        borderTop: `3px solid ${data.color}`,
        boxShadow: ARK_TOKENS.shadow1,
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: data.kind === 'ac' ? 120 : 160,
        cursor: 'grab',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = ARK_TOKENS.shadow2; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ARK_TOKENS.shadow1; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: data.color + '22', color: data.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {IconComp && <IconComp size={12} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: ARK_TOKENS.inkSubtle, letterSpacing: 0.5, textTransform: 'uppercase' }}>{data.sub}</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 1 }}>{data.title}</div>
        </div>
      </div>
      <div style={{ fontSize: 16, lineHeight: 1.5, color: ARK_TOKENS.ink, flex: 1 }}>{data.content}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4, borderTop: `1px solid ${ARK_TOKENS.border}`, paddingTop: 8 }}>
        <button style={{ border: 'none', background: 'transparent', color: ARK_TOKENS.inkSubtle, cursor: 'pointer', padding: 4, borderRadius: 3, fontSize: 13, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'inherit' }}>
          <Ico.edit size={11} /> Edit
        </button>
        <button style={{ border: 'none', background: 'transparent', color: ARK_TOKENS.ai, cursor: 'pointer', padding: 4, borderRadius: 3, fontSize: 13, display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'inherit' }}>
          <Ico.sparkle size={11} /> Tighten
        </button>
      </div>
    </div>
  );
}

function LegendTag({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: ARK_TOKENS.inkMuted }}>
      <span style={{ width: 10, height: 10, borderRadius: 5, background: color }} />
      {label}
    </div>
  );
}
