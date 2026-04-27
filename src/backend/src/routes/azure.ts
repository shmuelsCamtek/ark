import { Router } from 'express';
import { getWorkItem, createWorkItem, getCurrentUser } from '../services/azureDevOps.ts';

export const azureRouter = Router();

// Get current authenticated user
azureRouter.get('/me', async (_req, res) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      res.status(503).json({ error: 'Azure DevOps not configured' });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error('Azure /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Resolve a work item by ID
azureRouter.get('/workitems/:id', async (req, res) => {
  try {
    const item = await getWorkItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Work item not found' });
      return;
    }
    res.json(item);
  } catch (err) {
    console.error('Azure resolve error:', err);
    res.status(500).json({ error: 'Azure DevOps service unavailable' });
  }
});

// Create a new work item
azureRouter.post('/workitems', async (req, res) => {
  try {
    const { title, description, type, acceptanceCriteria, parentId } = req.body;
    const result = await createWorkItem({ title, description, type, acceptanceCriteria, parentId });
    res.status(201).json(result);
  } catch (err) {
    console.error('Azure create error:', err);
    res.status(500).json({ error: 'Failed to create work item' });
  }
});
