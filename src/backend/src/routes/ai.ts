import { Router } from 'express';
import { chatWithCoach, suggestForField } from '../services/claude.ts';

export const aiRouter = Router();

// Chat with AI coach
aiRouter.post('/chat', async (req, res) => {
  try {
    const { messages, draftContext } = req.body;
    const response = await chatWithCoach(messages, draftContext || '');
    res.json({ text: response });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Get field-specific suggestions
aiRouter.post('/suggest', async (req, res) => {
  try {
    const { field, currentValue, draftContext } = req.body;
    const result = await suggestForField(field, currentValue || '', draftContext || '');
    res.json(result);
  } catch (err) {
    console.error('AI suggest error:', err);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});
