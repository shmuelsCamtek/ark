import { useState, useEffect, useRef } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';

interface SuggestMessage {
  role: 'user' | 'ai';
  text?: string;
  kind?: 'suggestions' | 'criteria-bundle' | 'ack';
  intro?: string;
  field?: string;
  options?: string[];
}

interface SuggestChatProps {
  storyState: {
    title: string;
    background: string;
    persona: string;
    want: string;
    benefit: string;
    criteria: { id: string | number; text: string }[];
  };
  onApply: (field: string, value: string) => void;
  activeField: string;
  setActiveField: (f: string) => void;
}

const INITIAL_MESSAGES: SuggestMessage[] = [
  {
    role: 'ai',
    text: "I scanned recent tickets and stories in **Support-Platform / Billing** and your area's glossary. A few suggestions:",
  },
  {
    role: 'ai',
    kind: 'suggestions',
    intro: 'Tighter **titles** for this story:',
    field: 'title',
    options: [
      'Smart retry for failed Pro renewals',
      'Auto-recover declined subscription payments',
      'Reduce involuntary churn from card declines',
    ],
  },
  {
    role: 'ai',
    kind: 'suggestions',
    intro: '**Personas** common in your backlog:',
    field: 'persona',
    options: [
      'Support engineer',
      'Tier\u20112 billing support specialist',
      'Customer success manager',
    ],
  },
  {
    role: 'ai',
    kind: 'criteria-bundle',
    intro: 'Likely **acceptance criteria** based on similar stories:',
    options: [
      'Given a card-decline failure, when the retry runs, then a follow-up email is sent to the customer with a payment-update link.',
      'Given a renewal succeeds on retry, when processed, then the support timeline shows the recovery and the open alert auto-closes.',
      'Given all retries fail, when escalated, then the ticket inherits the customer\u2019s tier and SLA from their account.',
    ],
  },
];

const QUICK_CHIPS = [
  'Suggest more ACs',
  'Tighten the benefit',
  'Find similar stories',
  'Split this story',
];

function fieldLabel(f: string): string {
  const labels: Record<string, string> = {
    title: 'Title',
    background: 'Background',
    persona: 'Persona',
    want: 'Desire',
    benefit: 'Benefit',
    criteria: 'Acceptance criteria',
  };
  return labels[f] || f;
}

