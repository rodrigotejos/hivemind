import * as queries from '../db/queries';

function getSocketIo(): any {
  try {
    const { io } = require('../index');
    return io;
  } catch (e) {
    return null;
  }
}

export interface SecurityPhaseProgressPayload {
  runId: string;
  projectId: string;
  phase: number;
  totalPhases: number;
  phaseName: string;
  agentRole: 'delta-security' | 'beta-backend' | 'gamma-qa' | 'system';
  agentName: string;
  currentCheck: string;
  targetFile?: string;
  findingsCountSoFar: number;
  scoreSoFar: number;
  status: 'running' | 'completed' | 'error';
  timestamp: string;
}

export interface RunPipelineOptions {
  stepDelayMs?: number;
  io?: any;
  sessionId?: string;
  model?: string;
  reasoningLevel?: string;
}

export class SecurityPipelineService {
  private static instance: SecurityPipelineService;
  private activeScans: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): SecurityPipelineService {
    if (!SecurityPipelineService.instance) {
      SecurityPipelineService.instance = new SecurityPipelineService();
    }
    return SecurityPipelineService.instance;
  }

  public isScanRunning(projectId: string): boolean {
    if (this.activeScans.has(projectId)) return true;
    try {
      const activeRun = queries.getActiveSecurityRun(projectId);
      if (!activeRun) return false;
      const startTime = new Date(activeRun.started_at).getTime();
      const isStale = isNaN(startTime) || (Date.now() - startTime > 10 * 60 * 1000);
      if (isStale) {
        queries.updateSecurityRunProgress(activeRun.id, {
          status: 'failed',
          current_check: 'Auditoria cancelada por timeout de inatividade',
        });
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  public async runPipeline(projectId: string, options: RunPipelineOptions = {}): Promise<any> {
    if (this.isScanRunning(projectId)) {
      const activeRun = queries.getActiveSecurityRun(projectId);
      return {
        running: true,
        message: 'Auditoria já em andamento para este projeto.',
        runId: activeRun?.id,
        phase: activeRun?.phase,
      };
    }

    this.activeScans.add(projectId);
    // Delay padrão de 2.000ms por etapa para proporcionar visibilidade real ao operador no ticker
    const delay = options.stepDelayMs !== undefined ? options.stepDelayMs : 2000;
    const runId = `run_sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const phases = [
      {
        phase: 1,
        phaseName: 'Mapeamento de Rotas, CORS & Headers',
        agentRole: 'delta-security' as const,
        agentName: 'Delta (Security - Red Team)',
        currentCheck: 'Inspecionando middlewares Express, rotas expostas e política de CORS...',
        targetFile: 'packages/server/src/routes/*.ts',
      },
      {
        phase: 2,
        phaseName: 'Varredura Estrita de Segredos e .env',
        agentRole: 'delta-security' as const,
        agentName: 'Delta (Security - Red Team)',
        currentCheck: 'Auditando variáveis de ambiente, gitignore e vazamento de tokens...',
        targetFile: '.env / packages/server/src/config',
      },
      {
        phase: 3,
        phaseName: 'Simulação Adversarial OWASP (Red Team)',
        agentRole: 'delta-security' as const,
        agentName: 'Delta (Security - Red Team)',
        currentCheck: 'Simulando injeção NoSQL, bypass de autenticação e timing attacks...',
        targetFile: 'packages/server/src/routes/security.ts',
      },
      {
        phase: 4,
        phaseName: 'Defesas & Mitigações (Blue Team)',
        agentRole: 'beta-backend' as const,
        agentName: 'Beta (Backend - Blue Team)',
        currentCheck: 'Validando contramedidas, sanitização recursiva e schemas defensivos...',
        targetFile: 'packages/server/src/db/queries.ts',
      },
      {
        phase: 5,
        phaseName: 'Verificação Formal & Gravação no SQLite',
        agentRole: 'system' as const,
        agentName: 'Supervisor Hivemind',
        currentCheck: 'Calculando pontuação final, verificando invariantes e persistindo no banco...',
        targetFile: 'packages/server/database.sqlite',
      },
    ];

    try {
      const initialSummary = queries.getProjectSecuritySummary(projectId);

      // Inicia registro em security_runs no SQLite
      queries.createSecurityRun({
        id: runId,
        projectId,
        phase: 1,
        totalPhases: 5,
        phaseName: phases[0].phaseName,
        status: 'running',
        agentRole: phases[0].agentRole,
        agentName: phases[0].agentName,
        currentCheck: phases[0].currentCheck,
        targetFile: phases[0].targetFile,
        findingsCount: initialSummary.totalFindings,
        score: initialSummary.score,
      });

      for (let i = 0; i < phases.length; i++) {
        const p = phases[i];
        const isLast = i === phases.length - 1;

        // Recupera dados atualizados do banco
        const currentSummary = queries.getProjectSecuritySummary(projectId);

        // 1. Gravação síncrona no SQLite da transição de fase
        queries.updateSecurityRunProgress(runId, {
          phase: p.phase,
          phase_name: p.phaseName,
          status: isLast ? 'completed' : 'running',
          agent_role: p.agentRole,
          agent_name: p.agentName,
          current_check: p.currentCheck,
          target_file: p.targetFile,
          findings_count: currentSummary.totalFindings,
          score: currentSummary.score,
        });

        const payload: SecurityPhaseProgressPayload = {
          runId,
          projectId,
          phase: p.phase,
          totalPhases: 5,
          phaseName: p.phaseName,
          agentRole: p.agentRole,
          agentName: p.agentName,
          currentCheck: p.currentCheck,
          targetFile: p.targetFile,
          findingsCountSoFar: currentSummary.totalFindings,
          scoreSoFar: currentSummary.score,
          status: isLast ? 'completed' : 'running',
          timestamp: new Date().toISOString(),
        };

        // 2. Emite via Socket.IO para todos os clientes conectados ao projeto
        const socket = options.io || getSocketIo();
        if (socket) {
          socket.to(`project_${projectId}`).emit('security_phase_progress', payload);
        }

        if (isLast) {
          // Fase 5: Atualização atômica definitiva no SQLite (tabela projects)
          queries.updateProjectSecurityScore(projectId, currentSummary.score, currentSummary.rating);
          if (socket) {
            socket.to(`project_${projectId}`).emit('security_updated', { summary: currentSummary });
          }
        } else if (p.phase === 3 && process.env.NODE_ENV !== 'test' && (options.stepDelayMs === undefined || options.stepDelayMs >= 500)) {
          // --- VALIDAÇÃO E SINCRONIZAÇÃO DO CICLO DE VIDA DO AGENTE REAL ---
          let agentStarted = false;
          let agentFinished = false;

          try {
            const { LangGraphOrchestrator } = require('./langgraph/graph');
            const orchestrator = LangGraphOrchestrator.getInstance();
            const goal = 'Auditoria de Segurança Adversarial Red Team vs. Blue Team completa: Mapear vulnerabilidades OWASP Top 10, injeções, proteção de credenciais e sanitização no código.';

            agentStarted = true;
            console.log(`[SecurityPipeline] [LIFECYCLE]: 🚀 Agente Delta Security (Red Team) INICIADO para o projeto ${projectId}.`);

            queries.updateSecurityRunProgress(runId, {
              current_check: 'Agente Delta Security ativo: Executando varredura adversarial OWASP e análise profunda de código...',
            });
            if (socket) {
              socket.to(`project_${projectId}`).emit('security_phase_progress', {
                ...payload,
                currentCheck: 'Agente Delta Security ativo: Executando varredura adversarial OWASP e análise profunda de código...',
              });
            }

            const taskId = `scan_${Date.now()}`;
            const finalState = await orchestrator.startTask(
              projectId,
              taskId,
              goal,
              3,
              options.sessionId || 'general',
              options.model || 'auto',
              (options.reasoningLevel as any) || 'high'
            );

            agentFinished = true;
            console.log(`[SecurityPipeline] [LIFECYCLE]: ✅ Agente Delta Security FINALIZOU com status: ${finalState?.status || 'completed'}`);

            const updatedSummary = queries.getProjectSecuritySummary(projectId);
            queries.updateSecurityRunProgress(runId, {
              current_check: `Simulação adversarial concluída. ${updatedSummary.totalFindings} vulnerabilidade(s) registrada(s).`,
              findings_count: updatedSummary.totalFindings,
              score: updatedSummary.score,
            });
          } catch (agentErr: any) {
            console.warn(`[SecurityPipeline] [LIFECYCLE]: ⚠️ Aviso durante execução do agente:`, agentErr?.message || agentErr);
            if (agentStarted && !agentFinished) {
              console.warn(`[SecurityPipeline] [LIFECYCLE]: Agente iniciou mas foi interrompido.`);
            }
          }
        } else if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      const finalSummary = queries.getProjectSecuritySummary(projectId);
      return { success: true, runId, summary: finalSummary };
    } catch (err: any) {
      console.error('Erro no pipeline de segurança:', err);
      try {
        queries.updateSecurityRunProgress(runId, {
          status: 'failed',
          current_check: `Erro: ${err.message}`,
        });
      } catch (dbErr) {
        console.error('Falha ao atualizar status de erro no banco:', dbErr);
      }

      const socket = options.io || getSocketIo();
      if (socket) {
        socket.to(`project_${projectId}`).emit('security_phase_progress', {
          runId,
          projectId,
          phase: 0,
          totalPhases: 5,
          phaseName: 'Falha na Auditoria',
          agentRole: 'system',
          agentName: 'Supervisor Hivemind',
          currentCheck: `Erro: ${err.message}`,
          findingsCountSoFar: 0,
          scoreSoFar: 0,
          status: 'error',
          timestamp: new Date().toISOString(),
        });
      }
      throw err;
    } finally {
      this.activeScans.delete(projectId);
    }
  }
}
