import { Router, Request, Response } from 'express';
import { TelemetryService } from '../services/telemetry';

export const telemetryRouter = Router();

// Obter resumo de telemetria e tokens do projeto
telemetryRouter.get('/projects/:projectId/telemetry', (req: Request, res: Response): void => {
  const { projectId } = req.params;
  const service = TelemetryService.getInstance();
  const metrics = service.getProjectMetrics(projectId);
  const spans = service.getSpans(projectId);

  res.json({ success: true, telemetry: metrics, spans: spans.slice(-50) });
});

// Registrar span de execução
telemetryRouter.post('/projects/:projectId/telemetry/span', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { agentRole, promptTokens, completionTokens, durationMs, exitCode } = req.body;

  if (!agentRole) {
    res.status(400).json({ error: 'agentRole é obrigatório' });
    return;
  }

  try {
    const service = TelemetryService.getInstance();
    await service.recordCLISpan(projectId, {
      agentRole,
      promptTokens: Number(promptTokens) || 0,
      completionTokens: Number(completionTokens) || 0,
      durationMs: Number(durationMs) || 0,
      exitCode: Number(exitCode) || 0,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao registrar telemetria', details: error.message });
  }
});
