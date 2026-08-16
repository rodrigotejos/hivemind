import { Client } from 'langsmith';
import { AgentRole, CLISpanPayload, ProjectTelemetry } from '@ai-dlc/sdk';

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
  private projectSpans = new Map<string, RecordedSpan[]>();

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
    const recorded: RecordedSpan = {
      id: `span_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId,
      agentRole: span.agentRole,
      promptTokens: span.promptTokens || 0,
      completionTokens: span.completionTokens || 0,
      durationMs: span.durationMs || 0,
      timestamp: span.timestamp || new Date().toISOString(),
    };

    if (!this.projectSpans.has(projectId)) {
      this.projectSpans.set(projectId, []);
    }
    this.projectSpans.get(projectId)!.push(recorded);

    // Se cliente LangSmith estiver configurado, envia span remoto
    if (this.langsmithClient) {
      try {
        await this.langsmithClient.createRun({
          name: `agy-cli-${span.agentRole}`,
          run_type: 'llm',
          inputs: { agentRole: span.agentRole, promptTokens: span.promptTokens },
          outputs: { completionTokens: span.completionTokens, exitCode: span.exitCode },
          start_time: new Date(span.timestamp).getTime(),
          end_time: Date.now(),
          extra: { projectId, durationMs: span.durationMs },
        });
      } catch (e) {
        // Falha no envio remoto não bloqueia o fluxo local
      }
    }
  }

  public getProjectMetrics(projectId: string): ProjectTelemetry {
    const spans = this.projectSpans.get(projectId) || [];
    let totalTokens = 0;
    const agents = new Set<string>();

    for (const span of spans) {
      totalTokens += (span.promptTokens + span.completionTokens);
      agents.add(span.agentRole);
    }

    // Estimativa de custo: $0.075 por 1M de tokens (Gemini Flash baseline)
    const estimatedCostUsd = Number(((totalTokens / 1_000_000) * 0.075).toFixed(6));

    return {
      projectId,
      totalTokens,
      estimatedCostUsd,
      runsCount: spans.length,
      activeAgents: Array.from(agents),
    };
  }

  public getSpans(projectId: string): RecordedSpan[] {
    return this.projectSpans.get(projectId) || [];
  }
}
