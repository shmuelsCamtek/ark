import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Ico } from '../ui/icons';
import { Badge } from '../ui/Badge';
import { useServices } from '../../context/ServicesContext';
import { ContextLogPopover } from './ContextLogPopover';
import { fieldLabel } from '../../lib/fieldLabels';
import { mimeFromDataUrl, base64FromDataUrl } from '../../lib/pictures';
import type { CoachAttachment } from '../../services/ai';
import type { CoachMessage, ContextLogEntry, SuggestMessage, WorkItemComment, WorkItemInfo } from '../../types';

interface SuggestChatProps {
  draftId: string;
  storyState: {
    title: string;
    background: string;
    scenario: string;
    flow: string;
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
    pictures?: { dataUrl: string; caption?: string }[];
    supportingDocs?: {
      name: string;
      kind: string;
      scanned: boolean;
      mimeType?: string;
      dataUrl?: string;
      summary?: string;
      problemContext?: string;
      stakeholders?: string[];
      goals?: string[];
      acceptanceCriteria?: string[];
      edgeCases?: string[];
    }[];
  };
  onApply: (field: string, value: string) => void;
  onBatchApply?: (updates: { field: string; value: string }[]) => void;
  onAutoMockup?: () => void;
  phase?: 'chat' | 'ac';
  onPhaseChange?: (phase: 'chat' | 'ac') => void;
  activeField: string;
  setActiveField: (f: string) => void;
  attachmentsReady?: boolean;
  scanningDocNames?: string[];
  recentlyAddedDocName?: string | null;
  recentFieldEditLabel?: string | null;
  contextLog?: ContextLogEntry[];
  width?: number;
}

const QUICK_CHIPS = [
  'Suggest Background',
  'Suggest Narrative',
  'Suggest more ACs',
];

function patchStoryState(
  s: SuggestChatProps['storyState'],
  field: string,
  value: string,
): SuggestChatProps['storyState'] {
  switch (field) {
    case 'title': return { ...s, title: value };
    case 'background': return { ...s, background: value };
    case 'scenario': return { ...s, scenario: value };
    case 'flow': return { ...s, flow: value };
    case 'persona': return { ...s, persona: value };
    case 'want': return { ...s, want: value };
    case 'benefit': return { ...s, benefit: value };
    case 'criteria':
      return { ...s, criteria: [...s.criteria, { id: `applied-${Date.now()}`, text: value }] };
    default: return s;
  }
}

function hasMermaidBlock(s: string | undefined): boolean {
  if (!s) return false;
  return /(?:^|\n)```mermaid[ \t]*\r?\n[\s\S]*?\n```[ \t]*(?:\r?\n|$)/i.test(s);
}

function nextEmptyField(s: SuggestChatProps['storyState']): string | null {
  if (!s.background?.trim()) return 'Background';
  if (!s.persona?.trim() || !s.want?.trim() || !s.benefit?.trim()) return 'Narrative (persona, desire, benefit)';
  if (!s.scenario?.trim()) return 'The Scenario';
  if (!s.title?.trim()) return 'Title';
  if (s.criteria.length === 0) return 'Acceptance Criteria';
  return null;
}

