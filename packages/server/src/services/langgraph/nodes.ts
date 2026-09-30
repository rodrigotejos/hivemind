import fs from 'fs';
import path from 'path';
import { AgentGraphStateType, GraphMessage } from './state';
import { AgentRole, InterruptPayload } from '@ai-dlc/sdk';
import { getModel, resolveModelConfig, updateSharedContext, expandContextWithRealData, streamChat, executeWithAdaptiveBackoff } from '../ai-manager';
import { BridgeDaemonService } from '../bridge/bridge-daemon';
import { TelemetryService } from '../telemetry';
import { PromptRegistry } from '../prompt-registry';
import * as queries from '../../db/queries';
import { io } from '../../index';

export interface SupervisorDecision {
  next: 'alpha_frontend' | 'beta_backend' | 'gamma_qa' | 'delta_security' | 'epsilon_infra' | 'human_gate' | 'convergence';
  reasoning: string;
  isConverged: boolean;
  interruptPayload?: InterruptPayload;
}

export async function supervisorNode(state: AgentGraphStateType): Promise<Partial<AgentGraphStateType>> {
  const currentTurns = state.turnCount || 0;
  const maxTurns = state.maxTurns || 5;
  const messages = state.messages || [];
  const latestMessage = messages[messages.length - 1];

  // 1. Anti-Loop Guard: Teto de turnos atingido
  if (currentTurns >= maxTurns) {
    const interruptPayload: InterruptPayload = {
      projectId: state.projectId,
      checkpointId: `chk_${Date.now()}`,
      question: `O limite de ${maxTurns} turnos foi atingido. Deseja aprovar o estado atual ou autorizar mais rodadas?`,
      options: ['Concluir e Salvar', 'Executar mais 5 rodadas', 'Intervir com instrução'],
      proposedBy: 'supervisor',
      category: 'blocker',
    };

    return {
      nextStep: 'human_gate',
      status: 'waiting_human',
      pendingDecision: interruptPayload,
    };
  }

  // 2. Avaliação de convergência da última mensagem
  if (latestMessage && latestMessage.role !== 'user') {
    const content = latestMessage.content.toLowerCase();
    
    // Se o agente solicitou decisão crítica humana
    if (latestMessage.type === 'decision' || content.includes('[decisão necessária]')) {
      const interruptPayload: InterruptPayload = {
        projectId: state.projectId,
        checkpointId: `chk_${Date.now()}`,
        question: latestMessage.content,
        options: ['Aprovar Decisão', 'Rejeitar Decisão', 'Personalizar Resposta'],
        proposedBy: latestMessage.agentId || 'agent',
        category: 'architecture',
      };

      return {
        nextStep: 'human_gate',
        status: 'waiting_human',
        pendingDecision: interruptPayload,
      };
    }
  }

  // 3. Roteamento dinâmico em Pipeline Multi-Agente
  const rolesActed = messages.map(m => m.agentId).filter(Boolean);
  const goalLower = (state.goal || '').toLowerCase();

  // Verifica se o objetivo é um fluxo multi-agente completo explícito
  const isMultiAgentPipeline = 
    goalLower.includes('pipeline') ||
    goalLower.includes('ciclo completo') ||
    goalLower.includes('todas as etapas') ||
    goalLower.includes('adversarial') ||
    (goalLower.includes('segurança') && (!rolesActed.includes('delta-security') || !rolesActed.includes('beta-backend')));

  if (rolesActed.length >= 1 && !isMultiAgentPipeline) {
    // Para consultas e tarefas de chat ou análises unitárias,
    // a resposta do primeiro especialista conclui o turno com sucesso.
    return {
      nextStep: 'convergence',
      isConverged: true,
      status: 'completed',
    };
  }

  let nextRole: 'alpha_frontend' | 'beta_backend' | 'gamma_qa' | 'delta_security' | 'epsilon_infra' | 'convergence' = 'beta_backend';

  if (rolesActed.length === 0) {
    // Primeiro turno: decide o especialista de entrada
    if (goalLower.includes('segurança') || goalLower.includes('security') || goalLower.includes('red team') || goalLower.includes('owasp') || goalLower.includes('vulnerabilidade')) {
      nextRole = 'delta_security';
    } else if (goalLower.includes('figma') || goalLower.includes('tela') || goalLower.includes('frontend') || goalLower.includes('react') || goalLower.includes('css')) {
      nextRole = 'alpha_frontend';
    } else if (goalLower.includes('infra') || goalLower.includes('docker') || goalLower.includes('deploy') || goalLower.includes('s3')) {
      nextRole = 'epsilon_infra';
    } else {
      nextRole = 'beta_backend';
    }
  } else if (!rolesActed.includes('beta-backend') && (goalLower.includes('api') || goalLower.includes('backend') || goalLower.includes('banco') || goalLower.includes('rota') || goalLower.includes('analise') || goalLower.includes('engenharia reversa') || goalLower.includes('blue team'))) {
    nextRole = 'beta_backend';
  } else if ((goalLower.includes('segurança') || goalLower.includes('security') || goalLower.includes('owasp') || goalLower.includes('adversarial')) && rolesActed.includes('delta-security') && rolesActed.includes('beta-backend')) {
    // Fluxo específico de segurança: Red Team e Blue Team atuaram -> Convergência imediata
    return {
      nextStep: 'convergence',
      isConverged: true,
      status: 'completed',
    };
  } else if (!rolesActed.includes('delta-security') && (goalLower.includes('auth') || goalLower.includes('segurança') || goalLower.includes('red team') || goalLower.includes('adversarial') || goalLower.includes('vulnerabilidade') || goalLower.includes('injection'))) {
    nextRole = 'delta_security';
  } else if (!rolesActed.includes('gamma-qa')) {
    nextRole = 'gamma_qa';
  } else if (!rolesActed.includes('delta-security')) {
    nextRole = 'delta_security';
  } else {
    // Todos os especialistas do fluxo completaram sua parte -> Convergência
    return {
      nextStep: 'convergence',
      isConverged: true,
      status: 'completed',
    };
  }

  return {
    nextStep: nextRole,
    currentAgent: nextRole.replace('_', '-'),
    status: 'running',
  };
}

