import { Router, Request, Response } from 'express';
import * as queries from '../db/queries';
import { io } from '../index';
import { LangGraphOrchestrator } from '../services/langgraph';

export const securityRouter = Router();

// GET /api/projects/:projectId/security - Resumo e lista de vulnerabilidades
securityRouter.get('/projects/:projectId/security', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const status = req.query.status as string | undefined;

  try {
    const summary = queries.getProjectSecuritySummary(projectId);
    res.json({ success: true, ...summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/security/findings - Cria nova vulnerabilidade
securityRouter.post('/projects/:projectId/security/findings', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const { sessionId, title, category, severity, redTeamDetails, blueTeamMitigation, status, affectedFile } = req.body;

  if (!title || !category || !severity) {
    res.status(400).json({ success: false, error: 'Título, categoria e severidade são obrigatórios.' });
    return;
  }

  try {
    const finding = queries.createSecurityFinding({
      projectId,
      sessionId,
      title,
      category,
      severity,
      redTeamDetails,
      blueTeamMitigation,
      status: status || 'open',
      affectedFile,
    });

    const summary = queries.getProjectSecuritySummary(projectId);
    io.to(`project_${projectId}`).emit('security_updated', { summary });

    res.status(201).json({ success: true, finding, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/projects/:projectId/security/findings/:findingId - Atualiza status ou mitigação
securityRouter.patch('/projects/:projectId/security/findings/:findingId', (req: Request, res: Response): void => {
  const { projectId, findingId } = req.params;
  const updates = req.body;

  try {
    const updated = queries.updateSecurityFinding(findingId, updates);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Finding não encontrado.' });
      return;
    }

    const summary = queries.getProjectSecuritySummary(projectId);
    io.to(`project_${projectId}`).emit('security_updated', { summary });

    res.json({ success: true, finding: updated, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/projects/:projectId/security/findings/:findingId
securityRouter.delete('/projects/:projectId/security/findings/:findingId', (req: Request, res: Response): void => {
  const { projectId, findingId } = req.params;

  try {
    queries.deleteSecurityFinding(findingId);
    const summary = queries.getProjectSecuritySummary(projectId);
    io.to(`project_${projectId}`).emit('security_updated', { summary });

    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/security/scan - Dispara auditoria adversarial Red Team sob demanda
securityRouter.post('/projects/:projectId/security/scan', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { sessionId } = req.body;

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    // Inicia execução assíncrona do fluxo adversarial de segurança no LangGraph
    const goal = 'Auditoria de Segurança Adversarial Red Team vs. Blue Team completa: Mapear vulnerabilidades OWASP Top 10, injeções, proteção de credenciais e sanitização.';
    
    // Dispara em background
    LangGraphOrchestrator.getInstance().startTask(
      projectId,
      `scan_${Date.now()}`,
      goal,
      5,
      sessionId || 'general',
      'auto',
      'high'
    ).catch((err: any) => {
      console.error('Erro ao executar Security Scan:', err);
    });

    res.json({
      success: true,
      message: 'Auditoria de Segurança Red Team disparada com sucesso.',
      projectId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
