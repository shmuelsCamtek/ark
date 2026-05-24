import DOMPurify from 'isomorphic-dompurify';
import type { FlowBlock } from './renderFlowSvg';

export interface StoryHtmlInput {
  title: string;
  background: string;
  scenario?: string;
  flowBlocks: FlowBlock[];
  persona: string;
  want: string;
  benefit: string;
  criteria: { id: string | number; text: string }[];
  uiBeforeUrl?: string;
  uiAfterUrl?: string;
  workItemType?: string;
  workItemId?: string;
  mockupHtml?: string;
  generatedBy: string;
  generatedAt: string;
}

const MOCKUP_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'button', 'input', 'label',
    'hr', 'br', 'strong', 'em', 'code', 'small',
    'figure', 'figcaption', 'img',
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'type', 'placeholder', 'value', 'checked',
    'disabled', 'alt', 'src', 'width', 'height', 'for', 'role', 'aria-label',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'link', 'meta', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit'],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraph(text: string): string {
  return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

function flowBlockHtml(block: FlowBlock): string {
  if (block.kind === 'prose') return paragraph(block.text);
  // SVG output is sanitized by mermaid with securityLevel: 'strict'.
  return `<div class="flow-svg">${block.svg}</div>`;
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 40px 20px; font-family: Roboto, "Segoe UI", system-ui, sans-serif; color: #1a1a1a; background: #f5f6f7; -webkit-font-smoothing: antialiased; }
  .page { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e0e2e5; border-radius: 8px; padding: 32px 40px; }
  .eyebrow { font-size: 11px; font-weight: 600; color: #4a4d52; letter-spacing: 0.3px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .eyebrow::before { content: ""; width: 10px; height: 10px; background: #008FBE; border-radius: 1px; }
  h1 { font-size: 28px; font-weight: 600; margin: 0 0 24px; letter-spacing: -0.3px; line-height: 1.2; }
  section { margin-bottom: 22px; }
  section:last-of-type { margin-bottom: 0; }
  h2 { font-size: 11px; font-weight: 600; color: #6b6e72; letter-spacing: 0.7px; text-transform: uppercase; margin: 0 0 8px; }
  p { margin: 0; font-size: 14px; line-height: 1.6; color: #1a1a1a; }
  .desc b { font-weight: 600; }
  ol.ac { list-style: none; padding: 0; margin: 0; }
  ol.ac li { display: flex; gap: 12px; padding: 8px 0; font-size: 14px; line-height: 1.5; border-top: 1px solid #ececee; }
  ol.ac li:first-child { border-top: none; }
  ol.ac .tag { color: #6b6e72; font-weight: 600; font-size: 11px; flex-shrink: 0; width: 28px; margin-top: 3px; }
  .flow-svg { margin: 8px 0; padding: 8px; background: #fff; border-radius: 4px; overflow-x: auto; }
  .flow-svg svg { max-width: 100%; height: auto; }
  .ui-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ui-grid figure { margin: 0; }
  .ui-grid figcaption { font-size: 11px; font-weight: 600; color: #6b6e72; letter-spacing: 0.3px; text-transform: uppercase; margin-bottom: 4px; }
  .ui-grid img { width: 100%; height: auto; border: 1px solid #e0e2e5; border-radius: 4px; display: block; }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ececee; font-size: 11px; color: #8a8d92; }

  /* Pure-CSS tab pattern: hidden radio inputs + :checked sibling selectors */
  .ark-tabs-radio { position: absolute; opacity: 0; pointer-events: none; }
  .ark-tabs { display: flex; gap: 4px; border-bottom: 1px solid #e0e2e5; margin: 0 0 20px; }
  .ark-tabs label { padding: 8px 14px; font-size: 13px; font-weight: 500; color: #6b6e72; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; user-select: none; }
  .ark-tabs label:hover { color: #1a1a1a; }
  .ark-panel-story { display: block; }
  .ark-panel-mockup { display: none; }
  #t-mockup:checked ~ .ark-tabs label[for="t-mockup"] { color: #1a1a1a; font-weight: 600; border-bottom-color: #008FBE; }
  #t-story:checked ~ .ark-tabs label[for="t-story"] { color: #1a1a1a; font-weight: 600; border-bottom-color: #008FBE; }
  #t-mockup:checked ~ .ark-panel-story { display: none; }
  #t-mockup:checked ~ .ark-panel-mockup { display: block; }
  .ark-mockup-frame { border: 1px solid #e0e2e5; border-radius: 8px; background: #fff; padding: 16px; overflow-x: auto; }
  .ark-tab-badge { color: #7E57C2; font-weight: 600; margin-left: 6px; }
`;

export function storyToHtml(input: StoryHtmlInput): string {
  const {
    title,
    background,
    scenario,
    flowBlocks,
    persona,
    want,
    benefit,
    criteria,
    uiBeforeUrl,
    uiAfterUrl,
    workItemType,
    workItemId,
    mockupHtml,
    generatedBy,
    generatedAt,
  } = input;

  const eyebrow = [
    (workItemType || 'User Story').toUpperCase(),
    workItemId ? `#${workItemId}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const titleHtml = title.trim() ? escapeHtml(title) : 'Untitled story';

  const sections: string[] = [];

  sections.push(`<section><h2>Background</h2>${paragraph(background || '')}</section>`);
  if (scenario && scenario.trim()) {
    sections.push(`<section><h2>Scenario</h2>${paragraph(scenario)}</section>`);
  }
  if (flowBlocks.length > 0) {
    sections.push(`<section><h2>Flow</h2>${flowBlocks.map(flowBlockHtml).join('')}</section>`);
  }

  const descParts = [
    `<b>As a</b> ${escapeHtml(persona || '')}`,
    `<b>I want</b> ${escapeHtml(want || '')}`,
    `<b>So that</b> ${escapeHtml(benefit || '')}.`,
  ];
  sections.push(`<section><h2>Description</h2><p class="desc">${descParts.join('<br>')}</p></section>`);

  if (criteria.length > 0) {
    const items = criteria
      .map((c, i) => `<li><span class="tag">AC${i + 1}</span><span>${escapeHtml(c.text)}</span></li>`)
      .join('');
    sections.push(`<section><h2>Acceptance criteria</h2><ol class="ac">${items}</ol></section>`);
  }

  if (uiBeforeUrl || uiAfterUrl) {
    const before = uiBeforeUrl
      ? `<figure><figcaption>Before</figcaption><img src="${escapeHtml(uiBeforeUrl)}" alt="Before"></figure>`
      : '<figure></figure>';
    const after = uiAfterUrl
      ? `<figure><figcaption>After</figcaption><img src="${escapeHtml(uiAfterUrl)}" alt="After"></figure>`
      : '<figure></figure>';
    sections.push(
      `<section><h2>UI change · Before → After</h2><div class="ui-grid">${before}${after}</div></section>`,
    );
  }

  const footer = `<footer>Generated by ${escapeHtml(generatedBy)} · ${escapeHtml(generatedAt)} · Ark Story Studio</footer>`;

  const header = `${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ''}\n<h1>${titleHtml}</h1>`;
  const storySectionsHtml = sections.join('\n');

  // When a mockup is present, wrap the content in a pure-CSS tab pattern.
  // Hidden radio inputs + :checked sibling selectors drive panel visibility —
  // no <script> needed, no :target hash side-effects.
  let bodyContent: string;
  if (mockupHtml && mockupHtml.trim()) {
    const sanitizedMockup = DOMPurify.sanitize(mockupHtml, MOCKUP_SANITIZE_CONFIG);
    bodyContent = `
${header}
<input class="ark-tabs-radio" type="radio" name="ark-tabs" id="t-story" checked>
<input class="ark-tabs-radio" type="radio" name="ark-tabs" id="t-mockup">
<nav class="ark-tabs">
  <label for="t-story">Story</label>
  <label for="t-mockup">Mockup<span class="ark-tab-badge">✷</span></label>
</nav>
<div class="ark-panel-story">
${storySectionsHtml}
</div>
<div class="ark-panel-mockup">
<div class="ark-mockup-frame">${sanitizedMockup}</div>
</div>
${footer}`;
  } else {
    bodyContent = `
${header}
${storySectionsHtml}
${footer}`;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Ark Story Studio">
<title>${titleHtml}</title>
<style>${STYLES}</style>
</head>
<body>
<main class="page">${bodyContent}
</main>
</body>
</html>`;
}
