import { Router } from 'express';
import { scanDocument } from '../services/documentScanner.ts';

export const documentsRouter = Router();

interface StoredDocument {
  id: string;
  name: string;
  mimeType: string;
  content: string;
  scanResult?: { summary: string; acceptanceCriteria: string[]; edgeCases: string[] };
}

const documents = new Map<string, StoredDocument>();

// Upload a document (base64 content in body)
documentsRouter.post('/upload', (req, res) => {
  const { name, mimeType, content } = req.body;
  const id = crypto.randomUUID();
  const doc: StoredDocument = { id, name, mimeType, content };
  documents.set(id, doc);
  res.status(201).json({ id, name, mimeType });
});

// Scan a document with AI
documentsRouter.post('/:id/scan', async (req, res) => {
  try {
    const doc = documents.get(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    const result = await scanDocument(doc.content, doc.mimeType);
    doc.scanResult = result;
    res.json(result);
  } catch (err) {
    console.error('Document scan error:', err);
    res.status(500).json({ error: 'Document scanning failed' });
  }
});
