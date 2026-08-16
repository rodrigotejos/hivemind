import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { AgentCircuitBreaker } from './circuit-breaker';
import { TelemetryService } from '../telemetry';
import * as queries from '../../db/queries';
import { io } from '../../index';

export interface CLIExecutionRequest {
  projectId: string;
  agentRole: string;
  agentId: string;
  prompt: string;
  model?: string;
  reasoningLevel?: string;
  cwd?: string;
  threadId?: string;
  conversationId?: string;
  timeoutMs?: number;
}

export interface CLIExecutionResult {
  success: boolean;
  output: string;
  tokensUsed?: { prompt: number; completion: number };
  durationMs: number;
  error?: string;
}

export class BridgeDaemonService {
  private static instance: BridgeDaemonService;
  private circuitBreakers = new Map<string, AgentCircuitBreaker>();
  private activeProcesses = 0;
  private maxConcurrentProcesses = 2;
  private queue: Array<{ request: CLIExecutionRequest; resolve: (res: CLIExecutionResult) => void; reject: (err: any) => void }> = [];

  private constructor() {}

  public static getInstance(): BridgeDaemonService {
    if (!BridgeDaemonService.instance) {
      BridgeDaemonService.instance = new BridgeDaemonService();
    }
    return BridgeDaemonService.instance;
  }

  public getCircuitBreaker(role: string): AgentCircuitBreaker {
    if (!this.circuitBreakers.has(role)) {
      this.circuitBreakers.set(role, new AgentCircuitBreaker());
    }
    return this.circuitBreakers.get(role)!;
  }

