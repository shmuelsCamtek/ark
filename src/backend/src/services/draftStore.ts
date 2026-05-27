import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : DEFAULT_DATA_DIR;
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');
const CHATS_DIR = path.join(DATA_DIR, 'chats');

export function normalizeOwner(email: string): string {
  return email.trim().toLowerCase();
}

// Pre-ownership drafts get assigned to this account on first load so they stay
// visible to it (and no one else). Override via env if needed.
const LEGACY_OWNER_EMAIL = normalizeOwner(process.env.LEGACY_OWNER_EMAIL || 'shmuels@camtek.com');

export interface StoredDraft {
  id: string;
  ownerEmail?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text?: string;
  kind?: 'suggestions' | 'criteria-bundle' | 'ack' | 'quiz';
  intro?: string;
  field?: string;
  options?: string[];
  quizQuestion?: string;
  quizAnswered?: boolean;
  quizAnswer?: string;
  bundleResolved?: boolean;
  appliedOptionIndices?: number[];
}

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CHATS_DIR)) fs.mkdirSync(CHATS_DIR, { recursive: true });
}

const drafts = new Map<string, StoredDraft>();

function load(): void {
  ensureDirs();
  if (!fs.existsSync(DRAFTS_FILE)) return;
  try {
    const raw = fs.readFileSync(DRAFTS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoredDraft[];
    drafts.clear();
    let backfilled = 0;
    for (const d of parsed) {
      if (!d || typeof d.id !== 'string') continue;
      // One-time migration: stamp pre-ownership drafts so they aren't orphaned.
      if (typeof d.ownerEmail !== 'string' || !d.ownerEmail.trim()) {
        d.ownerEmail = LEGACY_OWNER_EMAIL;
        backfilled++;
      } else {
        d.ownerEmail = normalizeOwner(d.ownerEmail);
      }
      drafts.set(d.id, d);
    }
    if (backfilled > 0) {
      console.log(`[draftStore] backfilled ownerEmail on ${backfilled} draft(s) → ${LEGACY_OWNER_EMAIL}`);
      persist();
    }
  } catch (err) {
    console.error('[draftStore] failed to load drafts.json', err);
  }
}

// Atomic rewrite: write tmp → rename. Avoids partial files if the process dies mid-write.
function persist(): void {
  ensureDirs();
  const tmp = `${DRAFTS_FILE}.tmp`;
  const list = Array.from(drafts.values());
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, DRAFTS_FILE);
}

function chatPath(id: string): string {
  return path.join(CHATS_DIR, `${id}.json`);
}

load();

export function listDrafts(ownerEmail: string): StoredDraft[] {
  const owner = normalizeOwner(ownerEmail);
  return Array.from(drafts.values()).filter(
    (d) => typeof d.ownerEmail === 'string' && normalizeOwner(d.ownerEmail) === owner,
  );
}

export function getDraft(id: string): StoredDraft | undefined {
  return drafts.get(id);
}

export function putDraft(draft: StoredDraft): StoredDraft {
  drafts.set(draft.id, draft);
  persist();
  return draft;
}

export function deleteDraft(id: string): boolean {
  const had = drafts.delete(id);
  if (had) persist();
  const cp = chatPath(id);
  if (fs.existsSync(cp)) {
    try {
      fs.unlinkSync(cp);
    } catch (err) {
      console.error('[draftStore] failed to delete chat file', err);
    }
  }
  return had;
}

export function getChat(id: string): { messages: ChatMessage[] } {
  const cp = chatPath(id);
  if (!fs.existsSync(cp)) return { messages: [] };
  try {
    const raw = fs.readFileSync(cp, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.messages)) {
      return { messages: parsed.messages as ChatMessage[] };
    }
  } catch (err) {
    console.error('[draftStore] failed to load chat', err);
  }
  return { messages: [] };
}

export function putChat(id: string, messages: ChatMessage[]): void {
  ensureDirs();
  const cp = chatPath(id);
  const tmp = `${cp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ messages }, null, 2), 'utf8');
  fs.renameSync(tmp, cp);
}
