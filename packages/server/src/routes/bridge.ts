import { Router, Request, Response } from 'express';
import { BridgeDaemonService } from '../services/bridge';

export const bridgeRouter = Router();

// Obter status do Bridge Daemon e circuit breakers
bridgeRouter.get('/bridge/status', (req: Request, res: Response): void => {
  const daemon = BridgeDaemonService.getInstance();
  res.json({ success: true, status: daemon.getStatus() });
});

// Despachar manualmente um comando de agente via CLI
bridgeRouter.post('/projects/:projectId/bridge/dispatch', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { agentRole, agentId, prompt, timeoutMs } = req.body;

  if (!agentRole || !prompt) {
    res.status(400).json({ error: 'agentRole e prompt são obrigatórios' });
    return;
  }

  try {
    const daemon = BridgeDaemonService.getInstance();
    const result = await daemon.dispatch({
      projectId,
      agentRole,
      agentId: agentId || `${agentRole}-agent`,
      prompt,
      timeoutMs,
    });

    res.json({ success: result.success, result });
  } catch (error: any) {
    console.error('Erro ao despachar via bridge:', error);
    res.status(500).json({ error: 'Falha ao despachar subprocesso CLI', details: error.message });
  }
});