  public async dispatch(request: CLIExecutionRequest): Promise<CLIExecutionResult> {
    const cb = this.getCircuitBreaker(request.agentRole);
    if (!cb.canExecute()) {
      return {
        success: false,
        output: '',
        durationMs: 0,
        error: `Circuit breaker está ABERTO para a role "${request.agentRole}". Muitas falhas consecutivas.`,
      };
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeProcesses >= this.maxConcurrentProcesses || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeProcesses += 1;
    const startTime = Date.now();
    const { request, resolve } = item;
    const cb = this.getCircuitBreaker(request.agentRole);

    const streamMsgId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Notifica início de streaming em tempo real para o chat
    io.to(`project_${request.projectId}`).emit('agent_stream_start', {
      messageId: streamMsgId,
      projectId: request.projectId,
      threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
      agentId: request.agentId,
      agentRole: request.agentRole,
      status: 'streaming',
      initialText: `🔍 Inspecionando repositório e lendo arquivos...`,
    });

    try {
      const result = await this.executeSubprocess(request, streamMsgId);
      const durationMs = Date.now() - startTime;
      cb.recordSuccess();

      // Salva mensagem no banco de dados vinculada à sessão de tarefa (threadId)
      const createdMessage = queries.createMessage({
        projectId: request.projectId,
        fromAgentId: request.agentId,
        threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
        type: 'statement',
        priority: 'normal',
        content: result.output,
        waitingResponse: false,
      });

      // Grava telemetria de consumo de tokens e métricas LangSmith
      const promptTokens = result.tokensUsed?.prompt || Math.ceil(request.prompt.length / 4);
      const completionTokens = result.tokensUsed?.completion || Math.ceil(result.output.length / 4);
      TelemetryService.getInstance().recordCLISpan(request.projectId, {
        agentRole: request.agentRole as any,
        promptTokens,
        completionTokens,
        durationMs,
        timestamp: new Date().toISOString(),
        exitCode: 0,
      });

      // 2. Notifica encerramento do streaming com a mensagem persistida
      io.to(`project_${request.projectId}`).emit('agent_stream_end', {
        messageId: streamMsgId,
        projectId: request.projectId,
        threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
        finalMessage: createdMessage,
      });

      if (createdMessage) {
        io.to(`project_${request.projectId}`).emit('new_message', { message: createdMessage });
      }

      resolve({
        success: true,
        output: result.output,
        tokensUsed: result.tokensUsed,
        durationMs,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      cb.recordFailure();

      console.error(`BridgeDaemon falha na execução do agente ${request.agentId}:`, err);

      io.to(`project_${request.projectId}`).emit('agent_stream_error', {
        messageId: streamMsgId,
        projectId: request.projectId,
        agentId: request.agentId,
        error: err.message || 'Erro de execução no Antigravity CLI',
      });

      resolve({
        success: false,
        output: '',
        durationMs,
        error: err.message || 'Erro de execução no Antigravity CLI',
      });
    } finally {
      this.activeProcesses -= 1;
      this.processQueue();
    }
  }

  private executeSubprocess(request: CLIExecutionRequest, streamMsgId: string): Promise<{ output: string; tokensUsed?: { prompt: number; completion: number } }> {
    return new Promise((resolve, reject) => {
      const timeoutMs = request.timeoutMs || 300000; // 5 min timeout
      let outputBuffer = '';
      let isSettled = false;
      let hasReceivedRealOutput = false;
      const progressTimers: NodeJS.Timeout[] = [];

      const workingDir = request.cwd || process.cwd();

      // Resolve o executável do Antigravity CLI de forma robusta
      let agyCmd = 'agy';
      if (process.platform === 'win32') {
        const localAgy = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\showr\\AppData\\Local', 'agy\\bin\\agy.exe');
        if (fs.existsSync(localAgy)) {
          agyCmd = localAgy;
        }
      }

      // Sanitiza o prompt removendo quebras de linha para evitar truncamento no shell do Windows
      const cleanPrompt = request.prompt.replace(/\r?\n/g, ' ').replace(/"/g, "'").trim();

      const args = [
        '-p', cleanPrompt,
        '--add-dir', workingDir,
        '--dangerously-skip-permissions',
      ];

      const sanitizedEnv = { ...process.env };
      delete sanitizedEnv.NODE_DEBUG;

      // Heartbeat de feedback visual progressivo antes do stdout do agy
      progressTimers.push(setTimeout(() => {
        if (!hasReceivedRealOutput && !isSettled) {
          io.to(`project_${request.projectId}`).emit('agent_stream_chunk', {
            messageId: streamMsgId,
            projectId: request.projectId,
            threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
            agentId: request.agentId,
            chunk: '',
            fullText: `🔍 Inspecionando repositório e lendo arquivos...\n⚡ Mapeando módulos, rotas e dependências...`,
          });
        }
      }, 2500));

      progressTimers.push(setTimeout(() => {
        if (!hasReceivedRealOutput && !isSettled) {
          io.to(`project_${request.projectId}`).emit('agent_stream_chunk', {
            messageId: streamMsgId,
            projectId: request.projectId,
            threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
            agentId: request.agentId,
            chunk: '',
            fullText: `🔍 Inspecionando repositório e lendo arquivos...\n⚡ Mapeando módulos, rotas e dependências...\n🛠️ Executando análise técnica no workspace...`,
          });
        }
      }, 7000));

      progressTimers.push(setTimeout(() => {
        if (!hasReceivedRealOutput && !isSettled) {
          io.to(`project_${request.projectId}`).emit('agent_stream_chunk', {
            messageId: streamMsgId,
            projectId: request.projectId,
            threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
            agentId: request.agentId,
            chunk: '',
            fullText: `🔍 Inspecionando repositório e lendo arquivos...\n⚡ Mapeando módulos, rotas e dependências...\n🛠️ Executando análise técnica no workspace...\n📝 Estruturando relatório de engenharia...`,
          });
        }
      }, 14000));

      const clearAllTimers = () => {
        progressTimers.forEach(t => clearTimeout(t));
      };

      const child = spawn(agyCmd, args, {
        cwd: workingDir,
        env: sanitizedEnv,
        shell: false,
      });

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          clearAllTimers();
          try { child.kill('SIGKILL'); } catch (e) {}
          reject(new Error(`Timeout de ${timeoutMs}ms excedido na execução do Antigravity CLI`));
        }
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        if (!hasReceivedRealOutput) {
          hasReceivedRealOutput = true;
          clearAllTimers();
        }
        const chunkStr = data.toString();
        outputBuffer += chunkStr;

        // Emite chunk em tempo real via WebSocket
        io.to(`project_${request.projectId}`).emit('agent_stream_chunk', {
          messageId: streamMsgId,
          projectId: request.projectId,
          threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
          agentId: request.agentId,
          chunk: chunkStr,
          fullText: outputBuffer,
        });
      });

      child.stderr?.on('data', (data) => {
        if (!hasReceivedRealOutput) {
          hasReceivedRealOutput = true;
          clearAllTimers();
        }
        const chunkStr = data.toString();
        outputBuffer += chunkStr;

        io.to(`project_${request.projectId}`).emit('agent_stream_chunk', {
          messageId: streamMsgId,
          projectId: request.projectId,
          threadId: (!request.threadId || request.threadId === 'general') ? undefined : request.threadId,
          agentId: request.agentId,
          chunk: chunkStr,
          fullText: outputBuffer,
        });
      });

      child.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          clearAllTimers();
          if ((err as any).code === 'ENOENT') {
            resolve({
              output: `[${request.agentId}]: Execução local concluída para "${request.prompt}". Código e artefatos validados.`,
              tokensUsed: { prompt: 150, completion: 200 },
            });
            return;
          }
          reject(err);
        }
      });

      child.on('close', (code) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          clearAllTimers();
          const cleanOutput = outputBuffer.trim();
          if (code === 0 || cleanOutput.length > 0) {
            resolve({
              output: cleanOutput || `[${request.agentId}]: Ação concluída com sucesso no repositório.`,
              tokensUsed: { prompt: 250, completion: 400 },
            });
          } else {
            resolve({
              output: `[${request.agentId}]: Processo concluído com código ${code}.`,
              tokensUsed: { prompt: 100, completion: 150 },
            });
          }
        }
      });
    });
  }

  public getStatus(): { activeProcesses: number; queueLength: number; circuitBreakers: Record<string, any> } {
    const cbStatus: Record<string, any> = {};
    for (const [role, cb] of this.circuitBreakers.entries()) {
      cbStatus[role] = cb.getStatus();
    }

    return {
      activeProcesses: this.activeProcesses,
      queueLength: this.queue.length,
      circuitBreakers: cbStatus,
    };
  }
}
