import { Router, Request, Response } from 'express';
import * as queries from '../db/queries';
import { io } from '../index';

export const sessionsRouter = Router();

// Listar todas as sessões de tarefa de um projeto
sessionsRouter.get('/projects/:projectId/sessions', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  try {
    const sessions = queries.getProjectTaskSessions(projectId);
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar sessões', details: error.message });
  }
});

// Criar nova sessão de tarefa isolada com modelo coordenador e nível de raciocínio
sessionsRouter.post('/projects/:projectId/sessions', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const { title, goal, model, reasoningLevel } = req.body;

  if (!title) {
    res.status(400).json({ error: 'title é obrigatório' });
    return;
  }

  try {
    const session = queries.createTaskSession(
      projectId, 
      title, 
      goal, 
      model || 'auto',
      reasoningLevel || 'medium'
    );
    io.to(`project_${projectId}`).emit('session_created', session);
    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao criar sessão', details: error.message });
  }
});

// Obter detalhes de uma sessão
sessionsRouter.get('/projects/:projectId/sessions/:sessionId', (req: Request, res: Response): void => {
  const { sessionId } = req.params;
  try {
    const session = queries.getTaskSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar sessão', details: error.message });
  }
});

// Atualizar status, objetivo, modelo ou reasoning level da sessão
sessionsRouter.patch('/projects/:projectId/sessions/:sessionId', (req: Request, res: Response): void => {
  const { projectId, sessionId } = req.params;
  const updates = req.body;

  try {
    const updated = queries.updateTaskSession(sessionId, updates);
    io.to(`project_${projectId}`).emit('session_updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao atualizar sessão', details: error.message });
  }
});
