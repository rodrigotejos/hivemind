import { Router, Request, Response } from 'express';
import * as queries from '../db/queries';
import { GitSupervisor } from '../services/git-supervisor';
import { io } from '../index';

export const gitRouter = Router();

// GET /api/projects/:projectId/git/diff - Retorna git diff, contadores e verificação de segurança
gitRouter.get('/projects/:projectId/git/diff', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { taskTitle } = req.query as { taskTitle?: string };

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();
    const gitSupervisor = GitSupervisor.getInstance();
    const analysis = await gitSupervisor.getDiff(workingDir, taskTitle);

    res.json({
      success: true,
      hasChanges: analysis.hasChanges,
      filesChanged: analysis.filesChanged,
      diff: analysis.diff,
      totalAdditions: analysis.totalAdditions,
      totalDeletions: analysis.totalDeletions,
      suggestedMessage: analysis.suggestedMessage,
      sensitiveFilesDetected: analysis.sensitiveFilesDetected,
      isBlocked: analysis.isBlocked,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/git/commit - Executa commit com validações e proteção anti-injection
gitRouter.post('/projects/:projectId/git/commit', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { message, operator } = req.body;

  if (!message || !message.trim()) {
    res.status(400).json({ success: false, error: 'Mensagem de commit é obrigatória.' });
    return;
  }

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();
    const gitSupervisor = GitSupervisor.getInstance();
    const result = await gitSupervisor.commitChanges(workingDir, message, operator || 'Human Supervisor');

    // Emite evento para todos os clientes conectados ao Cockpit
    io.to(`project_${projectId}`).emit('commit_completed', {
      projectId,
      commitHash: result.commitHash,
      message,
      filesCount: result.filesCount,
      timestamp: result.timestamp,
    });
    io.to(`project_${projectId}`).emit('git_status_changed', { hasChanges: false, count: 0 });

    res.json(result);
  } catch (err: any) {
    const isSensitive = err.message?.includes('SENSITIVE_FILE_VIOLATION');
    const statusCode = isSensitive ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Falha ao executar commit no repositório.',
      code: isSensitive ? 'SENSITIVE_FILE_VIOLATION' : 'COMMIT_FAILED',
    });
  }
});

// POST /api/projects/:projectId/git/reject - Rejeita alterações com backup resiliente
gitRouter.post('/projects/:projectId/git/reject', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { reason, operator } = req.body;

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();
    const gitSupervisor = GitSupervisor.getInstance();
    const result = await gitSupervisor.rejectChanges(workingDir, reason, operator || 'Human Supervisor');

    // Emite evento para todos os clientes informando a branch de backup preservada
    io.to(`project_${projectId}`).emit('commit_rejected', {
      projectId,
      backupBranch: result.backupBranch,
      reason,
      timestamp: result.timestamp,
    });
    io.to(`project_${projectId}`).emit('git_status_changed', { hasChanges: false, count: 0 });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Falha ao rejeitar alterações no repositório.',
    });
  }
});

// POST /api/projects/:projectId/git/review-request - Solicita revisão de diff ao Cockpit
gitRouter.post('/projects/:projectId/git/review-request', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { taskTitle, taskId } = req.body;

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();
    const gitSupervisor = GitSupervisor.getInstance();
    const analysis = await gitSupervisor.getDiff(workingDir, taskTitle);

    if (analysis.hasChanges) {
      io.to(`project_${projectId}`).emit('commit_review_requested', {
        projectId,
        taskId,
        taskTitle,
        hasChanges: analysis.hasChanges,
        filesChanged: analysis.filesChanged,
        diff: analysis.diff,
        totalAdditions: analysis.totalAdditions,
        totalDeletions: analysis.totalDeletions,
        suggestedMessage: analysis.suggestedMessage,
        sensitiveFilesDetected: analysis.sensitiveFilesDetected,
        isBlocked: analysis.isBlocked,
      });
      io.to(`project_${projectId}`).emit('git_status_changed', {
        hasChanges: true,
        count: analysis.filesChanged.length,
      });
    }

    res.json({ success: true, analysis });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
