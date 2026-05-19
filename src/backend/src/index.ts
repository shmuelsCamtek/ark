import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { draftsRouter } from './routes/drafts.ts';
import { aiRouter } from './routes/ai.ts';
import { azureRouter } from './routes/azure.ts';
import { authRouter } from './routes/auth.ts';
import { documentsRouter } from './routes/documents.ts';
import { sharepointRouter } from './routes/sharepoint.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/drafts', draftsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/azure', azureRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/sharepoint', sharepointRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static frontend (production). CI populates ../public from src/frontend/dist.
// In local dev with Vite on :5173 this folder may not exist — express.static
// silently no-ops and the Vite proxy handles /api.
const STATIC_DIR = path.resolve(__dirname, '../public');
app.use(express.static(STATIC_DIR));

// SPA fallback so HTML5 pushState routes work on hard refresh / deep links.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ark server listening on port ${PORT}`);
});
