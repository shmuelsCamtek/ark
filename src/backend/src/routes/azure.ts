import { Router, type Request, type Response, type NextFunction } from 'express';
import { getWorkItemGraph, createWorkItem, searchWorkItems } from '../services/azureDevOps.ts';
import { getAccessToken } from '../services/auth.ts';

export const azureRouter = Router();

declare module 'express-serve-static-core' {
  interface Request {
    azureDevOpsToken?: string;
  }
}

async function withAzureToken(req: Request, res: Response, next: NextFunction) {
  const token = await getAccessToken();
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  req.azureDevOpsToken = token;
  next();
}

azureRouter.use(withAzureToken);

// Search work items by title or ID
azureRouter.get('/workitems', async (req, res) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (!q || q.length < 2) { res.json([]); return; }
    const results = await searchWorkItems(q, req.azureDevOpsToken!, 15);
    res.json(results);
  } catch (err) {
    console.error('Azure search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Resolve a work item by ID, including its discussion and a 3-hop linked-item graph
azureRouter.get('/workitems/:id', async (req, res) => {
  try {
    const item = await getWorkItemGraph(req.params.id, req.azureDevOpsToken!);
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
    const result = await createWorkItem(
      { title, description, type, acceptanceCriteria, parentId },
      req.azureDevOpsToken!,
    );
    res.status(201).json(result);
  } catch (err) {
    console.error('Azure create error:', err);
    res.status(500).json({ error: 'Failed to create work item' });
  }
});
