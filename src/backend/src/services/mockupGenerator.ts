import Anthropic from '@anthropic-ai/sdk';
import { buildManualContext } from './manualContext.ts';
import { buildAttachmentBlocks, type CoachAttachment } from './attachments.ts';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ fetch: globalThis.fetch as any, maxRetries: 3 });
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
  attachments?: CoachAttachment[];
}

const SYSTEM_PROMPT = `You are a UI designer who turns user stories into INTERACTIVE HTML prototypes.

Your task: based on the user story below, either generate a self-contained INTERACTIVE HTML document mocking up the proposed feature, OR judge that the story is too thin to mock up and return an insufficient verdict.

The output will be rendered inside an <iframe sandbox="allow-scripts">, so you can ship real interactivity: clickable buttons that change visible state, working tabs/accordions/modals, in-page state, in-page form validation, hover/focus styling.

Return your response in this exact format:

If you can build a mockup — write the word ok on the first line, then the complete HTML document starting on the second line:
ok
<!doctype html>…</html>

If the story is too thin — write insufficient on the first line, then a concrete 1-2 sentence explanation on the second line:
insufficient
Needs more detail about which fields the form contains and what triggers it.

No JSON. No code fences. No commentary. Start with exactly "ok" or "insufficient".

If you can build a mockup, follow these HARD CONSTRAINTS for the HTML:

ALLOWED
- Full HTML document with <!doctype html><html><head>…</head><body>…</body></html>
- <style> blocks (full CSS — hover, focus, transitions, animations, :checked, etc.)
- <script> blocks with inline JavaScript for interactivity (state, event handlers, DOM updates)
- Event handlers in HTML attributes (onclick=, onchange=, oninput=, etc.)
- <form>, <input>, <select>, <textarea>, <button> — all interactive form elements
- Common semantic and structural tags: div, span, p, h1–h6, ul, ol, li, table/thead/tbody/tr/td/th, hr, br, strong, em, code, small, figure, figcaption, img, a, nav, header, footer, section, article, aside, dialog
- data-* attributes for JS hooks
- Camtek brand colors as accent: Bondi blue #008FBE for primary actions; marker red #E11A22 sparingly for destructive/alert; otherwise neutral grays

FORBIDDEN
- External URLs in ANY attribute. No "https://…", no "http://…", no protocol-relative "//…". Images go as <img alt="…"> with no src or a relative path. Stylesheets/scripts are inline only — no <link rel="stylesheet">, no <script src="…">.
- Nested <iframe>, <object>, <embed> — the mockup itself is already inside a sandboxed iframe.
- <base>, <meta http-equiv> — could alter document base URL or trigger refreshes.
- <form action="…"> — forms must be JS-handled (use addEventListener('submit', e => e.preventDefault()) or onsubmit="return false"). External form submission won't work in the sandbox anyway.
- window.open(), location.href changes, navigation outside the document. The sandbox blocks them anyway; don't try.

LAYOUT
- Target ~480–680px wide for the main content area. Set body { font-family: Roboto, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 16px; background: #fafafa; } so the rendering matches the parent app's look.
- Make it feel like a real prototype: meaningful default values, sample data that reflects the story, working state transitions for the happy path.

KEEP IT SHORT
- Aim for 100–200 lines total. No HTML comments, no CSS comments, no decorative blank lines.
- Group CSS selectors and use shorthand properties. No vendor-prefix repetition.
- JS: just enough for the happy-path interaction — no defensive null checks, no polyfills, no utility wrappers.

If the story is too thin, write insufficient followed by a concrete 1-2 sentence explanation of what's missing (e.g. "Needs more detail about which fields the form contains and what triggers it.").`;

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

function parseModelResponse(raw: string): { status: 'ok'; html: string } | { status: 'insufficient'; reason: string } | null {
  const nl = raw.indexOf('\n');
  const firstLine = (nl >= 0 ? raw.slice(0, nl) : raw).trim().toLowerCase();
  const rest = nl >= 0 ? raw.slice(nl + 1).trim() : '';
  if (firstLine === 'ok' && rest) return { status: 'ok', html: rest };
  if (firstLine === 'insufficient') return { status: 'insufficient', reason: rest || 'Story is too thin to mock up — add more detail.' };
  return null;
}

