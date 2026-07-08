import { Router } from 'express';
import * as queries from '../db/queries';
import { processNewMessage } from '../services/notifier';
import { analyzeMessagePriority, updateSharedContext } from '../services/ai-manager';

const router = Router({ mergeParams: true });

// Note: req.params.projectId will only be accessible if router is created with { mergeParams: true }

router.get('/', (req, res) => {
  const { projectId } = req.params as any;
  const messages = queries.getProjectMessages(projectId);
  res.json(messages);
});

router.post('/', async (req, res) => {
  try {
    const { projectId } = req.params as any;
  // Simplistic agent auth mock
  const fromAgentId = req.headers['x-agent-key'] as string || req.body.fromAgentId; 
  const { toAgentId, threadId, type, content, metadata, waitingResponse } = req.body;
  
  if (!fromAgentId || !type || !content) {
    return res.status(400).json({ error: 'fromAgentId, type, and content are required' });
  }

  // AI Manager can classify priority dynamically
  const aiAnalysis = await analyzeMessagePriority(content, 'Project Context Mock');
  const priority = req.body.priority || aiAnalysis.priority;
  
  const message = queries.createMessage({
    projectId,
    fromAgentId,
    toAgentId,
    threadId,
    type,
    priority,
    content,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    waitingResponse
  });
  
  // Emitting the event over Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(`project_${projectId}`).emit('new_message', { message });
    processNewMessage(io, message);
  }

  // Update shared context asynchronously if important
  if (priority === 'high' || priority === 'critical' || type === 'decision' || type === 'answer' || type === 'blocker') {
    const project = queries.getProject(projectId);
    if (project) {
      updateSharedContext((project as any).shared_context || '', `Agente ${fromAgentId} [${type}]: ${content}`)
        .then(newContext => {
          queries.updateProjectContext(projectId, newContext);
        })
        .catch(e => console.error('Failed to update context', e));
    }
  }
  
    res.status(201).json(message);
  } catch (err: any) {
    console.error('Error creating message:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

router.post('/:msgId/reply', async (req, res) => {
  try {
    const { projectId, msgId } = req.params as any;
  const fromAgentId = req.headers['x-agent-key'] as string || req.body.fromAgentId; 
  const { content, metadata } = req.body;

  const originalMsg = queries.getProjectMessages(projectId).find((m: any) => m.id === msgId);
  if (originalMsg) {
    queries.updateMessage(msgId, { status: 'resolved', waiting_response: false });
  }

  const replyMessage = queries.createMessage({
    projectId,
    fromAgentId,
    toAgentId: originalMsg?.from_agent_id as string | undefined,
    threadId: (originalMsg?.thread_id || originalMsg?.id) as string | undefined,
    type: 'answer',
    priority: 'normal',
    content,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`project_${projectId}`).emit('new_message', { message: replyMessage });
    io.to(`project_${projectId}`).emit('message_updated', { messageId: msgId, status: 'resolved' });
  }

    res.status(201).json(replyMessage);
  } catch (err: any) {
    console.error('Error creating reply:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default router;
