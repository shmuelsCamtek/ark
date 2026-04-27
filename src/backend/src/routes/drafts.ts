import { Router } from 'express';

interface StoredDraft {
  id: string;
  [key: string]: unknown;
}

// In-memory store — will be replaced with Cosmos DB
const drafts = new Map<string, StoredDraft>();

export const draftsRouter = Router();

// List all drafts
draftsRouter.get('/', (_req, res) => {
  res.json(Array.from(drafts.values()));
});

// Get single draft
draftsRouter.get('/:id', (req, res) => {
  const draft = drafts.get(req.params.id);
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  drafts.set(draft.id, draft);
  res.status(201).json(draft);
});

// Update draft
draftsRouter.put('/:id', (req, res) => {
  const existing = drafts.get(req.params.id);
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
  drafts.set(req.params.id, updated);
  res.json(updated);
});

// Delete draft
draftsRouter.delete('/:id', (req, res) => {
  if (!drafts.has(req.params.id)) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  drafts.delete(req.params.id);
  res.status(204).send();
});