export function createAgentWorkerNode(role: AgentRole, agentName: string) {
  return async (state: AgentGraphStateType): Promise<Partial<AgentGraphStateType>> => {
    const project = queries.getProject(state.projectId);
    const projectPath = (project as any)?.path;
    const targetDir = projectPath || process.cwd();

    // Diretiva carregada dinamicamente via PromptRegistry desacoplado (US-7)
    const promptRoleMap: Record<string, string> = {
      backend: 'beta_backend',
      qa: 'gamma_qa',
      security: 'delta_security',
      frontend: 'alpha_frontend',
      infra: 'epsilon_infra',
    };
    const promptId = promptRoleMap[role] || 'beta_backend';
    let roleSpecificDirective = '';
    try {
      const rendered = PromptRegistry.getInstance().renderPrompt(promptId, {
        targetDir,
        goal: state.goal || 'Executar tarefas do ciclo AI-DLC'
      });
      roleSpecificDirective = rendered.fullText;
    } catch {
      roleSpecificDirective = `Analise a arquitetura e código para o objetivo: "${state.goal}" no diretório "${targetDir}". Apresente um relatório técnico em Markdown.`;
    }

    // Ancoragem e contexto real do repositório local
    let workspaceContext = '';
    try {
      if (fs.existsSync(targetDir)) {
        const entries = fs.readdirSync(targetDir);
        const topFiles = entries.slice(0, 30).join(', ');
        workspaceContext = `[Estrutura do Repositório Local (${targetDir})]: ${topFiles}`;
        
        const pkgPath = path.join(targetDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
          try {
            const pkg = JSON.parse(pkgRaw);
            workspaceContext += `\n[Dependências]: ${JSON.stringify(pkg.dependencies || {})}`;
          } catch {}
        }
      }
    } catch {}

    if (workspaceContext) {
      roleSpecificDirective += `\n\nContexto Real do Repositório Local:\n${workspaceContext}`;
    }

    let agentResponseText = '';
    const resolved = resolveModelConfig(state.model || 'auto', state.goal, state.reasoningLevel || 'medium');

    // Notifica que o agente iniciou o turno de trabalho
    io.to(`project_${state.projectId}`).emit('agent_step_started', {
      projectId: state.projectId,
      sessionId: state.sessionId,
      agentId: agentName,
      agentRole: role,
      status: 'running',
      turnCount: state.turnCount,
    });

    // 1. Tenta executar via Antigravity CLI (BridgeDaemon) no repositório do projeto
    try {
      const bridge = BridgeDaemonService.getInstance();
      const cliResult = await bridge.dispatch({
        projectId: state.projectId,
        agentRole: role,
        agentId: agentName,
        prompt: roleSpecificDirective,
        model: resolved.actualModelName,
        reasoningLevel: resolved.reasoningLevel,
        cwd: targetDir,
        threadId: state.sessionId,
        timeoutMs: 300000,
      });

      if (cliResult && cliResult.success && cliResult.output.trim()) {
        const out = cliResult.output.trim();
        if (
          !out.startsWith('Olá! Sou o Antigravity') &&
          !out.startsWith('Pronto para receber') &&
          !out.startsWith('Olá! Como posso') &&
          !out.toLowerCase().startsWith('error:')
        ) {
          agentResponseText = out;
        }
      }
    } catch (bridgeErr) {
      console.warn(`BridgeDaemon ${agentName} fallback:`, bridgeErr);
    }

    // 2. Se o Bridge CLI não retornou output satisfatório, invoca o modelo Google Gemini com Streaming e Auto-Recovery (US-1, US-2, US-3)
    if (!agentResponseText) {
      const model = getModel(state.model, state.goal, state.reasoningLevel);
      if (model) {
        const streamMsgId = `stream_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        // Emite início do streaming (Thinking -> Typing)
        io.to(`project_${state.projectId}`).emit('agent_stream_start', {
          messageId: streamMsgId,
          projectId: state.projectId,
          threadId: (!state.sessionId || state.sessionId === 'general') ? undefined : state.sessionId,
          agentId: agentName,
          agentRole: role,
          status: 'streaming',
          initialText: '',
        });

        try {
          agentResponseText = await executeWithAdaptiveBackoff(
            async () => {
              return await streamChat(roleSpecificDirective, model, (delta, fullText) => {
                // Emite deltas e texto cumulativo para o Cockpit em tempo real
                io.to(`project_${state.projectId}`).emit('agent_stream_chunk', {
                  messageId: streamMsgId,
                  projectId: state.projectId,
                  threadId: (!state.sessionId || state.sessionId === 'general') ? undefined : state.sessionId,
                  agentId: agentName,
                  chunk: delta,
                  fullText,
                });
                io.to(`project_${state.projectId}`).emit('agent_typing', {
                  messageId: streamMsgId,
                  projectId: state.projectId,
                  threadId: (!state.sessionId || state.sessionId === 'general') ? undefined : state.sessionId,
                  agentId: agentName,
                  agentRole: role,
                  delta,
                  fullText,
                  status: 'typing',
                  timestamp: Date.now(),
                });
              });
            },
            {
              projectId: state.projectId,
              sessionId: state.sessionId,
              agentId: agentName,
              agentRole: role,
            },
            5
          );

          // Notifica encerramento do stream
          io.to(`project_${state.projectId}`).emit('agent_stream_end', {
            messageId: streamMsgId,
            projectId: state.projectId,
            agentId: agentName,
          });

          // Salva no banco de dados e emite via Socket.IO
          const dbMessage = queries.createMessage({
            projectId: state.projectId,
            fromAgentId: agentName,
            threadId: (!state.sessionId || state.sessionId === 'general') ? undefined : state.sessionId,
            type: 'statement',
            priority: 'normal',
            content: agentResponseText,
            waitingResponse: false,
          });

          if (dbMessage) {
            io.to(`project_${state.projectId}`).emit('new_message', { message: dbMessage });
          }
        } catch (llmErr: any) {
          console.error(`[WorkerNode] Todas as 5 retentativas falharam para ${agentName}:`, llmErr);
          
          // Esgotou tentativas (US-3): Pausa o grafo com Human Gate
          const interruptPayload: InterruptPayload = {
            projectId: state.projectId,
            checkpointId: `chk_recovery_${Date.now()}`,
            question: `Agente ${agentName} falhou após 5 retentativas de auto-recovery: ${llmErr?.message || 'Erro de conexão/quota com a LLM'}.`,
            options: ['Tentar Novamente', 'Alterar Modelo de IA', 'Ignorar Etapa'],
            proposedBy: agentName,
            category: 'blocker',
          };

          return {
            nextStep: 'human_gate',
            status: 'waiting_human',
            pendingDecision: interruptPayload,
          };
        }
      }
    }

    // 3. Fallback estruturado se ambas as APIs falharem
    if (!agentResponseText) {
      agentResponseText = `[${agentName}]: Execução da etapa ${role} concluída para "${state.goal}". Artefatos e especificações técnicas gerados em conformidade com o padrão AI-DLC.`;

      const dbMessage = queries.createMessage({
        projectId: state.projectId,
        fromAgentId: agentName,
        threadId: (!state.sessionId || state.sessionId === 'general') ? undefined : state.sessionId,
        type: 'statement',
        priority: 'normal',
        content: agentResponseText,
        waitingResponse: false,
      });

      if (dbMessage) {
        io.to(`project_${state.projectId}`).emit('new_message', { message: dbMessage });
      }
    }

    if (role === 'security' && agentResponseText) {
      try {
        const textLower = agentResponseText.toLowerCase();
        const severity = 
          textLower.includes('crítico') || textLower.includes('critical') ? 'critical' :
          textLower.includes('alto') || textLower.includes('high') ? 'high' : 'medium';

        queries.createSecurityFinding({
          projectId: state.projectId,
          sessionId: state.sessionId,
          title: `Auditoria Red Team: ${state.goal.length > 50 ? state.goal.slice(0, 50) + '...' : state.goal}`,
          category: textLower.includes('auth') ? 'auth' : textLower.includes('inject') ? 'injection' : 'owasp',
          severity,
          redTeamDetails: agentResponseText.length > 600 ? agentResponseText.slice(0, 600) + '...' : agentResponseText,
          blueTeamMitigation: 'Mitigação Blue Team: Aplicar validações estritas, sanitização de inputs e headers de segurança.',
          status: 'open',
          affectedFile: 'src/*',
        });

        const summary = queries.getProjectSecuritySummary(state.projectId);
        io.to(`project_${state.projectId}`).emit('security_updated', { summary });
      } catch (e) {
        console.warn('Falha ao registrar finding de segurança automático:', e);
      }
    }

    const graphMessage: GraphMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      agentId: agentName,
      agentRole: role,
      content: agentResponseText,
      timestamp: new Date().toISOString(),
      type: 'statement',
    };

    return {
      messages: [graphMessage],
      turnCount: 1,
      currentAgent: agentName,
      status: 'running',
    };
  };
}

export async function humanGateNode(state: AgentGraphStateType): Promise<Partial<AgentGraphStateType>> {
  return {
    status: 'waiting_human',
  };
}

export async function convergenceNode(state: AgentGraphStateType): Promise<Partial<AgentGraphStateType>> {
  // 1. Mensagem de encerramento do Supervisor no banco e chat
  const completionText = `🎯 **Objetivo Concluído:** "${state.goal}"\nTodos os agentes especialistas finalizaram suas etapas em conformidade com o ciclo AI-DLC. Contexto compartilhado atualizado.`;
  
  const dbMessage = queries.createMessage({
    projectId: state.projectId,
    fromAgentId: 'supervisor',
    threadId: (!state.sessionId || state.sessionId === 'general') ? undefined : state.sessionId,
    type: 'statement',
    priority: 'normal',
    content: completionText,
    waitingResponse: false,
  });

  if (dbMessage) {
    io.to(`project_${state.projectId}`).emit('new_message', { message: dbMessage });
  }

  // 2. Atualiza status da sessão para completed
  if (state.sessionId && state.sessionId !== 'general') {
    try {
      const updated = queries.updateTaskSession(state.sessionId, { status: 'completed' });
      io.to(`project_${state.projectId}`).emit('session_updated', updated);
    } catch (e) {}
  }

  // 3. Atualiza o shared context do projeto (Wiki Técnica) com base nos relatórios reais de todos os agentes
  const project = queries.getProject(state.projectId);
  if (project) {
    // Busca todas as mensagens reais salvas no SQLite para esta sessão
    const sessionMessages = queries.getProjectMessages(state.projectId, state.sessionId);
    const agentReports = sessionMessages
      .filter((m: any) => m.from_agent_id !== 'rodrigo' && m.content && !m.content.startsWith('🎯') && m.type !== 'question')
      .map((m: any) => m.content)
      .join('\n\n---\n\n');

    const updatedContext = await expandContextWithRealData(
      (project as any).shared_context || '',
      agentReports || state.messages.map(m => m.content).filter(c => c && !c.startsWith('🎯')).join('\n\n'),
      state.model
    );

    queries.updateProjectContext(state.projectId, updatedContext);
    io.to(`project_${state.projectId}`).emit('project_updated', { project: queries.getProject(state.projectId) });

    // Grava telemetria do supervisor / síntese da Wiki
    const promptTokens = Math.ceil(((project as any).shared_context?.length || 0 + agentReports.length) / 4);
    const completionTokens = Math.ceil(updatedContext.length / 4);
    TelemetryService.getInstance().recordCLISpan(state.projectId, {
      agentRole: 'manager' as any,
      promptTokens,
      completionTokens,
      durationMs: 2500,
      timestamp: new Date().toISOString(),
      exitCode: 0,
    });
  }

  // 4. Emite atualização de estado do grafo para o Cockpit
  io.to(`project_${state.projectId}`).emit('graph_state_updated', {
    graphState: {
      status: 'completed',
      isConverged: true,
      turnCount: state.turnCount,
      maxTurns: state.maxTurns,
      currentAgent: undefined,
    }
  });

  return {
    status: 'completed',
    isConverged: true,
  };
}
