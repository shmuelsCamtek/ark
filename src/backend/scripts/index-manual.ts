/**
 * One-shot indexer for the Camtek User Manual.
 *
 * v1: text-only extraction via pdfjs-dist. Image captioning is a planned v2;
 * see TODO blocks below. The runtime (manualIndex.ts + manualContext.ts) works
 * fully with the text-only index — image captions, when added, will just enrich
 * existing chunks.
 *
 * Run:  npm run index-manual            (interactive)
 *       npm run index-manual -- --yes   (skip prompts)
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

function resolvePdfPath(): string {
  const fromEnv = process.env.USER_MANUAL_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_PDF;
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
  // closest preceding heading
  let best = fallback;
  for (const [p, title] of map.entries()) {
    if (p <= page && (best === fallback || p > 0)) {
      // Iterate to find highest p ≤ page
      // (Map iteration order is insertion order; we collect the max ≤ page)
    }
  }
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes') || args.includes('-y');

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

  // TODO (v2): image captioning via Claude Vision. For each page with images,
  // render the page (or extract image XObjects) to PNG, then send to
  // `client.messages.create({ model: claude-sonnet-4-…, messages: [{ role: 'user',
  // content: [{ type: 'image', source: … }, { type: 'text', text: CAPTION_PROMPT }] }] })`
  // and append the caption to the chunk's text. Concurrency 3, exponential
  // backoff on rate-limit, write captions incrementally to
  // manual-index.partial.json so a re-run is resume-safe. v1 ships text-only.

  const proceed = await confirm(
    `Build text-only index for ${doc.numPages} pages? (No API calls in v1.)`,
    yes,
  );
  if (!proceed) {
    console.log('Aborted.');
    process.exit(0);
  }

  const chunks: ManualChunk[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const text = await extractPageText(page);
    if (text) {
      chunks.push({
        id: `p${i}-c0`,
        section: sectionForPage(sectionMap, i, `Page ${i}`),
        page: i,
        text,
        imagePaths: [], // populated in v2 once captioning is wired
      });
    }
    if (i % 25 === 0 || i === doc.numPages) {
      console.log(`  processed page ${i}/${doc.numPages} (${chunks.length} chunks so far)`);
    }
    // pdfjs holds page resources; release them eagerly so we don't accumulate
    // memory on a 500-page manual.
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

  // Atomic write: stage to partial, rename to final.
  fs.writeFileSync(PARTIAL_PATH, JSON.stringify(out, null, 2));
  fs.renameSync(PARTIAL_PATH, OUTPUT_PATH);

  const sizeMb = (fs.statSync(OUTPUT_PATH).size / (1024 * 1024)).toFixed(2);
  console.log(`\nDone.`);
  console.log(`  chunks: ${chunks.length}`);
  console.log(`  pages with text: ${new Set(chunks.map((c) => c.page)).size} / ${doc.numPages}`);
  console.log(`  index file: ${OUTPUT_PATH} (${sizeMb} MiB)`);
  console.log(`  sha256: ${sha256.slice(0, 16)}…`);
}

main().catch((err) => {
  console.error('Indexing failed:', err);
  process.exit(1);
});
