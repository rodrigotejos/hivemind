import { Router, Request, Response } from 'express';
import { ProjectSetupService } from '../services/setup';
import * as queries from '../db/queries';

export const setupRouter = Router();

// Inspecionar se o projeto tem as regras AI-DLC e MCP
setupRouter.get('/projects/:projectId/setup/status', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const project = queries.getProject(projectId);

  if (!project) {
    res.status(404).json({ error: 'Projeto não encontrado' });
    return;
  }

  const projectPath = (project as any).path || process.cwd();
  const service = ProjectSetupService.getInstance();
  const result = service.inspect(projectPath);

  res.json({ success: true, ...result, projectPath });
});

// Executar bootstrap automático das regras AI-DLC e arquivos de steering
setupRouter.post('/projects/:projectId/setup/bootstrap', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const project = queries.getProject(projectId);

  if (!project) {
    res.status(404).json({ error: 'Projeto não encontrado' });
    return;
  }

  const projectPath = (project as any).path || process.cwd();
  const service = ProjectSetupService.getInstance();
  const result = service.bootstrap(projectPath);

  res.json({ ...result });
});
