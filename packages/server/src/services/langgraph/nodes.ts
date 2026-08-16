import { AgentGraphStateType, GraphMessage } from './state';
import { AgentRole, InterruptPayload } from '@ai-dlc/sdk';
import { analyzeMessagePriority, updateSharedContext } from '../ai-manager';
import * as queries from '../../db/queries';

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
      question: `O limite de ${maxTurns} turnos foi atingido sem convergência automática. Deseja aprovar o estado atual ou autorizar mais rodadas?`,
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
  if (latestMessage) {
    const content = latestMessage.content.toLowerCase();
    if (
      latestMessage.type === 'task_done' ||
      content.includes('task_done') ||
      content.includes('tarefa concluída com sucesso') ||
      content.includes('testes passaram com 100% de sucesso')
    ) {
      return {
        nextStep: 'convergence',
        isConverged: true,
        status: 'completed',
      };
    }

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

  // 3. Roteamento inteligente baseado no objetivo e histórico
  const goalLower = (state.goal || '').toLowerCase();
  const lastMsgLower = latestMessage ? latestMessage.content.toLowerCase() : '';
  const contextText = `${goalLower} ${lastMsgLower}`;

  let nextRole: 'alpha_frontend' | 'beta_backend' | 'gamma_qa' | 'delta_security' | 'epsilon_infra' = 'beta_backend';

  if (contextText.includes('figma') || contextText.includes('react') || contextText.includes('interface') || contextText.includes('frontend') || contextText.includes('css')) {
    nextRole = 'alpha_frontend';
  } else if (contextText.includes('teste') || contextText.includes('qa') || contextText.includes('pbt') || contextText.includes('validação')) {
    nextRole = 'gamma_qa';
  } else if (contextText.includes('segurança') || contextText.includes('vulnerabilidade') || contextText.includes('red team') || contextText.includes('auth')) {
    nextRole = 'delta_security';
  } else if (contextText.includes('docker') || contextText.includes('deploy') || contextText.includes('infra') || contextText.includes('s3') || contextText.includes('backup')) {
    nextRole = 'epsilon_infra';
  }

  return {
    nextStep: nextRole,
    currentAgent: nextRole,
    status: 'running',
  };
}

export function createAgentWorkerNode(role: AgentRole, agentName: string) {
  return async (state: AgentGraphStateType): Promise<Partial<AgentGraphStateType>> => {
    const newMessage: GraphMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      role: 'assistant',
      agentId: agentName,
      agentRole: role,
      content: `[${agentName} (${role})]: Processando objetivo "${state.goal}". Executando ações sob a skill correspondente.`,
      timestamp: new Date().toISOString(),
      type: 'status',
    };

    return {
      messages: [newMessage],
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
  // Atualiza o shared context do projeto se houver
  const project = queries.getProject(state.projectId);
  if (project) {
    const summary = `Tarefa "${state.goal}" concluída pelo ecossistema de agentes após ${state.turnCount} rodadas.`;
    const updatedContext = await updateSharedContext((project as any).shared_context || '', summary);
    queries.updateProjectContext(state.projectId, updatedContext);
  }

  return {
    status: 'completed',
    isConverged: true,
  };
}
