/**
 * One-shot indexer for the Camtek User Manual.
 *
 * Text extraction (default): pdfjs-dist, text-only — no API calls.
 * Figure captioning (--captions): for each page that contains an image, copy
 * that single page into a 1-page PDF (pdf-lib), send it to Claude as a document
 * block, and append the returned caption to that page's chunk text so visual
 * content becomes searchable. The runtime (manualIndex.ts + manualContext.ts)
 * needs no change — captions ride along inside `text`.
 *
 * Run:  npm run index-manual                       (text-only, interactive)
 *       npm run index-manual -- --yes               (text-only, no prompts)
 *       npm run index-manual -- --captions --yes    (text + figure captions; needs ANTHROPIC_API_KEY)
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { stdin as input, stdout as output } from 'node:process';
// pdfjs-dist legacy build runs in plain Node without a worker thread.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pdfjs-dist ships ambient types but TS can be picky about the legacy subpath.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ManualChunk {
  id: string;
  section: string;
  page: number;
  text: string;
  imagePaths: string[];
}

interface ManualIndexFile {
  manualPath: string;
  manualSizeBytes: number;
  manualSha256: string;
  generatedAt: string;
  chunks: ManualChunk[];
}

const MAX_PDF_SIZE = 200 * 1024 * 1024;
const DEFAULT_PDF = path.resolve(__dirname, '../manual/camtek-user-manual.pdf');
const OUTPUT_PATH = path.resolve(__dirname, '../manual/manual-index.json');
const PARTIAL_PATH = path.resolve(__dirname, '../manual/manual-index.partial.json');

// Captioning config
const CAPTION_CONCURRENCY = 3;
const CAPTION_MODEL = 'claude-sonnet-4-20250514';
const CAPTION_MARKER = '[Figure]';
const CAPTION_PROMPT =
  'This is a single page from the Camtek User Manual. In 2-4 sentences, describe the figures, ' +
  'screenshots, diagrams or UI shown on this page — name the product features, screen elements, ' +
  'buttons, labels, menu items and any values visible in the imagery. Focus on visual content ' +
  'that body text alone would not convey. If the page has no meaningful figure or screenshot, ' +
  'reply with exactly "NONE".';

// pdfjs image-drawing operators. Names vary across builds, so look them up by
// string and keep whatever this version actually defines.
const IMAGE_OP_NAMES = [
  'paintImageXObject',
  'paintImageXObjectRepeat',
  'paintInlineImageXObject',
  'paintInlineImageXObjectGroup',
  'paintImageMaskXObject',
  'paintImageMaskXObjectGroup',
  'paintImageMaskXObjectRepeat',
  'paintJpegXObject',
];
const OPS_TABLE = (pdfjsLib.OPS ?? {}) as Record<string, number | undefined>;
const IMAGE_OPS = new Set<number>(
  IMAGE_OP_NAMES.map((n) => OPS_TABLE[n]).filter((v): v is number => typeof v === 'number'),
);

function resolvePdfPath(): string {
  const fromEnv = process.env.USER_MANUAL_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_PDF;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirm(question: string, yes: boolean): Promise<boolean> {
  if (yes) return true;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

// Walk the (optional) PDF outline to map page → nearest preceding heading.
async function buildSectionMap(doc: any): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  let outline: any[] | null = null;
  try {
    outline = await doc.getOutline();
  } catch {
    outline = null;
  }
  if (!outline) return map;

  async function walk(items: any[], parentTitle = ''): Promise<void> {
    for (const item of items) {
      let pageIndex: number | null = null;
      try {
        const dest =
          typeof item.dest === 'string'
            ? await doc.getDestination(item.dest)
            : item.dest;
        if (Array.isArray(dest) && dest[0]) {
          pageIndex = await doc.getPageIndex(dest[0]);
        }
      } catch {
        pageIndex = null;
      }
      const title = item.title?.trim() || parentTitle || 'Untitled';
      if (pageIndex !== null && pageIndex >= 0) {
        const pageNum = pageIndex + 1;
        if (!map.has(pageNum)) map.set(pageNum, title);
      }
      if (item.items && item.items.length > 0) {
        await walk(item.items, title);
      }
    }
  }
  await walk(outline);
  return map;
}

function sectionForPage(map: Map<number, string>, page: number, fallback: string): string {
  let best = fallback;
  let bestPage = -1;
  for (const [p, title] of map.entries()) {
    if (p <= page && p > bestPage) {
      bestPage = p;
      best = title;
    }
  }
  return best;
}

async function extractPageText(page: any): Promise<string> {
  const tc = await page.getTextContent();
  const items: { str?: string; hasEOL?: boolean }[] = tc.items;
  const parts: string[] = [];
  for (const it of items) {
    if (typeof it.str === 'string') parts.push(it.str);
    if (it.hasEOL) parts.push('\n');
  }
  return parts.join(' ').replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
}

async function pageHasImage(page: any): Promise<boolean> {
  if (IMAGE_OPS.size === 0) return false;
  try {
    const opList = await page.getOperatorList();
    return opList.fnArray.some((fn: number) => IMAGE_OPS.has(fn));
  } catch {
    return false;
  }
}

// Copy one page (0-based index) into a fresh single-page PDF, base64-encoded.
async function singlePagePdfBase64(srcDoc: PDFDocument, pageIndex: number): Promise<string> {
  const out = await PDFDocument.create();
  const [copied] = await out.copyPages(srcDoc, [pageIndex]);
  out.addPage(copied);
  const bytes = await out.save();
  return Buffer.from(bytes).toString('base64');
}

// Caption a single page via Claude, with exponential backoff on rate/5xx errors.
// Returns '' when the page has no caption-worthy figure (model says NONE).
async function captionPage(client: Anthropic, srcDoc: PDFDocument, pageNum: number): Promise<string> {
  const b64 = await singlePagePdfBase64(srcDoc, pageNum - 1);
  let attempt = 0;
  for (;;) {
    try {
      const resp = await client.messages.create({
        model: CAPTION_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
              { type: 'text', text: CAPTION_PROMPT },
            ],
          },
        ],
      });
      const block = resp.content[0];
      const text = block && block.type === 'text' ? block.text.trim() : '';
      return text && text.toUpperCase() !== 'NONE' ? text : '';
    } catch (err: any) {
      const status: number | undefined = err?.status ?? err?.statusCode;
      attempt++;
      if (status !== undefined && (status === 429 || status === 529 || status >= 500) && attempt <= 5) {
        const delay = Math.min(30000, 1000 * 2 ** attempt);
        console.warn(`  page ${pageNum}: HTTP ${status}, retrying in ${Math.round(delay / 1000)}s (attempt ${attempt})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

// Run `worker` over items with a fixed concurrency.
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runOne = async (): Promise<void> => {
    const idx = next++;
    if (idx >= items.length) return;
    await worker(items[idx]);
    return runOne();
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runOne()));
}

// Resume support: reuse captions from a matching partial so re-runs skip done pages.
function loadExistingCaptions(sha: string): Map<number, string> {
  const m = new Map<number, string>();
  try {
    if (!fs.existsSync(PARTIAL_PATH)) return m;
    const prev = JSON.parse(fs.readFileSync(PARTIAL_PATH, 'utf8')) as ManualIndexFile;
    if (prev.manualSha256 !== sha) return m;
    for (const c of prev.chunks) {
      if (typeof c.text === 'string' && c.text.includes(CAPTION_MARKER)) m.set(c.page, c.text);
    }
  } catch {
    /* ignore a corrupt partial */
  }
  return m;
}