/**
 * Structural cleanup pass over the generated HTML. Defense-in-depth only —
 * the primary security boundary is the `<iframe sandbox="allow-scripts">`
 * the frontend uses to render this document.
 *
 * Removes:
 *  - Nested <iframe>/<object>/<embed> (the mockup is already sandboxed; no need to nest)
 *  - <base>/<meta http-equiv=…>/<link …> (could alter document base or pull external resources)
 *  - Attributes containing absolute / protocol-relative / javascript: / vbscript: URLs
 *    (prevents network exfiltration even though the sandbox limits damage)
 *  - <form action="…"> attributes (forms must be JS-handled; HTTP submit is blocked by sandbox anyway)
 *
 * Regex-based for simplicity. Not a full HTML parser; combined with the
 * iframe sandbox, this is enough.
 */
function sanitizeMockupHtml(html: string): string {
  let s = html;

  // Drop disallowed structural tags (with content)
  s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '');
  s = s.replace(/<iframe\b[^>]*\/?>/gi, '');
  s = s.replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, '');
  s = s.replace(/<object\b[^>]*\/?>/gi, '');
  s = s.replace(/<embed\b[^>]*\/?>/gi, '');

  // Drop void / meta-like tags entirely
  s = s.replace(/<base\b[^>]*\/?>/gi, '');
  s = s.replace(/<link\b[^>]*\/?>/gi, '');
  s = s.replace(/<meta\b[^>]*\bhttp-equiv\b[^>]*\/?>/gi, '');

  // Strip external URLs from URL-bearing attributes on any tag.
  // Matches  attr="http://..." | attr='https://...' | attr="//..." | attr="javascript:..." etc.
  const URL_ATTRS = ['src', 'href', 'action', 'formaction', 'cite', 'data', 'background', 'poster', 'srcset'];
  for (const attr of URL_ATTRS) {
    const re = new RegExp(
      `\\s${attr}\\s*=\\s*(['"])\\s*(?:https?:|//|javascript:|vbscript:|data:text/html)[^'"]*\\1`,
      'gi',
    );
    s = s.replace(re, '');
  }

  // Strip any action="…" from <form> elements regardless of value — forms must be JS-handled.
  s = s.replace(/(<form\b[^>]*?)\saction\s*=\s*(['"])[^'"]*\2/gi, '$1');

  return s;
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

  // When the user attached pictures/screenshots, show them to the model so the
  // generated UI mirrors the real design (layout, components, labels, styling).
  const attachmentBlocks = buildAttachmentBlocks(input.attachments);
  const userContent: Anthropic.MessageParam['content'] = attachmentBlocks.length > 0
    ? [
        { type: 'text', text: 'The user attached these reference screenshots / pictures of the UI. Match the prototype to what they show — reuse their layout, components, labels, and visual style where relevant, within the HTML constraints below.' },
        ...attachmentBlocks,
        { type: 'text', text: userText },
      ]
    : userText;

  const response = await client().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = response.content[0];
  const raw = block && block.type === 'text' ? block.text.trim() : '';
  const generatedAt = new Date().toISOString();

  if (response.stop_reason === 'max_tokens') {
    return { status: 'insufficient', insufficientReason: 'Model response was cut off — story may be too complex. Try reducing the acceptance criteria or scope.', generatedAt };
  }

  if (!raw) {
    return { status: 'insufficient', insufficientReason: 'Model returned empty response.', generatedAt };
  }

  const parsed = parseModelResponse(raw);
  if (!parsed) {
    return { status: 'insufficient', insufficientReason: 'Model returned unrecognised response format.', generatedAt };
  }
  if (parsed.status === 'insufficient') {
    return { status: 'insufficient', insufficientReason: parsed.reason, generatedAt };
  }
  const sanitized = sanitizeMockupHtml(parsed.html);
  if (!sanitized.trim()) {
    return { status: 'insufficient', insufficientReason: 'Model returned unsupported HTML — sanitization removed everything.', generatedAt };
  }
  return { status: 'ok', html: sanitized, generatedAt };
}
