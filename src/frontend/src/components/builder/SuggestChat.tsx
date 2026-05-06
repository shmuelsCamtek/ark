import { useState, useEffect, useRef, useCallback } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';
import { useServices } from '../../context/ServicesContext';
import type { CoachMessage, WorkItemComment, WorkItemInfo } from '../../types';

interface SuggestMessage {
  role: 'user' | 'ai';
  text?: string;
  kind?: 'suggestions' | 'criteria-bundle' | 'ack' | 'quiz';
  intro?: string;
  field?: string;
  options?: string[];
  quizQuestion?: string;
  quizAnswered?: boolean;
}

interface SuggestChatProps {
  storyState: {
    title: string;
    background: string;
    persona: string;
    want: string;
    benefit: string;
    criteria: { id: string | number; text: string }[];
    workItemId?: string;
    workItemType?: string;
    workItemState?: string;
    workItemAssignedTo?: string;
    workItemDescription?: string;
    workItemReproSteps?: string;
    workItemTechnicalDescription?: string;
    workItemDiscussion?: WorkItemComment[];
    linkedWorkItems?: WorkItemInfo[];
    epicName?: string;
    supportingDocs?: {
      name: string;
      kind: string;
      scanned: boolean;
      summary?: string;
      problemContext?: string;
      stakeholders?: string[];
      goals?: string[];
      acceptanceCriteria?: string[];
      edgeCases?: string[];
    }[];
  };
  onApply: (field: string, value: string) => void;
  activeField: string;
  setActiveField: (f: string) => void;
  attachmentsReady?: boolean;
}

const QUICK_CHIPS = [
  'Suggest Background',
  'Suggest Narrative',
  'Suggest more ACs',
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

function patchStoryState(
  s: SuggestChatProps['storyState'],
  field: string,
  value: string,
): SuggestChatProps['storyState'] {
  switch (field) {
    case 'title': return { ...s, title: value };
    case 'background': return { ...s, background: value };
    case 'persona': return { ...s, persona: value };
    case 'want': return { ...s, want: value };
    case 'benefit': return { ...s, benefit: value };
    case 'criteria':
      return { ...s, criteria: [...s.criteria, { id: `applied-${Date.now()}`, text: value }] };
    default: return s;
  }
}

function nextEmptyField(s: SuggestChatProps['storyState']): string | null {
  if (!s.background?.trim()) return 'Background';
  if (!s.persona?.trim() || !s.want?.trim() || !s.benefit?.trim()) return 'Narrative (persona, desire, benefit)';
  if (!s.title?.trim()) return 'Title';
  if (s.criteria.length === 0) return 'Acceptance Criteria';
  return null;
}

function buildDraftContext(storyState: SuggestChatProps['storyState'], activeField: string): string {
  const ctx: Record<string, unknown> = {
    title: storyState.title,
    background: storyState.background,
    persona: storyState.persona,
    want: storyState.want,
    benefit: storyState.benefit,
    criteria: storyState.criteria.map((c) => c.text),
    activeField,
  };
  if (storyState.workItemId) ctx.workItemId = storyState.workItemId;
  if (storyState.workItemType) ctx.workItemType = storyState.workItemType;
  if (storyState.workItemState) ctx.workItemState = storyState.workItemState;
  if (storyState.workItemAssignedTo) ctx.workItemAssignedTo = storyState.workItemAssignedTo;
  if (storyState.workItemDescription) ctx.workItemDescription = storyState.workItemDescription;
  if (storyState.workItemReproSteps) ctx.workItemReproSteps = storyState.workItemReproSteps;
  if (storyState.workItemTechnicalDescription) ctx.workItemTechnicalDescription = storyState.workItemTechnicalDescription;
  if (storyState.workItemDiscussion?.length) ctx.workItemDiscussion = storyState.workItemDiscussion;
  if (storyState.linkedWorkItems?.length) ctx.linkedWorkItems = storyState.linkedWorkItems;
  if (storyState.epicName) ctx.epicName = storyState.epicName;
  if (storyState.supportingDocs?.length) ctx.supportingDocs = storyState.supportingDocs;
  return JSON.stringify(ctx);
}

function toCoachMessages(msgs: SuggestMessage[]): CoachMessage[] {
  // Convert UI messages into API conversation turns. Render the AI's structured
  // turns (quiz / suggestions / criteria-bundle) as text so the model can see
  // what it previously asked or offered. Drop pure-noise ack messages.
  const out: CoachMessage[] = [];
  for (const m of msgs) {
    if (m.role === 'user') {
      const text = (m.text ?? '').trim();
      if (!text) continue;
      out.push({ id: `conv-${out.length}`, type: 'user', text, timestamp: new Date().toISOString() });
      continue;
    }
    if (m.role === 'ai') {
      if (m.kind === 'ack') continue;
      const parts: string[] = [];
      if (m.text) parts.push(m.text);
      if (m.intro) parts.push(m.intro);
      if (m.kind === 'quiz' && m.quizQuestion) {
        parts.push(`(Quiz: ${m.quizQuestion} — options: ${(m.options ?? []).join(' / ')})`);
      } else if ((m.kind === 'suggestions' || m.kind === 'criteria-bundle') && m.options?.length) {
        parts.push(`(Offered ${m.kind === 'criteria-bundle' ? 'acceptance criteria' : 'options'}: ${m.options.join(' / ')})`);
      }
      const text = parts.join('\n').trim();
      if (!text) continue;
      out.push({ id: `conv-${out.length}`, type: 'ai', text, timestamp: new Date().toISOString() });
    }
  }
  // Anthropic requires alternating user/assistant turns. Merge any consecutive
  // same-role messages into one (defense against edge cases like the apply
  // signal arriving right after another user turn).
  const merged: CoachMessage[] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.type === m.type) {
      merged[merged.length - 1] = { ...last, text: `${last.text}\n\n${m.text}` };
    } else {
      merged.push(m);
    }
  }
  return merged;
}