function writePartial(out: ManualIndexFile): void {
  fs.writeFileSync(PARTIAL_PATH, JSON.stringify(out, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes') || args.includes('-y');
  const captions = args.includes('--captions');

  const pdfPath = resolvePdfPath();
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found at ${pdfPath}. Set USER_MANUAL_PATH or drop the file in manual/.`);
    process.exit(1);
  }
  const stat = fs.statSync(pdfPath);
  if (stat.size > MAX_PDF_SIZE) {
    const mb = (stat.size / (1024 * 1024)).toFixed(1);
    console.error(`PDF is ${mb} MiB, over the 200 MiB indexing safety cap. Aborting.`);
    process.exit(1);
  }
  if (captions && !process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required for --captions. Aborting before any work.');
    process.exit(1);
  }
  console.log(`Loading PDF: ${pdfPath} (${(stat.size / (1024 * 1024)).toFixed(1)} MiB)`);

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');

  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
  }).promise;
  console.log(`PDF loaded: ${doc.numPages} pages`);

  const sectionMap = await buildSectionMap(doc);
  if (sectionMap.size > 0) {
    console.log(`Outline detected: ${sectionMap.size} heading anchors.`);
  } else {
    console.log('No outline in PDF — chunks will be labelled by page only.');
  }

  const proceed = await confirm(
    captions
      ? `Build index for ${doc.numPages} pages WITH figure captioning? (Makes one Claude call per image-bearing page.)`
      : `Build text-only index for ${doc.numPages} pages? (No API calls.)`,
    yes,
  );
  if (!proceed) {
    console.log('Aborted.');
    process.exit(0);
  }

  const chunks: ManualChunk[] = [];
  const chunkByPage = new Map<number, ManualChunk>();
  const imagePages: number[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const text = await extractPageText(page);
    const hasImage = captions ? await pageHasImage(page) : false;
    if (text || hasImage) {
      const chunk: ManualChunk = {
        id: `p${i}-c0`,
        section: sectionForPage(sectionMap, i, `Page ${i}`),
        page: i,
        text,
        imagePaths: [],
      };
      chunks.push(chunk);
      chunkByPage.set(i, chunk);
    }
    if (hasImage) imagePages.push(i);
    if (i % 25 === 0 || i === doc.numPages) {
      console.log(`  processed page ${i}/${doc.numPages} (${chunks.length} chunks, ${imagePages.length} with images)`);
    }
    // pdfjs holds page resources; release them eagerly.
    try {
      page.cleanup();
    } catch {
      /* ignore */
    }
  }

  const out: ManualIndexFile = {
    manualPath: pdfPath,
    manualSizeBytes: stat.size,
    manualSha256: sha256,
    generatedAt: new Date().toISOString(),
    chunks,
  };

  if (captions && imagePages.length > 0) {
    // Resume: pull captions from a matching partial, then only caption the rest.
    const existing = loadExistingCaptions(sha256);
    for (const [page, capturedText] of existing.entries()) {
      const chunk = chunkByPage.get(page);
      if (chunk) chunk.text = capturedText;
    }
    const todo = imagePages.filter((p) => !existing.has(p));
    console.log(
      `Captioning ${todo.length} image-bearing page(s)` +
        (existing.size ? ` (${existing.size} already done from a previous run)` : '') +
        ` at concurrency ${CAPTION_CONCURRENCY}…`,
    );

    const client = new Anthropic();
    // Re-read from disk: pdfjs may detach the `data` buffer it was given.
    const srcDoc = await PDFDocument.load(fs.readFileSync(pdfPath));
    let done = 0;
    let captioned = 0;
    await runPool(todo, CAPTION_CONCURRENCY, async (pageNum) => {
      try {
        const caption = await captionPage(client, srcDoc, pageNum);
        if (caption) {
          const chunk = chunkByPage.get(pageNum);
          if (chunk) {
            chunk.text = chunk.text ? `${chunk.text}\n\n${CAPTION_MARKER} ${caption}` : `${CAPTION_MARKER} ${caption}`;
            captioned++;
          }
        }
      } catch (err) {
        console.warn(`  page ${pageNum}: captioning failed — ${(err as Error).message}`);
      } finally {
        done++;
        if (done % 5 === 0 || done === todo.length) {
          writePartial(out);
          console.log(`  captioned ${done}/${todo.length}`);
        }
      }
    });
    console.log(`Figure captions added: ${captioned} (of ${imagePages.length} image-bearing pages).`);
  }

  // Atomic write: stage to partial, rename to final.
  out.generatedAt = new Date().toISOString();
  writePartial(out);
  fs.renameSync(PARTIAL_PATH, OUTPUT_PATH);

  const sizeMb = (fs.statSync(OUTPUT_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(`\nDone.`);
  console.log(`  chunks: ${chunks.length}`);
  console.log(`  pages with text: ${new Set(chunks.map((c) => c.page)).size} / ${doc.numPages}`);
  if (captions) console.log(`  image-bearing pages: ${imagePages.length}`);
  console.log(`  index file: ${OUTPUT_PATH} (${sizeMb} MiB)`);
  console.log(`  sha256: ${sha256.slice(0, 16)}…`);
}

main().catch((err) => {
  console.error('Indexing failed:', err);
  process.exit(1);
});