function buildDraftContext(storyState: SuggestChatProps['storyState'], activeField: string): string {
  const ctx: Record<string, unknown> = {
    title: storyState.title,
    background: storyState.background,
    scenario: storyState.scenario,
    flow: storyState.flow,
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
  if (storyState.supportingDocs?.length) {
    // Strip the raw bytes (dataUrl) — those are sent as image/document blocks,
    // never inlined as base64 into the text prompt.
    ctx.supportingDocs = storyState.supportingDocs.map(({ dataUrl: _dataUrl, mimeType: _mimeType, ...rest }) => rest);
  }
  return JSON.stringify(ctx);
}

// Collect the attached pictures and image/PDF docs as content blocks for the
// coach to actually see. Returns base64 payloads (no data: prefix).
function buildAttachments(storyState: SuggestChatProps['storyState']): CoachAttachment[] {
  const out: CoachAttachment[] = [];
  for (const p of storyState.pictures ?? []) {
    if (!p.dataUrl) continue;
    out.push({
      name: p.caption || 'picture',
      mimeType: mimeFromDataUrl(p.dataUrl),
      data: base64FromDataUrl(p.dataUrl),
      kind: 'image',
    });
  }
  for (const d of storyState.supportingDocs ?? []) {
    if (!d.dataUrl) continue;
    if (d.kind !== 'image' && d.kind !== 'pdf') continue;
    out.push({
      name: d.name,
      mimeType: d.mimeType || mimeFromDataUrl(d.dataUrl),
      data: base64FromDataUrl(d.dataUrl),
      kind: d.kind === 'pdf' ? 'pdf' : 'image',
    });
  }
  return out;
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

// Coach AI calls can fail (backend 500 when the AI service is down, network
// drop, etc.). Log the real cause for debugging and return one consistent,
// reassuring message for the user instead of a silent empty bubble.
function coachUnavailableMsg(err: unknown): SuggestMessage {
  console.error('[coach] ai request failed', err);
  return {
    role: 'ai',
    text: 'The Ark Coach is unavailable right now. Your story is saved — please try again in a moment.',
  };
}

function coachToSuggestMessage(coach: CoachMessage): SuggestMessage {
  if (coach.type === 'quiz' && coach.quiz) {
    return {
      role: 'ai',
      kind: 'quiz',
      text: coach.text,
      quizQuestion: coach.quiz.question,
      options: coach.quiz.options,
      autoCaptured: coach.autoCaptured || undefined,
      autoCapturedValue: coach.autoCaptured ? coach.value : undefined,
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
      autoCaptured: coach.autoCaptured || undefined,
      autoCapturedValue: coach.autoCaptured ? coach.value : undefined,
    };
  }
  return { role: 'ai', text: coach.text };
}

export function SuggestChat({ draftId, storyState, onApply, onBatchApply, onAutoMockup, phase = 'chat', onPhaseChange, activeField, setActiveField: _setActiveField, attachmentsReady = true, scanningDocNames = [], recentlyAddedDocName = null, recentFieldEditLabel = null, contextLog = [], width }: SuggestChatProps) {
  const { ai, drafts: draftsApi } = useServices();
  // Attached pictures + image/PDF docs, sent with every coach turn so the model
  // can see them (the chat API is stateless — they must ride along each call).
  const attachments = useMemo(() => buildAttachments(storyState), [storyState]);
  const sendChat = (msgs: CoachMessage[], ctx: string) => ai['chat'](msgs, ctx, attachments);
  const [messages, setMessages] = useState<SuggestMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [manualStatus, setManualStatus] = useState<{ loaded: boolean; pages: number } | null>(null);
  // First setMessages after a load is just the load itself — skip persisting it back.
  const skipNextPersistRef = useRef(false);
  // Guards: auto-advance/handoff/mockup must each fire at most once per logical event.
  const autoAdvancingRef = useRef(false);
  const handoffFiringRef = useRef(false);
  const autoMockupFiredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // Whether the Camtek User Manual is loaded as standing coach context — shown
  // as a pinned row in the gear popover. Global + session-stable, so fetch once.
  useEffect(() => {
    let cancelled = false;
    ai.getManualStatus()
      .then((s) => { if (!cancelled) setManualStatus({ loaded: s.loaded, pages: s.pages }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ai]);

  // Hydrate chat from backend on mount / draft change.
  useEffect(() => {
    let cancelled = false;
    setChatLoaded(false);
    skipNextPersistRef.current = true;
    draftsApi
      .getChat(draftId)
      .then((loaded) => {
        if (cancelled) return;
        if (loaded.length > 0) {
          setMessages(loaded);
          setInitialLoaded(true); // skip welcome bootstrap; we have history
          setTyping(false);
        }
        setChatLoaded(true);
      })
      .catch((err) => {
        console.error('[SuggestChat] getChat failed', err);
        if (!cancelled) setChatLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [draftId, draftsApi]);

  // Persist chat on every change once we've loaded.
  useEffect(() => {
    if (!chatLoaded) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    draftsApi
      .putChat(draftId, messages)
      .catch((err) => console.error('[SuggestChat] putChat failed', err));
  }, [messages, chatLoaded, draftId, draftsApi]);

  // Show the typing indicator while mount-time attachments are still scanning,
  // and clear it once they're ready. The initial-suggestions effect below
  // re-sets typing when it actually fires the chat call, so this can't strand
  // the indicator if that call never happens (e.g. attachments fail to scan).
  useEffect(() => {
    if (initialLoaded) return;
    setTyping(!attachmentsReady);
  }, [attachmentsReady, initialLoaded]);

  // Initial contextual suggestions for real mode
  useEffect(() => {
    if (initialLoaded) return;
    if (!chatLoaded) return;
    if (!attachmentsReady) return;
    let cancelled = false;
    setTyping(true);
    const ctx = buildDraftContext(storyState, activeField);
    sendChat(
      [{ id: 'init', type: 'user', text: 'I\'m starting a new user story. Based on what I have so far, what should I focus on?', timestamp: new Date().toISOString() }],
      ctx,
    ).then((response) => {
      if (cancelled) return;
      setTyping(false);
      setMessages((prev) => [...prev, coachToSuggestMessage(response)]);
      setInitialLoaded(true);
    }).catch((err) => {
      if (cancelled) return;
      setTyping(false);
      setMessages((prev) => [...prev, coachUnavailableMsg(err)]);
      setInitialLoaded(true);
    });
    return () => { cancelled = true; };
  }, [attachmentsReady, chatLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance for single-option prompts: when the latest AI message is
  // flagged autoCaptured and hasn't been advanced yet, mark it advanced and
  // send the synthetic signal to the AI so the conversation flows on without
  // the user clicking anything. Field updates are deferred — they batch-apply
  // at the AC handoff (see effect below) unless we're already in the 'ac'
  // phase, in which case we apply immediately.
  useEffect(() => {
    if (typing) return;
    if (autoAdvancingRef.current) return;
    if (!chatLoaded) return;
    if (messages.length === 0) return;
    const idx = messages.length - 1;
    const m = messages[idx];
    if (!m || m.role !== 'ai' || !m.autoCaptured) return;
    const alreadyAdvanced = m.kind === 'quiz'
      ? !!m.quizAnswered
      : (m.appliedOptionIndices?.length ?? 0) > 0;
    if (alreadyAdvanced) return;
    const value = m.autoCapturedValue || '';
    if (!value) return;
    const field = m.field || '';

    autoAdvancingRef.current = true;

    // Compute the "virtual" patched state including this capture plus any
    // prior auto-captured (still-buffered) values, so the coach's next-field
    // hint is correct even if we haven't flushed to the real form yet.
    let virtual = storyState;
    for (let i = 0; i < idx; i++) {
      const prev = messages[i];
      if (prev.autoCaptured && prev.field && prev.autoCapturedValue) {
        virtual = patchStoryState(virtual, prev.field, prev.autoCapturedValue);
      }
    }
    if (field) virtual = patchStoryState(virtual, field, value);

    if (m.kind === 'quiz') {
      setMessages((prev) => prev.map((mm, i) =>
        i === idx ? { ...mm, quizAnswered: true, quizAnswer: value } : mm,
      ));
      const userEcho: SuggestMessage = { role: 'user', text: value };
      setMessages((prev) => [...prev, userEcho]);
      const conversationMsgs = toCoachMessages([...messages, userEcho]);
      const ctx = buildDraftContext(virtual, activeField);
      setTyping(true);
      sendChat(conversationMsgs, ctx)
        .then((response) => setMessages((prev) => [...prev, coachToSuggestMessage(response)]))
        .catch((err) => setMessages((prev) => [...prev, coachUnavailableMsg(err)]))
        .finally(() => {
          setTyping(false);
          autoAdvancingRef.current = false;
        });
      return;
    }

    // Suggestion path.
    if (phase === 'ac') {
      // Post-handoff: apply immediately, no buffering.
      onApply(field, value);
    }
    setMessages((prev) => prev.map((mm, i) =>
      i === idx ? { ...mm, appliedOptionIndices: [...(mm.appliedOptionIndices ?? []), 0] } : mm,
    ));

    const truncated = value.length > 120 ? value.slice(0, 117) + '…' : value;
    const next = nextEmptyField(virtual);
    let tail: string;
    if (field === 'scenario' && !hasMermaidBlock(virtual.flow)) {
      tail = `Now offer me sequence/flow diagrams for The Flow section — a single \`suggestions\` block with field='flow' containing exactly two options: (1) a \`\`\`mermaid sequenceDiagram, (2) a \`\`\`mermaid flowchart or graph. Each option's text is the fenced mermaid block ONLY (no prose). Keep diagrams short (≤ 8 nodes/steps) and faithful to the scenario prose. If a diagram genuinely wouldn't help, say so briefly and move on to Title instead.`;
    } else {
      tail = next
        ? `Now help me with **${next}** — the next empty field. Ask me a clarifying question (quiz) or draft a value.`
        : `All four fields are filled now. Ask me via quiz whether I want to refine any of them or add more acceptance criteria.`;
    }
    const signal: CoachMessage = {
      id: `auto-apply-${Date.now()}`,
      type: 'user',
      text: `I applied your suggestion to ${fieldLabel(field)}: "${truncated}". ${tail}`,
      timestamp: new Date().toISOString(),
    };
    const aiConvo: CoachMessage[] = [...toCoachMessages(messages), signal];
    const ctx = buildDraftContext(virtual, activeField);
    setTyping(true);
    sendChat(aiConvo, ctx)
      .then((response) => setMessages((prev) => [...prev, coachToSuggestMessage(response)]))
      .catch((err) => setMessages((prev) => [...prev, coachUnavailableMsg(err)]))
      .finally(() => {
        setTyping(false);
        autoAdvancingRef.current = false;
      });
  }, [messages, typing, chatLoaded, phase, storyState, activeField, ai, onApply]);

  // AC handoff: when a criteria-bundle arrives that hasn't yet been
  // handed-off, flush every still-buffered single-option capture to the form
  // in one atomic batch, flip phase to 'ac' (which unlocks the form in
  // BuilderPage), and drop a summary ack in the chat showing what was applied.
  useEffect(() => {
    if (!chatLoaded) return;
    if (handoffFiringRef.current) return;
    const bundleIdx = messages.findIndex(
      (m) => m.kind === 'criteria-bundle' && !m.handoffApplied,
    );
    if (bundleIdx === -1) return;
    handoffFiringRef.current = true;

    const captures: { field: string; value: string }[] = [];
    for (let i = 0; i < bundleIdx; i++) {
      const m = messages[i];
      if (m.autoCaptured && m.field && m.autoCapturedValue) {
        captures.push({ field: m.field, value: m.autoCapturedValue });
      }
    }

    if (captures.length > 0 && onBatchApply) {
      onBatchApply(captures);
    }
    if (onPhaseChange) onPhaseChange('ac');

    setMessages((prev) => {
      const next = prev.map((m, i) => (i === bundleIdx ? { ...m, handoffApplied: true } : m));
      if (captures.length === 0) return next;
      const summaryLines = captures
        .map((c) => `${fieldLabel(c.field)}: ${c.value.length > 80 ? c.value.slice(0, 77) + '…' : c.value}`)
        .join('\n');
      const summary: SuggestMessage = {
        role: 'ai',
        kind: 'ack',
        text: `Applied to your story:\n${summaryLines}`,
      };
      // Insert the summary just before the criteria-bundle so the form-fill
      // story is visible above the AC list.
      return [...next.slice(0, bundleIdx), summary, ...next.slice(bundleIdx)];
    });

    handoffFiringRef.current = false;
  }, [messages, chatLoaded, onBatchApply, onPhaseChange]);

  const handleApply = (msgIdx: number, optIdx: number, field: string, text: string) => {
    const targetMsg = messages[msgIdx];
    const isCriteriaBundle = targetMsg?.kind === 'criteria-bundle';
    const isFirstAcAccept =
      isCriteriaBundle && (targetMsg?.appliedOptionIndices?.length ?? 0) === 0;

    onApply(field, text);
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== msgIdx) return m;
        const cur = m.appliedOptionIndices ?? [];
        return cur.includes(optIdx) ? m : { ...m, appliedOptionIndices: [...cur, optIdx] };
      }),
    );

    // Auto-fire the Interactive User Story exactly once when the user first
    // accepts an AC from the criteria-bundle. Guarded against rapid double-fires
    // and against re-firing on reload (appliedOptionIndices was empty pre-click).
    if (isFirstAcAccept && !autoMockupFiredRef.current && onAutoMockup) {
      autoMockupFiredRef.current = true;
      onAutoMockup();
    }

    // Skip the follow-up call if one is already in flight (e.g. user rapid-clicks
    // multiple criteria chips). The coach will pick up state when the pending call
    // returns.
    if (typing) return;

    const patched = patchStoryState(storyState, field, text);
    const truncated = text.length > 120 ? text.slice(0, 117) + '…' : text;
    const next = nextEmptyField(patched);
    let tail: string;
    if (field === 'scenario' && !hasMermaidBlock(patched.flow)) {
      tail = `Now offer me sequence/flow diagrams for The Flow section — a single \`suggestions\` block with field='flow' containing exactly two options: (1) a \`\`\`mermaid sequenceDiagram, (2) a \`\`\`mermaid flowchart or graph. Each option's text is the fenced mermaid block ONLY (no prose). Keep diagrams short (≤ 8 nodes/steps) and faithful to the scenario prose. If a diagram genuinely wouldn't help, say so briefly and move on to Title instead.`;
    } else {
      tail = next
        ? `Now help me with **${next}** — the next empty field. Ask me a clarifying question (quiz) or draft a value.`
        : `All four fields are filled now. Ask me via quiz whether I want to refine any of them or add more acceptance criteria.`;
    }
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
    sendChat(aiConvo, ctx)
      .then((response) => {
        setMessages((m) => [...m, coachToSuggestMessage(response)]);
      })
      .catch((err) => {
        setMessages((m) => [...m, coachUnavailableMsg(err)]);
      })
      .finally(() => {
        setTyping(false);
      });
  };

  const handleIgnoreSuggestion = (msgIdx: number, field: string) => {
    setMessages((prev) => prev.map((m, i) => (i === msgIdx ? { ...m, bundleResolved: true } : m)));
    setMessages((prev) => [...prev, { role: 'ai', kind: 'ack', text: `Skipped ${fieldLabel(field)}.` }]);
    if (typing) return;

    const next = nextEmptyField(storyState);
    const tail = next && next.toLowerCase() !== fieldLabel(field).toLowerCase()
      ? `Move on to **${next}** — ask me a clarifying question (quiz) or draft a value.`
      : `Move on to whatever empty field is next — ask me a clarifying question (quiz) or draft a value.`;
    const signal: CoachMessage = {
      id: `ignore-${Date.now()}`,
      type: 'user',
      text: `I'm skipping ${fieldLabel(field)} for now. ${tail}`,
      timestamp: new Date().toISOString(),
    };
    const aiConvo: CoachMessage[] = [...toCoachMessages(messages), signal];
    const ctx = buildDraftContext(storyState, activeField);

    setTyping(true);
    sendChat(aiConvo, ctx)
      .then((response) => setMessages((m) => [...m, coachToSuggestMessage(response)]))
      .catch((err) => setMessages((m) => [...m, coachUnavailableMsg(err)]))
      .finally(() => setTyping(false));
  };

  const handleApplyCustom = (msgIdx: number, field: string, text: string) => {
    onApply(field, text);
    setMessages((prev) => prev.map((m, i) => (i === msgIdx ? { ...m, bundleResolved: true } : m)));
    setMessages((prev) => [...prev, { role: 'ai', kind: 'ack', text: `Applied to ${fieldLabel(field)}.` }]);
    if (typing) return;

    const patched = patchStoryState(storyState, field, text);
    const truncated = text.length > 120 ? text.slice(0, 117) + '…' : text;
    const next = nextEmptyField(patched);
    let tail: string;
    if (field === 'scenario' && !hasMermaidBlock(patched.flow)) {
      tail = `Now offer me sequence/flow diagrams for The Flow section — a single \`suggestions\` block with field='flow' containing exactly two options: (1) a \`\`\`mermaid sequenceDiagram, (2) a \`\`\`mermaid flowchart or graph. Each option's text is the fenced mermaid block ONLY (no prose). Keep diagrams short (≤ 8 nodes/steps) and faithful to the scenario prose. If a diagram genuinely wouldn't help, say so briefly and move on to Title instead.`;
    } else {
      tail = next
        ? `Now help me with **${next}** — the next empty field. Ask me a clarifying question (quiz) or draft a value.`
        : `All four fields are filled now. Ask me via quiz whether I want to refine any of them or add more acceptance criteria.`;
    }
    const signal: CoachMessage = {
      id: `apply-custom-${Date.now()}`,
      type: 'user',
      text: `I wrote my own value for ${fieldLabel(field)}: "${truncated}". ${tail}`,
      timestamp: new Date().toISOString(),
    };
    const aiConvo: CoachMessage[] = [...toCoachMessages(messages), signal];
    const ctx = buildDraftContext(patched, activeField);

    setTyping(true);
    sendChat(aiConvo, ctx)
      .then((response) => setMessages((m) => [...m, coachToSuggestMessage(response)]))
      .catch((err) => setMessages((m) => [...m, coachUnavailableMsg(err)]))
      .finally(() => setTyping(false));
  };

  const handleQuizAnswer = useCallback((msgIdx: number, answer: string) => {
    // Mark quiz as answered and remember the answer for compact rendering
    setMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, quizAnswered: true, quizAnswer: answer } : m));
    // Send the answer as a user message
    const userMsg: SuggestMessage = { role: 'user', text: answer };
    setMessages((m) => [...m, userMsg]);
    setTyping(true);

    const ctx = buildDraftContext(storyState, activeField);
    const conversationMsgs = toCoachMessages([...messages, userMsg]);
    sendChat(conversationMsgs, ctx).then((response) => {
      setMessages((m) => [...m, coachToSuggestMessage(response)]);
    }).catch((err) => {
      setMessages((m) => [...m, coachUnavailableMsg(err)]);
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
      const response = await sendChat(conversationMsgs, ctx);
      setMessages((m) => [...m, coachToSuggestMessage(response)]);
    } catch (err) {
      setMessages((m) => [...m, coachUnavailableMsg(err)]);
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
      } catch (err) {
        setMessages((m) => [...m, coachUnavailableMsg(err)]);
      } finally {
        setTyping(false);
      }
    } else if (chatPrompt) {
      setMessages((m) => [...m, { role: 'user', text: chip }]);
      setTyping(true);
      try {
        const ctx = buildDraftContext(storyState, activeField);
        const conversationMsgs = toCoachMessages([...messages, { role: 'user', text: chatPrompt }]);
        const response = await sendChat(conversationMsgs, ctx);
        setMessages((m) => [...m, coachToSuggestMessage(response)]);
      } catch (err) {
        setMessages((m) => [...m, coachUnavailableMsg(err)]);
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
    const m = messages[i];
    if (m.kind === 'quiz' && !m.quizAnswered && !m.autoCaptured) {
      activeQuizIdx = i;
      break;
    }
  }
  const activeQuiz = activeQuizIdx >= 0 ? messages[activeQuizIdx] : null;

  type StatusKind = 'idle' | 'thinking' | 'scanning' | 'updated' | 'added';
  let coachStatusKind: StatusKind = 'idle';
  let coachStatus = 'Idle';
  if (typing) {
    coachStatusKind = 'thinking';
    coachStatus = 'Thinking…';
  } else if (scanningDocNames.length > 0) {
    coachStatusKind = 'scanning';
    const first = scanningDocNames[0];
    const rest = scanningDocNames.length - 1;
    coachStatus = rest > 0 ? `Scanning ${first} (+${rest})…` : `Scanning ${first}…`;
  } else if (recentFieldEditLabel) {
    coachStatusKind = 'updated';
    coachStatus = `Updated ${recentFieldEditLabel} in context`;
  } else if (recentlyAddedDocName) {
    coachStatusKind = 'added';
    coachStatus = `Added ${recentlyAddedDocName} to context`;
  }
  const STATUS_COLOR: Record<StatusKind, string> = {
    idle: ARK_TOKENS.inkSubtle,
    thinking: ARK_TOKENS.azure,
    scanning: ARK_TOKENS.warning,
    updated: ARK_TOKENS.success,
    added: ARK_TOKENS.success,
  };

  // Pin the User Manual at the top of the gear popover when it's loaded. It's
  // global standing context, so it's injected here, never persisted on a draft.
  // Appended (not prepended) because the popover renders entries reversed.
  const manualEntry: ContextLogEntry | null = manualStatus?.loaded
    ? {
        id: 'ctx-user-manual',
        kind: 'manual',
        label: 'Camtek User Manual',
        summary: manualStatus.pages > 0 ? `${manualStatus.pages} pages indexed` : 'Product reference',
        addedAt: new Date(0).toISOString(),
      }
    : null;
  const popoverEntries = manualEntry ? [...contextLog, manualEntry] : contextLog;

  return (
    <div
      className={typing ? 'ark-thinking' : undefined}
      style={{
        flex: `0 0 ${width ?? 400}px`,
        width: width ?? 400,
        borderLeft: `1px solid ${ARK_TOKENS.border}`,
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
          <div style={{ fontSize: ARK_TOKENS.type.h2, fontWeight: ARK_TOKENS.weight.semibold }}>Ark Coach</div>
          <div
            style={{
              fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {coachStatus}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setContextOpen((v) => !v)}
            aria-label="Coach context"
            className={coachStatusKind !== 'idle' ? 'ark-icon-pulse' : undefined}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: STATUS_COLOR[coachStatusKind],
              padding: 4, borderRadius: 3,
              transition: 'color 0.3s ease',
            }}
          >
            <Ico.gear size={14} />
          </button>
          {contextOpen && (
            <ContextLogPopover entries={popoverEntries} onClose={() => setContextOpen(false)} />
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="ark-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {messages.map((m, i) => (
          <SuggestMsg
            key={i}
            msg={m}
            msgIdx={i}
            onApply={handleApply}
            onIgnore={handleIgnoreSuggestion}
            onApplyCustom={handleApplyCustom}
          />
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
                fontSize: ARK_TOKENS.type.label,
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
            placeholder={activeQuiz ? 'Pick an option above…' : 'Ask the coach…'}
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: ARK_TOKENS.type.body,
              lineHeight: ARK_TOKENS.leading.normal,
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
        <div style={{ fontSize: ARK_TOKENS.type.h2, fontWeight: ARK_TOKENS.weight.semibold, lineHeight: ARK_TOKENS.leading.normal, color: ARK_TOKENS.ink, marginBottom: 2 }}>
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
                fontSize: ARK_TOKENS.type.body,
                lineHeight: ARK_TOKENS.leading.normal,
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
                  fontSize: ARK_TOKENS.type.micro, fontWeight: ARK_TOKENS.weight.bold, flexShrink: 0,
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
                  placeholder="Type your answer…"
                  style={{
                    flex: 1,
                    border: `1px solid ${ARK_TOKENS.borderStrong}`,
                    borderRadius: ARK_TOKENS.r,
                    padding: '6px 10px',
                    fontSize: ARK_TOKENS.type.label,
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
  onIgnore,
  onApplyCustom,
}: {
  msg: SuggestMessage;
  msgIdx: number;
  onApply: (msgIdx: number, optIdx: number, field: string, text: string) => void;
  onIgnore: (msgIdx: number, field: string) => void;
  onApplyCustom: (msgIdx: number, field: string, text: string) => void;
}) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'ark-fadein 0.25s' }}>
        <div style={{ maxWidth: '88%', background: ARK_TOKENS.surfaceAlt, color: ARK_TOKENS.ink, padding: '8px 12px', borderRadius: 10, fontSize: ARK_TOKENS.type.body, lineHeight: ARK_TOKENS.leading.normal }}>
          {msg.text}
        </div>
      </div>
    );
  }

  // Auto-captured single-option prompts are silently absorbed during chat and
  // surfaced as part of the AC handoff summary. Don't render them.
  if (msg.autoCaptured) return null;

  if (msg.kind === 'ack') {
    return (
      <div className="ark-fadein" style={{ display: 'flex', gap: 6, paddingLeft: 32, fontSize: ARK_TOKENS.type.label, color: ARK_TOKENS.inkSubtle, alignItems: 'center' }}>
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
            style={{ fontSize: ARK_TOKENS.type.body, lineHeight: ARK_TOKENS.leading.normal, color: ARK_TOKENS.ink, marginBottom: msg.kind ? 10 : 0 }}
            dangerouslySetInnerHTML={{ __html: renderBold(msg.text) }}
          />
        )}
        {msg.intro && (
          <div
            style={{ fontSize: ARK_TOKENS.type.label, lineHeight: ARK_TOKENS.leading.normal, color: ARK_TOKENS.inkMuted, marginBottom: 8 }}
            dangerouslySetInnerHTML={{ __html: renderBold(msg.intro) }}
          />
        )}

        {(msg.kind === 'suggestions' || msg.kind === 'criteria-bundle') && msg.options && !(msg.kind === 'suggestions' && msg.bundleResolved) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {msg.options.map((opt, i) => {
              const used = (msg.appliedOptionIndices ?? []).includes(i);
              const targetField = msg.kind === 'criteria-bundle' ? 'criteria' : msg.field!;
              return (
                <button
                  key={i}
                  onClick={() => onApply(msgIdx, i, targetField, opt)}
                  disabled={used}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: `1px solid ${used ? ARK_TOKENS.success : ARK_TOKENS.border}`,
                    background: used ? ARK_TOKENS.successBg : ARK_TOKENS.surface,
                    borderRadius: ARK_TOKENS.r2,
                    fontSize: ARK_TOKENS.type.body,
                    lineHeight: ARK_TOKENS.leading.normal,
                    color: ARK_TOKENS.ink,
                    cursor: used ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    transition: 'all 0.18s',
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
                  {used ? (
                    <span
                      style={{
                        width: 20, height: 20, borderRadius: 10,
                        background: ARK_TOKENS.success, color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Ico.check size={12} />
                    </span>
                  ) : (
                    <span style={{ color: ARK_TOKENS.inkMuted, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                      <Ico.plus size={11} />
                    </span>
                  )}
                  <span style={{ flex: 1 }}>{opt}</span>
                  {used && (
                    <Badge tone="success" icon={<Ico.check size={10} />}>
                      Applied
                    </Badge>
                  )}
                </button>
              );
            })}
            {msg.kind === 'suggestions' && msg.field && (
              <SuggestionActions
                msgIdx={msgIdx}
                field={msg.field}
                onIgnore={onIgnore}
                onApplyCustom={onApplyCustom}
              />
            )}
          </div>
        )}

        {msg.kind === 'quiz' && msg.quizAnswered && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {msg.quizQuestion && (
              <div style={{ fontSize: ARK_TOKENS.type.h2, fontWeight: ARK_TOKENS.weight.semibold, lineHeight: ARK_TOKENS.leading.normal, color: ARK_TOKENS.ink }}>
                {msg.quizQuestion}
              </div>
            )}
            {msg.quizAnswer && (
              <div style={{ fontSize: ARK_TOKENS.type.label, lineHeight: ARK_TOKENS.leading.normal, color: ARK_TOKENS.inkMuted }}>
                → {msg.quizAnswer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionActions({
  msgIdx,
  field,
  onIgnore,
  onApplyCustom,
}: {
  msgIdx: number;
  field: string;
  onIgnore: (msgIdx: number, field: string) => void;
  onApplyCustom: (msgIdx: number, field: string, text: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  const submitCustom = () => {
    const text = customText.trim();
    if (!text) return;
    onApplyCustom(msgIdx, field, text);
  };

  const buttonStyle: CSSProperties = {
    border: 'none',
    background: 'transparent',
    padding: '4px 8px',
    fontSize: ARK_TOKENS.type.label,
    color: ARK_TOKENS.inkMuted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    borderRadius: 4,
  };

  return (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={() => onIgnore(msgIdx, field)}
          style={buttonStyle}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.ink; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.inkMuted; }}
        >
          Ignore
        </button>
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          style={buttonStyle}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.ink; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ARK_TOKENS.inkMuted; }}
        >
          Something else…
        </button>
      </div>
      {showCustom && (
        <div className="ark-fadein" style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCustom(); }}
            placeholder={`Type your ${fieldLabel(field).toLowerCase()}…`}
            style={{
              flex: 1,
              border: `1px solid ${ARK_TOKENS.borderStrong}`,
              borderRadius: ARK_TOKENS.r,
              padding: '6px 10px',
              fontSize: ARK_TOKENS.type.label,
              fontFamily: 'inherit',
              outline: 'none',
              background: ARK_TOKENS.surface,
            }}
          />
          <button
            type="button"
            onClick={submitCustom}
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
}
