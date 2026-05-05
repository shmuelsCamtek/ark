import type { CoachMessage } from '../types';
import type { AiService } from './ai';

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
    const data = await res.json();

    // Handle quiz response — defensively normalize options so the user always
    // has a "Something else…" escape hatch even if the model misbehaves.
    if (data.quiz && data.quiz.question && Array.isArray(data.quiz.options)) {
      const options = normalizeQuizOptions(data.quiz.options);
      return {
        id: msgId(),
        type: 'quiz',
        text: data.text || '',
        quiz: { question: data.quiz.question, options },
        timestamp: new Date().toISOString(),
      };
    }

    // Handle structured response with suggestions
    if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      const first = data.suggestions[0];
      // Structured suggestion: { field, options }
      if (first.field && first.options) {
        return {
          id: msgId(),
          type: first.field === 'criteria' ? 'criteria-bundle' : 'suggestion',
          text: data.text,
          field: first.field,
          criteria: first.field === 'criteria'
            ? first.options.map((s: string, i: number) => ({ id: `ac-http-${i}`, text: s, source: 'ai' as const }))
            : undefined,
          value: first.field !== 'criteria' ? first.options[0] : undefined,
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
    const data = await res.json();

    if (data.suggestions) {
      return {
        id: msgId(),
        type: field === 'acceptanceCriteria' ? 'criteria-bundle' : 'suggestion',
        text: data.text,
        field,
        criteria: field === 'acceptanceCriteria'
          ? data.suggestions.map((s: string, i: number) => ({ id: `ac-http-${i}`, text: s, source: 'ai' as const }))
          : undefined,
        value: field !== 'acceptanceCriteria' ? data.suggestions[0] : undefined,
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
}
