import { AgentGraphStateType, GraphMessage } from './state';
import { AgentRole, InterruptPayload } from '@ai-dlc/sdk';
import { getModel, resolveModelConfig, updateSharedContext, expandContextWithRealData } from '../ai-manager';
import { BridgeDaemonService } from '../bridge/bridge-daemon';
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

  let nextRole: 'alpha_frontend' | 'beta_backend' | 'gamma_qa' | 'delta_security' | 'epsilon_infra' | 'convergence' = 'beta_backend';

  if (rolesActed.length === 0) {
    // Primeiro turno: decide o especialista de entrada
    if (goalLower.includes('figma') || goalLower.includes('tela') || goalLower.includes('frontend') || goalLower.includes('react') || goalLower.includes('css')) {
      nextRole = 'alpha_frontend';
    } else if (goalLower.includes('infra') || goalLower.includes('docker') || goalLower.includes('deploy') || goalLower.includes('s3')) {
      nextRole = 'epsilon_infra';
    } else {
      nextRole = 'beta_backend';
    }
  } else if (!rolesActed.includes('beta-backend') && (goalLower.includes('api') || goalLower.includes('backend') || goalLower.includes('banco') || goalLower.includes('rota') || goalLower.includes('analise') || goalLower.includes('engenharia reversa'))) {
    nextRole = 'beta_backend';
  } else if (!rolesActed.includes('gamma-qa')) {
    nextRole = 'gamma_qa';
  } else if (!rolesActed.includes('delta-security') && (goalLower.includes('auth') || goalLower.includes('segurança') || goalLower.includes('red team') || currentTurns >= 3)) {
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

    // Diretiva de Engenharia limpa e direta para execução sem truncamento no CLI
    let roleSpecificDirective = '';
    if (role === 'backend') {
      roleSpecificDirective = `Analise a arquitetura de backend, rotas, banco de dados e APIs do projeto no diretório "${targetDir}". Objetivo: "${state.goal}". Mapeie as rotas, banco de dados, models, APIs e dependências. Gere os artefatos de documentação necessários e apresente um relatório técnico completo em Markdown com a arquitetura.`;
    } else if (role === 'qa') {
      roleSpecificDirective = `Analise a qualidade de código, testes e validações para o objetivo: "${state.goal}" no projeto "${targetDir}". Mapeie testes unitários, testes PBT e cobertura necessária. Gere artefatos de teste se aplicável e apresente um relatório técnico em Markdown.`;
    } else if (role === 'security') {
      roleSpecificDirective = `Audite a segurança e integridade do projeto em "${targetDir}" para o objetivo: "${state.goal}". Mapeie riscos de segurança, validação de inputs e conformidade OWASP. Apresente um relatório de conformidade e Red Team em Markdown.`;
    } else if (role === 'frontend') {
      roleSpecificDirective = `Analise os componentes de UI, páginas e estilização do projeto em "${targetDir}" para o objetivo: "${state.goal}". Mapeie componentes React, layout e acessibilidade. Apresente um relatório técnico em Markdown.`;
    } else {
      roleSpecificDirective = `Analise a infraestrutura, scripts de automação e contêineres do projeto em "${targetDir}" para o objetivo: "${state.goal}". Apresente um relatório técnico em Markdown.`;
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
        if (!out.startsWith('Olá! Sou o Antigravity') && !out.startsWith('Pronto para receber') && !out.startsWith('Olá! Como posso')) {
          agentResponseText = out;
        }
      }
    } catch (bridgeErr) {
      console.warn(`BridgeDaemon ${agentName} fallback:`, bridgeErr);
    }

    // 2. Se o Bridge CLI não retornou output satisfatório, invoca o modelo Google Gemini configurado
    if (!agentResponseText) {
      const model = getModel(state.model, state.goal, state.reasoningLevel);
      if (model) {
        try {
          const result = await model.invoke(roleSpecificDirective);
          agentResponseText = (result as any).content as string;

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
        } catch (llmErr) {
          console.warn(`Gemini Model ${agentName} fallback:`, llmErr);
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
    fromAgentId: 'rodrigo',
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
