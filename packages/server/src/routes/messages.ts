import { Router } from 'express';
import * as queries from '../db/queries';
import { processNewMessage } from '../services/notifier';
import { analyzeMessagePriority, updateSharedContext } from '../services/ai-manager';
import { LangGraphOrchestrator } from '../services/langgraph';

const router = Router({ mergeParams: true });

// Note: req.params.projectId will only be accessible if router is created with { mergeParams: true }

router.get('/', (req, res) => {
  const { projectId } = req.params as any;
  const { threadId } = req.query as { threadId?: string };
  const messages = queries.getProjectMessages(projectId, threadId);
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

    const priority = req.body.priority || 'normal';
    
    // 1. Persiste a mensagem imediatamente no SQLite
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
    
    // 2. Emite o evento Socket.IO imediatamente para a UI atualizar em <5ms
    const io = req.app.get('io');
    if (io) {
      io.to(`project_${projectId}`).emit('new_message', { message });
      processNewMessage(io, message);
    }

    // 3. Retorna resposta HTTP 201 imediatamente (sem bloquear na LLM)
    res.status(201).json(message);

    // 4. Executa triagem e atualização de contexto assincronamente em background
    (async () => {
      try {
        const aiAnalysis = await analyzeMessagePriority(content, 'Project Context Mock');
        if (aiAnalysis && aiAnalysis.priority && aiAnalysis.priority !== priority && message && message.id) {
          queries.updateMessage(String(message.id), { priority: aiAnalysis.priority });
          if (io) {
            io.to(`project_${projectId}`).emit('message_updated', { messageId: String(message.id), priority: aiAnalysis.priority });
          }
        }

        const effectivePriority = aiAnalysis?.priority || priority;
        if (effectivePriority === 'high' || effectivePriority === 'critical' || type === 'decision' || type === 'answer' || type === 'blocker') {
          const project = queries.getProject(projectId);
          if (project) {
            const newContext = await updateSharedContext((project as any).shared_context || '', `Agente ${fromAgentId} [${type}]: ${content}`);
            queries.updateProjectContext(projectId, newContext);
            if (io) {
              io.to(`project_${projectId}`).emit('project_updated', { project: queries.getProject(projectId) });
            }
          }
        }
      } catch (e) {
        console.error('Falha na triagem de prioridade em background:', e);
      }
    })();

    // 5. Se a mensagem foi enviada por um usuário humano, dispara autonomamente o orquestrador LangGraph
    const isHumanUser = !['alpha-frontend', 'beta-backend', 'gamma-qa', 'delta-security', 'epsilon-infra', 'supervisor'].includes(fromAgentId);
    if (isHumanUser) {
      (async () => {
        try {
          const orchestrator = LangGraphOrchestrator.getInstance();
          const activeSession = threadId && threadId !== 'general' ? queries.getTaskSession(threadId) : null;
          const currentState = orchestrator.getState(projectId, threadId);

          if (currentState && currentState.status === 'waiting_human' && currentState.pendingDecision) {
            // Se o fluxo estava aguardando uma decisão humana, retoma o grafo com a resposta
            const finalState = await orchestrator.resumeTask(projectId, currentState.pendingDecision.checkpointId, content, threadId);
            if (io) {
              io.to(`project_${projectId}`).emit('graph_state_updated', { ...finalState, sessionId: threadId });
            }
          } else {
            // Inicia nova tarefa no grafo com o objetivo solicitado pelo usuário
            const model = (activeSession as any)?.model || 'auto';
            const reasoningLevel = ((activeSession as any)?.reasoning_level as any) || 'medium';
            const maxTurns = 5;

            const finalState = await orchestrator.startTask(
              projectId,
              `task_${Date.now()}`,
              content,
              maxTurns,
              threadId,
              model,
              reasoningLevel
            );

            if (io) {
              io.to(`project_${projectId}`).emit('graph_state_updated', { ...finalState, sessionId: threadId });
            }
          }
        } catch (dispatchErr: any) {
          console.error('Erro ao executar tarefa de mensagem no LangGraph:', dispatchErr);
        }
      })();
    }
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
