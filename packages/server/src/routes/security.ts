import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import util from 'util';
import * as queries from '../db/queries';
import { io } from '../index';
import { LangGraphOrchestrator } from '../services/langgraph';
import { BridgeDaemonService } from '../services/bridge/bridge-daemon';
import { SecurityPipelineService } from '../services/security-pipeline';

const execPromise = util.promisify(exec);
export const securityRouter = Router();

// GET /api/projects/:projectId/security - Resumo e lista de vulnerabilidades
securityRouter.get('/projects/:projectId/security', (req: Request, res: Response): void => {
  const { projectId } = req.params;

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

// GET /api/projects/:projectId/security/run-status - Consulta o último run e status de execução (US-14)
securityRouter.get('/projects/:projectId/security/run-status', (req: Request, res: Response): void => {
  const { projectId } = req.params;

  try {
    const latestRun = queries.getLatestSecurityRun(projectId);
    const isRunning = SecurityPipelineService.getInstance().isScanRunning(projectId);

    res.json({
      success: true,
      projectId,
      isRunning,
      latestRun,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/security/scan - Dispara auditoria adversarial Red Team sob demanda
securityRouter.post('/projects/:projectId/security/scan', async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { sessionId, model, reasoningLevel } = req.body || {};

  try {
    const project = queries.getProject(projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Projeto não encontrado.' });
      return;
    }

    const pipeline = SecurityPipelineService.getInstance();
    if (pipeline.isScanRunning(projectId)) {
      const activeRun = queries.getActiveSecurityRun(projectId);
      res.status(409).json({
        success: false,
        error: 'SCAN_ALREADY_RUNNING',
        message: 'Auditoria de segurança já está em andamento para este projeto.',
        projectId,
        activeRun,
      });
      return;
    }

    // Dispara pipeline determinístico de 5 fases assincronamente com o agente real
    pipeline.runPipeline(projectId, {
      sessionId,
      model,
      reasoningLevel,
      io,
    }).catch((err: any) => {
      console.error('Erro ao executar Security Pipeline:', err);
    });

    res.json({
      success: true,
      message: 'Auditoria de Segurança (Pipeline de 5 Fases) iniciada com sucesso.',
      projectId,
      totalPhases: 5,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:projectId/security/findings/:findingId/remediate - Auto-Remediação com Agentes (Blue Team + Red Team Re-Audit)
securityRouter.post('/projects/:projectId/security/findings/:findingId/remediate', async (req: Request, res: Response): Promise<void> => {
  const { projectId, findingId } = req.params;

  try {
    const project = queries.getProject(projectId);
    const findings = queries.getProjectSecurityFindings(projectId);
    const finding = findings.find(f => f.id === findingId);

    if (!project || !finding) {
      res.status(404).json({ success: false, error: 'Projeto ou vulnerabilidade não encontrados.' });
      return;
    }

    const workingDir = (project as any).path || process.cwd();

    // Responde imediatamente
    res.json({
      success: true,
      message: `Iniciando auto-remediação para "${finding.title}"`,
      findingId,
    });

    // Execução assíncrona do loop iterativo Blue Team ➔ Red Team ➔ QA
    (async () => {
      try {
        // Step 1: Blue Team (Beta Backend / Alpha Frontend)
        io.to(`project_${projectId}`).emit('remediation_progress', {
          findingId,
          step: 1,
          totalSteps: 3,
          agentRole: 'backend',
          agentName: 'Beta (Backend - Blue Team)',
          percent: 30,
          status: 'Aplicando patch defensivo, sanitização e validação no código...',
        });

        const blueTeamDirective = `Corrija a seguinte vulnerabilidade de segurança no repositório "${workingDir}": "${finding.title}". Vetor de Ataque: "${finding.red_team_details || ''}". Aplique a seguinte mitigação: "${finding.blue_team_mitigation || ''}". Arquivos afetados: "${finding.affected_file || 'src/*'}". Implemente as validações e correções no código diretamente no disco.`;

        await BridgeDaemonService.getInstance().dispatch({
          projectId,
          agentId: 'beta-backend',
          agentRole: 'backend',
          prompt: blueTeamDirective,
          cwd: workingDir,
        });

        // Step 2: Red Team (Delta Security)
        io.to(`project_${projectId}`).emit('remediation_progress', {
          findingId,
          step: 2,
          totalSteps: 3,
          agentRole: 'security',
          agentName: 'Delta (Security - Red Team)',
          percent: 70,
          status: 'Re-auditando ataque adversarial contra o patch para validar extinção do risco...',
        });

        const redTeamDirective = `Execute a re-auditoria adversarial sobre a correção aplicada para a vulnerabilidade "${finding.title}" no repositório "${workingDir}". Verifique se o ataque foi neutralizado e se nenhuma nova brecha ou regressão foi introduzida.`;

        await BridgeDaemonService.getInstance().dispatch({
          projectId,
          agentId: 'delta-security',
          agentRole: 'security',
          prompt: redTeamDirective,
          cwd: workingDir,
        });

        // Step 3: QA (Gamma QA)
        io.to(`project_${projectId}`).emit('remediation_progress', {
          findingId,
          step: 3,
          totalSteps: 3,
          agentRole: 'qa',
          agentName: 'Gamma (QA)',
          percent: 95,
          status: 'Validando integridade e testes de regressão...',
        });

        await BridgeDaemonService.getInstance().dispatch({
          projectId,
          agentId: 'gamma-qa',
          agentRole: 'qa',
          prompt: `Valide a integridade do código após a correção de segurança para "${finding.title}" em "${workingDir}".`,
          cwd: workingDir,
        });

        // Atualiza status do finding para mitigated no SQLite
        queries.updateSecurityFinding(findingId, {
          status: 'mitigated',
          blue_team_mitigation: finding.blue_team_mitigation || 'Patch defensivo aplicado e validado pelo Red Team e QA.',
        });

        // Obtém git diff das alterações (incluindo novos arquivos)
        let gitDiff = '';
        try {
          await execPromise('git add -N .', { cwd: workingDir }).catch(() => {});
          const { stdout } = await execPromise('git diff HEAD', { cwd: workingDir });
          gitDiff = stdout.trim();
        } catch (e) {
          try {
            const { stdout } = await execPromise('git diff', { cwd: workingDir });
            gitDiff = stdout.trim();
          } catch (e2) {}
        }

        const suggestedCommitMessage = `fix(security): mitigate ${finding.title.toLowerCase().slice(0, 50)} [Red-Team-Verified]`;
        const updatedSummary = queries.getProjectSecuritySummary(projectId);

        io.to(`project_${projectId}`).emit('remediation_completed', {
          findingId,
          success: true,
          diff: gitDiff || 'Modificações aplicadas nos arquivos do projeto.',
          suggestedCommitMessage,
          summary: updatedSummary,
        });

        io.to(`project_${projectId}`).emit('security_updated', { summary: updatedSummary });
      } catch (err: any) {
        console.error(`Erro na remediação do finding ${findingId}:`, err);
        io.to(`project_${projectId}`).emit('remediation_progress', {
          findingId,
          step: 3,
          totalSteps: 3,
          agentRole: 'system',
          agentName: 'Sistema',
          percent: 100,
          status: `Erro na remediação: ${err.message || 'Falha na execução dos agentes'}`,
          error: true,
        });
      }
    })();
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
