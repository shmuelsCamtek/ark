import { Router } from 'express';
import {
  listDrafts,
  getDraft,
  putDraft,
  deleteDraft as removeDraft,
  getChat,
  putChat,
  normalizeOwner,
  type StoredDraft,
  type ChatMessage,
} from '../services/draftStore.ts';
import { requireUser } from '../middleware/user.ts';

export const draftsRouter = Router();

// All draft access is scoped to the signed-in user.
draftsRouter.use(requireUser);

// Returns the draft only if it belongs to the caller, else undefined. Callers
// respond 404 for both "missing" and "not yours" so ids stay non-enumerable.
function ownedDraft(id: string, ownerEmail: string): StoredDraft | undefined {
  const draft = getDraft(id);
  if (!draft || typeof draft.ownerEmail !== 'string') return undefined;
  return normalizeOwner(draft.ownerEmail) === ownerEmail ? draft : undefined;
}

// List the caller's drafts
draftsRouter.get('/', (req, res) => {
  res.json(listDrafts(req.userEmail));
});

// Get single draft
draftsRouter.get('/:id', (req, res) => {
  const draft = ownedDraft(req.params.id, req.userEmail);
  if (!draft) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(draft);
});

// Create draft (owner is set server-side, never trusted from the client)
draftsRouter.post('/', (req, res) => {
  const draft: StoredDraft = {
    ...req.body,
    id: req.body.id || crypto.randomUUID(),
    ownerEmail: req.userEmail,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  putDraft(draft);
  res.status(201).json(draft);
});

// Update draft
draftsRouter.put('/:id', (req, res) => {
  const existing = ownedDraft(req.params.id, req.userEmail);
  if (!existing) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  const updated: StoredDraft = {
    ...existing,
    ...req.body,
    id: req.params.id,
    ownerEmail: req.userEmail,
    updatedAt: new Date().toISOString(),
  };
  putDraft(updated);
  res.json(updated);
});

// Delete draft (cascades to chat file via store)
draftsRouter.delete('/:id', (req, res) => {
  if (!ownedDraft(req.params.id, req.userEmail)) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  removeDraft(req.params.id);
  res.status(204).send();
});

// Get chat history for a draft
draftsRouter.get('/:id/chat', (req, res) => {
  if (!ownedDraft(req.params.id, req.userEmail)) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(getChat(req.params.id));
});

// Replace chat history for a draft
draftsRouter.put('/:id/chat', (req, res) => {
  if (!ownedDraft(req.params.id, req.userEmail)) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  const messages: ChatMessage[] =
    req.body && Array.isArray(req.body.messages) ? (req.body.messages as ChatMessage[]) : [];
  putChat(req.params.id, messages);
  res.status(204).send();
});
