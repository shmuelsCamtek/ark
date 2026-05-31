import { Router } from 'express';
import { chatWithCoach, suggestForField } from '../services/claude.ts';
import { generateMockup, type MockupInput } from '../services/mockupGenerator.ts';
import { draftAttachments } from '../services/attachments.ts';
import { getDraft, putDraft, normalizeOwner } from '../services/draftStore.ts';
import { isManualLoaded, getManualSize } from '../services/manualIndex.ts';
import { requireUser } from '../middleware/user.ts';

export const aiRouter = Router();

// Whether the Camtek User Manual index is loaded (so the UI can show it as
// standing coach context). No auth — just a boolean + counts.
aiRouter.get('/manual', (_req, res) => {
  const loaded = isManualLoaded();
  const { chunks, pages } = getManualSize();
  res.json({ loaded, chunks, pages });
});

// Chat with AI coach
aiRouter.post('/chat', async (req, res) => {
  try {
    const { messages, draftContext, attachments } = req.body;
    const response = await chatWithCoach(messages, draftContext || '', attachments);
    res.json(response);
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

// Generate an HTML/CSS mockup for a draft user story
aiRouter.post('/mockup', requireUser, async (req, res) => {
  const { draftId } = (req.body || {}) as { draftId?: string };
  if (!draftId) {
    res.status(400).json({ error: 'draftId is required' });
    return;
  }
  const draft = getDraft(draftId);
  if (!draft || typeof draft.ownerEmail !== 'string' || normalizeOwner(draft.ownerEmail) !== req.userEmail) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  try {
    const narrative = (draft.narrative as { asA?: string; iWantTo?: string; soThat?: string } | undefined) || {};
    const acRaw = (draft.acceptanceCriteria as Array<{ text?: string }> | undefined) || [];
    const input: MockupInput = {
      title: draft.title as string | undefined,
      background: draft.background as string | undefined,
      scenario: draft.scenario as string | undefined,
      persona: draft.persona as string | undefined,
      asA: narrative.asA,
      iWantTo: narrative.iWantTo,
      soThat: narrative.soThat,
      acceptanceCriteria: acRaw.map((c) => c.text || '').filter(Boolean),
      flow: draft.flow as string | undefined,
      workItemDescription: draft.workItemDescription as string | undefined,
      workItemReproSteps: draft.workItemReproSteps as string | undefined,
      attachments: draftAttachments(draft),
    };
    const result = await generateMockup(input);
    putDraft({ ...draft, mockup: result });
    res.json(result);
  } catch (err) {
    console.error('AI mockup error:', err);
    res.status(500).json({ error: 'Failed to generate mockup' });
  }
});
