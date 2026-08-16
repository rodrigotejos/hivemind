import { Router, Request, Response } from 'express';
import { LangGraphOrchestrator } from '../services/langgraph';
import { io } from '../index';

export const orchestratorRouter = Router();

// Iniciar tarefa autônoma
orchestratorRouter.post('/:projectId/graph/start', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { taskId, goal, maxTurns } = req.body;

  if (!goal) {
    res.status(400).json({ error: 'goal é obrigatório' });
    return;
  }

  try {
    const orchestrator = LangGraphOrchestrator.getInstance();
    const finalState = await orchestrator.startTask(
      projectId,
      taskId || `task_${Date.now()}`,
      goal,
      maxTurns || 5
    );

    // Emite status para a sala do projeto no Socket.IO
    io.to(`project_${projectId}`).emit('graph_state_updated', finalState);

    res.json({ success: true, state: finalState });
  } catch (error: any) {
    console.error('Erro ao iniciar LangGraph:', error);
    res.status(500).json({ error: 'Falha ao executar grafo de agentes', details: error.message });
  }
});

// Retomar tarefa pausada após decisão humana
orchestratorRouter.post('/:projectId/graph/resume', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { checkpointId, decision } = req.body;

  if (!decision) {
    res.status(400).json({ error: 'decision é obrigatório' });
    return;
  }

  try {
    const orchestrator = LangGraphOrchestrator.getInstance();
    const finalState = await orchestrator.resumeTask(projectId, checkpointId || '', decision);

    io.to(`project_${projectId}`).emit('graph_state_updated', finalState);

    res.json({ success: true, state: finalState });
  } catch (error: any) {
    console.error('Erro ao retomar LangGraph:', error);
    res.status(500).json({ error: 'Falha ao retomar grafo de agentes', details: error.message });
  }
});

// Obter estado atual do grafo
orchestratorRouter.get('/:projectId/graph/state', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const orchestrator = LangGraphOrchestrator.getInstance();
  const state = orchestrator.getState(projectId);

  if (!state) {
    res.json({ status: 'idle', messages: [] });
    return;
  }

  res.json({ success: true, state });
});
