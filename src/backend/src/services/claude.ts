import Anthropic from '@anthropic-ai/sdk';
import { buildCoachSystemPrompt, buildFieldSuggestionPrompt } from './coachPrompts.ts';

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic();
  return _client;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DraftContext {
  title?: string;
  background?: string;
  persona?: string;
  want?: string;
  benefit?: string;
  criteria?: string[];
  activeField?: string;
}

interface CoachSuggestion {
  field: string;
  options: string[];
}

interface CoachQuiz {
  question: string;
  options: string[];
}

interface CoachResponse {
  text: string;
  suggestions?: CoachSuggestion[];
  quiz?: CoachQuiz;
}

function parseDraftContext(raw: string | DraftContext): DraftContext {
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function parseStructuredResponse(text: string): CoachResponse {
  // Try to parse entire response as JSON
  try {
    const parsed = JSON.parse(text);
    if (parsed.text) return parsed;
  } catch {
    // Not valid JSON — check for embedded JSON block
  }

  // Try to extract JSON from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.text) return parsed;
    } catch {
      // Fall through
    }
  }

  // Plain text response
  return { text };
}

export async function chatWithCoach(
  messages: ChatMessage[],
  draftContext: string | DraftContext,
): Promise<CoachResponse> {
  const ctx = parseDraftContext(draftContext);
  const systemPrompt = buildCoachSystemPrompt(ctx);

  const response = await client().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const block = response.content[0];
  if (block.type === 'text') return parseStructuredResponse(block.text);
  return { text: '' };
}

export async function suggestForField(
  field: string,
  currentValue: string,
  draftContext: string | DraftContext,
): Promise<{ text: string; suggestions?: string[] }> {
  const ctx = parseDraftContext(draftContext);
  const systemPrompt = buildFieldSuggestionPrompt(field, currentValue, ctx);

  const response = await client().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Suggest improvements for the ${field} field.` }],
  });

  const block = response.content[0];
  if (block.type === 'text') {
    const parsed = parseStructuredResponse(block.text);
    // Flatten CoachSuggestion[] to string[] for field suggestions
    if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      const first = parsed.suggestions[0];
      if (first && typeof first === 'object' && 'options' in first) {
        return { text: parsed.text, suggestions: first.options };
      }
      // Already flat string array
      if (typeof first === 'string') {
        return { text: parsed.text, suggestions: parsed.suggestions as unknown as string[] };
      }
    }
    return { text: parsed.text };
  }
  return { text: 'No suggestions available.' };
}
