import { Annotation } from '@langchain/langgraph';
import { AgentRole, Message, InterruptPayload } from '@ai-dlc/sdk';

export interface GraphMessage {
  id: string;
  role: string;
  agentId?: string;
  agentRole?: AgentRole;
  content: string;
  timestamp: string;
  type?: string;
}

export const AgentGraphAnnotation = Annotation.Root({
  projectId: Annotation<string>(),
  taskId: Annotation<string>(),
  goal: Annotation<string>(),
  messages: Annotation<GraphMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  currentAgent: Annotation<string | undefined>(),
  nextStep: Annotation<string>(),
  turnCount: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),
  maxTurns: Annotation<number>({
    reducer: (current, update) => update ?? current,
    default: () => 5,
  }),
  isConverged: Annotation<boolean>({
    reducer: (current, update) => update ?? current,
    default: () => false,
  }),
  status: Annotation<'idle' | 'running' | 'paused' | 'waiting_human' | 'completed' | 'error'>({
    reducer: (current, update) => update ?? current,
    default: () => 'idle',
  }),
  pendingDecision: Annotation<InterruptPayload | undefined>({
    reducer: (current, update) => update ?? current,
  }),
});

export type AgentGraphStateType = typeof AgentGraphAnnotation.State;
