import Anthropic from '@anthropic-ai/sdk';
import DOMPurify from 'isomorphic-dompurify';
import { buildManualContext } from './manualContext.ts';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface MockupResult {
  status: 'ok' | 'insufficient';
  html?: string;
  insufficientReason?: string;
  generatedAt: string;
}

export interface MockupInput {
  title?: string;
  background?: string;
  scenario?: string;
  persona?: string;
  asA?: string;
  iWantTo?: string;
  soThat?: string;
  acceptanceCriteria?: string[];
  flow?: string;
  workItemDescription?: string;
  workItemReproSteps?: string;
}

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'button', 'input', 'label',
  'hr', 'br', 'strong', 'em', 'code', 'small',
  'figure', 'figcaption', 'img',
];
const ALLOWED_ATTR = ['class', 'style', 'type', 'placeholder', 'value', 'checked', 'disabled', 'alt', 'src', 'width', 'height', 'for', 'role', 'aria-label'];

const SYSTEM_PROMPT = `You are a UI designer who turns user stories into low-to-medium-fidelity HTML mockups.

Your task: based on the user story below, either generate a single self-contained HTML/CSS mockup of the proposed feature, OR judge that the story is too thin to mock up and return an insufficient verdict.

Return STRICT JSON in exactly one of these two shapes:
  { "status": "ok", "html": "<div class=\\"ark-mockup\\">…</div>" }
  { "status": "insufficient", "reason": "Needs more detail about …" }

If you can build a mockup, follow these HARD CONSTRAINTS for the HTML:
- Single root element: <div class="ark-mockup">
- Allowed tags ONLY: div, span, p, h1, h2, h3, h4, ul, ol, li, table, thead, tbody, tr, td, th, button, input, label, hr, br, strong, em, code, small, figure, figcaption, img
- NO <script>, <style>, <iframe>, <form>, <link>
- NO event handlers (onclick=, onload=, etc.)
- NO external URLs (no href, no src to remote hosts) — leave images as <img alt="…"> with no src or a relative path
- Inline style="…" ONLY, lean set of properties: color, background, padding, margin, border, font-size, font-weight, display, flex, gap, width, max-width, text-align, border-radius
- Target ~480–680px wide, max-width: 680px
- Use Camtek brand colors as accent only: Bondi blue #008FBE for primary actions; marker red #E11A22 sparingly for destructive/alert; otherwise neutral grays
- Roboto font family (set on root) so it matches the rest of the page

If the story is too thin, return { "status": "insufficient", "reason": "..." } with a concrete 1-2 sentence explanation of what's missing (e.g. "Needs more detail about which fields the form contains and what triggers it.").

Return ONLY the JSON object. No prose, no code fences, no commentary.`;

function buildUserPrompt(input: MockupInput): string {
  const lines: string[] = [];
  if (input.title) lines.push(`Title: ${input.title}`);
  if (input.background) lines.push(`Background:\n${input.background}`);
  if (input.scenario) lines.push(`Scenario:\n${input.scenario}`);
  if (input.persona) lines.push(`Persona: ${input.persona}`);
  if (input.asA || input.iWantTo || input.soThat) {
    lines.push(
      `User story:\n  As a ${input.asA || input.persona || '…'}\n  I want to ${input.iWantTo || '…'}\n  So that ${input.soThat || '…'}`,
    );
  }
  if (input.acceptanceCriteria && input.acceptanceCriteria.length > 0) {
    lines.push(`Acceptance criteria:\n${input.acceptanceCriteria.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}`);
  }
  if (input.flow) lines.push(`Flow:\n${input.flow}`);
  if (input.workItemDescription) lines.push(`Linked work item description:\n${input.workItemDescription}`);
  if (input.workItemReproSteps) lines.push(`Linked work item repro steps:\n${input.workItemReproSteps}`);
  return lines.join('\n\n');
}

function tryParseJson(s: string): unknown {
  // 1. direct
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }
  // 2. code fence
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fall through */
    }
  }
  // 3. balanced object
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

function sanitizeMockupHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'link', 'meta', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit'],
  });
}

export async function generateMockup(input: MockupInput): Promise<MockupResult> {
  const userText = buildUserPrompt(input);
  const manualQuery = [input.title, input.persona, input.iWantTo, input.acceptanceCriteria?.[0]]
    .filter(Boolean)
    .join(' ');
  const manualContext = buildManualContext(manualQuery);
  const system = manualContext
    ? `${manualContext}\n\n---\n\n${SYSTEM_PROMPT}`
    : SYSTEM_PROMPT;

  const response = await client().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system,
    messages: [{ role: 'user', content: userText }],
  });

  const block = response.content[0];
  const raw = block && block.type === 'text' ? block.text.trim() : '';
  const generatedAt = new Date().toISOString();

  if (!raw) {
    return { status: 'insufficient', insufficientReason: 'Model returned empty response.', generatedAt };
  }

  const parsed = tryParseJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { status: 'insufficient', insufficientReason: 'Model returned unparseable JSON.', generatedAt };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.status === 'insufficient') {
    const reason = typeof obj.reason === 'string' && obj.reason.trim()
      ? obj.reason.trim()
      : 'Story is too thin to mock up — add more detail.';
    return { status: 'insufficient', insufficientReason: reason, generatedAt };
  }

  if (obj.status === 'ok' && typeof obj.html === 'string' && obj.html.trim()) {
    const sanitized = sanitizeMockupHtml(obj.html);
    if (!sanitized.trim()) {
      return {
        status: 'insufficient',
        insufficientReason: 'Model returned unsupported HTML — sanitization removed everything.',
        generatedAt,
      };
    }
    return { status: 'ok', html: sanitized, generatedAt };
  }

  return {
    status: 'insufficient',
    insufficientReason: 'Model response did not match the expected shape.',
    generatedAt,
  };
}
