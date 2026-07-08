import { Router } from 'express';
import { summarizeProject } from '../services/ai-manager';

const router = Router({ mergeParams: true });

router.post('/summarize', async (req, res) => {
  const { projectId } = req.params as any; // injected in index.ts similar to messages
  try {
    const summary = await summarizeProject(projectId);
    res.json({ summary });
  } catch (error) {
    console.error('Error summarizing project:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;
