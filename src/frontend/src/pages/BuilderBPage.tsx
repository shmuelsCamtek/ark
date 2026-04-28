import { useState, useEffect, useRef } from 'react';
import { ARK_TOKENS } from '../tokens';
import { TopBar, Btn, Badge, Ico, AzureMark, Avatar } from '../components/ui';
import { WorkItemPreview } from '../components/builder/WorkItemPreview';
import { useNavigate } from '../router';

interface ChatMessage {
  role: 'user' | 'ai';
  text?: string;
  typing?: boolean;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { role: 'ai', text: "Hi Maya! I'll help you turn your idea into a story the dev team can run with. Start by describing what you want to build — in your own words." },
  { role: 'user', text: "Failed Pro renewals are eating my team's day. Every time a card declines we open a ticket, retry by hand a few days later, and email the customer. I want this to retry automatically and only escalate to a real ticket if it truly fails." },
  { role: 'ai', text: "Good starting point — I can see the 'who', 'what' and 'why'. Two quick questions so we nail the acceptance criteria:\n\n**1.** How many retries, and over what window? (1 day? 7 days?)\n**2.** When all retries fail, who picks it up — the same support engineer, or the Tier\u20112 billing queue?" },
  { role: 'user', text: "Three retries over 7 days feels right (1, 3, 7 days). When all retries fail, route it to the Tier\u20112 billing queue with the customer\u2019s tier + SLA attached so they don\u2019t have to look it up." },
  { role: 'ai', text: "Perfect — that's everything I need. I've drafted a story on the right. Take a look and tell me what to change." },
];

const QUICK_CHIPS = [
  'Add an edge case',
  'Make it smaller',
  'Suggest acceptance criteria',
  'Check INVEST',
];

const STORY_DATA = {
  title: 'Auto-retry failed Pro subscription renewals',
  background: '',
  persona: 'Support engineer',
  want: 'automatically retry a failed Pro renewal on a smart schedule and route it to Tier\u20112 only if all retries fail',
  benefit: 'I can resolve renewal failures without opening a manual ticket for each customer',
  criteria: [
    { id: '1', text: 'A failed renewal triggers up to 3 retries over 7 days (1d, 3d, 7d) before escalation' },
    { id: '2', text: 'Each retry attempt and outcome is written to the customer\u2019s support timeline within 30s' },
    { id: '3', text: 'After the final retry fails, a ticket is auto-created in Billing-Support and assigned to Tier\u20112' },
    { id: '4', text: 'The escalated ticket inherits the customer\u2019s tier and SLA from their account' },
  ],
  docs: [],
  showUiChange: false,
};

function renderBold(text: string): string {
  return (text || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

export function BuilderBPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: input }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { role: 'ai', text: "Got it — I've updated the story. Anything else to tighten up, or should we push to Azure?" },
      ]);
    }, 1400);
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: ARK_TOKENS.bg, display: 'flex', flexDirection: 'column' }}>
      <TopBar
        breadcrumbs={['Stories', 'Chat Builder']}
        rightActions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone="ai" icon={<Ico.sparkle size={10} />}>AI COACH MODE</Badge>
            <Btn variant="primary" icon={<Ico.arrow size={14} />} onClick={() => navigate('/stories/new/push')}>Push to Azure</Btn>
          </div>
        }
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* LEFT: Chat */}
        <div style={{ flex: '1 1 540px', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${ARK_TOKENS.border}`, minWidth: 0 }}>
          <div ref={scrollRef} className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
            <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((m, i) => (
                <ChatMsg key={i} msg={m} />
              ))}
              {typing && <ChatMsg msg={{ role: 'ai', typing: true }} />}
            </div>
          </div>

          {/* Composer */}
          <div style={{ padding: '16px 28px 20px', borderTop: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surface }}>
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {QUICK_CHIPS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    style={{
                      border: `1px solid ${ARK_TOKENS.border}`, background: ARK_TOKENS.surface,
                      padding: '5px 12px', borderRadius: 14, fontSize: 14, color: ARK_TOKENS.inkMuted,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div
                style={{
                  border: `1.5px solid ${ARK_TOKENS.borderStrong}`, borderRadius: ARK_TOKENS.r2,
                  background: ARK_TOKENS.surface, padding: 10,
                  display: 'flex', alignItems: 'flex-end', gap: 10,
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Reply to the coach, or ask a question\u2026"
                  rows={2}
                  style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 17, lineHeight: 1.5 }}
                />
                <Btn variant="primary" icon={<Ico.arrow size={14} />} onClick={send} disabled={!input.trim()}>Send</Btn>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Story preview */}
        <div style={{ flex: '0 0 460px', background: ARK_TOKENS.surface, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${ARK_TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AzureMark size={16} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Story being built</div>
              <div style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, background: ARK_TOKENS.success, borderRadius: 3 }} /> Auto-saving to draft
              </div>
            </div>
            <Btn size="sm" variant="ghost" icon={<Ico.edit size={12} />} onClick={() => navigate('/stories/new')}>Edit manually</Btn>
          </div>
          <div className="ark-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <WorkItemPreview {...STORY_DATA} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMsg({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'ai') {
    return (
      <div style={{ display: 'flex', gap: 12, animation: 'ark-fadein 0.3s' }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 16,
            background: `linear-gradient(135deg, ${ARK_TOKENS.ai} 0%, #b57edc 100%)`,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Ico.sparkle size={14} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle, fontWeight: 600, marginBottom: 4 }}>ARK COACH</div>
          {msg.typing ? (
            <div style={{ display: 'flex', gap: 4, padding: '12px 0', alignItems: 'center' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: ARK_TOKENS.ai, animation: `ark-pulse 1.2s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
          ) : (
            <div
              style={{ fontSize: 17, lineHeight: 1.55, color: ARK_TOKENS.ink, whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ __html: renderBold(msg.text || '') }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', animation: 'ark-fadein 0.3s' }}>
      <div style={{ maxWidth: '85%' }}>
        <div style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle, fontWeight: 600, marginBottom: 4, textAlign: 'right' }}>YOU</div>
        <div style={{ background: ARK_TOKENS.azure, color: '#fff', padding: '10px 14px', borderRadius: 12, borderBottomRightRadius: 4, fontSize: 17, lineHeight: 1.5 }}>
          {msg.text}
        </div>
      </div>
      <Avatar name="Maya Kowalski" size={32} />
    </div>
  );
}
