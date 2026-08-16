import { Router, Request, Response } from 'express';
import { CloudSnapshotService } from '../services/backup';

export const snapshotRouter = Router();

// Listar snapshots de um projeto
snapshotRouter.get('/projects/:projectId/snapshots', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const service = CloudSnapshotService.getInstance();
  const list = service.listSnapshots(projectId);

  res.json({ success: true, snapshots: list });
});

// Criar novo snapshot (backup)
snapshotRouter.post('/projects/:projectId/snapshots', (req: Request, res: Response): void => {
  const { projectId } = req.params;

  try {
    const service = CloudSnapshotService.getInstance();
    const metadata = service.createSnapshot(projectId);

    res.json({ success: true, snapshot: metadata });
  } catch (error: any) {
    console.error('Erro ao criar snapshot:', error);
    res.status(500).json({ error: 'Falha ao criar snapshot', details: error.message });
  }
});

// Restaurar projeto a partir de snapshot
snapshotRouter.post('/projects/:projectId/snapshots/restore', (req: Request, res: Response): void => {
  const { snapshotId } = req.body;

  if (!snapshotId) {
    res.status(400).json({ error: 'snapshotId é obrigatório' });
    return;
  }

  try {
    const service = CloudSnapshotService.getInstance();
    const result = service.restoreSnapshot(snapshotId);

    res.json({ ...result });
  } catch (error: any) {
    console.error('Erro ao restaurar snapshot:', error);
    res.status(500).json({ error: 'Falha ao restaurar snapshot', details: error.message });
  }
});
