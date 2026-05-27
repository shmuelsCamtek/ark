import { Router } from 'express';
import {
  getGraphAccessToken,
  GraphConsentRequiredError,
  GraphLoginRequiredError,
  startGraphDeviceFlow,
  pollGraphDeviceFlow,
} from '../services/auth.ts';
import { resolveSiteId, ensureFolder, uploadHtml } from '../services/sharepoint.ts';

export const sharepointRouter = Router();

const FILENAME_RE = /^[\w.\- @]+\.html$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

sharepointRouter.post('/login/start', async (req, res) => {
  try {
    const info = await startGraphDeviceFlow(req.sessionId);
    res.json(info);
  } catch (err) {
    console.error('[sharepoint] login start failed', err);
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to start Graph login' });
  }
});

sharepointRouter.post('/login/poll', async (req, res) => {
  try {
    const result = await pollGraphDeviceFlow(req.sessionId);
    res.json(result);
  } catch (err) {
    console.error('[sharepoint] login poll failed', err);
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to poll Graph login' });
  }
});

sharepointRouter.post('/publish', async (req, res) => {
  const siteUrl = process.env.SHAREPOINT_SITE_URL;
  if (!siteUrl) {
    res.status(500).json({ error: 'SHAREPOINT_SITE_URL is not configured' });
    return;
  }

  const { html, filename, folderName } = (req.body || {}) as {
    html?: string;
    filename?: string;
    folderName?: string;
  };
  if (!html || !filename || !folderName) {
    res.status(400).json({ error: 'html, filename, and folderName are required' });
    return;
  }
  if (!FILENAME_RE.test(filename)) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  if (!EMAIL_RE.test(folderName)) {
    res.status(400).json({ error: 'folderName must be an email' });
    return;
  }
  if (html.length > 4 * 1024 * 1024) {
    res.status(413).json({ error: 'HTML exceeds 4 MB upload limit' });
    return;
  }

  let token: string;
  try {
    token = await getGraphAccessToken(req.sessionId);
  } catch (err) {
    if (err instanceof GraphLoginRequiredError) {
      res.status(401).json({ error: 'graph_login_required' });
      return;
    }
    if (err instanceof GraphConsentRequiredError) {
      res.status(403).json({
        error: 'graph_consent_required',
        message: err.description,
      });
      return;
    }
    console.error('[sharepoint] graph token failed', err);
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to acquire Graph token',
    });
    return;
  }

  try {
    const siteId = await resolveSiteId(siteUrl, token);
    await ensureFolder(siteId, folderName, token);
    const uploaded = await uploadHtml(siteId, folderName, filename, html, token);
    res.json({ webUrl: uploaded.webUrl });
  } catch (err) {
    console.error('[sharepoint] publish failed', err);
    res.status(502).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});
