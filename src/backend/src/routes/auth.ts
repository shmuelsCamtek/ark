import { Router } from 'express';
import { startDeviceFlow, pollDeviceFlow, getProfile, signOut } from '../services/auth.ts';

export const authRouter = Router();

authRouter.get('/me', (_req, res) => {
  const profile = getProfile();
  if (!profile) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(profile);
});

authRouter.post('/device/start', async (_req, res) => {
  try {
    const result = await startDeviceFlow();
    res.json(result);
  } catch (err) {
    console.error('[auth] device/start failed', err);
    res.status(500).json({ error: 'Failed to start device flow' });
  }
});

authRouter.post('/device/poll', async (_req, res) => {
  try {
    const result = await pollDeviceFlow();
    res.json(result);
  } catch (err) {
    console.error('[auth] device/poll failed', err);
    res.status(500).json({ error: 'Polling failed' });
  }
});

authRouter.post('/logout', (_req, res) => {
  signOut();
  res.status(204).send();
});
