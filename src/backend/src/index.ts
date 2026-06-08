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
import { isManualLoaded, getManualSize } from './services/manualIndex.ts';
import { sessionMiddleware } from './middleware/session.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(sessionMiddleware);

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

// Warm up the manual index and record its status in the startup audit log.
// (manualIndex.ts also logs the resolved path / failure detail separately.)
if (isManualLoaded()) {
  const { chunks, pages } = getManualSize();
  console.log(`[startup] User Manual index loaded: ${chunks} chunks across ${pages} pages.`);
} else {
  console.warn('[startup] User Manual index NOT loaded — Ark Coach will run without product context.');
}

// Without ANTHROPIC_API_KEY the SDK throws "Could not resolve authentication
// method" from inside every coach / doc-scan / mockup request — opaque 500s
// with no startup signal. Surface it once, loudly, at boot.
if (!process.env.ANTHROPIC_API_KEY?.trim()) {
  console.warn(
    '[startup] ANTHROPIC_API_KEY is not set — coach chat, attachment scan, ' +
    'and mockup generation will all 500. Add it to .env (or NSSM ' +
    'AppEnvironmentExtra) and restart the service.',
  );
}

app.listen(PORT, () => {
  console.log(`Ark server listening on port ${PORT}`);
});
