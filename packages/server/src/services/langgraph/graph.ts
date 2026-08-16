import { StateGraph, END, START, MemorySaver } from '@langchain/langgraph';
import { AgentGraphAnnotation, AgentGraphStateType } from './state';
import { 
  supervisorNode, 
  createAgentWorkerNode, 
  humanGateNode, 
  convergenceNode 
} from './nodes';

export function buildMultiAgentGraph() {
  const workflow = new StateGraph(AgentGraphAnnotation)
    // 1. Registra os nós
    .addNode('supervisor', supervisorNode)
    .addNode('alpha_frontend', createAgentWorkerNode('frontend', 'alpha-frontend'))
    .addNode('beta_backend', createAgentWorkerNode('backend', 'beta-backend'))
    .addNode('gamma_qa', createAgentWorkerNode('qa', 'gamma-qa'))
    .addNode('delta_security', createAgentWorkerNode('security', 'delta-security'))
    .addNode('epsilon_infra', createAgentWorkerNode('infra', 'epsilon-infra'))
    .addNode('human_gate', humanGateNode)
    .addNode('convergence', convergenceNode)

    // 2. Arestas de Entrada
    .addEdge(START, 'supervisor')

    // 3. Arestas Condicionais do Supervisor
    .addConditionalEdges('supervisor', (state: AgentGraphStateType) => {
      if (state.status === 'completed' || state.nextStep === 'convergence') {
        return 'convergence';
      }
      if (state.status === 'waiting_human' || state.nextStep === 'human_gate') {
        return 'human_gate';
      }
      return state.nextStep || 'beta_backend';
    })

    // 4. Retorno dos Especialistas para o Supervisor (Ciclo Autônomo)
    .addEdge('alpha_frontend', 'supervisor')
    .addEdge('beta_backend', 'supervisor')
    .addEdge('gamma_qa', 'supervisor')
    .addEdge('delta_security', 'supervisor')
    .addEdge('epsilon_infra', 'supervisor')

    // 5. Finalização
    .addEdge('convergence', END)
    .addEdge('human_gate', END);

  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer });
}

export class LangGraphOrchestrator {
  private static instance: LangGraphOrchestrator;
  private appGraph: ReturnType<typeof buildMultiAgentGraph>;
  private activeStates = new Map<string, AgentGraphStateType>();

  private constructor() {
    this.appGraph = buildMultiAgentGraph();
  }

  public static getInstance(): LangGraphOrchestrator {
    if (!LangGraphOrchestrator.instance) {
      LangGraphOrchestrator.instance = new LangGraphOrchestrator();
    }
    return LangGraphOrchestrator.instance;
  }

  public async startTask(projectId: string, taskId: string, goal: string, maxTurns: number = 5): Promise<AgentGraphStateType> {
    const threadConfig = { configurable: { thread_id: `proj_${projectId}_task_${taskId}` } };
    
    const initialState: Partial<AgentGraphStateType> = {
      projectId,
      taskId,
      goal,
      messages: [{
        id: `init_${Date.now()}`,
        role: 'user',
        content: goal,
        timestamp: new Date().toISOString(),
      }],
      turnCount: 0,
      maxTurns,
      isConverged: false,
      status: 'running',
    };

    const finalState = await this.appGraph.invoke(initialState, threadConfig);
    this.activeStates.set(projectId, finalState as AgentGraphStateType);
    return finalState as AgentGraphStateType;
  }

  public async resumeTask(projectId: string, checkpointId: string, humanDecision: string): Promise<AgentGraphStateType> {
    const currentState = this.activeStates.get(projectId);
    const taskId = currentState ? currentState.taskId : 'resumed';
    const threadConfig = { configurable: { thread_id: `proj_${projectId}_task_${taskId}` } };

    const updatePayload: Partial<AgentGraphStateType> = {
      status: 'running',
      pendingDecision: undefined,
      messages: [{
        id: `decision_${Date.now()}`,
        role: 'user',
        content: `[Decisão do Engenheiro Humano]: ${humanDecision}`,
        timestamp: new Date().toISOString(),
      }],
    };

    const finalState = await this.appGraph.invoke(updatePayload, threadConfig);
    this.activeStates.set(projectId, finalState as AgentGraphStateType);
    return finalState as AgentGraphStateType;
  }

  public getState(projectId: string): AgentGraphStateType | undefined {
    return this.activeStates.get(projectId);
  }
}