export function SuggestChat({ storyState: _storyState, onApply, activeField: _activeField, setActiveField: _setActiveField }: SuggestChatProps) {
  const [messages, setMessages] = useState<SuggestMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const handleApply = (msgIdx: number, optIdx: number, field: string, text: string) => {
    onApply(field, text);
    const key = `${msgIdx}-${optIdx}`;
    setUsedSuggestions((prev) => new Set(prev).add(key));
    setMessages((prev) => [
      ...prev,
      {
        role: 'ai',
        kind: 'ack',
        text: field === 'criteria' ? 'Added.' : `Applied to ${fieldLabel(field)}.`,
      },
    ]);
  };

  const send = () => {
    if (!input.trim()) return;
    const userText = input;
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          kind: 'suggestions',
          intro: 'Tighter options for the **benefit**:',
          field: 'benefit',
          options: [
            'my team recovers 80% of declined renewals without human intervention.',
            'I can stop opening manual tickets for every card decline \u2014 saving ~5 hours per week per support engineer.',
            'customers on Pro stay in service through transient payment issues, reducing involuntary churn.',
          ],
        },
      ]);
    }, 1100);
  };

  return (
    <div
      style={{
        flex: '0 0 360px',
        borderLeft: `1px solid ${ARK_TOKENS.border}`,
        background: ARK_TOKENS.surface,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Header */}
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

      {/* Messages */}
      <div
        ref={scrollRef}
        className="ark-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {messages.map((m, i) => (
          <SuggestMsg key={i} msg={m} msgIdx={i} onApply={handleApply} usedSuggestions={usedSuggestions} />
        ))}
        {typing && (
          <div style={{ display: 'flex', gap: 4, padding: '4px 0 4px 32px', alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  background: ARK_TOKENS.inkSubtle,
                  animation: `ark-pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick chips */}
      <div style={{ padding: '4px 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {QUICK_CHIPS.map((c) => (
          <button
            key={c}
            onClick={() => setInput(c)}
            style={{
              border: `1px solid ${ARK_TOKENS.border}`,
              background: ARK_TOKENS.surface,
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: 11,
              color: ARK_TOKENS.inkMuted,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div style={{ padding: '0 14px 14px' }}>
        <div
          style={{
            border: `1px solid ${ARK_TOKENS.borderStrong}`,
            borderRadius: ARK_TOKENS.r2,
            background: ARK_TOKENS.surface,
            padding: 8,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the coach\u2026"
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              border: 'none',
              background: input.trim() ? ARK_TOKENS.ink : ARK_TOKENS.border,
              color: '#fff',
              cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ico.arrow size={11} dir="up" />
          </button>
        </div>
      </div>
    </div>
  );
}

function renderBold(text: string): string {
  return (text || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function SuggestMsg({
  msg,
  msgIdx,
  onApply,
  usedSuggestions,
}: {
  msg: SuggestMessage;
  msgIdx: number;
  onApply: (msgIdx: number, optIdx: number, field: string, text: string) => void;
  usedSuggestions: Set<string>;
}) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'ark-fadein 0.25s' }}>
        <div style={{ maxWidth: '88%', background: ARK_TOKENS.surfaceAlt, color: ARK_TOKENS.ink, padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5 }}>
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.kind === 'ack') {
    return (
      <div className="ark-fadein" style={{ display: 'flex', gap: 6, paddingLeft: 32, fontSize: 11, color: ARK_TOKENS.inkSubtle, alignItems: 'center' }}>
        <Ico.check size={11} />
        <span>{msg.text}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, animation: 'ark-fadein 0.25s' }}>
      <div
        style={{
          width: 22, height: 22, borderRadius: 11,
          background: ARK_TOKENS.ai, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 1,
        }}
      >
        <Ico.sparkle size={10} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {msg.text && (
          <div
            style={{ fontSize: 13, lineHeight: 1.55, color: ARK_TOKENS.ink, marginBottom: msg.kind ? 10 : 0 }}
            dangerouslySetInnerHTML={{ __html: renderBold(msg.text) }}
          />
        )}
        {msg.intro && (
          <div
            style={{ fontSize: 12, lineHeight: 1.5, color: ARK_TOKENS.inkMuted, marginBottom: 8 }}
            dangerouslySetInnerHTML={{ __html: renderBold(msg.intro) }}
          />
        )}

        {(msg.kind === 'suggestions' || msg.kind === 'criteria-bundle') && msg.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {msg.options.map((opt, i) => {
              const used = usedSuggestions.has(`${msgIdx}-${i}`);
              const targetField = msg.kind === 'criteria-bundle' ? 'criteria' : msg.field!;
              return (
                <button
                  key={i}
                  onClick={() => onApply(msgIdx, i, targetField, opt)}
                  disabled={used}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: `1px solid ${ARK_TOKENS.border}`,
                    background: used ? ARK_TOKENS.surfaceAlt : ARK_TOKENS.surface,
                    borderRadius: ARK_TOKENS.r2,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: used ? ARK_TOKENS.inkMuted : ARK_TOKENS.ink,
                    cursor: used ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!used) {
                      (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.borderStrong;
                      (e.currentTarget as HTMLElement).style.background = ARK_TOKENS.surfaceAlt;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!used) {
                      (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.border;
                      (e.currentTarget as HTMLElement).style.background = ARK_TOKENS.surface;
                    }
                  }}
                >
                  <span style={{ color: used ? ARK_TOKENS.inkSubtle : ARK_TOKENS.inkMuted, flexShrink: 0, marginTop: 1 }}>
                    {used ? <Ico.check size={11} /> : <Ico.plus size={11} />}
                  </span>
                  <span style={{ flex: 1 }}>{opt}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
