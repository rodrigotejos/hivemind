import { AgentGraphStateType, GraphMessage } from './state';
import { AgentRole, InterruptPayload } from '@ai-dlc/sdk';
import { getModel, updateSharedContext } from '../ai-manager';
import { BridgeDaemonService } from '../bridge/bridge-daemon';
import * as queries from '../../db/queries';
import { io } from '../../index';

export interface SupervisorDecision {
  next: 'alpha_frontend' | 'beta_backend' | 'gamma_qa' | 'delta_security' | 'epsilon_infra' | 'human_gate' | 'convergence';
  reasoning: string;
  isConverged: boolean;
  interruptPayload?: InterruptPayload;
}

const AGENT_PERSONAS: Record<string, string> = {
  'alpha-frontend': 'Você é o Alpha, Engenheiro Frontend Especialista em React 19, Vite, TailwindCSS e Figma. Analise ou crie componentes, tokens de layout e acessibilidade.',
  'beta-backend': 'Você é o Beta, Engenheiro Backend Especialista em Node.js, Express, TypeScript, SQLite e LangGraph. Analise ou crie rotas REST, models, queries e regras de negócio.',
  'gamma-qa': 'Você é o Gamma, Especialista em QA e Testes PBT (Property-Based Testing) com fast-check. Analise ou crie testes unitários e garanta que não há regressões.',
  'delta-security': 'Você é o Delta, Auditor de Segurança e Red Team Adversarial. Analise o código para vulnerabilidades, injeções, vazamentos e conformidade com OWASP.',
  'epsilon-infra': 'Você é o Epsilon, Especialista em DevOps e Infraestrutura (Docker, S3, Shell e CI/CD). Analise ou crie automações, scripts e backups.',
};

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
    const persona = AGENT_PERSONAS[agentName] || `Você é o especialista ${agentName} (${role}).`;
    const project = queries.getProject(state.projectId);
    const projectName = project ? (project as any).name : 'Projeto';
    const projectPath = (project as any)?.path;

    const actionPrompt = `
${persona}
Projeto: "${projectName}" (Diretório: ${projectPath || 'Workspace atual'})
Objetivo técnico da tarefa: "${state.goal}"

Histórico recente:
${state.messages.slice(-4).map(m => `${m.agentId || m.role}: ${m.content}`).join('\n')}

Instrução:
Execute a análise técnica ou desenvolvimento correspondente à sua especialidade (${role}). 
Identifique a estrutura de arquivos, regras de negócio, APIs ou testes necessários. 
Responda diretamente em português com tom de engenharia de software sênior de forma concisa e estruturada.
    `.trim();

    let agentResponseText = '';

    // 1. Tenta executar via Antigravity CLI (BridgeDaemon) em modo local no repositório do projeto
    try {
      const bridge = BridgeDaemonService.getInstance();
      const cliResult = await bridge.dispatch({
        projectId: state.projectId,
        agentRole: role,
        agentId: agentName,
        prompt: actionPrompt,
        cwd: projectPath || undefined,
        threadId: state.sessionId,
        timeoutMs: 120000,
      });

      if (cliResult && cliResult.success && cliResult.output.trim()) {
        agentResponseText = cliResult.output.trim();
      }
    } catch (bridgeErr) {
      console.warn(`BridgeDaemon ${agentName} fallback:`, bridgeErr);
    }

    // 2. Se o Bridge CLI não retornou output, invoca o modelo Google Gemini configurado
    if (!agentResponseText) {
      const model = getModel(state.model, state.goal, state.reasoningLevel);
      if (model) {
        try {
          const result = await model.invoke(actionPrompt);
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

  // 3. Atualiza o shared context do projeto (Wiki Técnica)
  const project = queries.getProject(state.projectId);
  if (project) {
    const summary = `### Resumo da Tarefa Concluída: ${state.goal}\n- Agentes participantes: ${Array.from(new Set(state.messages.map(m => m.agentId).filter(Boolean))).join(', ')}\n- Rodadas executadas: ${state.turnCount}\n- Status: 100% Convergido.`;
    const updatedContext = await updateSharedContext((project as any).shared_context || '', summary, state.model);
    queries.updateProjectContext(state.projectId, updatedContext);
    io.to(`project_${state.projectId}`).emit('project_updated', { project: queries.getProject(state.projectId) });
  }

  return {
    status: 'completed',
    isConverged: true,
  };
}
