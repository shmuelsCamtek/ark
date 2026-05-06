import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface ScanResult {
  summary: string;
  problemContext?: string;
  stakeholders?: string[];
  goals?: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
}

const ANALYSIS_INSTRUCTIONS =
  'Analyze this document to inform a user story. Extract:\n' +
  '- summary: 1-3 sentence overview of what this document is about\n' +
  '- problemContext: the business problem or current situation the doc describes (used to draft the story Background)\n' +
  '- stakeholders: roles, personas, or user types the doc mentions (used to draft the Persona)\n' +
  '- goals: desired outcomes, capabilities, or motivations implied by the doc (used to draft "I want to…" / "So that…")\n' +
  '- acceptanceCriteria: testable criteria in Given/When/Then form. Each array entry is EXACTLY ONE Given/When/Then triple — one scenario per entry. Never concatenate multiple triples into one string.\n' +
  '- edgeCases: failure modes, boundary conditions, exception paths. Each entry is also exactly ONE Given/When/Then triple.\n' +
  '\n' +
  'Return JSON: { "summary": "...", "problemContext": "...", "stakeholders": ["..."], "goals": ["..."], "acceptanceCriteria": ["..."], "edgeCases": ["..."] }';

const TEXT_LIKE_MIME_PREFIXES = ['text/'];
const TEXT_LIKE_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-yaml',
  'application/yaml',
  'application/csv',
]);

const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

type Kind = 'image' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'text' | 'unknown';

function extension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function detectKind(name: string, mimeType: string): Kind {
  const m = (mimeType || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m === DOCX_MIME) return 'docx';
  if (m === XLSX_MIME) return 'xlsx';
  if (m === PPTX_MIME) return 'pptx';
  if (TEXT_LIKE_MIME_PREFIXES.some((p) => m.startsWith(p))) return 'text';
  if (TEXT_LIKE_MIME_TYPES.has(m)) return 'text';

  switch (extension(name)) {
    case 'pdf': return 'pdf';
    case 'docx': return 'docx';
    case 'xlsx': case 'xls': case 'xlsm': case 'ods': return 'xlsx';
    case 'pptx': return 'pptx';
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': return 'image';
    case 'txt': case 'md': case 'markdown': case 'csv': case 'json':
    case 'xml': case 'yaml': case 'yml': case 'log':
      return 'text';
    default:
      return 'unknown';
  }
}

function decodeBase64Utf8(base64: string): string {
  return Buffer.from(base64, 'base64').toString('utf8');
}

function looksLikeText(s: string): boolean {
  if (!s) return false;
  const sample = s.slice(0, 4000);
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code < 127) || code >= 160) {
      printable++;
    }
  }
  return printable / sample.length > 0.85;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

function extractXlsxText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }
  return parts.join('\n\n');
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });
  const parts: string[] = [];
  for (let i = 0; i < slideNames.length; i++) {
    const xml = await zip.files[slideNames[i]].async('string');
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
    const text = matches
      .map((m) => m.replace(/<[^>]+>/g, ''))
      .map((t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
      .join(' ')
      .trim();
    if (text) parts.push(`--- Slide ${i + 1} ---\n${text}`);
  }
  return parts.join('\n\n');
}

async function buildMessages(
  content: string,
  mimeType: string,
  name: string,
): Promise<Anthropic.MessageParam[]> {
  const kind = detectKind(name, mimeType);

  if (kind === 'image') {
    const mediaType: Anthropic.Base64ImageSource['media_type'] = SUPPORTED_IMAGE_MEDIA_TYPES.has(mimeType)
      ? (mimeType as Anthropic.Base64ImageSource['media_type'])
      : 'image/png';
    return [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: content } },
          { type: 'text', text: ANALYSIS_INSTRUCTIONS },
        ],
      },
    ];
  }

  if (kind === 'pdf') {
    return [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: content } },
          { type: 'text', text: ANALYSIS_INSTRUCTIONS },
        ],
      },
    ];
  }

  const buffer = Buffer.from(content, 'base64');

  if (kind === 'docx') {
    const text = await extractDocxText(buffer);
    return [{ role: 'user', content: `${ANALYSIS_INSTRUCTIONS}\n\nDocument "${name}" (Word):\n${text}` }];
  }

  if (kind === 'xlsx') {
    const text = extractXlsxText(buffer);
    return [{ role: 'user', content: `${ANALYSIS_INSTRUCTIONS}\n\nWorkbook "${name}" (Excel, CSV per sheet):\n${text}` }];
  }

  if (kind === 'pptx') {
    const text = await extractPptxText(buffer);
    return [{ role: 'user', content: `${ANALYSIS_INSTRUCTIONS}\n\nPresentation "${name}" (PowerPoint):\n${text}` }];
  }

  if (kind === 'text') {
    const text = decodeBase64Utf8(content);
    return [{ role: 'user', content: `${ANALYSIS_INSTRUCTIONS}\n\nDocument "${name}" (${mimeType || 'text'}):\n${text}` }];
  }

  // Unknown: try UTF-8 decode; if it looks like text, include as text.
  const decoded = decodeBase64Utf8(content);
  if (looksLikeText(decoded)) {
    return [
      {
        role: 'user',
        content: `${ANALYSIS_INSTRUCTIONS}\n\nDocument "${name}" (declared type ${mimeType || 'unknown'}):\n${decoded}`,
      },
    ];
  }

  return [
    {
      role: 'user',
      content:
        `${ANALYSIS_INSTRUCTIONS}\n\nDocument "${name}" has type ${mimeType || 'unknown'}, which could not be parsed. ` +
        `Make best-effort suggestions based on the filename alone, and note in the summary that the file content was not readable.`,
    },
  ];
}

export async function scanDocument(
  content: string,
  mimeType: string,
  name = 'document',
): Promise<ScanResult> {
  const messages = await buildMessages(content, mimeType, name);

  const response = await client().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system:
      'You are a document analyzer that prepares context for user-story writing. ' +
      'Extract business context, stakeholders, goals, and testable acceptance criteria from documents. ' +
      'Always return valid JSON.',
    messages,
  });

  const block = response.content[0];
  if (block?.type === 'text') {
    const raw = block.text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const candidate = jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw;
    try {
      const parsed = JSON.parse(candidate);
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
        problemContext: typeof parsed.problemContext === 'string' && parsed.problemContext ? parsed.problemContext : undefined,
        stakeholders: Array.isArray(parsed.stakeholders) && parsed.stakeholders.length ? parsed.stakeholders : undefined,
        goals: Array.isArray(parsed.goals) && parsed.goals.length ? parsed.goals : undefined,
        acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : [],
        edgeCases: Array.isArray(parsed.edgeCases) ? parsed.edgeCases : [],
      };
    } catch {
      return { summary: raw, acceptanceCriteria: [], edgeCases: [] };
    }
  }
  return { summary: '', acceptanceCriteria: [], edgeCases: [] };
}
