import { Client } from 'langsmith';
import { AgentRole, CLISpanPayload, ProjectTelemetry } from '@ai-dlc/sdk';
import db from '../../db/connection';
import { io } from '../../index';

export interface RecordedSpan {
  id: string;
  projectId: string;
  agentRole: AgentRole;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  timestamp: string;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private langsmithClient: Client | null = null;

  private constructor() {
    const apiKey = process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY;
    if (apiKey && apiKey !== 'your_langsmith_key_here') {
      try {
        this.langsmithClient = new Client({ apiKey });
      } catch (err) {
        console.warn('LangSmith Client init warning:', err);
      }
    }
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public async recordCLISpan(projectId: string, span: CLISpanPayload): Promise<void> {
    const id = `span_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = span.timestamp || new Date().toISOString();
    const promptTokens = span.promptTokens || 0;
    const completionTokens = span.completionTokens || 0;
    const durationMs = span.durationMs || 0;
    const agentRole = span.agentRole || 'worker';

    // 1. Salva de forma persistente no SQLite
    try {
      db.prepare(`
        INSERT INTO telemetry_spans (id, project_id, agent_role, prompt_tokens, completion_tokens, duration_ms, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, agentRole, promptTokens, completionTokens, durationMs, timestamp);
    } catch (e) {
      console.warn('Falha ao salvar telemetry span no banco:', e);
    }

    // 2. Se cliente LangSmith estiver configurado, envia span remoto
    if (this.langsmithClient) {
      try {
        await this.langsmithClient.createRun({
          name: `hivemind-${agentRole}`,
          run_type: 'llm',
          inputs: { agentRole, promptTokens },
          outputs: { completionTokens, exitCode: span.exitCode },
          start_time: new Date(timestamp).getTime(),
          end_time: Date.now(),
          extra: { projectId, durationMs },
        });
      } catch (e) {
        // Falha no envio remoto não bloqueia o fluxo local
      }
    }

    // 3. Emite métricas atualizadas via Socket.IO para o dashboard em tempo real
    const metrics = this.getProjectMetrics(projectId);
    io.to(`project_${projectId}`).emit('telemetry_updated', { telemetry: metrics });
  }

  public getProjectMetrics(projectId: string): ProjectTelemetry {
    try {
      const row = db.prepare(`
        SELECT 
          COALESCE(SUM(prompt_tokens + completion_tokens), 0) as totalTokens,
          COUNT(*) as runsCount
        FROM telemetry_spans 
        WHERE project_id = ?
      `).get(projectId) as any;

      const roles = db.prepare(`
        SELECT DISTINCT agent_role 
        FROM telemetry_spans 
        WHERE project_id = ?
      `).all(projectId) as any[];

      const totalTokens = row?.totalTokens || 0;
      const runsCount = row?.runsCount || 0;
      const activeAgents = roles.map(r => r.agent_role);

      // Estimativa de custo: $0.075 por 1M de tokens (Gemini Flash baseline)
      const estimatedCostUsd = Number(((totalTokens / 1_000_000) * 0.075).toFixed(6));

      return {
        projectId,
        totalTokens,
        estimatedCostUsd,
        runsCount,
        activeAgents,
      };
    } catch (e) {
      return {
        projectId,
        totalTokens: 0,
        estimatedCostUsd: 0,
        runsCount: 0,
        activeAgents: [],
      };
    }
  }

  public getSpans(projectId: string): RecordedSpan[] {
    try {
      const rows = db.prepare(`
        SELECT id, project_id as projectId, agent_role as agentRole, prompt_tokens as promptTokens, completion_tokens as completionTokens, duration_ms as durationMs, timestamp
        FROM telemetry_spans
        WHERE project_id = ?
        ORDER BY timestamp DESC
        LIMIT 50
      `).all(projectId) as any[];

      return rows;
    } catch (e) {
      return [];
    }
  }
}