function coachToSuggestMessage(coach: CoachMessage): SuggestMessage {
  if (coach.type === 'quiz' && coach.quiz) {
    return {
      role: 'ai',
      kind: 'quiz',
      text: coach.text,
      quizQuestion: coach.quiz.question,
      options: coach.quiz.options,
    };
  }
  if (coach.type === 'criteria-bundle') {
    return {
      role: 'ai',
      kind: 'criteria-bundle',
      intro: coach.text,
      options: coach.criteria?.map((c) => c.text) ?? [],
    };
  }
  if (coach.type === 'suggestion' && coach.field) {
    return {
      role: 'ai',
      kind: 'suggestions',
      intro: coach.text,
      field: coach.field,
      options: coach.value ? [coach.value] : [],
    };
  }
  return { role: 'ai', text: coach.text };
}

export function SuggestChat({ storyState, onApply, activeField, setActiveField: _setActiveField, attachmentsReady = true }: SuggestChatProps) {
  const { ai } = useServices();
  const [messages, setMessages] = useState<SuggestMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(new Set());
  const [initialLoaded, setInitialLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // Show typing indicator while we wait for mount-time attachments to scan
  useEffect(() => {
    if (!initialLoaded && !attachmentsReady) setTyping(true);
  }, [attachmentsReady, initialLoaded]);

  // Initial contextual suggestions for real mode
  useEffect(() => {
    if (initialLoaded) return;
    if (!attachmentsReady) return;
    let cancelled = false;
    setTyping(true);
    const ctx = buildDraftContext(storyState, activeField);
    ai.chat(
      [{ id: 'init', type: 'user', text: 'I\'m starting a new user story. Based on what I have so far, what should I focus on?', timestamp: new Date().toISOString() }],
      ctx,
    ).then((response) => {
      if (cancelled) return;
      setTyping(false);
      setMessages((prev) => [...prev, coachToSuggestMessage(response)]);
      setInitialLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      setTyping(false);
      setMessages((prev) => [...prev, { role: 'ai', text: 'I\'m having trouble connecting. Try sending a message and I\'ll do my best to help.' }]);
      setInitialLoaded(true);
    });
    return () => { cancelled = true; };
  }, [attachmentsReady]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Skip the follow-up call if one is already in flight (e.g. user rapid-clicks
    // multiple criteria chips). The coach will pick up state when the pending call
    // returns.
    if (typing) return;

    const patched = patchStoryState(storyState, field, text);
    const truncated = text.length > 120 ? text.slice(0, 117) + '…' : text;
    const next = nextEmptyField(patched);
    const tail = next
      ? `Now help me with **${next}** — the next empty field. Ask me a clarifying question (quiz) or draft a value.`
      : `All four fields are filled now. Ask me via quiz whether I want to refine any of them or add more acceptance criteria.`;
    const signal: CoachMessage = {
      id: `apply-${Date.now()}`,
      type: 'user',
      text:
        field === 'criteria'
          ? `I added "${truncated}" to Acceptance Criteria. ${tail}`
          : `I applied your suggestion to ${fieldLabel(field)}: "${truncated}". ${tail}`,
      timestamp: new Date().toISOString(),
    };
    const aiConvo: CoachMessage[] = [...toCoachMessages(messages), signal];
    const ctx = buildDraftContext(patched, activeField);

    setTyping(true);
    ai.chat(aiConvo, ctx)
      .then((response) => {
        setMessages((m) => [...m, coachToSuggestMessage(response)]);
      })
      .catch(() => {
        setMessages((m) => [
          ...m,
          { role: 'ai', text: 'Sorry, I couldn’t continue. Please try again.' },
        ]);
      })
      .finally(() => {
        setTyping(false);
      });
  };

  const handleQuizAnswer = useCallback((msgIdx: number, answer: string) => {
    // Mark quiz as answered
    setMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, quizAnswered: true } : m));
    // Send the answer as a user message
    const userMsg: SuggestMessage = { role: 'user', text: answer };
    setMessages((m) => [...m, userMsg]);
    setTyping(true);

    const ctx = buildDraftContext(storyState, activeField);
    const conversationMsgs = toCoachMessages([...messages, userMsg]);
    ai.chat(conversationMsgs, ctx).then((response) => {
      setMessages((m) => [...m, coachToSuggestMessage(response)]);
    }).catch(() => {
      setMessages((m) => [...m, { role: 'ai', text: 'Sorry, I couldn\'t process that. Please try again.' }]);
    }).finally(() => {
      setTyping(false);
    });
  }, [ai, messages, storyState, activeField]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: SuggestMessage = { role: 'user', text };
    setMessages((m) => [...m, userMsg]);
    setTyping(true);
    try {
      const ctx = buildDraftContext(storyState, activeField);
      const conversationMsgs = toCoachMessages([...messages, userMsg]);
      const response = await ai.chat(conversationMsgs, ctx);
      setMessages((m) => [...m, coachToSuggestMessage(response)]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'Sorry, I couldn\'t process that. Please try again.' }]);
    } finally {
      setTyping(false);
    }
  }, [ai, messages, storyState, activeField]);

  const handleChip = useCallback(async (chip: string) => {
    // Chips that use suggestField (direct suggestions)
    const suggestChips: Record<string, { field: string; value: string }> = {
      'Suggest more ACs': { field: 'acceptanceCriteria', value: storyState.criteria.map((c) => c.text).join('; ') },
    };
    // Chips that use chat (quiz-style clarifying questions)
    const chatChips: Record<string, string> = {
      'Suggest Background': 'Help me write the background for this story. Ask me a clarifying question to understand the context.',
      'Suggest Narrative': 'Help me write the narrative (I want to… / So that…) for this story. Ask me a clarifying question first.',
    };

    const suggestMatch = suggestChips[chip];
    const chatPrompt = chatChips[chip];

    if (suggestMatch) {
      setMessages((m) => [...m, { role: 'user', text: chip }]);
      setTyping(true);
      try {
        const ctx = buildDraftContext(storyState, activeField);
        const response = await ai.suggestField(suggestMatch.field, suggestMatch.value, ctx);
        setMessages((m) => [...m, coachToSuggestMessage(response)]);
      } catch {
        setMessages((m) => [...m, { role: 'ai', text: 'Sorry, I couldn\'t generate suggestions right now.' }]);
      } finally {
        setTyping(false);
      }
    } else if (chatPrompt) {
      setMessages((m) => [...m, { role: 'user', text: chip }]);
      setTyping(true);
      try {
        const ctx = buildDraftContext(storyState, activeField);
        const conversationMsgs = toCoachMessages([...messages, { role: 'user', text: chatPrompt }]);
        const response = await ai.chat(conversationMsgs, ctx);
        setMessages((m) => [...m, coachToSuggestMessage(response)]);
      } catch {
        setMessages((m) => [...m, { role: 'ai', text: 'Sorry, I couldn\'t generate suggestions right now.' }]);
      } finally {
        setTyping(false);
      }
    } else {
      await sendMessage(chip);
    }
  }, [ai, messages, storyState, activeField, sendMessage]);

  const send = () => {
    if (!input.trim()) return;
    const userText = input;
    setInput('');
    sendMessage(userText);
  };

  let activeQuizIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].kind === 'quiz' && !messages[i].quizAnswered) {
      activeQuizIdx = i;
      break;
    }
  }
  const activeQuiz = activeQuizIdx >= 0 ? messages[activeQuizIdx] : null;

  return (
    <div
      style={{
        flex: '1 1 0',
        borderRight: `1px solid ${ARK_TOKENS.border}`,
        background: ARK_TOKENS.bg,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${ARK_TOKENS.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: 11, background: ARK_TOKENS.azure, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ico.sparkle size={11} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Ark Coach</div>
          <div style={{ fontSize: 13, color: ARK_TOKENS.inkSubtle }}>Reading your backlog</div>
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
          <SuggestMsg key={i} msg={m} msgIdx={i} onApply={handleApply} usedSuggestions={usedSuggestions} onQuizAnswer={handleQuizAnswer} />
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

      {/* Active quiz options OR quick chips */}
      {activeQuiz ? (
        <div style={{ padding: '4px 14px 10px' }}>
          <QuizOptions
            question={activeQuiz.quizQuestion || ''}
            options={activeQuiz.options || []}
            answered={false}
            onAnswer={(answer) => handleQuizAnswer(activeQuizIdx, answer)}
          />
        </div>
      ) : (
        <div style={{ padding: '4px 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => handleChip(c)}
              disabled={typing}
              style={{
                border: `1px solid ${ARK_TOKENS.border}`,
                background: ARK_TOKENS.surface,
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 13,
                color: ARK_TOKENS.inkMuted,
                cursor: typing ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: typing ? 0.5 : 1,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

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
            placeholder={activeQuiz ? 'Pick an option above\u2026' : 'Ask the coach\u2026'}
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: 16,
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || typing}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              border: 'none',
              background: input.trim() && !typing ? ARK_TOKENS.ink : ARK_TOKENS.border,
              color: '#fff',
              cursor: input.trim() && !typing ? 'pointer' : 'not-allowed',
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

function QuizOptions({
  question,
  options,
  answered,
  onAnswer,
}: {
  question: string;
  options: string[];
  answered: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [customText, setCustomText] = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const lastIdx = options.length - 1;
  const isLastOpenText = /something else|other|custom/i.test(options[lastIdx] || '');

  const handleSelect = (idx: number) => {
    if (answered) return;
    if (isLastOpenText && idx === lastIdx) {
      // Show text input instead of answering immediately
      setSelectedIdx(idx);
      return;
    }
    setSelectedIdx(idx);
    onAnswer(options[idx]);
  };

  const handleCustomSubmit = () => {
    if (!customText.trim()) return;
    onAnswer(customText.trim());
  };

  const LETTERS = 'ABCDEFGHIJ';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {question && (
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: ARK_TOKENS.ink, marginBottom: 2 }}>
          {question}
        </div>
      )}
      {options.map((opt, i) => {
        const isSelected = selectedIdx === i;
        const isOpenTextOption = isLastOpenText && i === lastIdx;
        const showCustomInput = isOpenTextOption && isSelected && !answered;

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              onClick={() => handleSelect(i)}
              disabled={answered}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                border: `1px solid ${isSelected ? ARK_TOKENS.azure : ARK_TOKENS.border}`,
                background: isSelected ? ARK_TOKENS.azureFaint : ARK_TOKENS.surface,
                borderRadius: ARK_TOKENS.r2,
                fontSize: 15,
                lineHeight: 1.5,
                color: answered && !isSelected ? ARK_TOKENS.inkMuted : ARK_TOKENS.ink,
                cursor: answered ? 'default' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                transition: 'all 0.12s',
                opacity: answered && !isSelected ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!answered) {
                  (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.azure;
                  (e.currentTarget as HTMLElement).style.background = ARK_TOKENS.azureFaint;
                }
              }}
              onMouseLeave={(e) => {
                if (!answered && !isSelected) {
                  (e.currentTarget as HTMLElement).style.borderColor = ARK_TOKENS.border;
                  (e.currentTarget as HTMLElement).style.background = ARK_TOKENS.surface;
                }
              }}
            >
              <span
                style={{
                  width: 20, height: 20, borderRadius: 10,
                  border: `1.5px solid ${isSelected ? ARK_TOKENS.azure : ARK_TOKENS.borderStrong}`,
                  background: isSelected ? ARK_TOKENS.azure : 'transparent',
                  color: isSelected ? '#fff' : ARK_TOKENS.inkMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  transition: 'all 0.12s',
                }}
              >
                {isSelected ? <Ico.check size={10} /> : LETTERS[i]}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
            </button>
            {showCustomInput && (
              <div className="ark-fadein" style={{ display: 'flex', gap: 6, paddingLeft: 28 }}>
                <input
                  autoFocus
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit(); }}
                  placeholder="Type your answer\u2026"
                  style={{
                    flex: 1,
                    border: `1px solid ${ARK_TOKENS.borderStrong}`,
                    borderRadius: ARK_TOKENS.r,
                    padding: '6px 10px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    background: ARK_TOKENS.surface,
                  }}
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customText.trim()}
                  style={{
                    width: 26, height: 26, borderRadius: 13,
                    border: 'none',
                    background: customText.trim() ? ARK_TOKENS.azure : ARK_TOKENS.border,
                    color: '#fff',
                    cursor: customText.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ico.arrow size={11} dir="up" />
                </button>
              </div>
            )}
          </div>
        );
      })}
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
  onQuizAnswer,
}: {
  msg: SuggestMessage;
  msgIdx: number;
  onApply: (msgIdx: number, optIdx: number, field: string, text: string) => void;
  usedSuggestions: Set<string>;
  onQuizAnswer: (msgIdx: number, answer: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'ark-fadein 0.25s' }}>
        <div style={{ maxWidth: '88%', background: ARK_TOKENS.surfaceAlt, color: ARK_TOKENS.ink, padding: '8px 12px', borderRadius: 10, fontSize: 16, lineHeight: 1.5 }}>
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.kind === 'ack') {
    return (
      <div className="ark-fadein" style={{ display: 'flex', gap: 6, paddingLeft: 32, fontSize: 13, color: ARK_TOKENS.inkSubtle, alignItems: 'center' }}>
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
          background: ARK_TOKENS.azure, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 1,
        }}
      >
        <Ico.sparkle size={10} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {msg.text && (
          <div
            style={{ fontSize: 16, lineHeight: 1.55, color: ARK_TOKENS.ink, marginBottom: msg.kind ? 10 : 0 }}
            dangerouslySetInnerHTML={{ __html: renderBold(msg.text) }}
          />
        )}
        {msg.intro && (
          <div
            style={{ fontSize: 14, lineHeight: 1.5, color: ARK_TOKENS.inkMuted, marginBottom: 8 }}
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
                    fontSize: 15,
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

        {msg.kind === 'quiz' && msg.options && msg.quizAnswered && (
          <QuizOptions
            question={msg.quizQuestion || ''}
            options={msg.options}
            answered={true}
            onAnswer={(answer) => onQuizAnswer(msgIdx, answer)}
          />
        )}
      </div>
    </div>
  );
}
