import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { draftsRouter } from './routes/drafts.ts';
import { aiRouter } from './routes/ai.ts';
import { azureRouter } from './routes/azure.ts';
import { authRouter } from './routes/auth.ts';
import { documentsRouter } from './routes/documents.ts';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/drafts', draftsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/azure', azureRouter);
app.use('/api/documents', documentsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Ark backend listening on http://localhost:${PORT}`);
});
