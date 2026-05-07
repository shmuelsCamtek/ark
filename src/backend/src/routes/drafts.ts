import { Router } from 'express';
import {
  listDrafts,
  getDraft,
  putDraft,
  deleteDraft as removeDraft,
  getChat,
  putChat,
  type StoredDraft,
  type ChatMessage,
} from '../services/draftStore.ts';

export const draftsRouter = Router();

// List all drafts
draftsRouter.get('/', (_req, res) => {
  res.json(listDrafts());
});

// Get single draft
draftsRouter.get('/:id', (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(draft);
});

// Create draft
draftsRouter.post('/', (req, res) => {
  const draft: StoredDraft = {
    ...req.body,
    id: req.body.id || crypto.randomUUID(),
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  putDraft(draft);
  res.status(201).json(draft);
});

// Update draft
draftsRouter.put('/:id', (req, res) => {
  const existing = getDraft(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  const updated: StoredDraft = {
    ...existing,
    ...req.body,
    id: req.params.id,
    updatedAt: new Date().toISOString(),
  };
  putDraft(updated);
  res.json(updated);
});

// Delete draft (cascades to chat file via store)
draftsRouter.delete('/:id', (req, res) => {
  if (!getDraft(req.params.id)) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  removeDraft(req.params.id);
  res.status(204).send();
});

// Get chat history for a draft
draftsRouter.get('/:id/chat', (req, res) => {
  if (!getDraft(req.params.id)) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(getChat(req.params.id));
});

// Replace chat history for a draft
draftsRouter.put('/:id/chat', (req, res) => {
  if (!getDraft(req.params.id)) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  const messages: ChatMessage[] =
    req.body && Array.isArray(req.body.messages) ? (req.body.messages as ChatMessage[]) : [];
  putChat(req.params.id, messages);
  res.status(204).send();
});
