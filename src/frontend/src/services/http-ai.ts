import type { CoachMessage, DraftMockup } from '../types';
import type { AiService, ManualStatus } from './ai';

let nextId = 1;
function msgId() {
  return `ai-http-${nextId++}`;
}

const SOMETHING_ELSE = 'Something else…';
const SOMETHING_ELSE_RE = /something else|other|custom/i;

function normalizeQuizOptions(raw: unknown[]): string[] {
  const cleaned = raw.filter((o): o is string => typeof o === 'string' && o.trim().length > 0);
  const hasEscape = cleaned.some((o) => SOMETHING_ELSE_RE.test(o));
  return hasEscape ? cleaned : [...cleaned, SOMETHING_ELSE];
}

function realOptions(options: string[]): string[] {
  return options.filter((o) => !SOMETHING_ELSE_RE.test(o));
}

export class HttpAiService implements AiService {
  async chat(messages: CoachMessage[], draftContext: string): Promise<CoachMessage> {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
        draftContext,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI chat failed (${res.status})`);
    }
    const data = await res.json();

    // Handle quiz response — defensively normalize options so the user always
    // has a "Something else…" escape hatch even if the model misbehaves.
    if (data.quiz && data.quiz.question && Array.isArray(data.quiz.options)) {
      const options = normalizeQuizOptions(data.quiz.options);
      const real = realOptions(options);
      const autoCaptured = real.length === 1;
      return {
        id: msgId(),
        type: 'quiz',
        text: data.text || '',
        quiz: { question: data.quiz.question, options },
        value: autoCaptured ? real[0] : undefined,
        autoCaptured,
        timestamp: new Date().toISOString(),
      };
    }

    // Handle structured response with suggestions
    if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      const first = data.suggestions[0];
      // Structured suggestion: { field, options }
      if (first.field && first.options) {
        const isCriteria = first.field === 'criteria';
        // The chat only ever renders coach.value as a single button regardless
        // of how many options the backend produced, so every non-criteria
        // suggestion is effectively single-option from the user's perspective.
        // Auto-capture all of them — they'll be flushed at the AC handoff.
        const value = isCriteria ? undefined : first.options[0];
        const autoCaptured = !isCriteria && typeof value === 'string' && value.length > 0;
        return {
          id: msgId(),
          type: isCriteria ? 'criteria-bundle' : 'suggestion',
          text: data.text,
          field: first.field,
          criteria: isCriteria
            ? first.options.map((s: string, i: number) => ({ id: `ac-http-${i}`, text: s, source: 'ai' as const }))
            : undefined,
          value,
          autoCaptured: autoCaptured || undefined,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      id: msgId(),
      type: 'ai',
      text: data.text,
      timestamp: new Date().toISOString(),
    };
  }

  async suggestField(field: string, currentValue: string, draftContext: string): Promise<CoachMessage> {
    const res = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, currentValue, draftContext }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI suggest failed (${res.status})`);
    }
    const data = await res.json();

    if (data.suggestions) {
      const isCriteria = field === 'acceptanceCriteria';
      const value = isCriteria ? undefined : data.suggestions[0];
      const autoCaptured = !isCriteria && typeof value === 'string' && value.length > 0;
      return {
        id: msgId(),
        type: isCriteria ? 'criteria-bundle' : 'suggestion',
        text: data.text,
        field,
        criteria: isCriteria
          ? data.suggestions.map((s: string, i: number) => ({ id: `ac-http-${i}`, text: s, source: 'ai' as const }))
          : undefined,
        value,
        autoCaptured: autoCaptured || undefined,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      id: msgId(),
      type: 'ai',
      text: data.text,
      timestamp: new Date().toISOString(),
    };
  }

  async getManualStatus(): Promise<ManualStatus> {
    try {
      const res = await fetch('/api/ai/manual');
      if (!res.ok) return { loaded: false, chunks: 0, pages: 0 };
      return (await res.json()) as ManualStatus;
    } catch {
      return { loaded: false, chunks: 0, pages: 0 };
    }
  }

  async generateMockup(draftId: string): Promise<DraftMockup> {
    const res = await fetch('/api/ai/mockup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Mockup generation failed (${res.status})`);
    }
    return (await res.json()) as DraftMockup;
  }
}
