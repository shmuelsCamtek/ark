import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ManualChunk {
  id: string;
  section: string;
  page: number;
  text: string;
  imagePaths: string[];
}

export interface ManualIndexFile {
  manualPath: string;
  manualSizeBytes: number;
  manualSha256: string;
  generatedAt: string;
  chunks: ManualChunk[];
}

const DEFAULT_INDEX_PATH = path.resolve(__dirname, '../../manual/manual-index.json');

let _attempted = false;
let _chunks: ManualChunk[] | null = null;
let _search: MiniSearch<ManualChunk> | null = null;

function indexPath(): string {
  const fromEnv = process.env.USER_MANUAL_INDEX_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_INDEX_PATH;
}

function load(): void {
  if (_attempted) return;
  _attempted = true;

  const p = indexPath();
  let raw: string;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      console.warn(
        `Manual index not found at ${p} — Ark Coach will run without product context. ` +
          `Run \`npm run index-manual\` to build it.`,
      );
    } else {
      console.warn(
        `Failed to read manual index from ${p}: ${(err as Error).message} — ` +
          `Ark Coach will run without product context.`,
      );
    }
    return;
  }

  let parsed: ManualIndexFile;
  try {
    parsed = JSON.parse(raw) as ManualIndexFile;
  } catch (err) {
    console.warn(
      `Manual index at ${p} is not valid JSON: ${(err as Error).message} — ` +
        `Ark Coach will run without product context.`,
    );
    return;
  }

  if (!Array.isArray(parsed.chunks) || parsed.chunks.length === 0) {
    console.warn(`Manual index at ${p} has no chunks — Ark Coach will run without product context.`);
    return;
  }

  const ms = new MiniSearch<ManualChunk>({
    fields: ['section', 'text'],
    storeFields: ['id', 'section', 'page', 'text', 'imagePaths'],
    searchOptions: {
      boost: { section: 2 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
  ms.addAll(parsed.chunks);

  _chunks = parsed.chunks;
  _search = ms;

  const pages = parsed.chunks.length === 0 ? 0 : Math.max(...parsed.chunks.map((c) => c.page));
  console.log(`Manual index loaded from ${p}: ${parsed.chunks.length} chunks across ${pages} pages.`);
}

export function isManualLoaded(): boolean {
  load();
  return _search !== null;
}

export function searchManual(query: string, topK = 4): ManualChunk[] {
  load();
  if (!_search || !_chunks) return [];
  const q = query.trim();
  if (!q) return [];
  const hits = _search.search(q, { combineWith: 'OR' });
  return hits.slice(0, topK) as unknown as ManualChunk[];
}

export function getManualSize(): { chunks: number; pages: number } {
  load();
  if (!_chunks) return { chunks: 0, pages: 0 };
  const pages = _chunks.length === 0 ? 0 : Math.max(..._chunks.map((c) => c.page));
  return { chunks: _chunks.length, pages };
}

// For tests / hot-reload scenarios.
export function resetManualIndexCache(): void {
  _attempted = false;
  _chunks = null;
  _search = null;
}
