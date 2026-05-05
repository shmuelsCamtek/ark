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

function tryParseCoach(s: string): CoachResponse | null {
  try {
    const parsed = JSON.parse(s);
    if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
      return parsed as CoachResponse;
    }
  } catch {
    /* fall through */
  }
  return null;
}

// Walk braces to extract the first balanced JSON object substring.
// Tolerates trailing junk after the object's matching close-brace
// (e.g. extra "]" the model sometimes appends).
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseStructuredResponse(text: string): CoachResponse {
  // 1. Whole response is JSON.
  const direct = tryParseCoach(text);
  if (direct) return direct;

  // 2. JSON inside a markdown code fence (with or without trailing garbage).
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fence) {
    const fenced = tryParseCoach(fence[1]);
    if (fenced) return fenced;
    const balanced = extractJsonObject(fence[1]);
    if (balanced) {
      const recovered = tryParseCoach(balanced);
      if (recovered) return recovered;
    }
  }

  // 3. JSON object embedded anywhere in the response (prose preamble case).
  const anywhere = extractJsonObject(text);
  if (anywhere) {
    const recovered = tryParseCoach(anywhere);
    if (recovered) return recovered;
  }

  // 4. Plain text — strip any code fences so the user never sees raw markdown.
  const stripped = text.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim();
  return { text: stripped || text };
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
